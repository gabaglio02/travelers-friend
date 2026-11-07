// O que vai para a Vercel (.vercelignore) e o que o servidor local entrega (server/publico.js).
// Uso: node tools/testes/publicacao.test.mjs
// Não acessa a rede nem o site publicado: lê os arquivos do repositório e a lista do git.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const raiz = new URL("../../", import.meta.url);
const ROOT = path.resolve(new URL(".", raiz).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const require = createRequire(import.meta.url);
const P = require(path.join(ROOT, "server", "publico.js"));

let ok = 0, falhou = 0;
const certo = (c, m, extra = "") => { c ? ok++ : falhou++; console.log((c ? "OK   " : "FALHA") + " " + m + (c ? "" : " " + extra)); };

// ---------- .vercelignore ----------
// Só os padrões usados aqui: "/*" (tudo na raiz), "!nome" (libera um item da raiz) e "/a/b" (tira um caminho exato).
const regras = fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
certo(regras[0] === "/*", ".vercelignore começa ignorando tudo na raiz (lista permitida)");
const liberados = regras.filter((r) => r.startsWith("!")).map((r) => r.slice(1));
const tirados = regras.filter((r) => r.startsWith("/") && r !== "/*").map((r) => r.slice(1));
certo(regras.every((r) => r === "/*" || /^![^/*!]+$/.test(r) || /^\/[^*!]+$/.test(r)), ".vercelignore só usa os padrões que este teste entende");

function enviado(rel) {
  let ignorado = false;
  for (const r of regras) {
    if (r === "/*") ignorado = true;
    else if (r.startsWith("!") && (rel === r.slice(1) || rel.startsWith(r.slice(1) + "/"))) ignorado = false;
    else if (r.startsWith("/") && rel === r.slice(1)) ignorado = true;
  }
  return !ignorado;
}

// As duas listas dizem a mesma coisa (api/, server/ e vercel.json vão para a Vercel, mas não são páginas).
const esperado = [...P.ARQUIVOS, ...P.PASTAS.map((p) => p.slice(0, -1)), "api", "server", "vercel.json"].sort();
certo(JSON.stringify([...liberados].sort()) === JSON.stringify(esperado), "itens liberados no .vercelignore = lista do server/publico.js + api, server e vercel.json",
  JSON.stringify(liberados));
certo(JSON.stringify([...tirados].sort()) === JSON.stringify([...P.BLOQUEADOS].sort()), "caminhos tirados no .vercelignore = BLOQUEADOS do server/publico.js");

// ---------- O que sai do repositório para a Vercel ----------
const versionados = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
const naVercel = new Set(versionados.filter(enviado));
const internos = versionados.filter((f) => /^(tools|docs|supabase)\//.test(f) || ["serve.js", "README.md", ".gitignore", ".vercelignore"].includes(f));
certo(internos.length > 0 && internos.every((f) => !naVercel.has(f)), `nenhum arquivo interno é enviado (${internos.length} conferidos: tools/, docs/, supabase/, serve.js, README...)`,
  internos.filter((f) => naVercel.has(f)).join(", "));
for (const f of ["CLAUDE.md", ".env.local", "data/agenda-sp.json", ".claude/launch.json"]) certo(!enviado(f), `${f} não é enviado`);
P.BLOQUEADOS.forEach((f) => certo(!naVercel.has(f), `${f} não é enviado`));

// Tudo que as funções carregam vai junto (require relativo, seguido arquivo a arquivo).
function requires(arquivo, vistos = new Set()) {
  if (vistos.has(arquivo)) return vistos;
  vistos.add(arquivo);
  const fonte = fs.readFileSync(path.join(ROOT, arquivo), "utf8");
  for (const [, alvo] of fonte.matchAll(/require\("(\.{1,2}\/[^"]+)"\)/g)) {
    let rel = path.posix.normalize(path.posix.join(path.posix.dirname(arquivo), alvo));
    if (!/\.(js|json)$/.test(rel)) rel += fs.existsSync(path.join(ROOT, rel + ".json")) ? ".json" : ".js";
    requires(rel, vistos);
  }
  return vistos;
}
const funcoes = versionados.filter((f) => /^api\/[^/]+\.js$/.test(f));
const precisos = new Set(funcoes.flatMap((f) => [...requires(f)]));
["js/data/sp.js", "js/data/sp-eventos.js"].forEach((f) => precisos.add(f)); // lidos por server/fontes/local.js
const faltando = [...precisos].filter((f) => !naVercel.has(f));
certo(funcoes.length >= 4 && faltando.length === 0, `as ${funcoes.length} funções levam tudo de que precisam (${precisos.size} arquivos)`, faltando.join(", "));

// Tudo que as páginas carregam está publicado e é servido no computador.
for (const pagina of ["index.html", "privacidade.html"]) {
  const html = fs.readFileSync(path.join(ROOT, pagina), "utf8");
  const locais = [...html.matchAll(/(?:src|href)="([^"#:?]+)"/g)].map((m) => m[1]).filter((u) => u !== "./");
  const ruins = locais.filter((u) => !naVercel.has(u) || !P.publico(u) || !fs.existsSync(path.join(ROOT, u)));
  certo(locais.length > 0 && ruins.length === 0, `${pagina}: os ${locais.length} arquivos locais que ela carrega existem e são públicos`, ruins.join(", "));
}

// ---------- Servidor local ----------
const casos = [
  ["/", "index.html"], ["/index.html", "index.html"], ["/js/app.js", "js/app.js"], ["/css/style.css", "css/style.css"],
  ["/js/data/sp.js", "js/data/sp.js"], ["/favicon.svg", "favicon.svg"],
  ["/server/agenda.js", null], ["/serve.js", null], ["/vercel.json", null], ["/.vercelignore", null], ["/README.md", null],
  ["/tools/coletas/coleta.txt", null], ["/docs/pendencias.json", null], ["/supabase/schema.sql", null], ["/api/cron.js", null],
  ["/.env.local", null], ["/.git/config", null], ["/CLAUDE.md", null], ["/data/agenda-sp.json", null],
  ["/js/../server/agenda.js", null], ["/js/..%2Fserver%2Fagenda.js", null], ["/js/..%5Cserver%5Cagenda.js", null],
  ["/js/%2e%2e/serve.js", null], ["/%E0%A4%A", null], ["/js/app.js%00.png", null], ["/JS/app.js", null]
];
for (const [url, quer] of casos) {
  const r = P.arquivoPublico(ROOT, url);
  const rel = r && path.relative(ROOT, r).split(path.sep).join("/");
  certo(rel === quer, `servidor local: ${url} → ${quer || "404"}`, `(veio ${rel})`);
}
for (const b of P.BLOQUEADOS) {
  certo(P.arquivoPublico(ROOT, "/" + b) === null, `servidor local: /${b} → 404`);
  certo(P.arquivoPublico(ROOT, "/" + b.toUpperCase()) === null, `servidor local: /${b.toUpperCase()} → 404 (disco sem diferença de maiúsculas)`);
}

console.log(`\n${ok} ok, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
