// Quem pode disparar /api/cron: só a Vercel, que manda "Authorization: Bearer <CRON_SECRET>" num GET.
// Sem CRON_SECRET configurado (ou curto demais) nada roda: falta de configuração bloqueia, nunca libera.
// As respostas não dizem o motivo (segredo ausente, errado ou método), só o log do servidor diz.
const crypto = require("crypto");

const MINIMO = 16; // caracteres do segredo
const NEGADO = { status: 401, corpo: { erro: "não autorizado" } };

const resumo = (texto) => crypto.createHash("sha256").update(String(texto), "utf8").digest();

function autorizarCron(req, segredo) {
  if (!req || req.method !== "GET") return { status: 405, corpo: { erro: "método não permitido" }, cabecalhos: { Allow: "GET" } };
  if (typeof segredo !== "string" || segredo.length < MINIMO) return { ...NEGADO, motivo: "CRON_SECRET ausente ou curto" };
  const enviado = req.headers && req.headers.authorization;
  if (typeof enviado !== "string" || !enviado) return { ...NEGADO, motivo: "sem Authorization" };
  // Compara os resumos (mesmo tamanho), em tempo constante, para não vazar quanto do segredo bateu.
  const ok = crypto.timingSafeEqual(resumo(enviado), resumo("Bearer " + segredo));
  return ok ? { ok: true } : { ...NEGADO, motivo: "Authorization não confere" };
}

module.exports = { autorizarCron, MINIMO };
