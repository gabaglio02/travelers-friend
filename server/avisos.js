/*
 * Resumo diário por e-mail (chamado pelo api/cron.js): erros do site e perguntas novas da caixa da Ajuda.
 * Só funciona com estas variáveis na Vercel; sem elas, não faz nada:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (já usadas pela agenda)
 *   RESEND_API_KEY                           (conta gratuita em resend.com)
 *   AVISO_EMAIL                              (para quem vai o resumo — o e-mail da conta no Resend)
 */
async function avisarErros() {
  const env = process.env;
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !env.RESEND_API_KEY || !env.AVISO_EMAIL) return { enviado: false, motivo: "não configurado" };

  const desde = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const ler = async (tabela, consulta, opcional) => {
    const res = await fetch(`${url}/rest/v1/${tabela}?${consulta}`, { headers: { apikey: chave, Authorization: "Bearer " + chave } });
    if (opcional && res.status === 404) return []; // tabela ainda não criada (migration não rodada)
    if (!res.ok) throw new Error(`Supabase (${tabela}): HTTP ` + res.status);
    return res.json();
  };
  const erros = await ler("erros_site", "select=mensagem,onde,pagina,navegador,vezes,primeiro_em,ultimo_em"
    + `&ultimo_em=gte.${desde}&order=vezes.desc&limit=20`);
  // supabase/008_perguntas.sql
  const perguntas = await ler("perguntas", `select=texto,email,criado_em&criado_em=gte.${desde}&order=criado_em.asc&limit=50`, true);
  if (!erros.length && !perguntas.length) return { enviado: false, motivo: "sem erros nem perguntas" };

  const partes = [];
  if (perguntas.length) {
    partes.push(`${perguntas.length} pergunta(s) nova(s) na caixa da Ajuda nas últimas 24 h.`, "",
      ...perguntas.map((p, i) => `${i + 1}. ${p.texto}\n   ${p.email ? "responder para: " + p.email : "sem e-mail"}`),
      "", "Todas: painel do Supabase → Table Editor → perguntas.", "");
  }
  if (erros.length) {
    const total = erros.reduce((s, e) => s + e.vezes, 0);
    partes.push(`${erros.length} erro(s) diferente(s) no site nas últimas 24 h (${total} ocorrência(s) no total).`, "",
      ...erros.map((e, i) => [
        `${i + 1}. ${e.mensagem}`,
        `   ${e.vezes}x · ${e.onde || "?"} · página ${e.pagina || "?"}`,
        `   navegador: ${(e.navegador || "?").slice(0, 120)}`
      ].join("\n")),
      "", "Lista completa: painel do Supabase → Table Editor → erros_site.");
  }
  const assunto = [perguntas.length ? `${perguntas.length} pergunta(s)` : "", erros.length ? `${erros.length} erro(s) no site` : ""]
    .filter(Boolean).join(" e ");

  const envio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.AVISO_REMETENTE || "Traveler's Friend <onboarding@resend.dev>",
      to: [env.AVISO_EMAIL],
      subject: `Traveler's Friend: ${assunto}`,
      text: partes.join("\n")
    })
  });
  if (!envio.ok) throw new Error("Resend: HTTP " + envio.status + " " + (await envio.text()).slice(0, 200));
  return { enviado: true, erros: erros.length, perguntas: perguntas.length };
}

module.exports = { avisarErros };
