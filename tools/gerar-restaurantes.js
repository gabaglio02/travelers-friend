// Gera js/data/sp-restaurantes.js a partir de uma coleta do Google Maps.
// Uso: node tools/gerar-restaurantes.js <pasta-do-projeto> <coleta.json>
// coleta.json: lista de { q, nome, lat, lng, nota, n, tipo, end, desc, h24 } (resultados de buscas "restaurantes bem avaliados <bairro>").
const fs = require("fs"), path = require("path");
const raiz = process.argv[2];
const brutos = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
global.window = {};
require(path.join(raiz, "js/data/sp.js"));
require(path.join(raiz, "js/data/sp-eventos.js"));
const lugares = window.TF_CITIES.sp.lugares;
const atracoes = lugares.filter((p) => p.categoria !== "gastronomia" && p.lat && !/a confirmar|secreto/i.test(p.bairro || ""));
const km = (a, b) => { const t = (x) => x * Math.PI / 180; const d = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(d)); };
const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const jaTem = lugares.filter((p) => p.categoria === "gastronomia").map((p) => sem(p.nome));
const slug = (s) => sem(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function perfil(tipo) {
  const t = sem(tipo);
  if (/quilo|self-service|buffet/.test(t)) return { preco: 55, dur: 60, h: ["11:00", "15:30"] };
  if (/padaria/.test(t)) return { preco: 45, dur: 60, h: ["07:00", "21:00"] };
  if (/lanchonete|hamburguer|pastel/.test(t)) return { preco: 60, dur: 60, h: ["11:30", "23:00"] };
  if (/pizzaria/.test(t)) return { preco: 80, dur: 90, h: ["18:00", "23:30"] };
  if (/churrascaria|rodizio|carne|steak|parrilla|grelhado|argentino|uruguaio/.test(t)) return { preco: 140, dur: 90, h: ["11:30", "23:00"] };
  if (/japones|sushi|izakaya|omakase/.test(t)) return { preco: 110, dur: 75, h: ["11:30", "23:00"] };
  if (/frances|mediterran|fusao|contemporane|moderno|alta gastronomia/.test(t)) return { preco: 150, dur: 90, h: ["12:00", "23:00"] };
  if (/italian|cantina|trattoria|osteria/.test(t)) return { preco: 110, dur: 90, h: ["11:30", "23:00"] };
  if (/ramen|lamen|udon|chines|coreano|tailand|vietnam|taiwan|asiatic/.test(t)) return { preco: 75, dur: 60, h: ["11:30", "22:30"] };
  if (/arabe|libanes|oriente medio|grego|judeu|bulgar/.test(t)) return { preco: 75, dur: 75, h: ["11:30", "23:00"] };
  if (/brunch|cafe/.test(t)) return { preco: 70, dur: 60, h: ["08:00", "18:00"] };
  return { preco: 90, dur: 75, h: ["11:30", "23:00"] };
}
const estacao = (txt) => { const m = (txt || "").match(/(Metrô|CPTM)[^,.;—]*?(\([^)]*\))?(?=[,.;—]|\s\+|$)/); return m ? m[0].trim() : ""; };
const fmtNota = (n) => String(n).replace(".", ",");
const fmtN = (n) => n.toLocaleString("pt-BR");

// Bairro pela busca feita no Maps (quando não há atração a até 1 km).
const ROTULOS = { "Pacaembu Higienópolis": "Higienópolis", "Avenida Paulista": "Paulista", "Alto de Pinheiros Villa-Lobos": "Alto de Pinheiros",
  "Moema Ibirapuera": "Moema", "Centro Sé República": "Centro", "Luz Bom Retiro": "Bom Retiro", "Brás Mooca": "Mooca",
  "Cidade Jardim Jockey": "Cidade Jardim", "Campo Belo Brooklin": "Brooklin", "Panamby Vila Andrade": "Vila Andrade",
  "perto do Zoológico de São Paulo Água Funda": "Água Funda", "Tremembé Horto Florestal": "Tremembé", "perto do Pico do Jaraguá": "Jaraguá",
  "Santana Zona Norte": "Santana", "Armênia Canindé": "Armênia", "centro de Guarulhos": "Centro",
  "Riacho Grande São Bernardo do Campo": "Riacho Grande", "centro Embu das Artes": "Centro", "Granja Viana Cotia": "Granja Viana",
  "centro histórico Santana de Parnaíba": "Centro histórico", "Mairiporã Serra da Cantareira": "Mairiporã",
  "Paranapiacaba Santo André": "Paranapiacaba", "Jabaquara Água Funda": "Jabaquara" };
const rotulo = (q) => { const c = q.replace(/ São Paulo$/, "").trim(); return ROTULOS[c] || c; };

const usados = new Set(lugares.map((p) => p.id));
const saida = [];
for (const r of brutos) {
  const pequenaCidade = /Paranapiacaba|Pirapora|Perus|Jaragu|Trememb|Jabaquara/.test(r.q);
  const bom = r.nota >= 4.5 || (r.nota >= 4.4 && r.n >= 1500) || (pequenaCidade && r.nota >= 4.3);
  if (!bom) continue;
  if (jaTem.some((n) => sem(r.nome).includes(n.split(" (")[0]) || n.includes(sem(r.nome)))) continue;
  // Perto de alguma atração do site (até 3 km).
  const viz = atracoes.map((p) => ({ p, d: km(r, p) })).sort((a, b) => a.d - b.d);
  if (!viz.length || viz[0].d > 3) continue;
  const prox = viz[0].p;
  const comTransporte = viz.find((v) => v.d <= 1 && estacao(v.p.comoChegar));
  const pf = perfil(r.tipo);
  let id = "r-" + slug(r.nome); let k = 2; while (usados.has(id)) id = "r-" + slug(r.nome) + "-" + k++;
  usados.add(id);
  const endereco = r.end.replace(/\s+/g, " ").trim();
  saida.push({
    id, nome: r.nome.trim(),
    bairro: viz[0].d <= 1 && !/^(Vários|Zona Sul|Zona Norte)$/.test(prox.bairro) ? prox.bairro : rotulo(r.q),
    ...(prox.municipio && viz[0].d <= 6 ? { municipio: prox.municipio } : {}),
    lat: r.lat, lng: r.lng, preco: pf.preco, duracao: pf.dur,
    horario: r.h24 ? { abre: "00:00", fecha: "23:59", fechado: [] } : { abre: pf.h[0], fecha: pf.h[1], fechado: [] },
    comoChegar: (endereco ? endereco + " — " : "") + (comTransporte ? "perto do " + estacao(comTransporte.p.comoChegar) + "." : "app de transporte ou ônibus."),
    descricao: `${r.tipo}${r.desc ? " — " + r.desc.replace(/\.$/, "") : ""}. Nota ${fmtNota(r.nota)} no Google Maps (${fmtN(r.n)} avaliações).`,
    nota: r.nota, avaliacoes: r.n
  });
}
saida.sort((a, b) => a.bairro.localeCompare(b.bairro) || b.nota - a.nota);
const js = `/*
 * Restaurantes bem avaliados perto das atrações (gerado a partir de buscas no Google Maps em 01/11/2026).
 * Critério: nota 4,5 ou mais (ou 4,4 com 1.500+ avaliações), pelo menos 200 avaliações (80 em cidades pequenas)
 * e até 3 km de alguma atração do site. Preço, duração e horário são estimativas pelo tipo de cozinha.
 * Para atualizar: refaça a coleta e rode o gerador (ver README). Não edite à mão.
 */
(function () {
  const lugares = window.TF_CITIES.sp.lugares;
  const PADRAO = { categoria: "gastronomia", restaurante: true, idade: "Livre", precoNota: "gasto médio por pessoa (estimado)",
    confirmar: "Nota vista no Google Maps em nov/2026; horário e preço aqui são aproximados — confira antes de ir." };
  ${JSON.stringify(saida).replace(/\},\{"id"/g, '},\n  {"id"')}.forEach((r) => lugares.push(Object.assign({}, PADRAO, r)));
})();
`;
fs.writeFileSync(path.join(raiz, "js/data/sp-restaurantes.js"), js);
const porBairro = {}; saida.forEach((r) => (porBairro[r.bairro] = (porBairro[r.bairro] || 0) + 1));
console.log(saida.length, "restaurantes;", Object.keys(porBairro).length, "bairros;", (js.length / 1024).toFixed(0), "KB");
console.log(Object.entries(porBairro).sort((a, b) => b[1] - a[1]).map(([b, n]) => b + " " + n).join(" · "));
