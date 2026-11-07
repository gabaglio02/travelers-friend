// Quais arquivos o servidor local entrega: a mesma lista permitida do .vercelignore.
// O caminho é conferido depois de resolvido, para "..", "%5C" e afins não escaparem da lista.
const path = require("path");

const ARQUIVOS = ["index.html", "privacidade.html", "favicon.svg"];
const PASTAS = ["js/", "css/"];
// Dentro das pastas públicas, o que fica de fora (as mesmas linhas sem "!" no fim do .vercelignore).
const BLOQUEADOS = ["js/data/sp-restaurantes.js", "js/data/sp-compras.js"];

// rel: caminho relativo à raiz do projeto, com "/" (ex.: "js/app.js").
// No Windows o disco não diferencia maiúsculas: "JS/DATA/X.JS" abriria o mesmo arquivo que "js/data/x.js".
function publico(rel) {
  if (typeof rel !== "string" || !rel || rel.startsWith("..") || path.posix.isAbsolute(rel)) return false;
  if (BLOQUEADOS.includes(rel.toLowerCase())) return false;
  return ARQUIVOS.includes(rel) || PASTAS.some((p) => rel.startsWith(p));
}

// Resolve o caminho pedido na URL para um arquivo dentro de root, ou null se não puder ser entregue.
function arquivoPublico(root, urlPathname) {
  let caminho;
  try { caminho = decodeURIComponent(urlPathname); } catch (_) { return null; }
  if (caminho.includes("\0")) return null;
  const arquivo = path.resolve(root, "." + (caminho === "/" ? "/index.html" : caminho));
  const rel = path.relative(root, arquivo).split(path.sep).join("/");
  return publico(rel) ? arquivo : null;
}

module.exports = { publico, arquivoPublico, ARQUIVOS, PASTAS, BLOQUEADOS };
