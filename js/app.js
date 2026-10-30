/* Traveler's Friend — planejador (Explorar · Roteiro · Custos). Módulo ES; usa Leaflet (global L). */
import {
  CITY_OPTIONS, CATEGORIES, AGE_OPTIONS, MONTHS, WEEKDAYS, WEEKDAYS_FULL,
  STORAGE_KEY, MAX_DAYS, WALK_LIMIT_KM, MODES, MEALS
} from "./core/constantes.js";
import {
  $, esc, money, moneyExact, toMin, toHHMM, fmtDur, parseDur, parseISO, toISO, fmtDay, fmtShort,
  dateRange, ageMin, bracketFor, ciIcon, ageBadge, placeLabel, distanceKm, walkMinutes
} from "./core/util.js";
import { rota, ir, iniciar as iniciarRotas } from "./core/router.js";

(function () {
  "use strict";

  // ---------- Deslocamento ----------
  // Opções possíveis entre dois lugares, com tempo (min) e custo total do grupo.
  // Estimativas por distância em linha reta; metrô/trem só quando os dois lados têm estação.
  function transportOptions(a, b) {
    const km = distanceKm(a, b);
    const far = km > 15; // acima disso o trajeto usa mais rodovia / trem e a velocidade média sobe
    const fare = city().tarifaTransporte * state.people;
    const hasMetro = (p) => /Metrô/.test(p.comoChegar || "");
    const hasTrain = (p) => /CPTM|Trem Expresso/.test(p.comoChegar || "");
    const noPublic = /Não há transporte público direto/i.test((a.comoChegar || "") + (b.comoChegar || ""));
    const opts = [];
    if (km <= 4) opts.push({ id: "pe", min: walkMinutes(km), cost: 0 });
    if (km >= 0.5 && km <= 12) opts.push({ id: "bike", min: Math.round(3 + km * 1.25 / 13 * 60), cost: 0, note: "bike própria ou compartilhada (aluguel à parte)" });
    if (km > 1 && !noPublic) {
      if (hasMetro(a) && hasMetro(b)) opts.push({ id: "metro", min: Math.round(10 + km * 1.3 / 30 * 60), cost: fare });
      if ((hasTrain(a) || hasTrain(b)) && (hasMetro(a) || hasTrain(a)) && (hasMetro(b) || hasTrain(b)))
        opts.push({ id: "trem", min: Math.round(14 + km * 1.3 / 35 * 60), cost: fare * (far ? 1.5 : 1) });
      opts.push({ id: "onibus", min: Math.round((far ? 20 : 8) + km * 1.35 / (far ? 30 : 16) * 60), cost: fare * (far ? 2 : 1) });
    }
    if (km > 0.8 || !opts.length) {
      opts.push({ id: "carro", min: Math.round(5 + km * 1.4 / (far ? 45 : 20) * 60), cost: Math.round((6 + 2.4 * km * 1.4) * Math.ceil(state.people / 4)) });
    }
    return opts.map((o) => ({ ...o, km }));
  }

  // ---------- Hospedagens ----------
  // A viagem pode ter várias hospedagens (com endereço opcional e valor por noite).
  // Cada dia termina na hospedagem daquele dia (a padrão ou a escolhida) e começa na da noite anterior,
  // então no dia da troca o roteiro sai de uma e chega na outra.
  const stayById = (id) => (state.stays || []).find((s) => s.id === id) || null;
  function stayFor(iso) {
    const d = state.days[iso];
    return stayById(d && d.stayId) || stayById(state.stayDefault) || null;
  }
  function prevStayFor(iso) {
    const days = tripDays(), i = days.indexOf(iso);
    return i > 0 ? stayFor(days[i - 1]) : stayFor(iso);
  }
  const stayPrice = (s) => s && s.price != null ? s.price : state.hotel;

  // Hospedagem vista como um "lugar" para calcular os trechos. Como não temos as estações,
  // inferimos metrô/trem pelos lugares cadastrados a até ~1 km dela.
  const stayCache = {};
  function stayPlace(s) {
    if (!s || s.lat == null) return null;
    const key = s.id + ":" + s.lat + "," + s.lng;
    if (!stayCache[key]) {
      const near = city().lugares.filter((p) => !p.municipio && distanceKm(s, p) <= 1);
      const how = [near.some((p) => /Metrô/.test(p.comoChegar)) ? "Metrô" : "", near.some((p) => /CPTM/.test(p.comoChegar)) ? "CPTM" : ""].join(" ");
      stayCache[key] = { id: "__stay", nome: s.label, lat: s.lat, lng: s.lng, comoChegar: how };
    }
    return stayCache[key];
  }

  // Escolha automática conforme a preferência; "mode" força uma opção específica do trecho.
  function legInfo(a, b, mode) {
    const opts = transportOptions(a, b);
    const km = opts[0].km;
    const by = (id) => opts.find((o) => o.id === id);
    const fastest = (ids) => opts.filter((o) => ids.includes(o.id)).sort((x, y) => x.min - y.min)[0];
    let chosen = mode && by(mode);
    if (!chosen) {
      if (km <= WALK_LIMIT_KM && by("pe")) chosen = by("pe");
      else if (state.transport === "app") chosen = by("carro");
      else if (state.transport === "ativo" && km <= 5) chosen = by("bike") || by("pe");
      chosen = chosen || fastest(["metro", "trem", "onibus"]) || by("carro") || opts[0];
    }
    return { ...chosen, km, options: opts, mode: MODES[chosen.id].label, icon: MODES[chosen.id].icon, forced: !!(mode && by(mode)) };
  }

  // ---------- Estado ----------
  function nextFriday() {
    const d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    return d;
  }
  function defaultState() {
    const s = nextFriday(), e = new Date(s); e.setDate(e.getDate() + 2);
    return {
      city: "sp", start: toISO(s), end: toISO(e), people: 2, youngest: 18,
      hotel: 250, food: 120, transport: "publico",
      days: {}, activeDay: toISO(s)
    };
  }

  // Completa uma viagem salva com os campos que versões antigas do site não tinham.
  function normalizeState(s) {
    s = Object.assign(defaultState(), s);
    // Horários padrão das refeições.
    s.meals = Object.assign(defaultMeals(), s.meals || {});
    s.stays = s.stays || [];
    if (s.stay) {
      s.stays.push({ id: "s1", ...s.stay, price: s.hotel });
      s.stayDefault = s.stayDefault || "s1";
      delete s.stay;
    }
    // A pessoa digita a idade real da pessoa mais nova; "youngest" guarda a faixa da ClassInd correspondente.
    if (s.youngestAge == null) s.youngestAge = s.youngest ?? 18;
    s.youngest = bracketFor(s.youngestAge);
    return s;
  }

  let state = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) state = Object.assign(state, saved);
  } catch (_) { /* storage indisponível */ }
  // Viagem do navegador salva no passado → volta para as datas padrão.
  // (Viagens da conta não passam por aqui: uma viagem antiga pode guardar fotos e lembranças.)
  if (state.start < toISO(new Date())) { const d = defaultState(); state.start = d.start; state.end = d.end; state.activeDay = d.activeDay; }
  state = normalizeState(state);

  const ui = { where: "", cats: new Set(), q: "", maxPrice: 1200, onlyFree: false, onlyAge: true, onlyDates: false, focusUid: null, view: "explore" };

  // Quem quiser saber de cada alteração (ex.: js/conta.js, que salva a viagem na conta).
  const saveHooks = [];
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignora */ }
    saveHooks.forEach((fn) => { try { fn(state); } catch (err) { console.warn(err); } });
  }

  const city = () => window.TF_CITIES[state.city];
  const placeById = (id) => city().lugares.find((p) => p.id === id);
  const tripDays = () => dateRange(state.start, state.end);
  function dayData(iso) {
    if (!state.days[iso]) state.days[iso] = { start: "09:00", items: [] };
    return state.days[iso];
  }
  const allPlannedIds = () => new Set(tripDays().flatMap((d) => (state.days[d]?.items || []).map((i) => i.id)));
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---------- Regras de horário ----------
  function isClosed(place, iso) {
    return (place.horario?.fechado || []).includes(parseISO(iso).getDay());
  }
  // Horário de fechamento em minutos; se fecha antes de abrir, vira a madrugada (ex.: 23:00–06:00).
  function closeMin(place) {
    const a = toMin(place.horario.abre), f = toMin(place.horario.fecha);
    if (a === 0 && f >= 23 * 60 + 59) return Infinity; // aberto 24h
    return f <= a ? f + 24 * 60 : f;
  }
  const isNight = (p) => !!p.horario && p.horario.fecha !== "23:59" && (toMin(p.horario.abre) >= 17 * 60 || closeMin(p) > 24 * 60);
  // Eventos: "datas" (dias avulsos) ou "periodo" { de, ate } (exposições e temporadas).
  const hasDates = (p) => !!(p.datas || p.periodo);
  function eventOn(p, iso) {
    if (p.datas) return p.datas.includes(iso);
    if (p.periodo) return (!p.periodo.de || iso >= p.periodo.de) && (!p.periodo.ate || iso <= p.periodo.ate);
    return false;
  }
  function happensOn(place, iso) {
    return !hasDates(place) || eventOn(place, iso);
  }
  function isPast(p) {
    const today = toISO(new Date());
    if (p.datas) return p.datas.every((d) => d < today);
    if (p.periodo && p.periodo.ate) return p.periodo.ate < today;
    return false;
  }
  function datesLabel(p, full = false) {
    if (p.periodo) {
      const { de, ate } = p.periodo;
      if (de && ate) return fmtShort(de) + " → " + fmtShort(ate) + (full ? "/" + ate.slice(0, 4) : "");
      return ate ? "até " + fmtShort(ate) : "desde " + fmtShort(de);
    }
    if (full || p.datas.length <= 3) return p.datas.map(fmtShort).join(", ");
    return fmtShort(p.datas[0]) + "–" + fmtShort(p.datas[p.datas.length - 1]);
  }
  // Lugares e eventos ainda válidos (eventos que já passaram somem).
  const activePlaces = () => city().lugares.filter((p) => !isPast(p));
  function priceOn(place, iso) {
    return (place.gratisDias || []).includes(parseISO(iso).getDay()) ? 0 : place.preco;
  }

  // ---------- Refeições ----------
  function defaultMeals() {
    return {
      cafe: { on: true, at: "08:00", dur: 30 },
      almoco: { on: true, at: "12:30", dur: 60 },
      jantar: { on: true, at: "19:30", dur: 75 }
    };
  }
  const servesFood = (p) => p.categoria === "gastronomia" || !!p.comida;

  // Refeições ativas de um dia: o padrão da viagem com os ajustes feitos só nesse dia.
  function mealsFor(iso) {
    const day = dayData(iso);
    return Object.keys(MEALS).map((key) => {
      const base = state.meals[key], own = (day.meals || {})[key] || {};
      return { key, ...MEALS[key], at: toMin(own.at || base.at), dur: own.dur ?? base.dur, on: base.on && !own.off, custom: own.dur != null, customAt: !!own.at };
    }).filter((m) => m.on).sort((a, b) => a.at - b.at);
  }

  // Calcula horários, deslocamentos, refeições e avisos de um dia.
  // 1ª passada sem refeições: descobre quais refeições caem num lugar que já serve comida (essas saem).
  // 2ª passada: encaixa as outras, ajustando a refeição ou o lugar, o que mexer menos no dia.
  function schedule(iso) {
    const day = dayData(iso);
    const meals = mealsFor(iso);
    const base = scheduleCore(iso, []);
    const covered = {};
    meals.forEach((m) => {
      // O lugar precisa estar acontecendo perto da hora da refeição (começa até 1h depois e ainda não acabou).
      const r = base.rows.find((r) => servesFood(r.place) && r.start <= m.at + 60 && r.end >= m.at + 15);
      if (r) covered[m.key] = r.item.uid;
    });
    const res = scheduleCore(iso, day.items.length ? meals.filter((m) => !covered[m.key]) : []);
    res.rows.forEach((r) => { r.meals = meals.filter((m) => covered[m.key] === r.item.uid); });
    res.ret = res.ret || null;
    res.off = Object.keys(MEALS).filter((k) => state.meals[k].on && (day.meals || {})[k]?.off);
    return res;
  }

  function scheduleCore(iso, meals) {
    const day = dayData(iso);
    const dayStart = toMin(day.start || "09:00");
    let t = dayStart;
    const rows = [], entries = [];
    const pend = meals.map((m) => ({ ...m }));
    const placeMeal = (m, start, note = "") => {
      const e = { kind: "meal", m, start, end: start + m.dur, note, warnings: [] };
      if (m.dur < m.min) e.warnings.push(`${fmtDur(m.dur)} talvez seja pouco tempo para ${m.label.toLowerCase()}.`);
      entries.push(e);
      pend.splice(pend.indexOf(m), 1);
      return e.end;
    };
    const delayNote = (m, start) => start - m.at > 15 ? "adiado(a) — o padrão é " + toHHMM(m.at)
      : m.at - start > 15 ? "adiantado(a) — o padrão é " + toHHMM(m.at) : "";
    const missMeal = (m, why) => { entries.push({ kind: "missed", m, why }); pend.splice(pend.indexOf(m), 1); };

    // Refeição que termina antes da hora de sair (ex.: café às 8h e dia começando às 9h) fica antes de tudo.
    pend.filter((m) => m.at + m.dur <= dayStart && dayStart - m.at <= 3 * 60).forEach((m) => placeMeal(m, m.at));
    entries.sort((a, b) => a.start - b.start);

    // Com hospedagem definida, o dia sai dela e volta para ela.
    const startStay = stayPlace(prevStayFor(iso)), endStay = stayPlace(stayFor(iso));
    let prev = startStay;
    for (const item of day.items) {
      const p = placeById(item.id);
      if (!p) continue;
      // Horário de início: o escolhido pela pessoa vale mais que o oficial do evento.
      const fixed = item.at ? toMin(item.at) : p.inicio ? toMin(p.inicio) : null;
      const opens = fixed == null && p.horario ? toMin(p.horario.abre) : null;
      let adjusted = "";
      // Repete até não haver mais refeição para encaixar antes deste lugar.
      for (let guard = 0; guard < 4 && pend.length; guard++) {
        const m = pend[0];
        if (t > m.janela[1] && t >= m.at) { missMeal(m, "passou do horário"); continue; }
        // Já está na hora de comer.
        if (t >= m.at - 10) { t = placeMeal(m, t, delayNote(m, t)); continue; }
        const legMin = prev ? legInfo(prev, p, item.mode).min : 0;
        const arrive = t + legMin;
        const s0 = fixed != null ? Math.max(arrive, fixed) : opens != null ? Math.max(arrive, opens) : arrive;
        const e0 = s0 + item.dur;
        if (m.at >= e0 - 20) break; // a refeição só chega depois deste lugar
        // Cabe na espera antes do lugar abrir/começar: encaixa sem mexer em nada
        // (adiantando a refeição o necessário para chegar a tempo).
        const inGap = Math.max(t, Math.min(m.at, s0 - legMin - m.dur));
        if (inGap + m.dur + legMin <= s0) { t = placeMeal(m, inGap, delayNote(m, inGap)); continue; }
        const afterOk = e0 <= m.janela[1];
        if (fixed == null) {
          // Lugar flexível: come antes (adianta a refeição e empurra o lugar) ou depois (adia a refeição).
          const advance = Math.max(0, m.at - t), delay = e0 - m.at;
          if (!afterOk || advance <= delay) {
            t = placeMeal(m, t, delayNote(m, t));
            adjusted = "Horário ajustado para depois do " + m.label.toLowerCase() + ".";
            continue;
          }
          break; // vai para depois do lugar
        }
        // Horário fixo (show, jogo...): a refeição fica para depois, se ainda der.
        if (!afterOk) missMeal(m, "não cabe antes de " + p.nome + " (começa às " + toHHMM(fixed) + ")");
        break;
      }
      const warnings = [];
      let leg = null;
      if (prev) { leg = legInfo(prev, p, item.mode); t += leg.min; }
      let wait = 0;
      if (fixed != null) {
        if (t < fixed) { wait = fixed - t; t = fixed; }
        else if (t > fixed + 5) warnings.push("Começa às " + toHHMM(fixed) + " — você chegaria atrasado(a).");
      } else if (opens != null && t < opens) {
        wait = opens - t; t = opens;
      }
      const startT = t, endT = t + item.dur;
      if (!happensOn(p, iso)) warnings.push("Não acontece neste dia. Datas: " + datesLabel(p, true) + ".");
      if (isClosed(p, iso)) warnings.push("Fechado às " + WEEKDAYS_FULL[parseISO(iso).getDay()] + "s.");
      if (p.horario && !p.inicio && endT > closeMin(p)) warnings.push("Fecha às " + p.horario.fecha + ".");
      if (state.youngest < ageMin(p.idade)) warnings.push("Classificação " + p.idade + " — acima da idade da pessoa mais nova do grupo.");
      if (item.at && p.inicio && item.at !== p.inicio) warnings.push("O horário oficial de início é " + p.inicio + ".");
      if (item.at && p.horario && !p.inicio && fixed < toMin(p.horario.abre)) warnings.push("Abre às " + p.horario.abre + ".");
      const row = { item, place: p, leg, fromStay: !!startStay && prev === startStay ? startStay.nome : "", wait, start: startT, end: endT, price: priceOn(p, iso), warnings, adjusted };
      rows.push(row);
      entries.push({ kind: "stop", row, start: startT });
      t = endT;
      prev = p;
    }
    // Refeições que sobraram vão para o fim do dia, no horário padrão ou logo depois do último lugar.
    pend.slice().forEach((m) => {
      const start = Math.max(t, m.at);
      if (start > m.janela[1] && m.at < 24 * 60) missMeal(m, "o dia termina tarde demais");
      else t = placeMeal(m, start, delayNote(m, start));
    });
    // Volta para a hospedagem no fim do dia.
    let ret = null;
    if (endStay && rows.length) {
      ret = legInfo(rows[rows.length - 1].place, endStay, day.returnMode);
      entries.push({ kind: "return", leg: ret, stayName: endStay.nome, change: !!startStay && startStay !== endStay, start: t, end: t + ret.min });
      t += ret.min;
    }
    return { rows, entries, ret, end: t };
  }

  // ---------- Ações ----------
  function addToDay(id, iso = state.activeDay) {
    const p = placeById(id);
    dayData(iso).items.push({ uid: uid(), id, dur: p.duracao });
    save();
    toast(p.nome + " → " + fmtDay(iso));
    renderAll();
  }
  function removeItem(u) {
    const day = dayData(state.activeDay);
    day.items = day.items.filter((i) => i.uid !== u);
    if (ui.focusUid === u) ui.focusUid = null;
    save(); renderAll();
  }
  function moveItem(u, dir) {
    const items = dayData(state.activeDay).items;
    const i = items.findIndex((x) => x.uid === u), j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    save(); renderAll();
  }
  function setDuration(u, min) {
    const item = dayData(state.activeDay).items.find((x) => x.uid === u);
    if (!item) return;
    item.dur = Math.max(5, Math.min(24 * 60, Math.round(min)));
    save(); renderAll();
  }

  // ---------- Combos ----------
  // O combo é só uma sugestão: pode ser adicionado em qualquer dia.
  const combosFor = (id) => (city().combos || []).map((c, idx) => ({ ...c, idx })).filter((c) => c.ids.includes(id));
  const bestDays = (c) => c.quando.length ? "melhor " + c.quando.map((d) => (d === 0 || d === 6 ? "aos " : "às ") + WEEKDAYS_FULL[d] + "s").join(" ou ") : "";
  function addCombo(idx, iso = state.activeDay) {
    const c = city().combos[idx];
    const day = dayData(iso);
    const missing = c.ids.filter((id) => !day.items.some((i) => i.id === id));
    missing.forEach((id) => day.items.push({ uid: uid(), id, dur: placeById(id).duracao }));
    save();
    toast(missing.length ? "Combo “" + c.titulo + "” → " + fmtDay(iso) : "O combo já está nesse dia");
    renderAll();
  }

  // ---------- Filtros ----------
  function filtered() {
    const q = ui.q.trim().toLowerCase();
    const days = tripDays();
    return activePlaces().filter((p) => {
      if (ui.where === "capital" && p.municipio) return false;
      if (ui.where === "grande" && !p.municipio) return false;
      if (ui.cats.size && !ui.cats.has(p.categoria)) return false;
      if (q && !(p.nome + " " + p.bairro + " " + (p.municipio || "") + " " + p.descricao + " " + CATEGORIES[p.categoria]).toLowerCase().includes(q)) return false;
      if (p.preco > ui.maxPrice) return false;
      if (ui.onlyNight && !isNight(p)) return false;
      if (ui.onlyFree && p.preco > 0 && !(p.gratisDias || []).length) return false;
      if (ui.onlyAge && state.youngest < ageMin(p.idade)) return false;
      if (ui.onlyDates && hasDates(p) && !days.some((d) => eventOn(p, d))) return false;
      return true;
    }).sort((a, b) => highlightScore(b, state.activeDay) - highlightScore(a, state.activeDay) || a.nome.localeCompare(b.nome));
  }

  // Nível de prioridade nos destaques do dia:
  //   3 = show/evento com data que acontece nesse dia
  //   2 = grátis só nesse dia da semana (ex.: MASP às terças)
  //   1 = sempre grátis
  //   0 = o resto;  -1 = fechado / não acontece nesse dia
  function highlightTier(p, iso) {
    if (!iso) return 0;
    if (!happensOn(p, iso) || isClosed(p, iso)) return -1;
    if (eventOn(p, iso)) return 3;
    if (priceOn(p, iso) === 0) return p.preco > 0 ? 2 : 1;
    return 0;
  }
  // Dentro do mesmo nível: eventos grátis antes dos pagos, depois os lugares em destaque.
  function highlightScore(p, iso) {
    if (!iso) return p.destaque ? 1 : 0;
    return highlightTier(p, iso) * 100 + (priceOn(p, iso) === 0 ? 10 : 0) + (p.destaque ? 1 : 0);
  }

  function tagsFor(p, opts = {}) {
    const t = [];
    t.push(`<span class="tag dark">${esc(CATEGORIES[p.categoria])}</span>`);
    const iso = state.activeDay;
    const today = iso && happensOn(p, iso) && !isClosed(p, iso);
    if (today && eventOn(p, iso)) t.push(`<span class="tag dark">★ ${p.periodo ? "em cartaz" : priceOn(p, iso) === 0 ? "grátis hoje" : "rola hoje"}</span>`);
    t.push(`<span class="tag ${p.preco === 0 ? "free" : ""}">${money(p.preco)}</span>`);
    if (today && p.preco > 0 && priceOn(p, iso) === 0) t.push(`<span class="tag free">★ grátis hoje</span>`);
    else if (p.gratisDias?.length && p.preco > 0) t.push(`<span class="tag free">grátis ${p.gratisDias.map((d) => WEEKDAYS[d]).join("/")}</span>`);
    t.push(ageBadge(p.idade));
    if (!opts.noDur) t.push(`<span class="tag">~${fmtDur(p.duracao)}</span>`);
    if (combosFor(p.id).length) t.push(`<span class="tag combo" title="Combina com outros lugares">combo</span>`);
    if (hasDates(p)) {
      const inTrip = tripDays().some((d) => eventOn(p, d));
      const label = datesLabel(p);
      t.push(`<span class="tag ${inTrip ? "" : "dim"}">📅 ${label}</span>`);
    }
    if (p.confirmar) t.push(`<span class="tag confirm" title="${esc(p.confirmar)}">a confirmar</span>`);
    if (p.ilustrativo) t.push(`<span class="tag dim">ilustrativo</span>`);
    return t.join("");
  }

  // ---------- Render: cidade e filtros ----------
  function renderCitySelect() {
    $("#city").innerHTML = CITY_OPTIONS.map((c) =>
      `<option value="${c.id}" ${c.soon ? "disabled" : ""} ${c.id === state.city ? "selected" : ""}>${esc(c.nome)}${c.soon ? " — em breve" : ""}</option>`
    ).join("");
    $("#cityName").textContent = city().nome;
  }

  function renderChips() {
    $("#catChips").innerHTML =
      `<button class="chip ${ui.cats.size ? "" : "on"}" data-cat="">Tudo</button>` +
      Object.entries(CATEGORIES).map(([k, v]) => `<button class="chip ${ui.cats.has(k) ? "on" : ""}" data-cat="${k}">${esc(v)}</button>`).join("");
  }

  // Dias da viagem em que o lugar já está no roteiro, com o número do dia.
  function plannedDays(id) {
    return tripDays().map((d, i) => ({ d, n: i + 1 })).filter(({ d }) => (state.days[d]?.items || []).some((it) => it.id === id));
  }
  function plannedNote(id) {
    const days = plannedDays(id);
    if (!days.length) return "";
    return `<div class="planned">✓ No roteiro: ${days.map(({ d, n }) => `Dia ${n} (${fmtDay(d)})`).join(", ")}</div>`;
  }

  function renderList() {
    const list = filtered();
    $("#resultCount").textContent = list.length + " de " + activePlaces().length;
    const nEvents = activePlaces().filter(hasDates).length;
    $("#agendaInfo").textContent = agendaLabel() + " · " + nEvents + " eventos e exposições por vir";
    $("#list").innerHTML = list.length ? list.map((p) => {
      const added = plannedDays(p.id).length > 0;
      return `
      <li class="card ${added ? "added" : ""}" data-open="${p.id}">
        <h4>${esc(p.nome)}</h4>
        <div class="actions">
          <button class="icon-btn" data-add="${p.id}" title="${added ? "Adicionar outra vez ao dia selecionado" : "Adicionar ao dia selecionado"}">+</button>
        </div>
        <span class="sub">${esc(placeLabel(p))} · <span class="readmore">leia mais</span></span>
        <div class="meta">${tagsFor(p)}</div>
        ${plannedNote(p.id)}
      </li>`;
    }).join("") : `<li class="empty">Nada encontrado com esses filtros.</li>`;
  }

  // ---------- Render: dias ----------
  function renderDays() {
    const days = tripDays();
    if (!days.includes(state.activeDay)) state.activeDay = days[0];
    $("#dayTabs").innerHTML = days.map((d, i) => {
      const n = (state.days[d]?.items || []).length;
      return `<button class="day-tab ${d === state.activeDay ? "on" : ""}" data-day="${d}">
        <b>Dia ${i + 1}</b><small>${fmtDay(d)} · ${n} ${n === 1 ? "item" : "itens"}</small></button>`;
    }).join("") || `<p class="muted">Escolha as datas de ida e volta.</p>`;
    if (state.activeDay) $("#dayStart").value = dayData(state.activeDay).start;
  }

  // ---------- Render: timeline ----------
  function renderTimeline() {
    if (!state.activeDay) { $("#timeline").innerHTML = ""; return; }
    const { rows, entries, end, off } = schedule(state.activeDay);
    $("#dayEnd").textContent = rows.length ? "termina por volta das " + toHHMM(end) : "";
    if (!rows.length) {
      $("#timeline").innerHTML = `<li class="empty">Dia vazio. Adicione lugares pela lista ou pelas recomendações abaixo.</li>`;
      return;
    }
    const weekday = parseISO(state.activeDay).getDay();
    const inDay = new Set(rows.map((r) => r.place.id));
    const shownCombos = new Set();
    const comboHint = (p) => {
      const c = combosFor(p.id).find((c) => !shownCombos.has(c.idx) && c.ids.some((id) => !inDay.has(id)));
      if (!c) return "";
      shownCombos.add(c.idx);
      const missing = c.ids.filter((id) => !inDay.has(id)).map((id) => placeById(id).nome);
      const when = c.quando.includes(weekday) ? "✓ hoje é o dia ideal!" : bestDays(c);
      return `<div class="combo-hint"><span class="tag combo">combo</span>
        <span><b>${esc(c.titulo)}</b>: + ${esc(missing.join(", "))}${when ? ` · <i>${when}</i>` : ""}</span>
        <button class="btn ghost small" data-combo="${c.idx}">+ adicionar</button></div>`;
    };
    const kmTxt = (km) => km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1).replace(".", ",") + " km";
    // attr identifica o trecho: data-legmode="<uid do destino>" ou data-retmode (volta para a hospedagem).
    const modesHtml = (leg, attr) => `
          <div class="modes" role="group" aria-label="Como ir">
            ${leg.options.map((o) => `<button class="mode ${o.id === leg.id ? "on" : ""}" ${attr} data-mode="${o.id}"
              title="${MODES[o.id].label}${o.note ? " — " + o.note : ""}">${MODES[o.id].icon} ${fmtDur(o.min)}${o.cost ? " · " + moneyExact(o.cost) : ""}</button>`).join("")}
          </div>
          <b>${leg.icon} ${leg.mode}</b> · ${kmTxt(leg.km)}${leg.forced ? ` · <button class="reset" ${attr} data-mode="">voltar ao automático</button>` : ""}`;
    const legHtml = (r) => !r.leg ? "" : `
        <li class="leg"><span></span><div class="leg-line">
          ${r.fromStay ? `<div class="stay-leg">🏨 Saindo de ${esc(r.fromStay)} às ${toHHMM(r.start - r.leg.min)}</div>` : ""}
          ${modesHtml(r.leg, `data-legmode="${r.item.uid}"`)}
          ${r.wait && !r.fromStay ? `<br>espera de ${fmtDur(r.wait)} até abrir/começar` : ""}
        </div></li>`;
    const returnHtml = (e) => `
        <li class="leg"><span></span><div class="leg-line">
          <div class="stay-leg">🏨 ${e.change ? "Indo para a nova hospedagem" : "Volta para"}: ${esc(e.stayName)} · chegada por volta das ${toHHMM(e.end)}</div>
          ${modesHtml(e.leg, "data-retmode")}
        </div></li>`;
    const mealHtml = (e) => {
      const m = e.m;
      return `<li class="stop meal">
          <div class="time">${toHHMM(e.start)}<small>${toHHMM(e.end)}</small></div>
          <div class="stop-body">
            <div class="stop-top">
              <h4>${m.icon} ${m.label}</h4>
              <div class="stop-tools"><button class="icon-btn" data-mealoff="${m.key}" title="Sem ${m.label.toLowerCase()} neste dia">×</button></div>
            </div>
            <div class="stop-row">
              <span class="duration">
                <button class="icon-btn" data-mealdur="${m.key}" data-step="-15" title="-15 min">−</button>
                <input value="${fmtDur(m.dur)}" data-mealinput="${m.key}" aria-label="Tempo de ${m.label}" title="Ex.: 45, 1h, 1h15">
                <button class="icon-btn" data-mealdur="${m.key}" data-step="15" title="+15 min">+</button>
                ${m.custom ? `<button class="reset" data-mealreset="${m.key}">padrão ${fmtDur(state.meals[m.key].dur)}</button>` : `<span class="muted small-text">tempo padrão</span>`}
              </span>
              <label class="start-at">às <input type="time" data-mealat="${m.key}" value="${toHHMM(m.at)}" title="Horário desejado neste dia"></label>
              ${m.customAt ? `<button class="reset" data-mealatreset="${m.key}">padrão ${state.meals[m.key].at}</button>` : ""}
              ${e.note ? `<span class="muted small-text">${esc(e.note)}</span>` : ""}
            </div>
            ${e.warnings.map((w) => `<div class="warning">⚠ ${esc(w)}</div>`).join("")}
          </div>
        </li>`;
    };
    const missedHtml = (e) => `<li class="leg"><span></span><div class="leg-line warning">⚠ Sem ${esc(e.m.label.toLowerCase())}: ${esc(e.why)}. Considere encurtar algum lugar.</div></li>`;

    let n = 0;
    $("#timeline").innerHTML = entries.map((e) => {
      if (e.kind === "meal") return mealHtml(e);
      if (e.kind === "missed") return missedHtml(e);
      if (e.kind === "return") return returnHtml(e);
      const r = e.row, i = n++;
      const leg = legHtml(r);
      const changed = r.item.dur !== r.place.duracao;
      return leg + `
        <li class="stop ${ui.focusUid === r.item.uid ? "focus" : ""}" data-focus="${r.item.uid}">
          <div class="time">${toHHMM(r.start)}<small>${toHHMM(r.end)}</small></div>
          <div class="stop-body">
            <div class="stop-top">
              <h4>${i + 1}. ${esc(r.place.nome)}</h4>
              <div class="stop-tools">
                <button class="icon-btn" data-move="${r.item.uid}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Subir">↑</button>
                <button class="icon-btn" data-move="${r.item.uid}" data-dir="1" ${i === rows.length - 1 ? "disabled" : ""} title="Descer">↓</button>
                <button class="icon-btn" data-remove="${r.item.uid}" title="Remover">×</button>
              </div>
            </div>
            <div class="stop-row">
              <span class="duration">
                <button class="icon-btn" data-dur="${r.item.uid}" data-step="-15" title="-15 min">−</button>
                <input value="${fmtDur(r.item.dur)}" data-durinput="${r.item.uid}" aria-label="Tempo no local" title="Ex.: 90, 1h30, 2:15">
                <button class="icon-btn" data-dur="${r.item.uid}" data-step="15" title="+15 min">+</button>
                ${changed ? `<button class="reset" data-resetdur="${r.item.uid}">padrão ${fmtDur(r.place.duracao)}</button>` : `<span class="muted small-text">tempo sugerido</span>`}
              </span>
              <label class="start-at">início <input type="time" data-itemat="${r.item.uid}" value="${r.item.at || toHHMM(r.start)}" title="Escolha o horário de chegada"></label>
              ${r.item.at ? `<button class="reset" data-itematreset="${r.item.uid}">${r.place.inicio ? "horário oficial " + r.place.inicio : "horário automático"}</button>` : ""}
              <span class="tag ${r.price === 0 ? "free" : ""}">${money(r.price)}${r.price && state.people > 1 ? " × " + state.people : ""}</span>
              ${ageBadge(r.place.idade)}
            </div>
            <div class="how">🚇 ${esc(r.place.comoChegar)}</div>
            ${r.meals.map((m) => `<div class="meal-covered">${m.icon} ${m.label} aqui — o lugar serve comida, então a refeição separada saiu do roteiro.</div>`).join("")}
            ${r.adjusted ? `<div class="how">⏱ ${esc(r.adjusted)}</div>` : ""}
            ${r.warnings.map((w) => `<div class="warning">⚠ ${esc(w)}</div>`).join("")}
            ${r.place.confirmar ? `<div class="how">ℹ ${esc(r.place.confirmar)}</div>` : ""}
            ${comboHint(r.place)}
          </div>
        </li>`;
    }).join("") + (off.length ? `<li class="leg"><span></span><div class="leg-line">Sem ${off.map((k) => MEALS[k].label.toLowerCase()).join(" e ")} neste dia ·
      ${off.map((k) => `<button class="reset" data-mealon="${k}">voltar ${MEALS[k].label.toLowerCase()}</button>`).join(" ")}</div></li>` : "");
  }

  // ---------- Render: recomendações ----------
  function recommendations() {
    const iso = state.activeDay;
    const items = dayData(iso).items;
    // Referência de distância: o item clicado no roteiro ou, sem foco, todos os itens do dia.
    const focusItem = items.find((i) => i.uid === ui.focusUid);
    const anchor = focusItem && placeById(focusItem.id);
    let refs = anchor ? [anchor] : items.map((i) => placeById(i.id)).filter(Boolean);
    const dayStay = stayPlace(prevStayFor(iso)) || stayPlace(stayFor(iso));
    const fromStay = !refs.length && !!dayStay;
    if (fromStay) refs = [dayStay];
    const planned = allPlannedIds();
    const cands = activePlaces().filter((p) =>
      !planned.has(p.id) && happensOn(p, iso) && !isClosed(p, iso) && state.youngest >= ageMin(p.idade));
    let list;
    if (refs.length) {
      // Mesmo nível de prioridade (eventos do dia → grátis → resto), mas dentro do nível o mais perto vem antes.
      list = cands.map((p) => {
        let km = Infinity, from = null;
        refs.forEach((r) => { const d = distanceKm(r, p); if (d < km) { km = d; from = r; } });
        return { p, km, from };
      }).sort((a, b) => highlightTier(b.p, iso) - highlightTier(a.p, iso) || a.km - b.km);
    } else {
      list = cands.filter((p) => highlightTier(p, iso) >= 1 || p.destaque)
        .sort((a, b) => highlightScore(b, iso) - highlightScore(a, iso))
        .map((p) => ({ p, km: null, from: null }));
    }
    return { anchor, hasRefs: refs.length > 0, fromStay, list: list.slice(0, 14) };
  }

  function renderRecs() {
    if (!state.activeDay) { $("#recs").innerHTML = ""; return []; }
    const { anchor, hasRefs, fromStay, list } = recommendations();
    $("#recsTitle").textContent = (anchor ? "Perto de " + anchor.nome
      : fromStay ? "Destaques perto da hospedagem"
      : hasRefs ? "Destaques perto do seu roteiro"
      : "Destaques para " + fmtDay(state.activeDay)) + " · eventos do dia primeiro, depois grátis";
    $("#recs").innerHTML = list.length ? list.map(({ p, km, from }) => {
      let dist = "";
      if (km !== null) {
        const ref = anchor ? "" : ` de ${from.nome}`;
        dist = km <= WALK_LIMIT_KM
          ? `${(km * 1000).toFixed(0)} m · ${walkMinutes(km)} min a pé${ref}`
          : `${km.toFixed(1).replace(".", ",")} km · ~${legInfo(from, p).min} min${ref}`;
      }
      return `<div class="rec">
        <h4 data-open="${p.id}">${esc(p.nome)}</h4>
        ${dist ? `<span class="dist">${dist}</span>` : ""}
        <div class="meta">${tagsFor(p)}</div>
        <button class="btn small" data-add="${p.id}">+ Adicionar</button>
      </div>`;
    }).join("") : `<p class="muted">Sem recomendações para este dia.</p>`;
    return list;
  }

  // ---------- Render: mapa ----------
  let map, mapLayer;
  function renderMap(recList) {
    if (!window.L) { $("#map").innerHTML = `<p class="empty">Mapa indisponível (sem conexão).</p>`; return; }
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false }).setView(city().centro, 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        className: "tiles-bw"
      }).addTo(map);
      mapLayer = L.layerGroup().addTo(map);
    }
    mapLayer.clearLayers();
    const { rows } = state.activeDay ? schedule(state.activeDay) : { rows: [] };
    const pts = rows.map((r) => [r.place.lat, r.place.lng]);
    if (state.activeDay) {
      const a = stayPlace(prevStayFor(state.activeDay)), b = stayPlace(stayFor(state.activeDay));
      [a, b].filter((x, i, arr) => x && arr.indexOf(x) === i).forEach((st) => {
        L.marker([st.lat, st.lng], {
          icon: L.divIcon({ className: "", html: `<div class="pin pin-stay">🏨</div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
        }).bindTooltip("Hospedagem: " + st.nome).addTo(mapLayer);
      });
      if (pts.length) { if (a) pts.unshift([a.lat, a.lng]); if (b) pts.push([b.lat, b.lng]); }
      else [a, b].filter(Boolean).forEach((st) => pts.push([st.lat, st.lng]));
    }
    if (pts.length > 1) L.polyline(pts, { color: "#0b0b0b", weight: 2, dashArray: "6 6" }).addTo(mapLayer);
    rows.forEach((r, i) => {
      L.marker([r.place.lat, r.place.lng], {
        icon: L.divIcon({ className: "", html: `<div class="pin">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] })
      }).bindTooltip(r.place.nome).addTo(mapLayer);
    });
    (recList || []).forEach(({ p }) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "", html: `<div class="pin pin-rec"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] })
      }).bindTooltip("Sugestão: " + p.nome).on("click", () => openDetail(p.id)).addTo(mapLayer);
    });
    const all = pts.concat((recList || []).map(({ p }) => [p.lat, p.lng]));
    if (all.length) map.fitBounds(all, { padding: [30, 30], maxZoom: 15 });
    else map.setView(city().centro, 12);
  }

  // ---------- Render: custos ----------
  function renderCosts() {
    const days = tripDays();
    let tickets = 0, transport = 0;
    const perDay = days.map((d, i) => {
      const { rows, ret } = schedule(d);
      const t = rows.reduce((s, r) => s + r.price * state.people, 0);
      const tr = rows.reduce((s, r) => s + (r.leg ? r.leg.cost : 0), 0) + (ret ? ret.cost : 0);
      tickets += t; transport += tr;
      return { d, i, t, tr, n: rows.length };
    });
    const nights = Math.max(0, days.length - 1);
    // A noite do dia i é passada na hospedagem desse dia; o último dia é o da volta (sem noite).
    const byStay = new Map();
    days.slice(0, nights).forEach((d) => {
      const st = stayFor(d), key = st ? st.id : "";
      const g = byStay.get(key) || { label: st ? st.label : "Valor padrão", price: stayPrice(st), n: 0 };
      g.n++; byStay.set(key, g);
    });
    const hotel = [...byStay.values()].reduce((sum, g) => sum + g.n * g.price, 0);
    const food = days.length * state.people * state.food;
    const total = tickets + transport + hotel + food;
    $("#costTable").innerHTML = `
      <tr><td>Ingressos e entradas</td><td>${moneyExact(tickets)}</td></tr>
      ${perDay.filter((x) => x.n).map((x) => `<tr class="sub"><td>Dia ${x.i + 1} · ${fmtDay(x.d)}</td><td>${moneyExact(x.t)}</td></tr>`).join("")}
      <tr><td>Deslocamento entre lugares</td><td>${moneyExact(transport)}</td></tr>
      <tr><td>Hospedagem (${nights} ${nights === 1 ? "noite" : "noites"})</td><td>${moneyExact(hotel)}</td></tr>
      ${byStay.size > 1 || (byStay.size === 1 && !byStay.has("")) ? [...byStay.values()].map((g) => `<tr class="sub"><td>${esc(g.label)} · ${g.n} × ${moneyExact(g.price)}</td><td>${moneyExact(g.n * g.price)}</td></tr>`).join("") : ""}
      <tr><td>Alimentação (${days.length} ${days.length === 1 ? "dia" : "dias"} × ${state.people})</td><td>${moneyExact(food)}</td></tr>
      <tr class="total"><td>Total da viagem</td><td>${moneyExact(total)}</td></tr>
      <tr class="pp"><td>Por pessoa</td><td>${moneyExact(total / Math.max(1, state.people))}</td></tr>`;
  }

  // ---------- Detalhe ----------
  function openDetail(id) {
    const p = placeById(id);
    const days = tripDays();
    const h = p.horario;
    const combos = combosFor(p.id);
    const dicas = (city().dicas || {})[p.id] || [];
    const opts = days.map((d, i) => {
      const bad = !happensOn(p, d) || isClosed(p, d);
      return `<option value="${d}" ${d === state.activeDay ? "selected" : ""}>Dia ${i + 1} · ${fmtDay(d)}${bad ? " (indisponível)" : ""}</option>`;
    }).join("");
    $("#detail").innerHTML = `
      <div class="modal-head">
        <div><h3>${esc(p.nome)}</h3><span class="small-text">${esc(placeLabel(p))} · ${esc(CATEGORIES[p.categoria])}</span></div>
        <button class="icon-btn" data-close title="Fechar">×</button>
      </div>
      <div class="modal-body">
        <p style="margin:0">${esc(p.descricao)}</p>
        <div class="facts">
          <div class="fact"><span>Valor</span><b>${money(p.preco)}</b>${p.precoNota ? `<div class="small-text muted">${esc(p.precoNota)}</div>` : ""}
            ${p.gratisDias?.length ? `<div class="small-text">Grátis: ${p.gratisDias.map((d) => WEEKDAYS_FULL[d]).join(", ")}</div>` : ""}</div>
          <div class="fact"><span>Classificação</span><b style="display:flex;gap:8px;align-items:center">${ageBadge(p.idade)} ${esc(AGE_OPTIONS.find((o) => o.v === ageMin(p.idade))?.desc || p.idade)}</b></div>
          <div class="fact"><span>Tempo sugerido</span><b>${fmtDur(p.duracao)}</b></div>
          <div class="fact"><span>Horário</span><b>${p.inicio ? "Início " + p.inicio : h.abre + "–" + h.fecha}</b>
            ${h.fechado.length ? `<div class="small-text muted">Fecha: ${h.fechado.map((d) => WEEKDAYS_FULL[d]).join(", ")}</div>` : ""}</div>
          ${hasDates(p) ? `<div class="fact" style="grid-column:1/-1"><span>${p.periodo ? "Período" : "Datas"}</span><b>${datesLabel(p, true)}</b></div>` : ""}
          ${p.fonte ? `<div class="fact" style="grid-column:1/-1"><span>Fonte da data</span><b><a href="${esc(p.fonte)}" target="_blank" rel="noopener">${esc(new URL(p.fonte).hostname.replace(/^www./, ""))}</a></b></div>` : ""}
          <div class="fact" style="grid-column:1/-1"><span>Como chegar</span><b>${esc(p.comoChegar)}</b></div>
        </div>
        ${p.confirmar ? `<p class="small-text" style="margin:0">ℹ ${esc(p.confirmar)}</p>` : ""}
        ${p.ilustrativo ? `<p class="small-text muted" style="margin:0">⚠ Dados ilustrativos para o protótipo — confirme no site oficial.</p>` : ""}
        ${plannedNote(p.id)}
        <div class="modal-actions">
          ${days.length ? `<select id="detailDay">${opts}</select><button class="btn" data-adddetail="${p.id}">${plannedDays(p.id).length ? "Adicionar outra vez" : "Adicionar ao roteiro"}</button>` : ""}
        </div>
        ${combos.length ? `<h4 style="margin:4px 0 0">Faça um combo</h4>` + combos.map((c) => `
          <div class="combo-box">
            <h5><span class="tag combo">combo</span>${esc(c.titulo)}${c.quando.length ? ` <span class="tag">${bestDays(c)}</span>` : ""}</h5>
            <p>${esc(c.texto)}</p>
            <span class="members">${c.ids.map((cid) => esc(placeById(cid).nome)).join(" + ")}</span>
            ${days.length ? `<button class="btn ghost small" data-combodetail="${c.idx}">+ Adicionar combo ao dia escolhido</button>` : ""}
          </div>`).join("") + `<p class="small-text muted" style="margin:0">O dia sugerido é só uma dica — você pode montar o combo em qualquer data.</p>` : ""}
        ${dicas.length ? `<details><summary>Leia mais</summary><ul>${dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>` : ""}
      </div>`;
    $("#detail").showModal();
  }

  // ---------- Toast ----------
  let toastTimer;
  // action opcional: { label, run } vira um botão no aviso (ex.: "Desfazer"), e o aviso fica mais tempo na tela.
  function toast(msg, action) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#0b0b0b;color:#fff;padding:10px 14px;border-radius:4px;font-size:14px;z-index:2000;max-width:calc(100vw - 32px);transition:opacity .2s;display:flex;gap:12px;align-items:center";
      document.body.appendChild(el);
    }
    el.textContent = "✓ " + msg;
    if (action) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.style.cssText = "background:var(--accent);color:#0b0b0b;border:0;border-radius:4px;padding:4px 10px;font:inherit;font-weight:700;cursor:pointer";
      b.addEventListener("click", () => { action.run(); el.style.opacity = "0"; el.style.pointerEvents = "none"; });
      el.appendChild(b);
    }
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = "0"; el.style.pointerEvents = "none"; }, action ? 6000 : 1800);
  }

  // ---------- Mobile ----------
  function renderView() {
    document.querySelectorAll("#mobileTabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === ui.view));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("show", p.id === "view-" + ui.view));
    if (ui.view === "plan" && map) setTimeout(() => { map.invalidateSize(); renderMap(renderRecs()); }, 0);
  }

  // ---------- Agenda online ----------
  // Ao buscar (ou trocar as datas), pede ao servidor os eventos daquelas datas e junta com os do arquivo.
  // Se o servidor não responder, o site segue com os arquivos de js/data/ (agenda "local").
  const API_BASE = window.TF_CONFIG ? window.TF_CONFIG.apiBase : "";
  const agenda = { online: false, carregando: false, atualizadoEm: null, atualizando: false, tentativa: 0 };

  function agendaLabel() {
    if (agenda.carregando) return "Atualizando a agenda…";
    if (agenda.online && agenda.atualizadoEm) {
      const d = new Date(agenda.atualizadoEm);
      const quando = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " às " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      return "Agenda online atualizada em " + quando + (agenda.atualizando ? " (buscando novidades…)" : "");
    }
    const local = city().atualizadoEm;
    return "Agenda do arquivo local" + (local ? " de " + fmtShort(local) + "/" + local.slice(0, 4) : "");
  }

  function mergeEvents(lista) {
    const lugares = city().lugares;
    lista.forEach((ev) => {
      if (!ev || !ev.id) return;
      const i = lugares.findIndex((p) => p.id === ev.id);
      if (i >= 0) lugares[i] = ev; else lugares.push(ev);
    });
  }

  async function loadAgenda() {
    if (API_BASE === null || location.protocol === "file:") return;
    const tentativa = ++agenda.tentativa;
    agenda.carregando = true;
    renderList();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const params = new URLSearchParams({ cidade: state.city, de: state.start, ate: state.end });
      const res = await fetch(API_BASE + "/api/eventos?" + params, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (tentativa !== agenda.tentativa) return; // chegou resposta de uma busca mais nova
      mergeEvents(data.eventos || []);
      Object.assign(agenda, { online: true, atualizadoEm: data.atualizadoEm, atualizando: !!data.atualizando });
      // O servidor está buscando novidades em segundo plano: pergunta de novo daqui a pouco.
      if (data.atualizando) setTimeout(() => { if (tentativa === agenda.tentativa) loadAgenda(); }, 15000);
    } catch (_) {
      if (tentativa === agenda.tentativa) agenda.online = false;
    } finally {
      clearTimeout(timer);
      if (tentativa === agenda.tentativa) { agenda.carregando = false; renderAll(); }
    }
  }

  // ---------- Calendário de ida e volta ----------
  const dp = { start: null, end: null, hover: null, month: null };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };

  function renderDateBtn() {
    const n = tripDays().length;
    $("#dateBtn").innerHTML = `📅 ${fmtDay(state.start)} → ${fmtDay(state.end)} <small>${n} ${n === 1 ? "dia" : "dias"}</small><span class="arrow">▼</span>`;
  }

  function openDatePicker() {
    dp.start = state.start; dp.end = state.end; dp.hover = null;
    const s = parseISO(state.start);
    dp.month = new Date(s.getFullYear(), s.getMonth(), 1);
    $("#datePicker").hidden = false;
    renderDatePicker();
  }
  function closeDatePicker() { $("#datePicker").hidden = true; }

  function monthGrid(first) {
    const today = todayISO();
    const maxEnd = dp.start && !dp.end ? addDays(dp.start, MAX_DAYS - 1) : null;
    const rangeEnd = dp.end || (dp.start && dp.hover && dp.hover > dp.start ? dp.hover : null);
    let html = `<div><div class="dp-title">${MONTHS[first.getMonth()]} ${first.getFullYear()}</div><div class="dp-grid">`;
    html += WEEKDAYS.map((w) => `<span class="dp-wd">${w[0].toUpperCase()}</span>`).join("");
    html += "<span></span>".repeat(first.getDay());
    const d = new Date(first);
    while (d.getMonth() === first.getMonth()) {
      const iso = toISO(d);
      const disabled = iso < today || (maxEnd && iso > maxEnd);
      const cls = ["dp-day"];
      if (iso === today) cls.push("today");
      if (iso === dp.start) cls.push("start");
      if (iso === dp.end || (!dp.end && iso === rangeEnd)) cls.push("end");
      if (dp.start && rangeEnd && iso > dp.start && iso < rangeEnd) cls.push("in-range");
      html += `<button type="button" class="${cls.join(" ")}" data-dpday="${iso}" ${disabled ? "disabled" : ""}>${d.getDate()}</button>`;
      d.setDate(d.getDate() + 1);
    }
    return html + "</div></div>";
  }

  function renderDatePicker() {
    const months = window.innerWidth > 820 ? 2 : 1;
    const now = new Date();
    const atFirst = dp.month.getFullYear() === now.getFullYear() && dp.month.getMonth() === now.getMonth();
    let grids = "";
    for (let i = 0; i < months; i++) grids += monthGrid(new Date(dp.month.getFullYear(), dp.month.getMonth() + i, 1));
    const n = dp.start && dp.end ? dateRange(dp.start, dp.end).length : 0;
    const summary = !dp.start ? "Escolha a data de ida"
      : !dp.end ? `Ida: <b>${fmtDay(dp.start)}</b> — agora escolha a volta`
      : `<b>${fmtDay(dp.start)} → ${fmtDay(dp.end)}</b> · ${n} ${n === 1 ? "dia" : "dias"}`;
    $("#datePicker").innerHTML = `
      <div class="dp-nav">
        <button type="button" class="icon-btn" data-dpnav="-1" ${atFirst ? "disabled" : ""} aria-label="Mês anterior">‹</button>
        <span class="small-text muted">máx. ${MAX_DAYS} dias</span>
        <button type="button" class="icon-btn" data-dpnav="1" aria-label="Próximo mês">›</button>
      </div>
      <div class="dp-months">${grids}</div>
      <div class="dp-foot"><span>${summary}</span>
        <span style="display:flex;gap:6px">
          <button type="button" class="btn ghost small" data-dpclear>Limpar</button>
          <button type="button" class="btn small" data-dpok ${dp.start && dp.end ? "" : "disabled"}>Pronto</button>
        </span>
      </div>`;
  }

  function pickDate(iso) {
    if (!dp.start || dp.end || iso < dp.start) { dp.start = iso; dp.end = null; }
    else dp.end = iso;
    renderDatePicker();
  }

  function applyDates() {
    if (!dp.start || !dp.end) return;
    state.start = dp.start; state.end = dp.end;
    save(); closeDatePicker(); renderDateBtn(); renderAll();
    if (inApp()) loadAgenda();
  }

  // ---------- Classificação indicativa ----------
  function renderAge() {
    const o = AGE_OPTIONS.find((x) => x.v === state.youngest);
    if (document.activeElement !== $("#youngestAge")) $("#youngestAge").value = state.youngestAge;
    $("#ageBadge").innerHTML = ciIcon(o.v);
    $("#ageBadge").title = o.faixaDesc;
  }


  // ---------- Configuração das refeições ----------
  function renderMealsCfg() {
    $("#mealsRows").innerHTML = Object.entries(MEALS).map(([k, m]) => {
      const c = state.meals[k];
      return `<div class="meal-cfg-row">
        <label class="name check"><input type="checkbox" data-mealcfg="${k}" data-field="on" ${c.on ? "checked" : ""}> ${m.icon} ${m.label}</label>
        <label>às <input type="time" data-mealcfg="${k}" data-field="at" value="${c.at}"></label>
        <label>por <input type="number" min="5" max="240" step="5" data-mealcfg="${k}" data-field="dur" value="${c.dur}"> min</label>
        ${c.dur < m.min ? `<div class="warning">⚠ ${c.dur} min talvez seja pouco tempo para ${m.label.toLowerCase()}.</div>` : ""}
      </div>`;
    }).join("");
  }
  // ---------- Hospedagem ----------
  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const shortLabel = (name) => name.split(",").slice(0, 3).join(",").trim();
  let stayHits = [];

  const newStayId = () => "s" + Date.now().toString(36);

  function renderStay() {
    const stays = state.stays;
    const iso = state.activeDay;
    const today = iso ? stayFor(iso) : null;
    $("#stayLabel").textContent = today ? today.label : stays.length ? "nenhuma neste dia" : "não definida";
    $("#stayBox").open = $("#stayBox").open || !stays.length;
    $("#stayList").innerHTML = stays.map((st) => `
      <li class="stay-item">
        <span class="stay-name">🏨 ${esc(st.label)}${st.id === state.stayDefault ? ` <span class="tag">padrão</span>` : ""}</span>
        <span class="small-text muted">${st.lat == null ? "sem endereço" : "endereço no mapa"} · ${moneyExact(stayPrice(st))}/noite</span>
        <span class="stay-actions">
          ${st.lat == null ? `<button type="button" class="reset" data-staypick="${st.id}">📍 marcar no mapa</button>` : ""}
          ${st.id !== state.stayDefault ? `<button type="button" class="reset" data-staydefault="${st.id}">tornar padrão</button>` : ""}
          <button type="button" class="reset" data-stayremove="${st.id}">remover</button>
        </span>
      </li>`).join("");
    // Escolha da hospedagem do dia aberto no roteiro.
    const dayRow = $("#dayStayRow");
    dayRow.hidden = stays.length < 2 || !iso;
    if (!dayRow.hidden) {
      const own = (state.days[iso] || {}).stayId || "";
      const def = stayById(state.stayDefault);
      const n = tripDays().indexOf(iso) + 1;
      $("#dayStayLabel").textContent = "Na noite do Dia " + n + " (" + fmtDay(iso) + "), ficar em:";
      $("#dayStay").innerHTML = `<option value="">Padrão${def ? " — " + esc(def.label) : ""}</option>` +
        stays.map((st) => `<option value="${st.id}" ${st.id === own ? "selected" : ""}>${esc(st.label)}</option>`).join("");
    }
    $("#stayResults").innerHTML = stayHits.map((h, i) =>
      `<li><button type="button" data-stayhit="${i}">📍 ${esc(h.display_name)}</button></li>`).join("");
    renderStayCosts();
  }
  // Valores por noite de cada hospedagem, no painel de custos.
  function renderStayCosts() {
    $("#stayCosts").innerHTML = state.stays.map((st) => `
      <div class="stay-cost">
        <input type="text" data-staylabel="${st.id}" value="${esc(st.label)}" aria-label="Nome da hospedagem">
        <label>R$ <input type="number" min="0" step="10" data-stayprice="${st.id}" value="${stayPrice(st)}" aria-label="Valor por noite"></label>
      </div>`).join("");
  }
  // Adiciona uma hospedagem (a primeira vira a padrão) ou atualiza a localização de uma existente.
  function addStay(data, targetId) {
    if (targetId) Object.assign(stayById(targetId) || {}, data);
    else {
      const st = { id: newStayId(), price: state.hotel, ...data };
      state.stays.push(st);
      if (!state.stayDefault || !stayById(state.stayDefault)) state.stayDefault = st.id;
      targetId = st.id;
    }
    stayHits = [];
    save(); renderStay(); renderAll();
    toast("Hospedagem: " + stayById(targetId).label);
    return stayById(targetId);
  }
  function removeStay(id) {
    state.stays = state.stays.filter((st) => st.id !== id);
    Object.values(state.days).forEach((d) => { if (d.stayId === id) delete d.stayId; });
    if (state.stayDefault === id) state.stayDefault = state.stays[0] ? state.stays[0].id : null;
    save(); renderStay(); renderAll();
  }
  async function searchStay(q) {
    if (!q.trim()) return;
    $("#stayResults").innerHTML = `<li class="muted small-text">Buscando…</li>`;
    try {
      // Limitado à região metropolitana de SP.
      const params = new URLSearchParams({ q, format: "jsonv2", countrycodes: "br", viewbox: "-47.3,-23.1,-45.6,-24.1", bounded: "1", limit: "6", "accept-language": "pt-BR" });
      const res = await fetch(NOMINATIM + "/search?" + params);
      stayHits = res.ok ? await res.json() : [];
      renderStay();
      if (!stayHits.length) $("#stayResults").innerHTML = `<li class="muted small-text">Nada encontrado. Tente rua + número + bairro, ou marque no mapa.</li>`;
    } catch (_) {
      $("#stayResults").innerHTML = `<li class="warning">Não foi possível buscar agora (sem conexão?). Use "Marcar no mapa".</li>`;
    }
  }
  function pickStayOnMap(targetId) {
    if (!map) return;
    $("#map").classList.add("picking");
    toast("Clique no mapa onde você vai se hospedar");
    map.once("click", async (e) => {
      $("#map").classList.remove("picking");
      const target = typeof targetId === "string" ? targetId : null;
      const pos = { lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) };
      const stay = addStay(target ? pos : { label: "Ponto marcado no mapa", ...pos }, target);
      if (target) return; // já tem nome
      // Tenta dar um nome ao ponto (rua/bairro); se falhar, fica o rótulo genérico.
      try {
        const params = new URLSearchParams({ lat: stay.lat, lon: stay.lng, format: "jsonv2", "accept-language": "pt-BR", zoom: "17" });
        const res = await fetch(NOMINATIM + "/reverse?" + params);
        const j = res.ok ? await res.json() : null;
        if (j && j.display_name && stayById(stay.id)) { stay.label = shortLabel(j.display_name); save(); renderStay(); }
      } catch (_) { /* mantém o rótulo genérico */ }
    });
  }

  function dayMeal(key) {
    const day = dayData(state.activeDay);
    day.meals = day.meals || {};
    return (day.meals[key] = day.meals[key] || {});
  }
  function setMealDur(key, min) {
    dayMeal(key).dur = Math.max(5, Math.min(240, Math.round(min)));
    save(); renderAll();
  }

  const inApp = () => !document.body.classList.contains("landing");

  function renderAll() {
    if (!inApp()) return;
    renderDays();
    renderList();
    renderTimeline();
    const recs = renderRecs();
    renderMap(recs);
    renderCosts();
  }

  // ---------- Eventos ----------
  function bindSetup() {
    const fields = { people: "#people", hotel: "#hotel", food: "#food", transport: "#transport" };
    for (const [key, sel] of Object.entries(fields)) {
      const el = $(sel);
      el.value = state[key];
      el.addEventListener("change", () => {
        const numeric = ["people", "hotel", "food"].includes(key);
        state[key] = numeric ? Math.max(0, Number(el.value) || 0) : el.value;
        if (key === "people") state.people = Math.max(1, state.people);
        save(); renderAll();
      });
    }
    $("#stayForm").addEventListener("submit", (e) => { e.preventDefault(); searchStay($("#stayQuery").value); });
    $("#stayPick").addEventListener("click", () => pickStayOnMap());
    $("#stayAddPrice").addEventListener("click", () => addStay({ label: "Hospedagem " + (state.stays.length + 1) }));
    $("#dayStay").addEventListener("change", (e) => {
      const d = dayData(state.activeDay);
      if (e.target.value) d.stayId = e.target.value; else delete d.stayId;
      save(); renderStay(); renderAll();
    });
    $(".brand").addEventListener("click", () => ir("/"));
    $("#dateBtn").addEventListener("click", () => ($("#datePicker").hidden ? openDatePicker() : closeDatePicker()));
    $("#youngestAge").addEventListener("input", (e) => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isFinite(n)) return; // campo apagado enquanto digita
      state.youngestAge = Math.max(0, Math.min(120, n));
      state.youngest = bracketFor(state.youngestAge);
      save(); renderAge(); renderAll();
    });
    $("#youngestAge").addEventListener("change", () => renderAge()); // ao sair do campo, mostra o valor válido
    $("#setup").addEventListener("submit", (e) => {
      e.preventDefault();
      closeDatePicker();
      ir("/planejar");
    });
    $("#city").addEventListener("change", (e) => {
      if (window.TF_CITIES[e.target.value]) { state.city = e.target.value; save(); renderCitySelect(); renderAll(); }
    });
    $("#dayStart").addEventListener("change", (e) => {
      if (!state.activeDay || !e.target.value) return;
      dayData(state.activeDay).start = e.target.value; save(); renderAll();
    });
    // Sem confirm() nativo (alguns navegadores e o painel do app bloqueiam a caixa e ela volta "cancelar"):
    // limpa na hora e oferece "Desfazer".
    $("#clearDay").addEventListener("click", () => {
      const iso = state.activeDay;
      if (!iso) return;
      const day = dayData(iso);
      if (!day.items.length) { toast("Este dia já está vazio"); return; }
      const backup = { items: day.items, returnMode: day.returnMode };
      day.items = [];
      delete day.returnMode;
      ui.focusUid = null;
      save(); renderAll();
      toast(fmtDay(iso) + " limpo (" + backup.items.length + (backup.items.length === 1 ? " lugar removido)" : " lugares removidos)"), {
        label: "Desfazer",
        run: () => {
          const d = dayData(iso);
          d.items = backup.items.concat(d.items);
          if (backup.returnMode) d.returnMode = backup.returnMode;
          save(); renderAll();
        }
      });
    });
  }

  function bindFilters() {
    $("#search").addEventListener("input", (e) => { ui.q = e.target.value; renderList(); });
    $("#maxPrice").addEventListener("input", (e) => { ui.maxPrice = +e.target.value; $("#maxPriceOut").textContent = e.target.value; renderList(); });
    $("#onlyFree").addEventListener("change", (e) => { ui.onlyFree = e.target.checked; renderList(); });
    $("#onlyNight").addEventListener("change", (e) => { ui.onlyNight = e.target.checked; renderList(); });
    $("#onlyAge").addEventListener("change", (e) => { ui.onlyAge = e.target.checked; renderList(); });
    $("#onlyDates").addEventListener("change", (e) => { ui.onlyDates = e.target.checked; renderList(); });
    $("#whereTabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-where]");
      if (!b) return;
      ui.where = b.dataset.where;
      document.querySelectorAll("#whereTabs button").forEach((x) => x.classList.toggle("on", x === b));
      renderList();
    });
    $("#catChips").addEventListener("click", (e) => {
      const c = e.target.closest("[data-cat]");
      if (!c) return;
      if (!c.dataset.cat) ui.cats.clear();
      else ui.cats.has(c.dataset.cat) ? ui.cats.delete(c.dataset.cat) : ui.cats.add(c.dataset.cat);
      renderChips(); renderList();
    });
  }

  function bindDelegates() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      let el;
      // Ícone "!" de ajuda: no celular não há hover, então o toque abre/fecha a explicação.
      document.querySelectorAll(".tip.show").forEach((tip) => { if (!t.closest(".label-help") || tip !== t.closest(".label-help").querySelector(".tip")) tip.classList.remove("show"); });
      if ((el = t.closest(".info"))) { el.nextElementSibling.classList.toggle("show"); return; }
      // Fecha os seletores ao clicar fora deles.
      if (!t.closest(".date-field")) closeDatePicker();
      if ((el = t.closest("[data-dpday]"))) { pickDate(el.dataset.dpday); return; }
      if ((el = t.closest("[data-dpnav]"))) { dp.month = new Date(dp.month.getFullYear(), dp.month.getMonth() + +el.dataset.dpnav, 1); renderDatePicker(); return; }
      if (t.closest("[data-dpclear]")) { dp.start = dp.end = null; renderDatePicker(); return; }
      if (t.closest("[data-dpok]")) { applyDates(); return; }
      if ((el = t.closest("[data-legmode]"))) {
        const item = dayData(state.activeDay).items.find((x) => x.uid === el.dataset.legmode);
        if (item) { if (el.dataset.mode) item.mode = el.dataset.mode; else delete item.mode; save(); renderAll(); }
        return;
      }
      if ((el = t.closest("[data-retmode]"))) {
        const day = dayData(state.activeDay);
        if (el.dataset.mode) day.returnMode = el.dataset.mode; else delete day.returnMode;
        save(); renderAll(); return;
      }
      if ((el = t.closest("[data-itematreset]"))) {
        const item = dayData(state.activeDay).items.find((x) => x.uid === el.dataset.itematreset);
        if (item) { delete item.at; save(); renderAll(); }
        return;
      }
      if ((el = t.closest("[data-mealatreset]"))) { delete dayMeal(el.dataset.mealatreset).at; save(); renderAll(); return; }
      if ((el = t.closest("[data-stayhit]"))) {
        const h = stayHits[+el.dataset.stayhit];
        if (h) addStay({ label: shortLabel(h.display_name), lat: +(+h.lat).toFixed(5), lng: +(+h.lon).toFixed(5) });
        return;
      }
      if ((el = t.closest("[data-staypick]"))) { pickStayOnMap(el.dataset.staypick); return; }
      if ((el = t.closest("[data-staydefault]"))) { state.stayDefault = el.dataset.staydefault; save(); renderStay(); renderAll(); return; }
      if ((el = t.closest("[data-stayremove]"))) { removeStay(el.dataset.stayremove); return; }
      if ((el = t.closest("[data-mealoff]"))) { dayMeal(el.dataset.mealoff).off = true; save(); renderAll(); return; }
      if ((el = t.closest("[data-mealon]"))) { delete dayMeal(el.dataset.mealon).off; save(); renderAll(); return; }
      if ((el = t.closest("[data-mealreset]"))) { delete dayMeal(el.dataset.mealreset).dur; save(); renderAll(); return; }
      if ((el = t.closest("[data-mealdur]"))) {
        const m = mealsFor(state.activeDay).find((x) => x.key === el.dataset.mealdur);
        if (m) setMealDur(m.key, m.dur + +el.dataset.step);
        return;
      }
      if ((el = t.closest("[data-combo]"))) { addCombo(+el.dataset.combo); return; }
      if ((el = t.closest("[data-combodetail]"))) { addCombo(+el.dataset.combodetail, $("#detailDay").value); $("#detail").close(); return; }
      if ((el = t.closest("[data-add]"))) { e.stopPropagation(); addToDay(el.dataset.add); return; }
      if ((el = t.closest("[data-adddetail]"))) { addToDay(el.dataset.adddetail, $("#detailDay").value); $("#detail").close(); return; }
      if (t.closest("[data-close]")) { $("#detail").close(); return; }
      if ((el = t.closest("[data-remove]"))) { removeItem(el.dataset.remove); return; }
      if ((el = t.closest("[data-move]"))) { moveItem(el.dataset.move, +el.dataset.dir); return; }
      if ((el = t.closest("[data-dur]"))) {
        const item = dayData(state.activeDay).items.find((x) => x.uid === el.dataset.dur);
        if (item) setDuration(item.uid, item.dur + +el.dataset.step);
        return;
      }
      if ((el = t.closest("[data-resetdur]"))) {
        const item = dayData(state.activeDay).items.find((x) => x.uid === el.dataset.resetdur);
        if (item) setDuration(item.uid, placeById(item.id).duracao);
        return;
      }
      if (t.closest("input")) return;
      if ((el = t.closest("[data-day]"))) { state.activeDay = el.dataset.day; ui.focusUid = null; save(); renderAll(); renderStay(); return; }
      if ((el = t.closest("[data-focus]"))) { ui.focusUid = ui.focusUid === el.dataset.focus ? null : el.dataset.focus; renderTimeline(); renderMap(renderRecs()); return; }
      if ((el = t.closest("[data-open]"))) { openDetail(el.dataset.open); return; }
      if ((el = t.closest("#mobileTabs [data-view]"))) { ui.view = el.dataset.view; renderView(); }
    });
    document.addEventListener("change", (e) => {
      const ds = e.target.dataset || {};
      if (ds.mealcfg) {
        const c = state.meals[ds.mealcfg];
        if (ds.field === "on") c.on = e.target.checked;
        else if (ds.field === "at" && e.target.value) c.at = e.target.value;
        else if (ds.field === "dur") c.dur = Math.max(5, Math.min(240, Math.round(+e.target.value || c.dur)));
        save(); renderMealsCfg(); renderAll();
        return;
      }
      if (ds.stayprice || ds.staylabel) {
        const st = stayById(ds.stayprice || ds.staylabel);
        if (st && ds.stayprice) st.price = Math.max(0, +e.target.value || 0);
        if (st && ds.staylabel && e.target.value.trim()) st.label = e.target.value.trim();
        save(); renderStay(); renderAll();
        return;
      }
      if (ds.itemat) {
        const item = dayData(state.activeDay).items.find((x) => x.uid === ds.itemat);
        if (item && e.target.value) { item.at = e.target.value; save(); renderAll(); }
        return;
      }
      if (ds.mealat) {
        if (e.target.value) { dayMeal(ds.mealat).at = e.target.value; save(); renderAll(); }
        return;
      }
      if (ds.mealinput) {
        const v = parseDur(e.target.value);
        if (v === null || v <= 0) { toast("Use formatos como 45, 1h ou 1h15"); renderTimeline(); return; }
        setMealDur(ds.mealinput, v);
        return;
      }
      const u = ds.durinput;
      if (!u) return;
      const v = parseDur(e.target.value);
      if (v === null || v <= 0) { toast("Use formatos como 90, 1h30 ou 2:15"); renderTimeline(); return; }
      setDuration(u, v);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.dataset && (e.target.dataset.durinput || e.target.dataset.mealinput)) e.target.blur();
    });
    $("#detail").addEventListener("click", (e) => { if (e.target === $("#detail")) $("#detail").close(); });
    // Pré-visualiza o intervalo enquanto escolhe a volta.
    $("#datePicker").addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-dpday]");
      if (!el || !dp.start || dp.end || dp.hover === el.dataset.dpday) return;
      dp.hover = el.dataset.dpday; renderDatePicker();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDatePicker(); });
  }

  // ---------- API para outros módulos (js/conta.js) ----------
  function syncInputs() {
    ["people", "hotel", "food", "transport"].forEach((k) => { const el = $("#" + k); if (el) el.value = state[k]; });
  }
  window.TF = {
    getState: () => JSON.parse(JSON.stringify(state)),
    // Troca a viagem aberta (ex.: ao escolher outra viagem da conta) e redesenha tudo.
    loadState(dados, { silent = false } = {}) {
      state = normalizeState(JSON.parse(JSON.stringify(dados || {})));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignora */ }
      ui.focusUid = null;
      syncInputs(); renderCitySelect(); renderDateBtn(); renderAge(); renderMealsCfg(); renderStay(); renderAll();
      if (!silent) toast("Viagem carregada");
    },
    // Viagem "vazia"? (nada no roteiro e nenhuma hospedagem) — para decidir se vale importar para a conta.
    hasContent: () => Object.values(state.days).some((d) => (d.items || []).length) || (state.stays || []).length > 0,
    newState: () => defaultState(),
    onSave: (fn) => saveHooks.push(fn),
    toast, esc, fmtDay, fmtShort
  };

  // ---------- Início ----------
  renderCitySelect();
  renderDateBtn();
  renderAge();
  renderMealsCfg();
  renderStay();
  renderChips();
  bindSetup();
  bindFilters();
  bindDelegates();
  renderView();
  renderAll();

  // ---------- Rotas ----------
  // #/ → tela inicial (busca) · #/planejar → painel. Novas áreas (perfil, personas) entram aqui.
  rota("/", () => {
    document.body.classList.add("landing");
    window.scrollTo(0, 0);
  });
  rota("/planejar", () => {
    const vindoDoInicio = document.body.classList.contains("landing");
    document.body.classList.remove("landing");
    if (vindoDoInicio) window.scrollTo(0, 0);
    renderAll();
    loadAgenda();
    if (map) setTimeout(() => { map.invalidateSize(); renderMap(renderRecs()); }, 0);
  });
  iniciarRotas();
})();
