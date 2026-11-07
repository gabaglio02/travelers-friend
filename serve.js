// Servidor do Traveler's Friend: arquivos do site + API da agenda.
//   node serve.js  →  http://localhost:5173
const http = require("http");
const fs = require("fs");
const path = require("path");

// Chaves do Supabase para testar no computador (arquivo fora do git). Ver README.
try { process.loadEnvFile(path.join(__dirname, ".env.local")); } catch (_) { /* sem .env.local: roda sem contas */ }

const agenda = require("./server/agenda");
const configPublica = require("./server/config-publica");

const ROOT = __dirname;
// Os mesmos cabeçalhos de segurança da Vercel: o teste local vale para o site publicado.
const CABECALHOS = require("./vercel.json").headers[0].headers;
const PORT = process.env.PORT || 5173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};
// Só os arquivos da lista permitida (a mesma do .vercelignore) são servidos.
const { arquivoPublico } = require("./server/publico");

http.createServer(async (req, res) => {
  CABECALHOS.forEach((h) => res.setHeader(h.key, h.value));
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/config") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(configPublica()));
  }
  if (url.pathname.startsWith("/api/")) {
    try { return await agenda.handle(url, res); }
    catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ erro: "falha interna" }));
    }
  }
  const file = arquivoPublico(ROOT, url.pathname);
  if (!file) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, () => console.log("Traveler's Friend em http://localhost:" + PORT));

agenda.startScheduler();
