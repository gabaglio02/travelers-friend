// Vercel Cron (vercel.json): atualiza a agenda dos próximos meses uma vez por dia
// e, se configurado, manda por e-mail o resumo dos erros do site (server/avisos.js).
// Com a variável CRON_SECRET definida, a Vercel manda "Authorization: Bearer <CRON_SECRET>"
// e qualquer outra chamada é recusada.
const agenda = require("../server/agenda");
const { avisarErros } = require("../server/avisos");

module.exports = async (req, res) => {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.authorization !== "Bearer " + segredo) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ erro: "não autorizado" }));
  }
  await agenda.atualizarProximos();
  // O aviso de erros nunca derruba a atualização da agenda.
  const erros = await avisarErros().catch((err) => { console.error("[avisos]", err); return { enviado: false, motivo: "falhou" }; });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, em: new Date().toISOString(), erros }));
};
