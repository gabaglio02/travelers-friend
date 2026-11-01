/*
 * Resumo diário de erros do site por e-mail (chamado pelo api/cron.js).
 * Só funciona com estas variáveis na Vercel; sem elas, não faz nada:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (já usadas pela agenda)
 *   RESEND_API_KEY                           (conta gratuita em resend.com)
 *   AVISO_EMAIL                              (para quem vai o resumo — o e-mail da conta no Resend)
 */
async function avisarErros() {
  const env = process.env;
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !env.RESEND_API_KEY || !env.AVISO_EMAIL) return { enviado: false, motivo: "não configurado" };

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${url}/rest/v1/erros_site?select=mensagem,onde,pagina,navegador,vezes,primeiro_em,ultimo_em`
    + `&ultimo_em=gte.${encodeURIComponent(desde)}&order=vezes.desc&limit=20`,
    { headers: { apikey: chave, Authorization: "Bearer " + chave } });
  if (!res.ok) throw new Error("Supabase (erros_site): HTTP " + res.status);
  const erros = await res.json();
  if (!erros.length) return { enviado: false, motivo: "sem erros" };

  const total = erros.reduce((s, e) => s + e.vezes, 0);
  const texto = [
    `${erros.length} erro(s) diferente(s) no site nas últimas 24 h (${total} ocorrência(s) no total).`, "",
    ...erros.map((e, i) => [
      `${i + 1}. ${e.mensagem}`,
      `   ${e.vezes}x · ${e.onde || "?"} · página ${e.pagina || "?"}`,
      `   navegador: ${(e.navegador || "?").slice(0, 120)}`
    ].join("\n")),
    "", "Lista completa: painel do Supabase → Table Editor → erros_site."
  ].join("\n");

  const envio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.AVISO_REMETENTE || "Traveler's Friend <onboarding@resend.dev>",
      to: [env.AVISO_EMAIL],
      subject: `Traveler's Friend: ${erros.length} erro(s) no site`,
      text: texto
    })
  });
  if (!envio.ok) throw new Error("Resend: HTTP " + envio.status + " " + (await envio.text()).slice(0, 200));
  return { enviado: true, erros: erros.length };
}

module.exports = { avisarErros };
