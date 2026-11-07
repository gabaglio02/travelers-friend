/*
 * Validação de dados não confiáveis (sem DOM nem estado; testes em tools/testes/seguranca.test.mjs).
 * Toda viagem passa por aqui ao entrar no site: navegador, conta, link de compartilhar e eventos da API.
 * Regra: campo com formato fixo (id, data, hora, número, opção de lista) só entra se tiver esse formato.
 * Texto livre (nome de hospedagem, por exemplo) continua como foi escrito: quem protege é o esc() ao desenhar.
 * O que é válido não muda: viagens existentes têm de sair daqui iguais.
 */
import { CATEGORIES, MEALS, MODES } from "./constantes.js";
import { parseISO, toISO } from "./util.js";

const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ehObjeto = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const CHAVES_PROIBIDAS = new Set(["__proto__", "prototype", "constructor"]);
const DIA_MS = 24 * 60 * 60 * 1000;
const TEXTO_MAX = 200;
// Limites de uma viagem: a interface não deixa passar deles (js/app.js). O que chegar acima é cortado aqui, e o
// relatório (opção "relatorio" de sanearViagem) diz o que saiu, para o site avisar antes de salvar.
// O que protege é o total da viagem (os dias guardados não têm limite de quantidade); o do dia é uma trava a mais.
export const LIMITES = Object.freeze({ itensPorViagem: 500, itensPorDia: 60, hospedagens: 50 });
const ITENS_POR_VIAGEM = LIMITES.itensPorViagem, ITENS_POR_DIA = LIMITES.itensPorDia, HOSPEDAGENS = LIMITES.hospedagens;
// itens: { "<dia>": quantos saíram (limite do dia ou da viagem) }; hospedagens: quantas passaram; invalidos: dias, itens e hospedagens
// descartados por formato inválido.
export const relatorioVazio = () => ({ itens: {}, hospedagens: 0, invalidos: 0 });
export const houveCortes = (r) => !!r && (Object.keys(r.itens).length > 0 || r.hospedagens > 0 || r.invalidos > 0);
const TRANSPORTES = ["publico", "ativo", "app", "alugado"];
// Limite dos campos enviados no link de compartilhar (o mesmo que TF.compartilhavel() produz).
const CAMPOS_COMPARTILHADOS = ["city", "start", "end", "people", "youngestAge", "food", "transport", "meals", "activeDay", "days", "nomes"];

const RE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;          // uid de item, hospedagem e pessoa do grupo
const RE_ID_LUGAR = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/;  // lugar do catálogo ou evento da API ("api:123")
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_HORA_EVENTO = /^([01]\d|2[0-4]):[0-5]\d$/;        // "24:00" existe em horários de funcionamento

export const idValido = (v) => typeof v === "string" && RE_ID.test(v);
export const idLugarValido = (v) => typeof v === "string" && RE_ID_LUGAR.test(v);
export const horaValida = (v) => typeof v === "string" && RE_HORA.test(v);
export function dataValida(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return toISO(parseISO(v)) === v; // recusa 2026-02-31
}
// Só links http(s); "javascript:", "data:" e afins viram "".
export function urlSegura(v) {
  if (typeof v !== "string") return "";
  try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:" ? u.href : ""; }
  catch (_) { return ""; }
}

// Número dentro de um intervalo; texto numérico ("3") é aceito; o resto vira "padrao".
function numero(v, min, max, padrao) {
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}
const texto = (v, max = TEXTO_MAX) => (typeof v === "string" ? v.slice(0, max) : "");

// Cópia rasa sem as chaves que mexem no protótipo de quem receber o objeto.
export function copiaSegura(o) {
  const out = {};
  if (ehObjeto(o)) Object.keys(o).forEach((k) => { if (!CHAVES_PROIBIDAS.has(k)) out[k] = o[k]; });
  return out;
}
const uidNovo = () => Math.random().toString(36).slice(2, 9) || "x";

// ---------- Dia e itens do roteiro ----------
function sanearItem(it, vistos) {
  if (!ehObjeto(it) || !idLugarValido(it.id)) return null;
  // uid inválido ou repetido não apaga o item: ele ganha um novo.
  let uid = it.uid;
  if (!idValido(uid) || vistos.has(uid)) { do { uid = uidNovo(); } while (vistos.has(uid)); }
  vistos.add(uid);
  const out = { uid, id: it.id, dur: numero(it.dur, 1, 10080, 60) };
  if (horaValida(it.at)) out.at = it.at;
  if (typeof it.mode === "string" && tem(MODES, it.mode)) out.mode = it.mode;
  if (typeof it.refeicao === "string" && tem(MEALS, it.refeicao)) out.refeicao = it.refeicao;
  return out;
}
function sanearRefeicoesDoDia(m) {
  const out = {};
  if (!ehObjeto(m)) return out;
  Object.keys(MEALS).forEach((k) => {
    if (!tem(m, k) || !ehObjeto(m[k])) return;
    const r = {};
    if (horaValida(m[k].at)) r.at = m[k].at;
    const dur = numero(m[k].dur, 1, 1440, null);
    if (dur != null) r.dur = dur;
    if (m[k].off === true) r.off = true;
    if (Object.keys(r).length) out[k] = r;
  });
  return out;
}
export function sanearDia(d, rel = null, iso = "") {
  if (!ehObjeto(d)) return null;
  const vistos = new Set();
  const lista = Array.isArray(d.items) ? d.items : [];
  const items = lista.slice(0, ITENS_POR_DIA).map((it) => sanearItem(it, vistos)).filter(Boolean);
  if (rel) {
    if (lista.length > ITENS_POR_DIA) rel.itens[iso] = lista.length - ITENS_POR_DIA;
    rel.invalidos += Math.min(lista.length, ITENS_POR_DIA) - items.length;
  }
  const out = { start: horaValida(d.start) ? d.start : "09:00", items };
  const meals = sanearRefeicoesDoDia(d.meals);
  if (Object.keys(meals).length) out.meals = meals;
  if (typeof d.returnMode === "string" && tem(MODES, d.returnMode)) out.returnMode = d.returnMode;
  if (d.semCarro === true) out.semCarro = true;
  if (idValido(d.stayId)) out.stayId = d.stayId;
  return out;
}
// Dias em ordem de data: passando do total da viagem, saem os lugares dos últimos dias.
function sanearDias(dias, rel) {
  const out = {};
  let total = 0;
  if (ehObjeto(dias)) Object.keys(dias).sort().forEach((iso) => {
    const d = dataValida(iso) ? sanearDia(dias[iso], rel, iso) : null;
    if (!d) { if (rel && !CHAVES_PROIBIDAS.has(iso)) rel.invalidos++; return; }
    const cabe = Math.max(0, ITENS_POR_VIAGEM - total);
    if (d.items.length > cabe) {
      if (rel) rel.itens[iso] = (rel.itens[iso] || 0) + d.items.length - cabe;
      d.items = d.items.slice(0, cabe);
    }
    total += d.items.length;
    out[iso] = d;
  });
  return out;
}

// ---------- Viagem ----------
export function refeicoesPadrao() {
  return {
    cafe: { on: true, at: "08:00", dur: 30 },
    almoco: { on: true, at: "12:30", dur: 60 },
    jantar: { on: true, at: "19:30", dur: 75 }
  };
}
function sanearRefeicoes(m) {
  const out = refeicoesPadrao();
  if (ehObjeto(m)) Object.keys(out).forEach((k) => {
    const v = tem(m, k) && ehObjeto(m[k]) ? m[k] : {};
    if (typeof v.on === "boolean") out[k].on = v.on;
    if (horaValida(v.at)) out[k].at = v.at;
    out[k].dur = numero(v.dur, 1, 1440, out[k].dur);
  });
  return out;
}
function sanearHospedagens(lista, rel) {
  const ids = new Set(), out = [];
  if (rel && Array.isArray(lista) && lista.length > HOSPEDAGENS) rel.hospedagens = lista.length - HOSPEDAGENS;
  for (const st of Array.isArray(lista) ? lista.slice(0, HOSPEDAGENS) : []) {
    if (!ehObjeto(st) || !idValido(st.id) || ids.has(st.id)) { if (rel) rel.invalidos++; continue; }
    ids.add(st.id);
    const h = { id: st.id, label: texto(st.label).trim() || "Hospedagem" };
    const preco = numero(st.price, 0, 1e7, null);
    if (preco != null) h.price = preco;
    const lat = numero(st.lat, -90, 90, null), lng = numero(st.lng, -180, 180, null);
    if (lat != null && lng != null) { h.lat = lat; h.lng = lng; }
    out.push(h);
  }
  return out;
}
function sanearCarro(c, padrao) {
  c = ehObjeto(c) ? c : {};
  const v = (k, min) => numero(c[k], min, 1e6, padrao[k]);
  return { diaria: numero(c.diaria, 0, 1e6, null), combustivel: v("combustivel", 0), consumo: v("consumo", 1), estacionamento: v("estacionamento", 0) };
}

/**
 * Viagem pronta para usar. Campos que este arquivo não conhece passam como estão (nunca são desenhados);
 * os outros módulos validam os seus (o grupo, por exemplo, em normalGrupo de js/grupo.js).
 * @param opcoes.padrao  valores de uma viagem nova (defaultState)
 * @param opcoes.cidadeValida(id)  a cidade existe no catálogo carregado?
 * @param opcoes.relatorio  (opcional) objeto de relatorioVazio(), preenchido com o que foi cortado
 */
export function sanearViagem(dados, { padrao, cidadeValida = () => true, relatorio = null }) {
  const s = copiaSegura(dados);
  const out = { ...s };
  out.city = typeof s.city === "string" && !CHAVES_PROIBIDAS.has(s.city) && cidadeValida(s.city) ? s.city : padrao.city;
  const datasOk = dataValida(s.start) && dataValida(s.end);
  out.start = datasOk ? s.start : padrao.start;
  out.end = datasOk ? s.end : padrao.end;
  out.activeDay = dataValida(s.activeDay) ? s.activeDay : out.start;
  out.people = Math.round(numero(s.people, 1, 999, padrao.people));
  out.youngest = numero(s.youngest, 0, 120, padrao.youngest);
  if (s.youngestAge != null) out.youngestAge = numero(s.youngestAge, 0, 120, padrao.youngest);
  out.hotel = numero(s.hotel, 0, 1e7, padrao.hotel);
  out.food = numero(s.food, 0, 1e7, padrao.food);
  out.transport = TRANSPORTES.includes(s.transport) ? s.transport : padrao.transport;
  out.carro = sanearCarro(s.carro, padrao.carro);
  out.days = sanearDias(s.days, relatorio);
  out.meals = sanearRefeicoes(s.meals);
  out.stays = sanearHospedagens(s.stays, relatorio);
  if (idValido(s.stayDefault)) out.stayDefault = s.stayDefault; else delete out.stayDefault;
  const orcamento = numero(s.budget, 0, 1e9, null);
  if (orcamento != null) out.budget = orcamento; else delete out.budget;
  return out;
}

/**
 * Roteiro recebido por link: vem de outra pessoa, então só entram os campos que o botão Compartilhar envia.
 * Hospedagens, orçamento e grupo ficam de fora mesmo que alguém os coloque na mão.
 * @returns a viagem pronta, ou null se nem as datas forem válidas.
 */
export function sanearCompartilhado(dados, opcoes) {
  if (!ehObjeto(dados) || !dataValida(dados.start) || !dataValida(dados.end)) return null;
  const base = {};
  CAMPOS_COMPARTILHADOS.forEach((k) => { if (tem(dados, k)) base[k] = dados[k]; });
  const out = sanearViagem(base, opcoes);
  Object.values(out.days).forEach((d) => { delete d.stayId; });
  const nomes = {};
  if (ehObjeto(dados.nomes)) Object.keys(dados.nomes).forEach((id) => {
    if (idLugarValido(id) && typeof dados.nomes[id] === "string") nomes[id] = texto(dados.nomes[id]);
  });
  out.nomes = nomes;
  return out;
}

// Muda as datas da viagem para começar em "novoInicio", mantendo a ordem dos dias.
export function moverDatas(dados, novoInicio) {
  const delta = Math.round((parseISO(novoInicio) - parseISO(dados.start)) / DIA_MS);
  const mover = (iso) => { const d = parseISO(iso); d.setDate(d.getDate() + delta); return toISO(d); };
  const days = {};
  Object.entries(dados.days || {}).forEach(([iso, dia]) => { days[mover(iso)] = dia; });
  return { ...dados, start: mover(dados.start), end: mover(dados.end), activeDay: mover(dados.start), days };
}

// ---------- Eventos da API (/api/eventos) ----------
// Os campos que entram no HTML sem texto livre têm formato fixo; texto livre segue para o esc() ao desenhar.
const TEXTOS_EVENTO = ["bairro", "municipio", "descricao", "comoChegar", "precoNota", "confirmar", "idade"];
const diasDaSemana = (l) => (Array.isArray(l) ? l.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : []);
export function sanearEvento(ev) {
  if (!ehObjeto(ev) || !idLugarValido(ev.id) || typeof ev.nome !== "string" || !ev.nome.trim()) return null;
  if (typeof ev.categoria !== "string" || !tem(CATEGORIES, ev.categoria)) return null;
  const lat = numero(ev.lat, -90, 90, null), lng = numero(ev.lng, -180, 180, null);
  if (lat == null || lng == null) return null;
  const temDatas = Array.isArray(ev.datas) && ev.datas.length > 0 && ev.datas.every(dataValida);
  const temPeriodo = ehObjeto(ev.periodo) && (ev.periodo.de || ev.periodo.ate)
    && (!ev.periodo.de || dataValida(ev.periodo.de)) && (!ev.periodo.ate || dataValida(ev.periodo.ate));
  if (!temDatas && !temPeriodo) return null;
  const out = { ...copiaSegura(ev), lat, lng, preco: numero(ev.preco, 0, 1e7, 0), duracao: numero(ev.duracao, 1, 10080, 120) };
  if (!temDatas) delete out.datas;
  if (!temPeriodo) delete out.periodo;
  TEXTOS_EVENTO.forEach((k) => { if (k in out && typeof out[k] !== "string") delete out[k]; });
  if (typeof out.idade !== "string") out.idade = "Livre";
  if ("inicio" in out && !RE_HORA_EVENTO.test(String(out.inicio))) delete out.inicio;
  if (ehObjeto(ev.horario) && RE_HORA_EVENTO.test(String(ev.horario.abre)) && RE_HORA_EVENTO.test(String(ev.horario.fecha))) {
    out.horario = { abre: ev.horario.abre, fecha: ev.horario.fecha, fechado: diasDaSemana(ev.horario.fechado) };
  } else {
    // O detalhe do lugar precisa de um horário: sem um válido, usa o do início ou o dia inteiro.
    out.horario = { abre: out.inicio && out.inicio !== "24:00" ? out.inicio : "00:00", fecha: "23:59", fechado: [] };
  }
  if ("gratisDias" in out) out.gratisDias = diasDaSemana(out.gratisDias);
  if ("local" in out && !idLugarValido(out.local)) delete out.local;
  if ("fonte" in out) { const u = urlSegura(out.fonte); if (u) out.fonte = ev.fonte; else delete out.fonte; }
  if (!Number.isFinite(out.nota) || !Number.isFinite(out.avaliacoes)) { delete out.nota; delete out.avaliacoes; }
  if ("lojasRoupa" in out && !(Array.isArray(out.lojasRoupa) && out.lojasRoupa.every((l) => typeof l === "string"))) delete out.lojasRoupa;
  return out;
}
