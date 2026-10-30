// Vercel: GET /api/config — endereço e chave pública do Supabase para o navegador.
const configPublica = require("../server/config-publica");

module.exports = (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" });
  res.end(JSON.stringify(configPublica()));
};
