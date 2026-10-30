// Vercel Cron (vercel.json): atualiza a agenda dos próximos meses uma vez por dia.
// Com a variável CRON_SECRET definida, a Vercel manda "Authorization: Bearer <CRON_SECRET>"
// e qualquer outra chamada é recusada.
const agenda = require("../server/agenda");

module.exports = async (req, res) => {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.authorization !== "Bearer " + segredo) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ erro: "não autorizado" }));
  }
  await agenda.atualizarProximos();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, em: new Date().toISOString() }));
};
