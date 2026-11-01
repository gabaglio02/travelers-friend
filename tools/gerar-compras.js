// Gera js/data/sp-compras.js (shoppings, galerias e outlets) a partir de uma coleta do Google Maps.
// Uso: node tools/gerar-compras.js <pasta-do-projeto> <compras.json> <dentro.json> <saida-restaurantes-dentro.json>
//   compras.json: lista de { nome, lat, lng, nota, n, tipo, extra } (buscas "shopping center", "galeria de roupas", "outlet")
//   dentro.json:  { "<nome do shopping>": { rest: [...], roupa: [{ nome, nota, n, tipo }] } }
//                 (buscas "restaurantes no <shopping>" e "lojas de roupa no <shopping>", até 350 m do shopping)
// A terceira saída é a coleta de restaurantes de dentro dos shoppings, no formato do tools/gerar-restaurantes.js
// (com o campo "local" = id do shopping); rode o gerador de restaurantes depois, passando os dois arquivos.
const fs = require("fs"), path = require("path");
const [raiz, arqCompras, arqDentro, arqSaidaRest] = process.argv.slice(2);
const brutos = JSON.parse(fs.readFileSync(arqCompras, "utf8"));
const dentro = JSON.parse(fs.readFileSync(arqDentro, "utf8"));
global.window = {};
require(path.join(raiz, "js/data/sp.js"));
require(path.join(raiz, "js/data/sp-eventos.js"));
const lugares = window.TF_CITIES.sp.lugares;
const km = (a, b) => { const t = (x) => x * Math.PI / 180; const d = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(d)); };
const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (s) => sem(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const estacao = (txt) => { const m = (txt || "").match(/(Metrô|CPTM)[^,.;—]*?(\([^)]*\))?(?=[,.;—]|\s\+|$)/); return m ? m[0].trim() : ""; };
const fmtN = (n) => n.toLocaleString("pt-BR");
// Shoppings famosos aparecem no "Tudo" do Explorar; os demais, pelo filtro Compras ou pela busca.
const DESTAQUE = /Galeria do Rock|Galeria Pagé|25 de Março|Conjunto Nacional|Iguatemi$|JK Iguatemi|Cidade Jardim|Eldorado|Morumbi Shopping|Ibirapuera Shopping|Pátio Paulista|Cidade São Paulo|Center Norte|Aricanduva|Anália Franco|Vila Olímpia|Villa Lobos|Outlet Premium/;

// Bairro e cidade pelo OpenStreetMap (Nominatim, 1 consulta por segundo; respostas guardadas em cache).
const arqCache = arqCompras.replace(/\.json$/, "") + "-enderecos.json";
const cache = fs.existsSync(arqCache) ? JSON.parse(fs.readFileSync(arqCache, "utf8")) : {};
async function bairroDe(c) {
  const chave = c.lat.toFixed(4) + "," + c.lng.toFixed(4);
  if (!cache[chave]) {
    await new Promise((r) => setTimeout(r, 1100));
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=pt-BR&lat=${c.lat}&lon=${c.lng}`,
      { headers: { "User-Agent": "TravelersFriend/1.0 (travelersfriend.contato@gmail.com)" } });
    cache[chave] = (await res.json()).address || {};
    fs.writeFileSync(arqCache, JSON.stringify(cache));
  }
  const a = cache[chave], cidade = a.city || a.town || a.municipality || "";
  // Na capital, o distrito (Bela Vista, Vila Guilherme...) é mais conhecido que o sub-bairro do OSM.
  const bairro = /^São Paulo$/.test(cidade) ? (a.city_district || a.suburb || a.neighbourhood || "") : (a.suburb || a.neighbourhood || a.city_district || "");
  return { bairro: bairro.replace(/^(Subprefeitura|Distrito) d[aeo]s? /i, ""), cidade };
}

// Bairros pelos quais os shoppings mais conhecidos são chamados (o OSM às vezes dá o sub-bairro).
const BAIRRO_CERTO = { "Shopping Aricanduva": "Aricanduva", "Shopping Center Norte": "Vila Guilherme", "Shopping Cidade São Paulo": "Bela Vista",
  "Shopping Pátio Paulista": "Bela Vista", "Morumbi Shopping": "Morumbi", "Ibirapuera Shopping": "Moema", "Galeria Pagé": "Centro",
  "Shopping 25 de Março": "Centro", "Shopping Villa Lobos": "Alto de Pinheiros", "Shopping Eldorado": "Pinheiros",
  "Shopping Anália Franco": "Tatuapé", "Shopping Metrô Tatuapé": "Tatuapé", "Shopping Metrô Boulevard Tatuapé": "Tatuapé",
  "Shopping Metrô Itaquera": "Itaquera", "Shopping Center 3": "Bela Vista", "Conjunto Nacional": "Bela Vista" };
const referencias = lugares.filter((p) => p.lat && !/a confirmar|secreto|Vários|Zona/i.test(p.bairro || ""));
const saida = [], usados = new Set(lugares.map((p) => p.id)), restDentro = [];
(async () => {
for (const c of brutos.sort((a, b) => b.n - a.n)) {
  if (saida.some((s) => km(s, c) < 0.08)) continue; // mesma galeria com dois nomes
  const tipo0 = c.tipo.split(" · ")[0].trim();
  const end = c.tipo.split(" · ").slice(2).join(" · ").trim();
  const ehGaleria = /galeria|centro comercial/i.test(c.nome + " " + tipo0) && !/shopping/i.test(c.nome.replace(/Galeria/i, ""));
  const ehOutlet = /outlet/i.test(c.nome + " " + tipo0);
  const viz = referencias.map((p) => ({ p, d: km(c, p) })).sort((a, b) => a.d - b.d);
  const geo = await bairroDe(c);
  const cidade = geo.cidade && !/^São Paulo$/.test(geo.cidade) ? geo.cidade : "";
  const comTransporte = viz.find((v) => v.d <= 1 && estacao(v.p.comoChegar));
  let id = "c-" + slug(c.nome); let k = 2; while (usados.has(id)) id = "c-" + slug(c.nome) + "-" + k++;
  usados.add(id);
  const ex = c.extra.split(" | ").map((s) => s.trim());
  const desc = ex.find((s) => s && !s.includes(" · ") && !/^(Aberto|Fechado|Abre|Fecha|Reabre|\d)/.test(s) && s.length > 8 && s.length < 90) || "";
  const d = dentro[c.nome] || { rest: [], roupa: [] };
  // Só lojas de roupa (o Maps mistura perfumaria, joalheria...), sem o nome do shopping colado no da loja.
  // Tira só o nome do shopping no fim ("Aramis Iguatemi", "Ave Rara MorumbiShopping") e "Loja" no começo.
  const nucleo = sem(c.nome).replace(/\bshopping\b/g, "").replace(/\s+/g, " ").trim();
  const limpaNome = (n) => {
    let s = n.split(/ - | \| | \(|, /)[0].replace(/^(loja|store)\s+/i, "").trim();
    const fim = new RegExp("\\s+((no|do|da)\\s+)?(shopping\\s*)?" + nucleo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*") + "(\\s*shopping)?(\\s+s[aã]o paulo)?$", "i");
    const semAcento = sem(s);
    const m = semAcento.match(fim);
    return (m ? s.slice(0, m.index) : s).replace(/[\s–—-]+$/, "").replace(/\s+Loja$/i, "").trim();
  };
  const ehRoupa = (r) => /roupa|moda|vestu|jeans|lingerie|surf|esportiv|outlet|boutique|alfaiat|camisa/i.test(r.tipo)
    && !/perfum|cosm|joalh|ótica|calçad|sapat|bolsa|brinq/i.test(r.tipo);
  const roupa = [...new Map(d.roupa.filter(ehRoupa).sort((a, b) => b.n - a.n).map((r) => limpaNome(r.nome))
    .filter((n) => n.length > 1 && !sem(c.nome).includes(sem(n))).map((n) => [sem(n), n])).values()].slice(0, 10);
  saida.push({
    id, nome: c.nome,
    // Capital: bairro conhecido (correção manual ou o de uma atração a até 1,5 km); senão, o do OpenStreetMap.
    bairro: BAIRRO_CERTO[c.nome] || (!cidade && viz[0] && viz[0].d <= 1.5 ? viz[0].p.bairro : "") || geo.bairro || (cidade ? "Centro" : "São Paulo"),
    ...(cidade ? { municipio: cidade } : {}),
    lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), duracao: ehGaleria ? 90 : ehOutlet ? 180 : 150,
    horario: ehGaleria ? { abre: "09:00", fecha: "18:00", fechado: [0] } : { abre: "10:00", fecha: "22:00", fechado: [] },
    comoChegar: (end ? end + " — " : "") + (comTransporte ? "perto do " + estacao(comTransporte.p.comoChegar) + "." : "app de transporte ou ônibus."),
    descricao: `${ehGaleria ? "Galeria de lojas" : ehOutlet ? "Outlet" : "Shopping center"}${desc ? " — " + desc.replace(/\.$/, "") : ""}. Nota ${String(c.nota).replace(".", ",")} no Google Maps (${fmtN(c.n)} avaliações).`,
    nota: c.nota, avaliacoes: c.n,
    ...(roupa.length ? { lojasRoupa: roupa } : {}),
    ...(DESTAQUE.test(c.nome) ? {} : { secundario: true })
  });
  // Restaurantes de dentro: vão para o gerador de restaurantes com "local" = este shopping.
  d.rest.forEach((r) => restDentro.push({ q: c.nome, nome: r.nome, lat: +r.lat.toFixed(5), lng: +r.lng.toFixed(5), nota: r.nota, n: r.n,
    tipo: r.tipo.split(" · ")[0].trim(), end: r.tipo.split(" · ").slice(2).join(" · ").trim(), desc: "", h24: 0, local: id }));
}
const js = `/*
 * Shoppings, galerias de roupas e outlets (gerado a partir de buscas no Google Maps em 01/11/2026).
 * Nota 4,2+ com 500+ avaliações (galerias: 4,1+ e 300+). Entrada grátis; horário aproximado.
 * lojasRoupa: lojas de roupa encontradas dentro (até 350 m), as mais avaliadas primeiro.
 * Restaurantes de dentro ficam em sp-restaurantes.js com "local" = id do shopping.
 * Gerado por tools/gerar-compras.js — não edite à mão.
 */
(function () {
  const lugares = window.TF_CITIES.sp.lugares;
  const PADRAO = { categoria: "compras", idade: "Livre", preco: 0, precoNota: "entrada grátis; compras à parte",
    confirmar: "Nota vista no Google Maps em nov/2026; horários variam (domingo e feriado costumam ser menores) — confira antes de ir." };
  ${JSON.stringify(saida).replace(/\},\{"id"/g, '},\n  {"id"')}.forEach((c) => lugares.push(Object.assign({}, PADRAO, c)));
})();
`;
fs.writeFileSync(path.join(raiz, "js/data/sp-compras.js"), js);
fs.writeFileSync(arqSaidaRest, JSON.stringify(restDentro));
console.log(saida.length, "lugares de compras;", saida.filter((s) => !s.secundario).length, "em destaque;", restDentro.length, "restaurantes de dentro;", (js.length / 1024).toFixed(0), "KB");
})();
