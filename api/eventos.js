// Vercel: GET /api/eventos — mesma lógica do serve.js, em modo serverless.
const agenda = require("../server/agenda");

module.exports = async (req, res) => {
  try {
    await agenda.handle(new URL(req.url, "http://localhost"), res, { serverless: true });
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ erro: "falha interna" }));
  }
};
