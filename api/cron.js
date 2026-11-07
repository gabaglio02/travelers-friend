// Vercel Cron (vercel.json): atualiza a agenda dos próximos meses uma vez por dia
// e, se configurado, manda por e-mail o resumo dos erros do site e das perguntas novas (server/avisos.js).
// Só roda com a variável CRON_SECRET configurada (16+ caracteres): a Vercel manda "Authorization: Bearer <CRON_SECRET>".
// Sem ela, ou com outro método/cabeçalho, nada é executado (server/cron-auth.js).
const agenda = require("../server/agenda");
const { avisarErros } = require("../server/avisos");
const { autorizarCron } = require("../server/cron-auth");

const responder = (res, status, corpo, cabecalhos = {}) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cabecalhos });
  res.end(JSON.stringify(corpo));
};

module.exports = async (req, res) => {
  const acesso = autorizarCron(req, process.env.CRON_SECRET);
  if (!acesso.ok) {
    if (acesso.motivo) console.warn("[cron] recusado:", acesso.motivo);
    return responder(res, acesso.status, acesso.corpo, acesso.cabecalhos);
  }
  try {
    await agenda.atualizarProximos();
    // O aviso de erros nunca derruba a atualização da agenda; o resultado fica só no log.
    const erros = await avisarErros().catch((err) => { console.error("[avisos]", err); return { enviado: false }; });
    console.log("[cron] agenda atualizada; aviso de erros:", erros && erros.enviado ? "enviado" : "não enviado");
    responder(res, 200, { ok: true });
  } catch (err) {
    console.error("[cron]", err);
    responder(res, 500, { erro: "falha interna" });
  }
};
