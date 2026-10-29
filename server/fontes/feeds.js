/*
 * Fonte "feeds": lê listas de eventos em JSON publicadas em URLs (as suas ou de parceiros).
 * Cada feed é configurado em server/config.json:
 *
 *   "feeds": [{ "nome": "parceiro-x", "cidade": "sp", "url": "https://.../eventos.json" }]
 *
 * O JSON deve ser uma lista de eventos no mesmo formato de js/data/sp-eventos.js
 * (id, nome, categoria, lat, lng, datas ou periodo, preco, idade, comoChegar, fonte...).
 */
module.exports = {
  nome: "feeds",
  ativa: (cfg) => Array.isArray(cfg.feeds) && cfg.feeds.length > 0,
  async coletar({ cidade, config }) {
    const out = [];
    for (const feed of config.feeds.filter((f) => (f.cidade || "sp") === cidade)) {
      const res = await fetch(feed.url, { headers: { "User-Agent": "TravelersFriend/1.0" } });
      if (!res.ok) throw new Error(`${feed.nome}: HTTP ${res.status}`);
      const lista = await res.json();
      for (const ev of Array.isArray(lista) ? lista : []) {
        out.push({ ...ev, id: ev.id && ev.id.startsWith(feed.nome + ":") ? ev.id : `${feed.nome}:${ev.id}`, fonte: ev.fonte || feed.url });
      }
    }
    return out;
  }
};
