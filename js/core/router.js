/*
 * Roteador por hash (#/caminho) — funciona em hospedagem estática, sem configuração no servidor.
 *
 *   rota("/", () => ...);
 *   rota("/@:apelido", ({ apelido }) => ...);
 *   iniciar();          // resolve a rota atual e passa a ouvir mudanças
 *   ir("/planejar");    // navega (entra no histórico do navegador)
 */
const rotas = [];
let atual = null;

// "/@:apelido/album/:id" → regex com grupos nomeados.
function compilar(padrao) {
  const corpo = padrao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:(\w+)/g, "(?<$1>[^/]+)");
  return new RegExp("^" + corpo + "/?$");
}

export function rota(padrao, handler) {
  rotas.push({ padrao, re: compilar(padrao), handler });
}

// Links de confirmação de e-mail e recuperação de senha do Supabase chegam com dados no hash
// (#access_token=…, #error=…). Esses não são rotas: ficam intactos para o supabase-js ler.
const ehRetornoDeLogin = (h) => /(^|[#&])(access_token|refresh_token|error|error_description|type)=/.test(h);

function resolver() {
  const hash = location.hash;
  if (ehRetornoDeLogin(hash)) return;
  const caminho = decodeURIComponent(hash.replace(/^#/, "")) || "/";
  for (const r of rotas) {
    const m = caminho.match(r.re);
    if (m) {
      atual = { padrao: r.padrao, caminho, params: m.groups || {} };
      r.handler(atual.params);
      return;
    }
  }
  ir("/"); // rota desconhecida → início
}

export function ir(caminho) {
  if (location.hash === "#" + caminho) resolver();
  else location.hash = caminho;
}

export const rotaAtual = () => atual;

export function iniciar() {
  window.addEventListener("hashchange", resolver);
  resolver();
}
