// Vercel: GET /api/status — resultado da última coleta de cada fonte.
const agenda = require("../server/agenda");

module.exports = async (req, res) => {
  await agenda.handle(new URL("/api/status", "http://localhost"), res, { serverless: true });
};
