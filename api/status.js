// Vercel: GET /api/status — resultado da última coleta de cada fonte.
const agenda = require("../server/agenda");

module.exports = async (req, res) => {
  try {
    await agenda.handle(new URL("/api/status", "http://localhost"), res, { serverless: true });
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ erro: "falha interna" }));
  }
};
