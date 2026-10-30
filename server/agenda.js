/*
 * Agenda de eventos do servidor.
 *
 * GET /api/eventos?cidade=sp&de=AAAA-MM-DD&ate=AAAA-MM-DD
 *   → { cidade, de, ate, atualizadoEm, atualizando, fontes, eventos: [...] }
 * GET /api/status
 *
 * Funcionamento:
 *  - Os eventos ficam guardados pelo store.js (arquivo no computador ou Supabase na Vercel).
 *  - Cada busca olha quando aquelas datas foram atualizadas pela última vez:
 *      nunca  → coleta nas fontes antes de responder;
 *      velha  → no servidor contínuo (serve.js), responde na hora e atualiza em segundo plano;
 *               na Vercel (sem segundo plano), tenta atualizar por alguns segundos antes de responder;
 *      fresca → só responde.
 *  - atualizarProximos() mantém os próximos DIAS_A_FRENTE dias atualizados
 *    (setInterval no serve.js; Cron Job na Vercel).
 */
const path = require("path");
const armazenamento = require("./store");

const ROOT = path.join(__dirname, "..");
const CIDADES = ["sp"];
const MAX_DIAS_BUSCA = 120;
const DIAS_A_FRENTE = 90;
const TIMEOUT_FONTE_MS = 20000;
const ESPERA_SERVERLESS_MS = 8000;
const RECARREGAR_MS = 30000; // em funções serverless várias instâncias gravam; relê o store com frequência

const FONTES = [
  require("./fontes/local"),
  require("./fontes/feeds"),
  require("./fontes/modelo-api")
];

function config() {
  try { return require("./config.json"); } catch (_) { return {}; }
}
const ttlMs = () => (config().ttlHoras || 12) * 3600 * 1000;

// ---------- Armazenamento (com cópia em memória) ----------
// Se o banco falhar (ex.: tabela ainda não criada), a agenda segue funcionando só em memória,
// com as fontes coletadas na hora — o site não fica sem eventos por causa disso.
const memoria = {};
let erroArmazenamento = null;
async function store(cidade) {
  const m = memoria[cidade];
  if (!m || Date.now() - m.lidoEm > RECARREGAR_MS) {
    let dados;
    try {
      dados = await armazenamento.carregar(cidade);
      erroArmazenamento = null;
    } catch (err) {
      erroArmazenamento = String(err.message || err);
      console.warn("[agenda] não consegui ler o armazenamento:", erroArmazenamento);
      dados = m ? m.dados : { eventos: {}, faixas: [], fontes: {} };
    }
    memoria[cidade] = { dados, lidoEm: Date.now() };
  }
  return memoria[cidade].dados;
}
async function persist(cidade) {
  try {
    await armazenamento.salvar(cidade, memoria[cidade].dados);
    erroArmazenamento = null;
  } catch (err) {
    erroArmazenamento = String(err.message || err);
    console.warn("[agenda] não consegui gravar o armazenamento:", erroArmazenamento);
  }
  memoria[cidade].lidoEm = Date.now();
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
function atualizadoEm(s, de, ate) {
  const f = s.faixas.filter((x) => x.de <= de && x.ate >= ate).sort((a, b) => b.em.localeCompare(a.em))[0];
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
    const s = await store(cidade);
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
    await persist(cidade);
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

// opts.serverless: true na Vercel (não há como continuar trabalhando depois de responder).
async function handle(url, res, opts = {}) {
  if (url.pathname === "/api/status") {
    const out = { armazenamento: armazenamento.nome };
    for (const c of CIDADES) {
      const s = await store(c);
      out[c] = { fontes: s.fontes, eventos: Object.keys(s.eventos).length, faixas: s.faixas.slice(-5) };
    }
    out.erroArmazenamento = erroArmazenamento;
    return json(res, 200, out);
  }
  if (url.pathname !== "/api/eventos") return json(res, 404, { erro: "rota não encontrada" });

  const cidade = url.searchParams.get("cidade") || "sp";
  const de = url.searchParams.get("de"), ate = url.searchParams.get("ate");
  if (!CIDADES.includes(cidade)) return json(res, 400, { erro: "cidade não suportada" });
  if (!isISO(de) || !isISO(ate) || ate < de) return json(res, 400, { erro: "use de=AAAA-MM-DD&ate=AAAA-MM-DD" });
  if (diasEntre(de, ate) > MAX_DIAS_BUSCA) return json(res, 400, { erro: `intervalo máximo de ${MAX_DIAS_BUSCA} dias` });

  let em = atualizadoEm(await store(cidade), de, ate);
  let atualizando = false;
  if (!em) {
    await atualizar(cidade, de, ate);
  } else if (Date.now() - new Date(em).getTime() > ttlMs()) {
    if (opts.serverless) {
      // Espera um pouco; se a coleta demorar, responde com o que tem e a próxima busca pega o resultado.
      try { await comTimeout(atualizar(cidade, de, ate), ESPERA_SERVERLESS_MS); } catch (_) { atualizando = true; }
    } else {
      atualizando = true;
      atualizar(cidade, de, ate).catch(() => {});
    }
  }
  const s = await store(cidade);
  em = atualizadoEm(s, de, ate) || em;
  const eventos = Object.values(s.eventos).filter((ev) => cruza(ev, de, ate));
  json(res, 200, { cidade, de, ate, atualizadoEm: em, atualizando, fontes: s.fontes, eventos });
}

// Atualiza os próximos meses de todas as cidades.
function atualizarProximos() {
  return Promise.all(CIDADES.map((c) => atualizar(c, hoje(), somaDias(hoje(), DIAS_A_FRENTE)).catch((err) => console.warn(err))));
}

// Servidor contínuo (serve.js): repete a atualização sozinho.
function startScheduler() {
  atualizarProximos();
  setInterval(atualizarProximos, ttlMs()).unref();
}

module.exports = { handle, atualizarProximos, startScheduler };
