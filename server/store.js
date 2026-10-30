/*
 * Onde a agenda fica guardada.
 *  - Com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Vercel): tabela public.agenda_cache no Supabase.
 *  - Sem elas (no seu computador): arquivo data/agenda-<cidade>.json.
 * As duas versões têm a mesma interface: carregar(cidade) e salvar(cidade, dados).
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const vazio = () => ({ eventos: {}, faixas: [], fontes: {} });

const arquivo = {
  nome: "arquivo",
  async carregar(cidade) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `agenda-${cidade}.json`), "utf8")); }
    catch (_) { return vazio(); }
  },
  async salvar(cidade, dados) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, `agenda-${cidade}.json`), JSON.stringify(dados, null, 1));
  }
};

function supabase(url, chave) {
  const base = url.replace(/\/$/, "") + "/rest/v1/agenda_cache";
  const headers = { apikey: chave, Authorization: "Bearer " + chave, "Content-Type": "application/json" };
  return {
    nome: "supabase",
    async carregar(cidade) {
      const res = await fetch(`${base}?cidade=eq.${encodeURIComponent(cidade)}&select=dados`, { headers });
      if (!res.ok) throw new Error("Supabase (leitura da agenda): HTTP " + res.status);
      const linhas = await res.json();
      return linhas[0] ? linhas[0].dados : vazio();
    },
    async salvar(cidade, dados) {
      const res = await fetch(base, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ cidade, dados, atualizado_em: new Date().toISOString() })
      });
      if (!res.ok) throw new Error("Supabase (gravação da agenda): HTTP " + res.status);
    }
  };
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
module.exports = url && chave ? supabase(url, chave) : arquivo;
