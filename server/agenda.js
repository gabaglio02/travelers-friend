/*
 * Agenda de eventos do servidor.
 *
 * GET /api/eventos?cidade=sp&de=AAAA-MM-DD&ate=AAAA-MM-DD
 *   → { cidade, de, ate, atualizadoEm, atualizando, fontes, eventos: [...] }
 * GET /api/status
 *
 * Funcionamento:
 *  - Os eventos ficam guardados em data/agenda-<cidade>.json.
 *  - Cada busca olha quando aquelas datas foram atualizadas pela última vez:
 *      nunca  → coleta nas fontes antes de responder;
 *      velha  → responde na hora com o que tem e atualiza em segundo plano ("atualizando": true);
 *      fresca → só responde.
 *  - Uma tarefa periódica mantém os próximos DIAS_A_FRENTE dias sempre atualizados.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_FILE = path.join(__dirname, "config.json");
const CIDADES = ["sp"];
const MAX_DIAS_BUSCA = 120;
const DIAS_A_FRENTE = 90;
const TIMEOUT_FONTE_MS = 20000;

const FONTES = [
  require("./fontes/local"),
  require("./fontes/feeds"),
  require("./fontes/modelo-api")
];

function config() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch (_) { return {}; }
}
const ttlMs = () => (config().ttlHoras || 12) * 3600 * 1000;

// ---------- Armazenamento ----------
const stores = {};
function storeFile(cidade) { return path.join(DATA_DIR, `agenda-${cidade}.json`); }
function store(cidade) {
  if (!stores[cidade]) {
    try { stores[cidade] = JSON.parse(fs.readFileSync(storeFile(cidade), "utf8")); }
    catch (_) { stores[cidade] = { eventos: {}, faixas: [], fontes: {} }; }
  }
  return stores[cidade];
}
function persist(cidade) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(storeFile(cidade), JSON.stringify(stores[cidade], null, 1));
}

// ---------- Regras de data ----------
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);

function cruza(ev, de, ate) {
  if (ev.datas) return ev.datas.some((d) => d >= de && d <= ate);
  if (ev.periodo) return (!ev.periodo.de || ev.periodo.de <= ate) && (!ev.periodo.ate || ev.periodo.ate >= de);
  return false;
}

// Só aceita eventos no formato que o site entende.
function valido(ev) {
  return ev && typeof ev.id === "string" && typeof ev.nome === "string" && typeof ev.categoria === "string"
    && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)
    && ((Array.isArray(ev.datas) && ev.datas.every(isISO)) || (ev.periodo && typeof ev.periodo === "object"));
}

// Última atualização que cobre todo o intervalo pedido (ou null).
function atualizadoEm(cidade, de, ate) {
  const f = store(cidade).faixas.filter((x) => x.de <= de && x.ate >= ate).sort((a, b) => b.em.localeCompare(a.em))[0];
  return f ? f.em : null;
}

// ---------- Coleta ----------
const emAndamento = new Map();
function comTimeout(promessa, ms) {
  return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);
}

function atualizar(cidade, de, ate) {
  const chave = `${cidade}:${de}:${ate}`;
  if (emAndamento.has(chave)) return emAndamento.get(chave);
  const job = (async () => {
    const cfg = config();
    const s = store(cidade);
    for (const fonte of FONTES) {
      if (!fonte.ativa(cfg)) continue;
      const inicio = Date.now();
      try {
        const lista = await comTimeout(fonte.coletar({ cidade, de, ate, config: cfg, root: ROOT }), TIMEOUT_FONTE_MS);
        let ok = 0;
        for (const ev of lista || []) {
          if (!valido(ev)) continue;
          s.eventos[ev.id] = { ...ev, origem: fonte.nome };
          ok++;
        }
        s.fontes[fonte.nome] = { em: new Date().toISOString(), eventos: ok, ms: Date.now() - inicio };
      } catch (err) {
        s.fontes[fonte.nome] = { em: new Date().toISOString(), erro: String(err.message || err) };
        console.warn(`[agenda] fonte ${fonte.nome} falhou:`, err.message || err);
      }
    }
    // Limpa eventos que já terminaram há mais de 7 dias.
    const corte = somaDias(hoje(), -7);
    for (const [id, ev] of Object.entries(s.eventos)) {
      const fim = ev.datas ? ev.datas[ev.datas.length - 1] : ev.periodo && ev.periodo.ate;
      if (fim && fim < corte) delete s.eventos[id];
    }
    s.faixas = s.faixas.filter((x) => x.ate >= hoje()).concat({ de, ate, em: new Date().toISOString() }).slice(-50);
    persist(cidade);
  })().finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, job);
  return job;
}

// ---------- HTTP ----------
function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*", // o site pode estar hospedado em outro domínio
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

async function handle(url, res) {
  if (url.pathname === "/api/status") {
    return json(res, 200, Object.fromEntries(CIDADES.map((c) => [c, { fontes: store(c).fontes, eventos: Object.keys(store(c).eventos).length, faixas: store(c).faixas.slice(-5) }])));
  }
  if (url.pathname !== "/api/eventos") return json(res, 404, { erro: "rota não encontrada" });

  const cidade = url.searchParams.get("cidade") || "sp";
  const de = url.searchParams.get("de"), ate = url.searchParams.get("ate");
  if (!CIDADES.includes(cidade)) return json(res, 400, { erro: "cidade não suportada" });
  if (!isISO(de) || !isISO(ate) || ate < de) return json(res, 400, { erro: "use de=AAAA-MM-DD&ate=AAAA-MM-DD" });
  if (diasEntre(de, ate) > MAX_DIAS_BUSCA) return json(res, 400, { erro: `intervalo máximo de ${MAX_DIAS_BUSCA} dias` });

  let em = atualizadoEm(cidade, de, ate);
  let atualizando = false;
  if (!em) {
    await atualizar(cidade, de, ate);
    em = atualizadoEm(cidade, de, ate);
  } else if (Date.now() - new Date(em).getTime() > ttlMs()) {
    atualizando = true;
    atualizar(cidade, de, ate).catch(() => {});
  }
  const eventos = Object.values(store(cidade).eventos).filter((ev) => cruza(ev, de, ate));
  json(res, 200, { cidade, de, ate, atualizadoEm: em, atualizando, fontes: store(cidade).fontes, eventos });
}

// Mantém os próximos meses atualizados mesmo sem ninguém buscar.
function startScheduler() {
  const rodar = () => CIDADES.forEach((c) => atualizar(c, hoje(), somaDias(hoje(), DIAS_A_FRENTE)).catch(() => {}));
  rodar();
  setInterval(rodar, ttlMs()).unref();
}

module.exports = { handle, startScheduler };
