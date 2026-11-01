/*
 * Aviso automático de erros: quando algo quebra no navegador de alguém, manda um resumo técnico
 * (mensagem, arquivo:linha, rota e navegador — nada pessoal) para a tabela erros_site do Supabase
 * (supabase/007_compartilhar_e_erros.sql). Script comum, carregado antes do resto para pegar até erro de carregamento.
 */
(function () {
  const cfg = window.TF_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || location.protocol === "file:") return;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return; // testes locais não poluem o registro
  const enviados = new Set();
  let total = 0;

  function enviar(mensagem, onde, pilha) {
    mensagem = String(mensagem || "").slice(0, 500);
    if (!mensagem || /^Script error\.?$/i.test(mensagem) || /ResizeObserver loop/i.test(mensagem)) return; // sem informação útil
    if (/(chrome|moz|safari)-extension:\/\//.test((onde || "") + (pilha || ""))) return; // erro de extensão do navegador
    const chave = mensagem + "|" + onde;
    if (enviados.has(chave) || total >= 5) return;
    enviados.add(chave); total++;
    try {
      fetch(cfg.supabaseUrl + "/rest/v1/rpc/registrar_erro", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey },
        body: JSON.stringify({
          p_mensagem: mensagem, p_onde: onde || null, p_pilha: pilha ? String(pilha).slice(0, 3000) : null,
          // Só a rota, sem códigos: #/r/<código> e #/@apelido viram genéricos.
          p_pagina: (location.hash || "#/").replace(/^#\/r\/.+/, "#/r/…").replace(/^#\/@[^/]+/, "#/@…").slice(0, 200),
          p_navegador: navigator.userAgent.slice(0, 300)
        })
      }).catch(() => {});
    } catch (_) { /* nunca quebra o site por causa do aviso */ }
  }

  const curto = (url) => String(url || "").replace(location.origin, "");
  window.addEventListener("error", (e) => {
    if (e.error || e.message) enviar(e.message || String(e.error), e.filename ? curto(e.filename) + ":" + e.lineno + ":" + e.colno : "", e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    if (r && /AbortError|Failed to fetch|NetworkError|Load failed/i.test(String(r.name) + " " + String(r.message))) return; // queda de internet
    enviar(r && r.message ? r.message : String(r), "promessa", r && r.stack);
  });
})();
