// Testes de segurança dos dados de viagem (js/core/sanitizar.js). Uso: node tools/testes/seguranca.test.mjs
// Payloads controlados: só marcação inofensiva, nada é executado (estes testes nem têm navegador).
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const raiz = new URL("../../", import.meta.url);
const S = await import(new URL("js/core/sanitizar.js", raiz));
const { esc, money, moneyExact } = await import(new URL("js/core/util.js", raiz));
// js/grupo.js importa módulos de tela; normalGrupo em si é puro, então bastam estes dois enfeites.
globalThis.document = { addEventListener() {} };
globalThis.window = { addEventListener() {} };
const { normalGrupo, dadosDoGrupo } = await import(new URL("js/grupo.js", raiz));

let ok = 0, falhou = 0;
const certo = (c, m, extra = "") => { c ? ok++ : falhou++; console.log((c ? "OK   " : "FALHA") + " " + m + (c ? "" : " " + extra)); };
const igual = (a, b, m) => { try { assert.deepEqual(a, b); certo(true, m); } catch (e) { certo(false, m, e.message.slice(0, 600)); } };

const padrao = () => ({ city: "sp", start: "2030-03-01", end: "2030-03-03", people: 2, youngest: 18, hotel: 250, food: 120, transport: "publico",
  carro: { diaria: null, combustivel: 6.3, consumo: 12, estacionamento: 0 }, days: {}, activeDay: "2030-03-01" });
const opcoes = { padrao: padrao(), cidadeValida: (id) => id === "sp" };
const sanear = (d) => S.sanearViagem(d, opcoes);
const compart = (d) => S.sanearCompartilhado(d, opcoes);

// Tudo que vira atributo ou HTML sem texto livre: nenhum caractere de marcação pode sobrar.
const MARCACAO = /[<>"'`]/;
const PAYLOADS = [
  `<b>inofensivo</b>`,
  `<script>window.__tf=1</script>`,
  `"><img src=x onerror="window.__tf=1">`,
  `' onmouseover='window.__tf=1`,
  `<svg onload=window.__tf=1>`,
  `javascript:window.__tf=1`,
  `data:text/html,<i>x</i>`,
  `</textarea><iframe srcdoc="x">`,
  `__proto__`,
  ``
];

// Viagem legítima, como o site grava hoje.
const legitima = () => ({
  city: "sp", start: "2030-03-01", end: "2030-03-03", people: 4, youngest: 12, youngestAge: 13, hotel: 300, food: 150, transport: "alugado",
  carro: { diaria: 180, combustivel: 6.1, consumo: 11.5, estacionamento: 30 }, activeDay: "2030-03-02", budget: 5000,
  meals: { cafe: { on: false, at: "07:30", dur: 20 }, almoco: { on: true, at: "13:00", dur: 90 }, jantar: { on: true, at: "20:00", dur: 75 } },
  stays: [{ id: "s1", label: "Hotel Centro, Rua Augusta", price: 400, lat: -23.55, lng: -46.65 }, { id: "smgk2", label: "Casa da Ana & Bia", price: 0 }],
  stayDefault: "s1",
  days: {
    "2030-03-01": { start: "08:30", items: [
      { uid: "ab12cd3", id: "masp", dur: 120 },
      { uid: "x9y8z7w", id: "ibirapuera", dur: 90, at: "14:00", mode: "metro" },
      { uid: "q1w2e3r", id: "api:123", dur: 150, refeicao: "almoco" }
    ], meals: { almoco: { at: "12:00", dur: 45 }, jantar: { off: true } }, returnMode: "carro", semCarro: true, stayId: "smgk2" },
    "2030-03-02": { start: "09:00", items: [] }
  },
  grupo: { participantes: [], indispensaveis: {}, removidos: [] },
  campoFuturo: { qualquer: "coisa" }
});

console.log("\n# Viagens existentes ficam intactas");
{
  const v = legitima();
  igual(sanear(v), v, "viagem completa legítima sai idêntica");
  const nova = sanear(padrao());
  igual(nova.days, {}, "viagem nova: dias vazios");
  igual(nova.meals, S.refeicoesPadrao(), "viagem nova: refeições padrão");
  certo(sanear(sanear(legitima())).days["2030-03-01"].items[0].uid === "ab12cd3", "sanear duas vezes não muda nada");
  const passada = { ...legitima(), start: "2019-05-01", end: "2019-05-03", activeDay: "2019-05-01" };
  certo(sanear(passada).start === "2019-05-01", "viagem antiga mantém as datas (lembranças)");
  const orfao = legitima(); orfao.days["2025-01-01"] = { start: "10:00", items: [{ uid: "aaaaaaa", id: "masp", dur: 60 }] };
  certo(sanear(orfao).days["2025-01-01"].items.length === 1, "dia fora das datas atuais continua guardado");
  const semInicio = { items: [{ uid: "a1", id: "masp", dur: 60 }] };
  certo(S.sanearDia(semInicio).start === "09:00", "dia sem horário começa às 09:00, como no roteiro");
  const sumiu = sanear({ ...legitima(), days: { "2030-03-01": { start: "09:00", items: [{ uid: "zzz", id: "evento-que-saiu-do-catalogo", dur: 60 }] } } });
  certo(sumiu.days["2030-03-01"].items.length === 1, "item de lugar que saiu do catálogo não é apagado");
}

console.log("\n# Campos com formato fixo não deixam marcação passar");
for (const p of PAYLOADS) {
  const v = sanear({
    ...legitima(), start: p, end: p, activeDay: p, people: p, hotel: p, food: p, budget: p, transport: p, city: p, stayDefault: p, youngest: p, youngestAge: p,
    carro: { diaria: p, combustivel: p, consumo: p, estacionamento: p },
    meals: { cafe: { on: p, at: p, dur: p }, [p || "x"]: { at: p } },
    stays: [{ id: "s1", label: "Hotel", price: p, lat: p, lng: p }, { id: p, label: "x" }],
    days: {
      [p || "y"]: { start: "09:00", items: [{ uid: "a", id: "masp", dur: 60 }] },
      "2030-03-01": { start: p, returnMode: p, stayId: p, semCarro: p, meals: { almoco: { at: p, dur: p, off: p }, [p || "x"]: { at: p } }, items: [{ uid: p, id: "masp", dur: p, at: p, mode: p, refeicao: p }, { uid: "b", id: p, dur: 60 }] }
    }
  });
  const fixos = JSON.stringify([v.start, v.end, v.activeDay, v.people, v.hotel, v.food, v.budget, v.transport, v.city, v.stayDefault, v.youngest, v.youngestAge, v.carro, v.meals, v.stays.map((s) => ({ ...s, label: 0 })), v.days].map((x) => x ?? null));
  const fixosSemAspasDoJson = fixos.replace(/"/g, "");
  certo(!MARCACAO.test(fixosSemAspasDoJson) && !/onerror|onload|onmouseover|javascript:|script|iframe/.test(fixos), "campos fixos limpos: " + (p || "(vazio)"), fixos.slice(0, 300));
  certo(v.days["2030-03-01"].items.length === (S.idLugarValido(p) ? 2 : 1), "item válido fica e id de lugar manipulado sai: " + (p || "(vazio)"));
  certo(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(v.days["2030-03-01"].items[0].uid), "uid manipulado é trocado por um novo: " + (p || "(vazio)"));
}
certo(esc(PAYLOADS[2]).indexOf("<") < 0 && esc(PAYLOADS[3]).indexOf("'") < 0, "esc() neutraliza tags e aspas");

console.log("\n# Texto livre fica como escrito (o esc() protege ao desenhar)");
{
  const nome = `Hotel <b>Sol</b> & "Lua"`;
  const v = sanear({ ...legitima(), stays: [{ id: "s1", label: nome }] });
  certo(v.stays[0].label === nome, "nome de hospedagem preservado");
  certo(!esc(v.stays[0].label).includes("<"), "e não vira HTML com esc()");
  certo(sanear({ ...legitima(), stays: [{ id: "s1", label: 5 }] }).stays[0].label === "Hospedagem", "nome que não é texto vira genérico");
}

console.log("\n# Dinheiro nunca devolve texto cru");
certo(!money("<b>x</b>").includes("<"), "money() com texto");
certo(!moneyExact("<b>x</b>").includes("<"), "moneyExact() com texto");
certo(money(0) === "Grátis", "money(0) continua Grátis");
certo(money(1500).replace(/\s/g, " ") === "R$ 1.500", "money(1500) não muda", money(1500));
certo(moneyExact(12.5).replace(/\s/g, " ") === "R$ 12,50", "moneyExact(12,5) não muda", moneyExact(12.5));

console.log("\n# Conteúdo malformado não derruba nada");
for (const lixo of [null, undefined, 5, "texto", [], true]) {
  const nome = JSON.stringify(lixo) ?? "undefined";
  try {
    const v = sanear(lixo);
    certo(v.start === "2030-03-01" && v.city === "sp", "viagem = " + nome + " vira viagem nova");
  } catch (e) { certo(false, "viagem = " + nome, e.message); }
  certo(compart(lixo) === null, "roteiro por link = " + nome + " é recusado");
  try {
    const v = sanear({ ...padrao(), days: { "2030-03-01": lixo }, stays: lixo, meals: lixo, carro: lixo });
    certo(Array.isArray(v.stays) && !v.days["2030-03-01"] && v.meals.cafe.at === "08:00", "campos internos = " + nome);
  } catch (e) { certo(false, "campos internos = " + nome, e.message); }
}
{
  const d = S.sanearDia({ items: "nao-e-lista" });
  igual(d.items, [], "items que não é lista vira lista vazia");
  const uids = S.sanearDia({ items: [{ uid: "aaa", id: "masp", dur: 60 }, { uid: "aaa", id: "ibira", dur: 60 }] }).items.map((i) => i.uid);
  certo(uids[0] === "aaa" && uids[1] !== "aaa", "uid repetido no mesmo dia ganha outro");
  certo(S.sanearDia({ items: Array(5000).fill({ uid: "a", id: "masp", dur: 60 }) }).items.length === 200, "excesso de itens é cortado");
  certo(!S.dataValida("2030-02-31") && S.dataValida("2028-02-29"), "data impossível é recusada; 29/02 de ano bissexto passa");
  certo(!S.horaValida("24:00") && !S.horaValida("9:00") && S.horaValida("23:59"), "hora só no formato do campo de horário");
}

console.log("\n# Protótipo");
{
  const m = JSON.parse(`{"__proto__":{"poluido":"sim"},"constructor":{"x":1},"city":"__proto__","days":{"__proto__":{"items":[]}},"meals":{"__proto__":{"at":"10:00"}},"start":"2030-03-01","end":"2030-03-02"}`);
  const v = sanear(m);
  certo(v.poluido === undefined && Object.getPrototypeOf(v) === Object.prototype, "__proto__ no topo não muda o protótipo");
  certo(({}).poluido === undefined, "nada vaza para Object.prototype");
  certo(v.city === "sp", "cidade __proto__ vira a padrão");
  certo(Object.keys(v.days).length === 0, "dia __proto__ é descartado");
  certo(S.sanearEvento(JSON.parse(`{"__proto__":{"x":1},"id":"ev1","nome":"A","categoria":"show","lat":-23,"lng":-46,"datas":["2030-01-01"]}`)).x === undefined, "evento com __proto__");
  const g = normalGrupo(JSON.parse(`{"participantes":[{"id":"__proto__","nome":"A"},{"id":"p1","nome":"B"}],"indispensaveis":{"__proto__":["p1"],"masp":["p1"]}}`));
  certo(g.participantes.length === 1 && g.participantes[0].id === "p1", "grupo recusa id __proto__");
  igual(Object.keys(g.indispensaveis), ["masp"], "grupo recusa lugar __proto__");
  certo(Object.getPrototypeOf(g.indispensaveis) === Object.prototype, "indispensaveis mantém o protótipo");
}

console.log("\n# Compartilhamento: roteiros legítimos");
{
  // O mesmo que TF.compartilhavel() produz.
  const enviado = { city: "sp", start: "2030-03-01", end: "2030-03-02", people: 3, youngestAge: 16, food: 100, transport: "publico", activeDay: "2030-03-01",
    meals: { cafe: { on: true, at: "08:00", dur: 30 }, almoco: { on: true, at: "12:30", dur: 60 }, jantar: { on: true, at: "19:30", dur: 75 } },
    days: { "2030-03-01": { start: "09:00", items: [{ uid: "ab12cd3", id: "masp", dur: 120, at: "10:00" }], meals: { jantar: { off: true } } }, "2030-03-02": { start: "10:00", items: [] } },
    nomes: { masp: "MASP" } };
  const r = compart(enviado);
  igual(r.days, enviado.days, "dias chegam iguais");
  igual(r.meals, enviado.meals, "refeições chegam iguais");
  igual(r.nomes, enviado.nomes, "nomes chegam iguais");
  certo(r.people === 3 && r.food === 100 && r.youngestAge === 16 && r.transport === "publico", "pessoas, alimentação, idade e transporte chegam iguais");
  const movida = S.moverDatas(r, "2030-04-10");
  certo(movida.start === "2030-04-10" && movida.end === "2030-04-11" && movida.activeDay === "2030-04-10", "copiar: datas mudam junto com a ida");
  igual(Object.keys(movida.days), ["2030-04-10", "2030-04-11"], "copiar: dias acompanham");
  igual(movida.days["2030-04-10"], enviado.days["2030-03-01"], "copiar: conteúdo do dia preservado");
  const nv = sanear(movida);
  igual(nv.days, movida.days, "roteiro copiado é aceito como viagem");
  const meses = S.moverDatas(compart({ ...enviado, start: "2030-01-31", end: "2030-02-01", days: { "2030-01-31": { start: "09:00", items: [] }, "2030-02-01": { start: "09:00", items: [] } } }), "2030-02-28");
  igual(Object.keys(meses.days), ["2030-02-28", "2030-03-01"], "copiar: virada de mês");
}

console.log("\n# Compartilhamento: o que não pode vir pelo link");
{
  const r = compart({ city: "sp", start: "2030-03-01", end: "2030-03-02", people: 2, budget: 999, hotel: 1, stays: [{ id: "s1", label: "<b>x</b>", price: 1 }], stayDefault: "s1",
    grupo: { participantes: [{ id: "p1", nome: "<b>x</b>" }], removidos: ["p9"] }, extra: "<b>x</b>",
    days: { "2030-03-01": { start: "09:00", stayId: "s1", items: [] } } });
  certo(r.budget === undefined, "orçamento não entra");
  certo(r.hotel === 250, "valor de hospedagem não entra");
  igual(r.stays, [], "hospedagens não entram");
  certo(r.stayDefault === undefined, "hospedagem padrão não entra");
  certo(r.grupo === undefined, "grupo não entra");
  certo(r.extra === undefined, "campo desconhecido não entra");
  certo(r.days["2030-03-01"].stayId === undefined, "hospedagem do dia não entra");
  certo(compart({ city: "sp", start: `2030-03-01"><i>`, end: "2030-03-02" }) === null, "data manipulada recusa o roteiro");
  certo(compart({ city: "sp", start: "2030-03-01", end: 5 }) === null, "data que não é texto recusa o roteiro");
  const n = compart({ city: "sp", start: "2030-03-01", end: "2030-03-02", nomes: { "<i>": "x", masp: { a: 1 }, ok: "Nome <b>livre</b>" } });
  igual(n.nomes, { ok: "Nome <b>livre</b>" }, "nomes: chave ou valor estranho sai; texto livre fica para o esc()");
}

console.log("\n# URLs");
for (const u of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,x", "vbscript:x", "file:///c:/x", "blob:http://x/y", "nao e url", "", null, 5]) {
  certo(S.urlSegura(u) === "", "recusada: " + u);
}
certo(S.urlSegura("https://www.sympla.com.br/evento?a=1") === "https://www.sympla.com.br/evento?a=1", "https passa");
certo(S.urlSegura("http://exemplo.com/") === "http://exemplo.com/", "http passa");

console.log("\n# Eventos vindos da API");
{
  const bom = () => ({ id: "api:123", nome: "Show", categoria: "show", bairro: "Centro", lat: -23.5, lng: -46.6, datas: ["2030-03-01"], inicio: "21:00",
    horario: { abre: "21:00", fecha: "23:59", fechado: [] }, preco: 80, idade: "16 anos", duracao: 150, comoChegar: "Metrô", descricao: "D", fonte: "https://x.com/e", origem: "feeds" });
  igual(S.sanearEvento(bom()), bom(), "evento legítimo sai igual");
  certo(S.sanearEvento({ ...bom(), id: `x"><img src=x>` }) === null, "id manipulado recusa");
  certo(S.sanearEvento({ ...bom(), categoria: `x"><img>` }) === null, "categoria desconhecida recusa");
  certo(S.sanearEvento({ ...bom(), categoria: "constructor" }) === null, "categoria 'constructor' recusa");
  certo(S.sanearEvento({ ...bom(), lat: "x" }) === null, "sem coordenada recusa");
  certo(S.sanearEvento({ ...bom(), datas: ["<i>"] }) === null, "data manipulada recusa");
  certo(S.sanearEvento({ ...bom(), nome: 5 }) === null, "nome que não é texto recusa");
  certo(S.sanearEvento(null) === null, "null recusa");
  const e = S.sanearEvento({ ...bom(), fonte: "javascript:alert(1)", inicio: `<i>`, preco: "<b>", duracao: "<b>", nota: "<b>", avaliacoes: 1, local: `"><i>`,
    horario: { abre: `<i>`, fecha: "x", fechado: "y" }, gratisDias: ["<i>", 2], lojasRoupa: "<i>" });
  certo(e.fonte === undefined, "fonte javascript: sai");
  certo(e.inicio === undefined, "início manipulado sai");
  certo(e.preco === 0 && e.duracao === 120, "preço e duração voltam a número");
  certo(e.nota === undefined && e.local === undefined && e.lojasRoupa === undefined, "nota, local e lojas estranhos saem");
  igual(e.horario, { abre: "00:00", fecha: "23:59", fechado: [] }, "horário manipulado vira o dia inteiro");
  igual(e.gratisDias, [2], "dias grátis só com números válidos");
}

console.log("\n# Catálogo real do site");
{
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const f of ["sp", "sp-eventos", "sp-compras", "sp-restaurantes", "sp-fotos"]) vm.runInContext(fs.readFileSync(new URL(`js/data/${f}.js`, raiz), "utf8"), ctx);
  const cidade = ctx.window.TF_CITIES.sp, lugares = JSON.parse(JSON.stringify(cidade.lugares));
  certo(lugares.length > 500, "catálogo carregado: " + lugares.length + " lugares");
  certo(lugares.every((p) => S.idLugarValido(p.id)), "todo id do catálogo é aceito no roteiro", lugares.filter((p) => !S.idLugarValido(p.id)).map((p) => p.id).slice(0, 5).join());
  // /api/eventos também devolve os eventos do arquivo: nenhum pode ser perdido ou alterado.
  const eventos = lugares.filter((p) => p.datas || p.periodo);
  const diferentes = eventos.filter((ev) => { try { assert.deepEqual(S.sanearEvento(ev), ev); return false; } catch (_) { return true; } });
  certo(eventos.length > 10 && !diferentes.length, eventos.length + " eventos do arquivo saem iguais", diferentes.slice(0, 5).map((d) => d.id + ": " + JSON.stringify(S.sanearEvento(d))?.slice(0, 200)).join(" | "));
  certo(eventos.every((p) => !p.fonte || S.urlSegura(p.fonte)), "fontes do arquivo são http(s)");
  // Roteiro com todos os lugares: nenhum item se perde (regressão de roteiro e custos).
  const itens = lugares.map((p, i) => ({ uid: "u" + i, id: p.id, dur: p.duracao }));
  const dias = {};
  for (let i = 0, n = 0; i < itens.length; i += 100, n++) dias[new Date(Date.UTC(2030, 0, 1 + n)).toISOString().slice(0, 10)] = { start: "09:00", items: itens.slice(i, i + 100) };
  igual(sanear({ ...padrao(), days: dias }).days, dias, "roteiro com todo o catálogo não perde nem muda item");
}

console.log("\n# Grupo");
{
  const g = normalGrupo({ participantes: [{ id: "p1a2b", nome: "Ana", notas: { museus: 5 }, puladas: ["noite"], respondido: "2030-01-01" }, { id: `x"><i>`, nome: "B" }], indispensaveis: { masp: ["p1a2b"], "<i>": ["p1a2b"] }, removidos: ["p7k2m"] });
  certo(g.participantes.length === 1 && g.participantes[0].nome === "Ana" && g.participantes[0].notas.museus === 5, "participante legítimo fica; id manipulado sai");
  igual(g.indispensaveis, { masp: ["p1a2b"] }, "lugar legítimo fica; manipulado sai");
  igual(g.removidos, ["p7k2m"], "lista de removidos preservada");
  const gv = normalGrupo({ participantes: [{ id: "voce", nome: "Falso" }, { id: "p1", nome: "Ana" }], indispensaveis: { masp: ["voce", "p1", "p9"] } });
  certo(gv.participantes.length === 1 && gv.participantes[0].id === "p1", "vaga não pode usar o id reservado de quem organiza");
  igual(gv.indispensaveis, { masp: ["voce", "p1"] }, "marcação de quem organiza fica; de vaga inexistente sai");
  const dv = dadosDoGrupo(gv, () => null, null, { notas: { museus: 5 }, puladas: [] });
  certo(dv.participantes[0].nome === "Você" && dv.respondentes === 1 && dv.indispensaveis[0].todos && dv.indispensaveis[0].por[0].nome === "Você", "resumo com quem organiza: entra como Você e conta em \"todos\"");
  certo(!dadosDoGrupo({ participantes: [{ id: "p1", nome: "Ana" }], indispensaveis: { masp: ["p1"] } }).indispensaveis[0].todos, "sem a marcação de quem organiza, não é \"todos\"");
}

console.log("\n# Configuração de segurança");
{
  const cfg = JSON.parse(fs.readFileSync(new URL("vercel.json", raiz), "utf8"));
  const h = Object.fromEntries(cfg.headers[0].headers.map((x) => [x.key, x.value]));
  const csp = h["Content-Security-Policy"];
  const script = csp.split(";").find((d) => d.trim().startsWith("script-src"));
  certo(!!csp && !script.includes("'unsafe-inline'") && !script.includes("'unsafe-eval'"), "CSP não permite script embutido nem eval");
  certo(csp.includes("object-src 'none'") && csp.includes("base-uri 'self'") && csp.includes("frame-ancestors 'none'"), "CSP fecha object, base e iframes");
  certo(h["X-Content-Type-Options"] === "nosniff", "nosniff");
  const html = fs.readFileSync(new URL("index.html", raiz), "utf8");
  certo(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/\son[a-z]+=/i.test(html), "index.html sem script embutido nem onclick=");
  const privacidade = fs.readFileSync(new URL("privacidade.html", raiz), "utf8");
  certo(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(privacidade) && !/\son[a-z]+=/i.test(privacidade), "privacidade.html sem script embutido nem onclick=");
}

console.log(`\n${ok} ok, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
