// Autorização do /api/cron, sem rodar a rotina de verdade. Uso: node tools/testes/cron.test.mjs
// A agenda e o aviso por e-mail são trocados por versões falsas antes de carregar api/cron.js:
// nada acessa a rede, o Supabase ou o Resend, e o endpoint publicado nunca é chamado.
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const require = createRequire(import.meta.url);

let ok = 0, falhou = 0;
const certo = (c, m, extra = "") => { c ? ok++ : falhou++; console.log((c ? "OK   " : "FALHA") + " " + m + (c ? "" : " " + extra)); };

// ---------- Versões falsas da rotina ----------
const chamadas = { agenda: 0, avisos: 0 };
let agendaFalha = false;
const falso = (arquivo, exports) => {
  const id = require.resolve(path.join(ROOT, arquivo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
falso("server/agenda.js", { atualizarProximos: async () => { chamadas.agenda++; if (agendaFalha) throw new Error("detalhe interno: tabela agenda_cache"); } });
falso("server/avisos.js", { avisarErros: async () => { chamadas.avisos++; return { enviado: false, motivo: "não configurado" }; } });

const { autorizarCron, MINIMO } = require(path.join(ROOT, "server/cron-auth.js"));
const cron = require(path.join(ROOT, "api/cron.js"));

// ---------- autorizarCron ----------
const SEGREDO = "s3gr3do-de-teste-com-32-caracteres!";
const req = (method, authorization) => ({ method, headers: authorization === undefined ? {} : { authorization } });
const casos = [
  ["sem CRON_SECRET", req("GET", "Bearer qualquer"), undefined, 401],
  ["CRON_SECRET vazio", req("GET", "Bearer "), "", 401],
  ["CRON_SECRET curto", req("GET", "Bearer abc"), "abc", 401],
  ["sem Authorization", req("GET"), SEGREDO, 401],
  ["Authorization vazio", req("GET", ""), SEGREDO, 401],
  ["segredo errado", req("GET", "Bearer outro-segredo-de-32-caracteres!!"), SEGREDO, 401],
  ["sem o prefixo Bearer", req("GET", SEGREDO), SEGREDO, 401],
  ["bearer minúsculo", req("GET", "bearer " + SEGREDO), SEGREDO, 401],
  ["espaço a mais", req("GET", "Bearer  " + SEGREDO), SEGREDO, 401],
  ["segredo com sobra no fim", req("GET", "Bearer " + SEGREDO + "x"), SEGREDO, 401],
  ["Authorization repetido (lista)", { method: "GET", headers: { authorization: ["Bearer " + SEGREDO] } }, SEGREDO, 401],
  ["POST com o segredo certo", req("POST", "Bearer " + SEGREDO), SEGREDO, 405],
  ["HEAD com o segredo certo", req("HEAD", "Bearer " + SEGREDO), SEGREDO, 405],
  ["OPTIONS", req("OPTIONS"), SEGREDO, 405],
  ["sem objeto de pedido", null, SEGREDO, 405]
];
for (const [nome, r, seg, status] of casos) {
  const a = autorizarCron(r, seg);
  certo(!a.ok && a.status === status, `autorizarCron: ${nome} → ${status}`, JSON.stringify(a));
}
certo(autorizarCron(req("GET", "Bearer " + SEGREDO), SEGREDO).ok === true, "autorizarCron: GET com o segredo certo → liberado");
certo(MINIMO >= 16, "segredo mínimo de 16 caracteres");

// ---------- api/cron.js com a rotina falsa ----------
const resposta = () => {
  const r = { status: 0, cab: {}, corpo: "" };
  r.writeHead = (s, c) => { r.status = s; r.cab = c || {}; };
  r.end = (b) => { r.corpo = String(b || ""); };
  return r;
};
async function chamar(r, segredo) {
  const antes = process.env.CRON_SECRET;
  if (segredo === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = segredo;
  const res = resposta();
  const logs = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {}; // o log do servidor não interessa aqui
  try { await cron(r, res); } finally { [console.warn, console.error, console.log] = logs; }
  if (antes === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = antes;
  return res;
}
const semVazamento = (corpo) => !/CRON_SECRET|Bearer|agenda_cache|motivo|stack|Error|configurad/i.test(corpo) && !corpo.includes(SEGREDO);

let res = await chamar(req("GET"), undefined);
certo(res.status === 401 && chamadas.agenda === 0 && chamadas.avisos === 0, "handler sem CRON_SECRET: 401 e a rotina não roda");
certo(semVazamento(res.corpo), "resposta 401 não revela o motivo", res.corpo);
res = await chamar(req("GET", "Bearer errado"), SEGREDO);
certo(res.status === 401 && chamadas.agenda === 0, "handler com segredo errado: 401 e a rotina não roda");
res = await chamar(req("POST", "Bearer " + SEGREDO), SEGREDO);
certo(res.status === 405 && res.cab.Allow === "GET" && chamadas.agenda === 0, "handler com POST: 405, Allow: GET, a rotina não roda");
res = await chamar(req("GET", "Bearer " + SEGREDO), SEGREDO);
certo(res.status === 200 && chamadas.agenda === 1 && chamadas.avisos === 1, "handler autorizado: 200 e a rotina (falsa) roda uma vez");
certo(res.corpo === '{"ok":true}' && semVazamento(res.corpo), "resposta 200 não traz detalhes internos (nem o estado do e-mail)", res.corpo);
certo(/no-store/.test(res.cab["Cache-Control"] || ""), "resposta do cron não fica em cache");
agendaFalha = true;
res = await chamar(req("GET", "Bearer " + SEGREDO), SEGREDO);
certo(res.status === 500 && semVazamento(res.corpo), "falha na rotina: 500 sem detalhes internos", res.corpo);

console.log(`\n${ok} ok, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
