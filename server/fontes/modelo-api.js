/*
 * MODELO para ligar uma API de ingressos/eventos. Desligado até existir a chave.
 *
 * Para usar com uma API real:
 *  1. Crie a conta/chave na plataforma e confira se os termos permitem exibir os eventos.
 *  2. Rode o servidor com a variável de ambiente EVENTOS_API_KEY (e EVENTOS_API_URL).
 *  3. Ajuste a função "converter" para os campos que a API devolve.
 *
 * Nenhuma plataforma específica está ligada aqui: cada uma tem endereço, parâmetros e formato próprios.
 */
const LOCAIS_CONHECIDOS = {
  // Coordenadas de casas frequentes, para quando a API não manda latitude/longitude.
  "espaço unimed": [-23.5238, -46.6650],
  "nubank parque": [-23.5275, -46.6783],
  "allianz parque": [-23.5275, -46.6783],
  "vibra são paulo": [-23.6510, -46.7215]
};

function converter(item) {
  // Exemplo de mapeamento — troque pelos nomes de campo da API escolhida.
  const local = (item.venue && item.venue.name || "").toLowerCase();
  const [lat, lng] = item.venue && item.venue.lat != null
    ? [Number(item.venue.lat), Number(item.venue.lng)]
    : LOCAIS_CONHECIDOS[local] || [NaN, NaN];
  return {
    id: "api:" + item.id,
    nome: item.name,
    categoria: "show",
    bairro: item.venue && item.venue.city || "São Paulo",
    lat, lng,
    datas: [String(item.date).slice(0, 10)],
    inicio: item.time ? String(item.time).slice(0, 5) : "21:00",
    horario: { abre: item.time ? String(item.time).slice(0, 5) : "21:00", fecha: "23:59", fechado: [] },
    preco: Number(item.minPrice) || 0,
    precoNota: "a partir de; confirme no site de venda",
    idade: item.ageRating || "16+",
    duracao: 150,
    comoChegar: item.venue && item.venue.address || "Confira o endereço no ingresso.",
    descricao: item.description || "",
    fonte: item.url,
    confirmar: "Dados vindos da API do site de ingressos — confirme antes de comprar."
  };
}

module.exports = {
  nome: "api-ingressos",
  ativa: () => !!(process.env.EVENTOS_API_KEY && process.env.EVENTOS_API_URL),
  async coletar({ cidade, de, ate }) {
    const url = new URL(process.env.EVENTOS_API_URL);
    url.searchParams.set("city", cidade === "sp" ? "São Paulo" : cidade);
    url.searchParams.set("from", de);
    url.searchParams.set("to", ate);
    const res = await fetch(url, { headers: { Authorization: "Bearer " + process.env.EVENTOS_API_KEY } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const body = await res.json();
    return (body.events || body.results || []).map(converter);
  }
};
