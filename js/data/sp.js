/*
 * Dados de São Paulo.
 * Preços, horários e datas são aproximados e servem para o protótipo —
 * confirme sempre no site oficial antes de ir.
 *
 * Campos:
 *  preco       valor por pessoa em R$ (0 = grátis)
 *  idade       classificação indicativa ("Livre", "10+", "14+", "16+", "18+")
 *  duracao     tempo sugerido de permanência, em minutos
 *  horario     { abre, fecha, fechado: [dias da semana fechados, 0 = domingo] }
 *  gratisDias  dias da semana com entrada gratuita
 *  datas       (eventos) datas em que acontece, AAAA-MM-DD
 *  inicio      (eventos) horário fixo de início
 *  ilustrativo true quando a data/atração é apenas um exemplo
 */
window.TF_CITIES = window.TF_CITIES || {};

window.TF_CITIES.sp = {
  id: "sp",
  nome: "São Paulo",
  uf: "SP",
  centro: [-23.5558, -46.6496],
  tarifaTransporte: 5.2, // metrô/ônibus (estimado)
  lugares: [
    // ---------- Museus ----------
    {
      id: "masp", nome: "MASP", categoria: "museu", bairro: "Bela Vista",
      lat: -23.5614, lng: -46.6559, preco: 75, idade: "Livre", duracao: 120,
      horario: { abre: "10:00", fecha: "18:00", fechado: [1] }, gratisDias: [2],
      comoChegar: "Metrô Trianon-MASP (Linha 2-Verde), saída na própria Av. Paulista.",
      descricao: "Museu de Arte de São Paulo, com o famoso vão livre e acervo de arte europeia e brasileira.",
      destaque: true
    },
    {
      id: "pinacoteca", nome: "Pinacoteca de São Paulo", categoria: "museu", bairro: "Luz",
      lat: -23.5343, lng: -46.6339, preco: 30, idade: "Livre", duracao: 120,
      horario: { abre: "10:00", fecha: "18:00", fechado: [2] }, gratisDias: [6],
      comoChegar: "Metrô Luz (Linhas 1-Azul e 4-Amarela) ou CPTM Luz, 5 min a pé.",
      descricao: "Museu de arte mais antigo da cidade, com foco em arte brasileira do séc. XIX ao contemporâneo.",
      destaque: true
    },
    {
      id: "mlp", nome: "Museu da Língua Portuguesa", categoria: "museu", bairro: "Luz",
      lat: -23.5352, lng: -46.6358, preco: 24, idade: "Livre", duracao: 90,
      horario: { abre: "09:00", fecha: "16:30", fechado: [1] }, gratisDias: [6],
      comoChegar: "Dentro da Estação da Luz (Linhas 1-Azul, 4-Amarela e CPTM).",
      descricao: "Museu interativo sobre a língua portuguesa, instalado no prédio histórico da Estação da Luz."
    },
    {
      id: "ipiranga", nome: "Museu do Ipiranga", categoria: "museu", bairro: "Ipiranga",
      lat: -23.5855, lng: -46.6097, preco: 30, idade: "Livre", duracao: 150,
      horario: { abre: "10:00", fecha: "17:00", fechado: [1] },
      comoChegar: "CPTM Ipiranga (Linha 10) + 15 min a pé, ou ônibus a partir do Metrô Sacomã.",
      descricao: "Museu Paulista reformado, com jardins inspirados em Versalhes e o Parque da Independência.",
      destaque: true
    },
    {
      id: "futebol", nome: "Museu do Futebol", categoria: "museu", bairro: "Pacaembu",
      lat: -23.5475, lng: -46.6650, preco: 24, idade: "Livre", duracao: 120,
      horario: { abre: "09:00", fecha: "18:00", fechado: [1] },
      comoChegar: "Metrô Clínicas (Linha 2-Verde) + 15 min a pé, ou ônibus pela Av. Dr. Arnaldo.",
      descricao: "Museu interativo sobre a história do futebol, embaixo das arquibancadas do Pacaembu."
    },
    {
      id: "catavento", nome: "Museu Catavento", categoria: "museu", bairro: "Brás",
      lat: -23.5446, lng: -46.6278, preco: 20, idade: "Livre", duracao: 150,
      horario: { abre: "09:00", fecha: "16:00", fechado: [1] },
      comoChegar: "Metrô Pedro II (Linha 3-Vermelha), 5 min a pé.",
      descricao: "Museu de ciências interativo, ótimo para crianças e famílias.",
      tags: ["crianças"]
    },
    {
      id: "mis", nome: "MIS — Museu da Imagem e do Som", categoria: "museu", bairro: "Jardim Europa",
      lat: -23.5714, lng: -46.6767, preco: 30, idade: "Livre", duracao: 120,
      horario: { abre: "10:00", fecha: "20:00", fechado: [1] },
      comoChegar: "Metrô Oscar Freire (Linha 4-Amarela) + 15 min a pé.",
      descricao: "Exposições temporárias de cinema, música, fotografia e cultura pop."
    },
    {
      id: "afro", nome: "Museu Afro Brasil Emanoel Araujo", categoria: "museu", bairro: "Ibirapuera",
      lat: -23.5845, lng: -46.6553, preco: 15, idade: "Livre", duracao: 90,
      horario: { abre: "10:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Dentro do Parque Ibirapuera, portão 10. Ônibus pela Av. Pedro Álvares Cabral.",
      descricao: "Acervo sobre história, arte e cultura afro-brasileira."
    },
    {
      id: "mam", nome: "MAM — Museu de Arte Moderna", categoria: "museu", bairro: "Ibirapuera",
      lat: -23.5880, lng: -46.6544, preco: 30, idade: "Livre", duracao: 75,
      horario: { abre: "10:00", fecha: "18:00", fechado: [1] }, gratisDias: [0],
      comoChegar: "Dentro do Parque Ibirapuera, sob a marquise. Portão 3.",
      descricao: "Arte moderna e contemporânea brasileira, com jardim de esculturas."
    },
    {
      id: "japan", nome: "Japan House", categoria: "museu", bairro: "Bela Vista",
      lat: -23.5713, lng: -46.6450, preco: 0, idade: "Livre", duracao: 60,
      horario: { abre: "10:00", fecha: "18:00", fechado: [1] },
      comoChegar: "Metrô Brigadeiro (Linha 2-Verde), 3 min a pé pela Av. Paulista.",
      descricao: "Centro cultural japonês com exposições, loja e restaurante."
    },
    {
      id: "ims", nome: "Instituto Moreira Salles", categoria: "museu", bairro: "Consolação",
      lat: -23.5560, lng: -46.6627, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "10:00", fecha: "20:00", fechado: [1] },
      comoChegar: "Metrô Consolação (Linha 2-Verde), 2 min a pé.",
      descricao: "Fotografia, cinema e biblioteca, com terraço com vista para a Paulista."
    },
    {
      id: "farol", nome: "Farol Santander", categoria: "museu", bairro: "Centro",
      lat: -23.5458, lng: -46.6340, preco: 40, idade: "Livre", duracao: 90,
      horario: { abre: "09:00", fecha: "20:00", fechado: [1] },
      comoChegar: "Metrô São Bento (Linha 1-Azul), 3 min a pé.",
      descricao: "Antigo Edifício Altino Arantes: exposições e mirante no 26º andar."
    },
    {
      id: "tomie", nome: "Instituto Tomie Ohtake", categoria: "museu", bairro: "Pinheiros",
      lat: -23.5625, lng: -46.6930, preco: 0, idade: "Livre", duracao: 75,
      horario: { abre: "11:00", fecha: "20:00", fechado: [1] },
      comoChegar: "Metrô Faria Lima (Linha 4-Amarela), 5 min a pé.",
      descricao: "Arte contemporânea em prédio icônico projetado por Ruy Ohtake."
    },
    {
      id: "ccbb", nome: "CCBB São Paulo", categoria: "museu", bairro: "Centro",
      lat: -23.5479, lng: -46.6346, preco: 0, idade: "Livre", duracao: 60,
      horario: { abre: "09:00", fecha: "20:00", fechado: [2] },
      comoChegar: "Metrô Sé (Linhas 1 e 3) ou São Bento (Linha 1), 5 min a pé.",
      descricao: "Centro Cultural Banco do Brasil, com exposições geralmente gratuitas."
    },

    // ---------- Pontos turísticos ----------
    {
      id: "paulista", nome: "Avenida Paulista", categoria: "ponto", bairro: "Bela Vista",
      lat: -23.5631, lng: -46.6544, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "00:00", fecha: "23:59", fechado: [] },
      comoChegar: "Metrô Linha 2-Verde: estações Consolação, Trianon-MASP e Brigadeiro.",
      descricao: "Principal avenida da cidade. Aos domingos é fechada para carros (Paulista Aberta).",
      destaque: true
    },
    {
      id: "mercadao", nome: "Mercado Municipal (Mercadão)", categoria: "gastronomia", bairro: "Centro",
      lat: -23.5418, lng: -46.6295, preco: 60, precoNota: "gasto médio com lanche", idade: "Livre", duracao: 90,
      horario: { abre: "07:00", fecha: "18:00", fechado: [] },
      comoChegar: "Metrô São Bento (Linha 1-Azul), 10 min a pé.",
      descricao: "Famoso pelo sanduíche de mortadela e pelo pastel de bacalhau. Vitrais históricos.",
      destaque: true
    },
    {
      id: "se", nome: "Catedral da Sé", categoria: "ponto", bairro: "Centro",
      lat: -23.5505, lng: -46.6343, preco: 0, idade: "Livre", duracao: 45,
      horario: { abre: "08:00", fecha: "19:00", fechado: [] },
      comoChegar: "Metrô Sé (Linhas 1-Azul e 3-Vermelha), saída em frente.",
      descricao: "Catedral neogótica no marco zero da cidade."
    },
    {
      id: "patio", nome: "Pátio do Colégio", categoria: "ponto", bairro: "Centro",
      lat: -23.5482, lng: -46.6324, preco: 10, idade: "Livre", duracao: 45,
      horario: { abre: "09:00", fecha: "16:30", fechado: [1] },
      comoChegar: "Metrô Sé (Linhas 1 e 3), 5 min a pé.",
      descricao: "Local de fundação de São Paulo, em 1554, com museu anexo."
    },
    {
      id: "theatro", nome: "Theatro Municipal (visita guiada)", categoria: "ponto", bairro: "Centro",
      lat: -23.5454, lng: -46.6387, preco: 0, idade: "Livre", duracao: 60,
      horario: { abre: "11:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Metrô Anhangabaú (Linha 3-Vermelha), 2 min a pé.",
      descricao: "Visita guiada gratuita pelo teatro histórico de 1911 (agende com antecedência)."
    },
    {
      id: "sampasky", nome: "Sampa Sky", categoria: "ponto", bairro: "Centro",
      lat: -23.5460, lng: -46.6358, preco: 70, idade: "Livre", duracao: 60,
      horario: { abre: "09:00", fecha: "19:00", fechado: [] },
      comoChegar: "Metrô Anhangabaú (Linha 3) ou São Bento (Linha 1), 5 min a pé.",
      descricao: "Mirante com caixas de vidro suspensas no 42º andar."
    },
    {
      id: "italia", nome: "Terraço Itália", categoria: "gastronomia", bairro: "República",
      lat: -23.5450, lng: -46.6434, preco: 120, precoNota: "gasto médio no bar", idade: "Livre", duracao: 90,
      horario: { abre: "12:00", fecha: "23:59", fechado: [] },
      comoChegar: "Metrô República (Linhas 3-Vermelha e 4-Amarela), 3 min a pé.",
      descricao: "Bar e restaurante no topo do Edifício Itália, ótimo para o pôr do sol."
    },
    {
      id: "batman", nome: "Beco do Batman", categoria: "ponto", bairro: "Vila Madalena",
      lat: -23.5560, lng: -46.6880, preco: 0, idade: "Livre", duracao: 45,
      horario: { abre: "08:00", fecha: "20:00", fechado: [] },
      comoChegar: "Metrô Fradique Coutinho (Linha 4-Amarela) ou Vila Madalena (Linha 2), 15 min a pé.",
      descricao: "Viela cheia de grafites, um dos cartões postais da arte de rua paulistana.",
      destaque: true
    },
    {
      id: "liberdade", comida: true, nome: "Bairro da Liberdade", categoria: "ponto", bairro: "Liberdade",
      lat: -23.5557, lng: -46.6355, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "09:00", fecha: "20:00", fechado: [] },
      comoChegar: "Metrô Liberdade (Linha 1-Azul), saída na Praça da Liberdade.",
      descricao: "Bairro oriental com lojas, lanternas e feira de comida aos fins de semana.",
      destaque: true
    },
    {
      id: "25marco", nome: "Rua 25 de Março", categoria: "ponto", bairro: "Centro",
      lat: -23.5420, lng: -46.6320, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "08:00", fecha: "18:00", fechado: [0] },
      comoChegar: "Metrô São Bento (Linha 1-Azul), 5 min a pé.",
      descricao: "Maior centro de comércio popular da América Latina."
    },
    {
      id: "mirante9", nome: "Mirante 9 de Julho", categoria: "ponto", bairro: "Bela Vista",
      lat: -23.5590, lng: -46.6560, preco: 0, idade: "Livre", duracao: 45,
      horario: { abre: "10:00", fecha: "22:00", fechado: [1] },
      comoChegar: "Metrô Trianon-MASP (Linha 2-Verde), 5 min a pé atrás do MASP.",
      descricao: "Mirante com café e vista para a Av. 9 de Julho."
    },

    // ---------- Parques ----------
    {
      id: "ibirapuera", nome: "Parque Ibirapuera", categoria: "parque", bairro: "Ibirapuera",
      lat: -23.5874, lng: -46.6576, preco: 0, idade: "Livre", duracao: 180,
      horario: { abre: "05:00", fecha: "23:59", fechado: [] },
      comoChegar: "Metrô AACD-Servidor (Linha 5-Lilás) + 15 min a pé, ou ônibus pela Av. Brasil.",
      descricao: "O parque mais famoso da cidade, com lago, museus e a Oca de Niemeyer.",
      destaque: true
    },
    {
      id: "planetario", nome: "Planetário do Ibirapuera", categoria: "museu", bairro: "Ibirapuera",
      lat: -23.5885, lng: -46.6598, preco: 20, idade: "Livre", duracao: 60,
      horario: { abre: "10:00", fecha: "17:00", fechado: [1, 2] },
      comoChegar: "Dentro do Parque Ibirapuera, portão 10.",
      descricao: "Sessões de cúpula sobre astronomia. Compre o ingresso com antecedência.",
      tags: ["crianças"]
    },
    {
      id: "villalobos", nome: "Parque Villa-Lobos", categoria: "parque", bairro: "Alto de Pinheiros",
      lat: -23.5460, lng: -46.7230, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "05:30", fecha: "19:00", fechado: [] },
      comoChegar: "CPTM Villa-Lobos–Jaguaré (Linha 9-Esmeralda), 10 min a pé.",
      descricao: "Parque amplo com ciclovia, quadras e orquidário."
    },
    {
      id: "aquario", nome: "Aquário de São Paulo", categoria: "parque", bairro: "Ipiranga",
      lat: -23.5935, lng: -46.6145, preco: 120, idade: "Livre", duracao: 150,
      horario: { abre: "09:00", fecha: "18:00", fechado: [] },
      comoChegar: "Metrô Alto do Ipiranga (Linha 2-Verde) + 20 min a pé, ou app de transporte.",
      descricao: "Maior aquário temático da América do Sul, com ursos-polares e tubarões.",
      tags: ["crianças"]
    },
    {
      id: "zoo", nome: "Zoológico de São Paulo", categoria: "parque", bairro: "Água Funda",
      lat: -23.6505, lng: -46.6206, preco: 70, idade: "Livre", duracao: 240,
      horario: { abre: "09:00", fecha: "17:00", fechado: [] },
      comoChegar: "Metrô Jabaquara (Linha 1-Azul) + ônibus 4742 (cerca de 20 min).",
      descricao: "Zoológico com mais de 2 mil animais, ao lado do Jardim Botânico.",
      tags: ["crianças"]
    },
    {
      id: "botanico", nome: "Jardim Botânico", categoria: "parque", bairro: "Água Funda",
      lat: -23.6410, lng: -46.6230, preco: 20, idade: "Livre", duracao: 120,
      horario: { abre: "09:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Metrô São Judas/Jabaquara (Linha 1-Azul) + ônibus, ou app de transporte.",
      descricao: "Trilhas, estufas e a nascente do riacho do Ipiranga."
    },

    // ---------- Gastronomia / vida noturna ----------
    {
      id: "vilamadalena", comida: true, nome: "Bares da Vila Madalena", categoria: "noite", bairro: "Vila Madalena",
      lat: -23.5555, lng: -46.6900, preco: 100, precoNota: "gasto médio por pessoa", idade: "18+", duracao: 180,
      horario: { abre: "17:00", fecha: "23:59", fechado: [] },
      comoChegar: "Metrô Vila Madalena (Linha 2-Verde) ou Fradique Coutinho (Linha 4), 10 min a pé.",
      descricao: "Região boêmia com bares, botecos e música ao vivo."
    },
    {
      id: "bixiga", nome: "Cantinas do Bixiga", categoria: "gastronomia", bairro: "Bela Vista",
      lat: -23.5585, lng: -46.6470, preco: 90, precoNota: "gasto médio por pessoa", idade: "Livre", duracao: 120,
      horario: { abre: "12:00", fecha: "23:00", fechado: [] },
      comoChegar: "Metrô São Joaquim (Linha 1-Azul) ou Brigadeiro (Linha 2), 10 min a pé.",
      descricao: "Bairro italiano tradicional, famoso pelas cantinas e pela Rua 13 de Maio."
    },

    // ---------- Teatros e concertos ----------
    {
      id: "osesp", nome: "Concerto da OSESP na Sala São Paulo", categoria: "teatro", bairro: "Campos Elíseos",
      lat: -23.5345, lng: -46.6400, preco: 90, idade: "Livre", duracao: 120,
      horario: { abre: "20:30", fecha: "22:30", fechado: [1, 2, 3] }, inicio: "20:30",
      comoChegar: "CPTM Júlio Prestes ou Metrô Luz (Linhas 1 e 4), 5 min a pé.",
      descricao: "Orquestra Sinfônica do Estado em uma das melhores salas de concerto do mundo."
    },
    {
      id: "musical", nome: "Musical da temporada — Teatro Renault", categoria: "teatro", bairro: "Bela Vista",
      lat: -23.5574, lng: -46.6420, preco: 150, idade: "Livre", duracao: 150,
      horario: { abre: "20:00", fecha: "23:00", fechado: [1, 2] }, inicio: "20:00",
      comoChegar: "Metrô Brigadeiro (Linha 2-Verde), 10 min a pé pela Av. Brigadeiro Luís Antônio.",
      descricao: "Grandes musicais no estilo Broadway. Consulte o espetáculo em cartaz.",
      ilustrativo: true
    },
    {
      id: "standup", nome: "Stand-up comedy", categoria: "teatro", bairro: "Pinheiros",
      lat: -23.5660, lng: -46.6900, preco: 80, idade: "14+", duracao: 90,
      horario: { abre: "21:00", fecha: "23:00", fechado: [1, 2] }, inicio: "21:00",
      comoChegar: "Metrô Faria Lima (Linha 4-Amarela), 10 min a pé.",
      descricao: "Noite de stand-up com comediantes da cena paulistana.",
      ilustrativo: true
    },

    // ---------- Shows ----------
    // Agenda pesquisada em out/2026 (Billboard Brasil, Omelete, JamBase, RockBizz, Ticketle).
    // Horários e preços são estimativas; "confirmar" aparece como aviso no site.
    {
      id: "show-ronnie", nome: "Ronnie Wood", categoria: "show", bairro: "Barra Funda",
      lat: -23.5238, lng: -46.6650, preco: 350, precoNota: "estimado; varia por setor", idade: "16+", duracao: 150,
      horario: { abre: "20:00", fecha: "23:59", fechado: [] }, inicio: "21:00",
      datas: ["2026-11-01"],
      comoChegar: "Espaço Unimed — Metrô Palmeiras-Barra Funda (Linha 3) + 10 min de app ou 20 min a pé.",
      descricao: "Guitarrista dos Rolling Stones em show solo. Menores de 16 só acompanhados dos responsáveis.",
      confirmar: "Confirme horário e valores no site oficial de venda."
    },
    {
      id: "show-mariah", nome: "Mariah Carey", categoria: "show", bairro: "Água Branca",
      lat: -23.5275, lng: -46.6783, preco: 450, precoNota: "pista; estimado", idade: "16+", duracao: 210,
      horario: { abre: "18:00", fecha: "23:59", fechado: [] }, inicio: "21:00",
      datas: ["2026-11-17", "2026-11-18"],
      comoChegar: "Nubank Parque (antigo Allianz Parque) — Metrô Palmeiras-Barra Funda (Linha 3) + 15 min a pé. Evite carro.",
      descricao: "Show de estádio. Menores de 16 só acompanhados dos responsáveis.",
      confirmar: "As fontes divergem entre 17 e 18/11 — confirme a data."
    },
    {
      id: "show-zztop", nome: "ZZ Top", categoria: "show", bairro: "Zona Sul",
      lat: -23.6337, lng: -46.7115, preco: 300, precoNota: "estimado", idade: "16+", duracao: 150,
      horario: { abre: "20:00", fecha: "23:59", fechado: [] }, inicio: "21:30",
      datas: ["2026-11-21"],
      comoChegar: "Suhai Music Hall (Zona Sul) — recomendado app de transporte; confirme o endereço no ingresso.",
      descricao: "Banda texana de blues rock.",
      confirmar: "Confirme local, horário e valores no site oficial de venda."
    },
    {
      id: "show-seal", nome: "Seal + Seu Jorge", categoria: "show", bairro: "Água Branca",
      lat: -23.5275, lng: -46.6783, preco: 350, precoNota: "estimado", idade: "16+", duracao: 210,
      horario: { abre: "15:00", fecha: "23:59", fechado: [] }, inicio: "18:00",
      datas: ["2026-11-28"],
      comoChegar: "Nubank Parque (antigo Allianz Parque) — Metrô Palmeiras-Barra Funda (Linha 3) + 15 min a pé.",
      descricao: "Seal com abertura de Seu Jorge.",
      confirmar: "Horário de início a confirmar."
    },
    {
      id: "show-ed", nome: "Ed Sheeran", categoria: "show", bairro: "Água Branca",
      lat: -23.5275, lng: -46.6783, preco: 450, precoNota: "pista; estimado", idade: "16+", duracao: 240,
      horario: { abre: "16:00", fecha: "23:59", fechado: [] }, inicio: "19:00",
      datas: ["2026-12-05", "2026-12-06"],
      comoChegar: "Nubank Parque (antigo Allianz Parque) — Metrô Palmeiras-Barra Funda (Linha 3) + 15 min a pé.",
      descricao: "Turnê de estádio, com abertura de FINNEAS.",
      confirmar: "As fontes divergem entre 5 e 6/12 — confirme a data."
    },
    {
      id: "show-purple", nome: "Deep Purple", categoria: "show", bairro: "Zona Sul",
      lat: -23.6337, lng: -46.7115, preco: 350, precoNota: "estimado", idade: "16+", duracao: 150,
      horario: { abre: "20:00", fecha: "23:59", fechado: [] }, inicio: "21:30",
      datas: ["2026-12-05"],
      comoChegar: "Suhai Music Hall (Zona Sul) — recomendado app de transporte; confirme o endereço no ingresso.",
      descricao: "Clássicos do hard rock ao vivo.",
      confirmar: "Confirme local, horário e valores no site oficial de venda."
    },
    {
      id: "show-slayer", nome: "Slayer + Kreator + Korzus", categoria: "show", bairro: "Água Branca",
      lat: -23.5275, lng: -46.6783, preco: 450, precoNota: "estimado", idade: "16+", duracao: 300,
      horario: { abre: "15:00", fecha: "23:59", fechado: [] }, inicio: "17:00",
      datas: ["2026-12-17"],
      comoChegar: "Nubank Parque (antigo Allianz Parque) — Metrô Palmeiras-Barra Funda (Linha 3) + 15 min a pé.",
      descricao: "Noite de thrash metal no estádio.",
      confirmar: "Horário de início a confirmar."
    },
    {
      id: "show-lionel", nome: "Lionel Richie", categoria: "show", bairro: "Água Branca",
      lat: -23.5275, lng: -46.6783, preco: 400, precoNota: "estimado", idade: "Livre", duracao: 180,
      horario: { abre: "18:00", fecha: "23:59", fechado: [] }, inicio: "21:00",
      datas: ["2026-12-19"],
      comoChegar: "Nubank Parque (antigo Allianz Parque) — Metrô Palmeiras-Barra Funda (Linha 3) + 15 min a pé.",
      descricao: "Os grandes sucessos do cantor em show de estádio.",
      confirmar: "Confirme horário e classificação no site oficial de venda."
    },
    {
      id: "show-sesc", nome: "Show instrumental — Sesc Pompeia", categoria: "show", bairro: "Pompeia",
      lat: -23.5260, lng: -46.6836, preco: 40, idade: "Livre", duracao: 120,
      horario: { abre: "20:00", fecha: "23:00", fechado: [1] }, inicio: "21:00",
      datas: ["2026-11-05", "2026-11-12", "2026-11-19"],
      comoChegar: "Metrô Palmeiras-Barra Funda (Linha 3) + ônibus ou 25 min a pé.",
      descricao: "Shows a preços populares no espaço projetado por Lina Bo Bardi.",
      ilustrativo: true
    },

    // ---------- Festivais / eventos ----------
    {
      id: "gp", nome: "Grande Prêmio de São Paulo de F1", categoria: "festival", bairro: "Interlagos",
      lat: -23.7036, lng: -46.6997, preco: 1200, precoNota: "arquibancada; varia por setor", idade: "Livre", duracao: 480,
      horario: { abre: "08:00", fecha: "18:00", fechado: [] }, inicio: "09:00",
      datas: ["2026-11-06", "2026-11-07", "2026-11-08"],
      comoChegar: "CPTM Autódromo (Linha 9-Esmeralda) + 15 min a pé.",
      descricao: "Etapa brasileira da Fórmula 1 no Autódromo de Interlagos (6 a 8/11/2026). Sexta: treinos · sábado: classificação · domingo: corrida.",
      confirmar: "Datas confirmadas; horários das sessões e preços a confirmar."
    },
    {
      id: "mostra", nome: "Mostra Internacional de Cinema", categoria: "festival", bairro: "Vários",
      lat: -23.5590, lng: -46.6600, preco: 25, idade: "14+", duracao: 150,
      horario: { abre: "13:00", fecha: "23:00", fechado: [] },
      datas: ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"],
      comoChegar: "Sessões em vários cinemas da Paulista e região — Metrô Linha 2-Verde.",
      descricao: "Um dos maiores festivais de cinema do país. Classificação varia por filme.",
      ilustrativo: true
    },
    {
      id: "jazz", nome: "Festival de Jazz no Parque", categoria: "festival", bairro: "Ibirapuera",
      lat: -23.5865, lng: -46.6560, preco: 0, idade: "Livre", duracao: 180,
      horario: { abre: "14:00", fecha: "20:00", fechado: [] }, inicio: "15:00",
      datas: ["2026-11-08", "2026-11-15"],
      comoChegar: "Parque Ibirapuera, Auditório externo. Metrô AACD-Servidor (Linha 5) + 15 min a pé.",
      descricao: "Shows gratuitos de jazz ao ar livre. Leve canga!",
      ilustrativo: true
    },
    {
      id: "virada", nome: "Virada Cultural", categoria: "festival", bairro: "Centro",
      lat: -23.5440, lng: -46.6360, preco: 0, idade: "Livre", duracao: 360,
      horario: { abre: "00:00", fecha: "23:59", fechado: [] },
      datas: ["2027-05-22", "2027-05-23"],
      comoChegar: "Palcos espalhados pelo centro — Metrô Sé, República e Anhangabaú.",
      descricao: "24 horas de shows gratuitos pela cidade, normalmente em maio.",
      ilustrativo: true
    },

    // ---------- Trilhas e natureza ----------
    {
      id: "jaragua", nome: "Pico do Jaraguá", categoria: "trilha", bairro: "Jaraguá",
      lat: -23.4566, lng: -46.7666, preco: 0, idade: "Livre", duracao: 180,
      horario: { abre: "07:00", fecha: "17:00", fechado: [] },
      comoChegar: "CPTM Vila Aurora (Linha 7-Rubi) + ônibus até o parque, ou app de transporte (~40 min do centro).",
      descricao: "Ponto mais alto da cidade (1.135 m), com trilhas e vista de 360° de São Paulo.",
      nivel: "moderada", destaque: true
    },
    {
      id: "cantareira", nome: "Cantareira — Núcleo Pedra Grande", categoria: "trilha", bairro: "Tremembé",
      lat: -23.4440, lng: -46.6370, preco: 20, idade: "Livre", duracao: 240,
      horario: { abre: "08:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Metrô Tucuruvi (Linha 1-Azul) + app (~15 min) ou ônibus até o Horto.",
      descricao: "Trilha de ~10 km (ida e volta) em Mata Atlântica até o mirante da Pedra Grande.",
      nivel: "moderada"
    },
    {
      id: "horto", nome: "Horto Florestal", categoria: "trilha", bairro: "Tremembé",
      lat: -23.4590, lng: -46.6350, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "06:00", fecha: "18:00", fechado: [] },
      comoChegar: "Metrô Santana (Linha 1-Azul) + ônibus, ou app de transporte.",
      descricao: "Parque Estadual Alberto Löfgren: lagos, trilhas curtas e área para piquenique.",
      nivel: "leve", tags: ["crianças"]
    },
    {
      id: "anhanguera", nome: "Parque Anhanguera", categoria: "trilha", bairro: "Perus",
      lat: -23.4195, lng: -46.7860, preco: 0, idade: "Livre", duracao: 180,
      horario: { abre: "06:00", fecha: "18:00", fechado: [] },
      comoChegar: "CPTM Perus (Linha 7-Rubi) + ônibus, ou app de transporte.",
      descricao: "Maior parque municipal da cidade, com trilhas em meio ao eucaliptal e à mata nativa.",
      nivel: "leve"
    },
    {
      id: "burlemarx", nome: "Parque Burle Marx", categoria: "trilha", bairro: "Panamby",
      lat: -23.6330, lng: -46.7230, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "07:00", fecha: "19:00", fechado: [] },
      comoChegar: "CPTM Granja Julieta (Linha 9) + app (~10 min).",
      descricao: "Jardins de Burle Marx e trilhas curtas em mata atlântica.",
      nivel: "leve"
    },

    // ---------- Esportes e estádios ----------
    {
      id: "kart-interlagos", nome: "Kart de aluguel — Kartódromo de Interlagos", categoria: "esporte", bairro: "Interlagos",
      lat: -23.7020, lng: -46.6960, preco: 120, precoNota: "por bateria; estimado", idade: "12+", duracao: 90,
      horario: { abre: "10:00", fecha: "22:00", fechado: [1] },
      comoChegar: "CPTM Autódromo (Linha 9-Esmeralda) + 15 min a pé.",
      descricao: "Kartódromo Ayrton Senna, onde ele começou. Baterias de kart rental para iniciantes.",
      confirmar: "Altura e idade mínimas variam por operador. Pode fechar no fim de semana do GP."
    },
    {
      id: "kart-granja", nome: "Kartódromo Granja Viana (KGV)", categoria: "esporte", bairro: "Cotia",
      lat: -23.5995, lng: -46.8360, preco: 150, precoNota: "por bateria; estimado", idade: "12+", duracao: 120,
      horario: { abre: "10:00", fecha: "22:00", fechado: [] },
      comoChegar: "Fica em Cotia (~30 km do centro): app de transporte ou carro pela Rod. Raposo Tavares.",
      descricao: "Um dos kartódromos mais tradicionais do país, com kart rental e campeonatos amadores.",
      confirmar: "Agende a bateria com antecedência."
    },
    {
      id: "society", nome: "Futebol society — aluguel de quadra", categoria: "esporte", bairro: "Pinheiros",
      lat: -23.5670, lng: -46.7020, preco: 40, precoNota: "rateio de ~R$ 400/h entre 10 pessoas", idade: "Livre", duracao: 90,
      horario: { abre: "08:00", fecha: "23:59", fechado: [] },
      comoChegar: "Região de Pinheiros — Metrô Faria Lima ou Pinheiros (Linha 4-Amarela).",
      descricao: "Campos society com grama sintética para alugar por hora. Ideal para grupos.",
      ilustrativo: true
    },
    {
      id: "nubanktour", nome: "Tour no Nubank Parque (Palmeiras)", categoria: "esporte", bairro: "Água Branca",
      lat: -23.5275, lng: -46.6783, preco: 70, precoNota: "estimado", idade: "Livre", duracao: 75,
      horario: { abre: "10:00", fecha: "17:00", fechado: [] },
      comoChegar: "Metrô Palmeiras-Barra Funda (Linha 3), 15 min a pé.",
      descricao: "Visita guiada pelo antigo Allianz Parque: vestiários, gramado e sala de troféus.",
      confirmar: "Não há tour em dias de jogo ou show."
    },
    {
      id: "morumbistour", nome: "Tour no MorumBIS (São Paulo FC)", categoria: "esporte", bairro: "Morumbi",
      lat: -23.6000, lng: -46.7203, preco: 60, precoNota: "estimado", idade: "Livre", duracao: 90,
      horario: { abre: "10:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Metrô São Paulo-Morumbi (Linha 4-Amarela) + 20 min a pé ou ônibus.",
      descricao: "Visita ao estádio do São Paulo, com memorial e vestiários.",
      confirmar: "Não há tour em dias de jogo."
    },
    {
      id: "arenatour", nome: "Tour na Neo Química Arena (Corinthians)", categoria: "esporte", bairro: "Itaquera",
      lat: -23.5453, lng: -46.4743, preco: 70, precoNota: "estimado", idade: "Livre", duracao: 90,
      horario: { abre: "10:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Metrô Corinthians-Itaquera (Linha 3-Vermelha), 10 min a pé.",
      descricao: "Tour pela arena da abertura da Copa de 2014.",
      confirmar: "Não há tour em dias de jogo."
    },
    {
      id: "jogo-spcor", nome: "São Paulo x Corinthians — Brasileirão", categoria: "esporte", bairro: "Morumbi",
      lat: -23.6000, lng: -46.7203, preco: 120, precoNota: "setor popular; estimado", idade: "Livre", duracao: 180,
      horario: { abre: "19:00", fecha: "23:59", fechado: [] }, inicio: "21:30",
      datas: ["2026-11-04", "2026-11-05"],
      comoChegar: "MorumBIS — Metrô São Paulo-Morumbi (Linha 4-Amarela) + 20 min a pé. Chegue cedo.",
      descricao: "Clássico Majestoso pela 34ª rodada.",
      confirmar: "CBF ainda pode mudar o dia (4 ou 5/11) e o horário."
    },
    {
      id: "jogo-spflu", nome: "São Paulo x Fluminense — Brasileirão", categoria: "esporte", bairro: "Morumbi",
      lat: -23.6000, lng: -46.7203, preco: 100, precoNota: "setor popular; estimado", idade: "Livre", duracao: 180,
      horario: { abre: "19:00", fecha: "23:59", fechado: [] }, inicio: "21:30",
      datas: ["2026-11-18", "2026-11-19"],
      comoChegar: "MorumBIS — Metrô São Paulo-Morumbi (Linha 4-Amarela) + 20 min a pé.",
      descricao: "Jogo pela 35ª rodada do Brasileirão.",
      confirmar: "CBF ainda pode mudar o dia (18 ou 19/11) e o horário."
    },
    {
      id: "jogo-corbot", nome: "Corinthians x Botafogo — Brasileirão", categoria: "esporte", bairro: "Itaquera",
      lat: -23.5453, lng: -46.4743, preco: 100, precoNota: "setor popular; estimado", idade: "Livre", duracao: 180,
      horario: { abre: "19:00", fecha: "23:59", fechado: [] }, inicio: "21:30",
      datas: ["2026-11-18", "2026-11-19"],
      comoChegar: "Neo Química Arena — Metrô Corinthians-Itaquera (Linha 3-Vermelha), 10 min a pé.",
      descricao: "Jogo pela 35ª rodada do Brasileirão.",
      confirmar: "CBF ainda pode mudar o dia (18 ou 19/11) e o horário."
    },

    // ---------- Mais na capital ----------
    {
      id: "copan", comida: true, nome: "Edifício Copan", categoria: "ponto", bairro: "República",
      lat: -23.5465, lng: -46.6445, preco: 0, idade: "Livre", duracao: 45,
      horario: { abre: "09:00", fecha: "22:00", fechado: [] },
      comoChegar: "Metrô República (Linhas 3-Vermelha e 4-Amarela), 5 min a pé.",
      descricao: "Prédio sinuoso de Oscar Niemeyer, com galeria de cafés e bares no térreo."
    },
    {
      id: "sesc24", comida: true, nome: "Sesc 24 de Maio", categoria: "museu", bairro: "República",
      lat: -23.5442, lng: -46.6400, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "09:00", fecha: "21:00", fechado: [1] },
      comoChegar: "Metrô República (Linhas 3 e 4) ou Anhangabaú (Linha 3), 5 min a pé.",
      descricao: "Projeto de Paulo Mendes da Rocha com exposições, comedoria e terraço com vista do centro."
    },
    {
      id: "casarosas", nome: "Casa das Rosas", categoria: "museu", bairro: "Bela Vista",
      lat: -23.5710, lng: -46.6455, preco: 0, idade: "Livre", duracao: 45,
      horario: { abre: "10:00", fecha: "18:00", fechado: [1] },
      comoChegar: "Metrô Brigadeiro (Linha 2-Verde), 2 min a pé.",
      descricao: "Casarão de 1935 na Paulista, hoje espaço de literatura, com jardim de rosas e café."
    },
    {
      id: "aguabranca", nome: "Parque da Água Branca", categoria: "parque", bairro: "Água Branca",
      lat: -23.5260, lng: -46.6680, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "06:00", fecha: "20:00", fechado: [] },
      comoChegar: "Metrô Palmeiras-Barra Funda (Linha 3), 10 min a pé.",
      descricao: "Parque com galinhas e pavões soltos, feira orgânica e cara de interior.",
      tags: ["crianças"]
    },

    // ---------- Região metropolitana (Grande SP) ----------
    {
      id: "paranapiacaba", nome: "Vila de Paranapiacaba", categoria: "ponto", bairro: "Paranapiacaba",
      municipio: "Santo André", lat: -23.7790, lng: -46.3020, preco: 0, idade: "Livre", duracao: 300,
      horario: { abre: "09:00", fecha: "17:00", fechado: [] },
      comoChegar: "Trem Expresso Turístico da CPTM (aos domingos, saindo da Luz) ou CPTM Rio Grande da Serra (Linha 10) + ônibus.",
      descricao: "Vila ferroviária inglesa do séc. XIX no alto da Serra do Mar, famosa pela neblina e pelo relógio estilo Big Ben.",
      destaque: true
    },
    {
      id: "trilhas-parana", nome: "Trilhas do Parque Nascentes de Paranapiacaba", categoria: "trilha", bairro: "Paranapiacaba",
      municipio: "Santo André", lat: -23.7760, lng: -46.2990, preco: 40, precoNota: "monitor credenciado; estimado", idade: "10+", duracao: 240,
      horario: { abre: "08:30", fecha: "16:00", fechado: [] },
      comoChegar: "Saída da própria Vila de Paranapiacaba, com monitor.",
      descricao: "Trilhas na Mata Atlântica com cachoeiras e poços.",
      nivel: "moderada", confirmar: "As trilhas só podem ser feitas com monitor — agende antes."
    },
    {
      id: "caminhosmar", nome: "Caminhos do Mar (Estrada Velha de Santos)", categoria: "trilha", bairro: "Riacho Grande",
      municipio: "São Bernardo do Campo", lat: -23.8000, lng: -46.4900, preco: 60, precoNota: "estimado", idade: "Livre", duracao: 300,
      horario: { abre: "08:00", fecha: "17:00", fechado: [1, 2] },
      comoChegar: "Carro ou app pela Rod. Anchieta (~1h do centro). Não há transporte público direto.",
      descricao: "Descida a pé pela estrada histórica da Serra do Mar, com monumentos de 1922 e mirantes.",
      nivel: "moderada", confirmar: "Confirme dias de funcionamento e valores no site do parque."
    },
    {
      id: "frango-polenta", nome: "Rota do Frango com Polenta", categoria: "gastronomia", bairro: "Estrada dos Alvarengas",
      municipio: "São Bernardo do Campo", lat: -23.7290, lng: -46.5720, preco: 80, precoNota: "gasto médio por pessoa", idade: "Livre", duracao: 120,
      horario: { abre: "11:00", fecha: "22:00", fechado: [] },
      comoChegar: "Metrô Jabaquara (Linha 1) + ônibus intermunicipal, ou app (~40 min).",
      descricao: "Restaurantes tradicionais de frango frito com polenta, herança dos imigrantes italianos."
    },
    {
      id: "embu", nome: "Embu das Artes — centro histórico e feira", categoria: "ponto", bairro: "Centro",
      municipio: "Embu das Artes", lat: -23.6490, lng: -46.8520, preco: 0, idade: "Livre", duracao: 240,
      horario: { abre: "09:00", fecha: "18:00", fechado: [] },
      comoChegar: "Ônibus intermunicipal (EMTU) a partir da região de Pinheiros/Butantã, ou app (~40 min).",
      descricao: "Feira de artesanato e móveis rústicos aos fins de semana, ateliês e a igreja jesuíta do séc. XVII.",
      destaque: true
    },
    {
      id: "cemucam", nome: "Parque Cemucam", categoria: "parque", bairro: "Granja Viana",
      municipio: "Cotia", lat: -23.6290, lng: -46.8930, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "07:00", fecha: "17:00", fechado: [] },
      comoChegar: "App ou carro pela Rod. Raposo Tavares (~45 min do centro).",
      descricao: "Grande área verde com lagos, trilhas leves e espaço para piquenique.",
      tags: ["crianças"]
    },
    {
      id: "parnaiba", nome: "Centro Histórico de Santana de Parnaíba", categoria: "ponto", bairro: "Centro",
      municipio: "Santana de Parnaíba", lat: -23.4440, lng: -46.9180, preco: 0, idade: "Livre", duracao: 150,
      horario: { abre: "09:00", fecha: "18:00", fechado: [] },
      comoChegar: "CPTM Barueri (Linha 8-Diamante) + ônibus, ou app (~50 min).",
      descricao: "Um dos conjuntos coloniais mais preservados do estado, com casarões dos séculos XVII a XIX."
    },
    {
      id: "pirapora", nome: "Santuário de Pirapora do Bom Jesus", categoria: "ponto", bairro: "Centro",
      municipio: "Pirapora do Bom Jesus", lat: -23.3970, lng: -47.0000, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "07:00", fecha: "18:00", fechado: [] },
      comoChegar: "Carro ou ônibus intermunicipal (~1h do centro).",
      descricao: "Santuário centenário, destino tradicional de romarias, às margens do rio Tietê."
    },
    {
      id: "juquery", nome: "Parque Estadual do Juquery", categoria: "trilha", bairro: "Franco da Rocha",
      municipio: "Franco da Rocha", lat: -23.3360, lng: -46.7120, preco: 0, idade: "Livre", duracao: 180,
      horario: { abre: "08:00", fecha: "17:00", fechado: [] },
      comoChegar: "CPTM Franco da Rocha (Linha 7-Rubi) + app (~10 min).",
      descricao: "Último cerrado da região metropolitana, com trilha até o Pico do Juquery e pôr do sol famoso.",
      nivel: "leve"
    },
    {
      id: "olhodagua", nome: "Pico do Olho d'Água (voo livre)", categoria: "trilha", bairro: "Serra da Cantareira",
      municipio: "Mairiporã", lat: -23.3300, lng: -46.5800, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "08:00", fecha: "18:00", fechado: [] },
      comoChegar: "Carro ou app pela Rod. Fernão Dias (~50 min do centro).",
      descricao: "Mirante com rampa de voo livre e vista da represa de Mairiporã. Voos duplos são pagos à parte."
    },
    {
      id: "bosquemaia", nome: "Parque Bosque Maia", categoria: "parque", bairro: "Centro",
      municipio: "Guarulhos", lat: -23.4610, lng: -46.5310, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "06:00", fecha: "22:00", fechado: [] },
      comoChegar: "Ônibus intermunicipal a partir do Metrô Armênia ou Tucuruvi, ou app (~35 min).",
      descricao: "Parque arborizado no centro de Guarulhos, bom para uma parada perto do aeroporto.",
      tags: ["crianças"]
    },
    {
      id: "picourubu", nome: "Pico do Urubu", categoria: "trilha", bairro: "Serra do Itapety",
      municipio: "Mogi das Cruzes", lat: -23.4905, lng: -46.2010, preco: 0, idade: "Livre", duracao: 150,
      horario: { abre: "07:00", fecha: "18:00", fechado: [] },
      comoChegar: "CPTM Estudantes (Linha 11-Coral) + app (~20 min).",
      descricao: "Mirante a 1.100 m com rampa de voo livre e vista do Alto Tietê.",
      nivel: "leve"
    },
    {
      id: "casaraocha", nome: "Casarão do Chá", categoria: "ponto", bairro: "Cocuera",
      municipio: "Mogi das Cruzes", lat: -23.5822, lng: -46.2253, preco: 0, idade: "Livre", duracao: 60,
      horario: { abre: "09:00", fecha: "17:00", fechado: [1] },
      comoChegar: "CPTM Mogi das Cruzes (Linha 11-Coral) + app (~20 min).",
      descricao: "Antiga fábrica de chá construída por imigrantes japoneses em 1942, patrimônio nacional."
    },
    {
      id: "guararema", nome: "Guararema e Pedra Montada", categoria: "ponto", bairro: "Centro",
      municipio: "Guararema", lat: -23.4120, lng: -46.0350, preco: 0, idade: "Livre", duracao: 300,
      horario: { abre: "09:00", fecha: "18:00", fechado: [] },
      comoChegar: "Carro pela Rod. Ayrton Senna/Dutra (~1h20) ou CPTM Estudantes (Linha 11) + ônibus.",
      descricao: "Cidadezinha às margens do Paraíba, com estação ferroviária antiga, ilha com tirolesa e a curiosa Pedra Montada."
    },
    {
      id: "nascentetiete", nome: "Nascente do Rio Tietê", categoria: "trilha", bairro: "Zona rural",
      municipio: "Salesópolis", lat: -23.5670, lng: -45.7460, preco: 0, idade: "Livre", duracao: 120,
      horario: { abre: "08:00", fecha: "17:00", fechado: [1] },
      comoChegar: "Carro (~2h do centro via Mogi das Cruzes). Não há transporte público direto.",
      descricao: "Parque onde nasce o rio que corta São Paulo, com trilha curta e mata preservada.",
      nivel: "leve"
    },
    {
      id: "rafting", nome: "Rafting em Juquitiba", categoria: "esporte", bairro: "Rio Juquiá",
      municipio: "Juquitiba", lat: -23.9300, lng: -47.0700, preco: 150, precoNota: "por pessoa; estimado", idade: "12+", duracao: 240,
      horario: { abre: "08:00", fecha: "16:00", fechado: [] },
      comoChegar: "Carro pela Rod. Régis Bittencourt (~1h20). Algumas operadoras oferecem transporte.",
      descricao: "Descida de bote pelas corredeiras do rio Juquiá, com instrutores e equipamento.",
      confirmar: "Agende com a operadora; idade mínima e nível das corredeiras variam."
    },

    // ---------- Bares, casas noturnas e festas ----------
    // Horário com "fecha" menor que "abre" vira a madrugada (ex.: 23:00–06:00).
    // Programação de casas noturnas muda muito: tudo aqui leva "confirmar".
    {
      id: "dedge", nome: "D-Edge", categoria: "noite", bairro: "Barra Funda",
      lat: -23.5255, lng: -46.6650, preco: 80, precoNota: "entrada; varia por festa", idade: "18+", duracao: 300,
      horario: { abre: "23:00", fecha: "06:00", fechado: [1, 2, 3] },
      comoChegar: "Metrô Palmeiras-Barra Funda (Linha 3), 5 min a pé. Na volta, metrô reabre às 4h40.",
      descricao: "Clube de música eletrônica referência no Brasil. Moving às quintas, Freak Chic às sextas.",
      confirmar: "Funciona normalmente de quinta a domingo — confira a festa e o line-up de cada data.",
      destaque: true
    },
    {
      id: "fabrique", nome: "Fabrique Club", categoria: "noite", bairro: "Barra Funda",
      lat: -23.5265, lng: -46.6620, preco: 70, precoNota: "entrada; varia por festa", idade: "18+", duracao: 300,
      horario: { abre: "23:00", fecha: "06:00", fechado: [0, 1, 2, 3, 4] },
      comoChegar: "Metrô Palmeiras-Barra Funda (Linha 3), 10 min a pé.",
      descricao: "Galpão com festas de eletrônico, funk e pop, frequentado por coletivos independentes.",
      confirmar: "Programação varia; confira a festa do dia."
    },
    {
      id: "madame", nome: "Madame Club", categoria: "noite", bairro: "Bixiga",
      lat: -23.5620, lng: -46.6440, preco: 50, precoNota: "entrada", idade: "18+", duracao: 240,
      horario: { abre: "23:00", fecha: "06:00", fechado: [0, 1, 2, 3, 4] },
      comoChegar: "Metrô Brigadeiro (Linha 2-Verde), 15 min a pé; na volta prefira app.",
      descricao: "Herdeira do lendário Madame Satã: noites de pós-punk, gótico, new wave e anos 80.",
      confirmar: "Confirme a programação nas redes da casa."
    },
    {
      id: "funhouse", nome: "Funhouse", categoria: "noite", bairro: "Consolação",
      lat: -23.5545, lng: -46.6560, preco: 40, precoNota: "entrada", idade: "18+", duracao: 240,
      horario: { abre: "23:00", fecha: "05:00", fechado: [0, 1, 2] },
      comoChegar: "Metrô Consolação (Linha 2) ou Higienópolis-Mackenzie (Linha 4), 10 min a pé.",
      descricao: "Casa de rock e indie no Baixo Augusta, com pista e bar apertadinhos.",
      confirmar: "Confirme a programação nas redes da casa."
    },
    {
      id: "lions", nome: "Lions Nightclub", categoria: "noite", bairro: "Centro",
      lat: -23.5500, lng: -46.6390, preco: 60, precoNota: "entrada; varia por festa", idade: "18+", duracao: 300,
      horario: { abre: "23:30", fecha: "06:00", fechado: [0, 1, 2, 3] },
      comoChegar: "Metrô Sé ou Anhangabaú, 10 min a pé. Na volta, use app.",
      descricao: "Clube no centro histórico com festas de house, disco e hip-hop.",
      confirmar: "Confirme a programação nas redes da casa."
    },
    {
      id: "mamba", nome: "Mamba Negra (festa itinerante)", categoria: "noite", bairro: "Local secreto",
      lat: -23.5300, lng: -46.6450, preco: 90, precoNota: "lote antecipado; estimado", idade: "18+", duracao: 480,
      horario: { abre: "23:00", fecha: "08:00", fechado: [0, 1, 2, 3, 4, 5] },
      comoChegar: "O local é revelado pela organização perto da data, normalmente galpões no centro ou Zona Oeste.",
      descricao: "Um dos coletivos de techno mais conhecidos do underground paulistano. Festas longas em espaços inusitados.",
      confirmar: "Sem data divulgada para o período — acompanhe as redes do coletivo. O pino no mapa é aproximado."
    },
    {
      id: "baixoaugusta", nome: "Baixo Augusta", categoria: "noite", bairro: "Consolação",
      lat: -23.5530, lng: -46.6530, preco: 60, precoNota: "gasto médio por pessoa", idade: "18+", duracao: 180,
      horario: { abre: "18:00", fecha: "04:00", fechado: [] },
      comoChegar: "Metrô Consolação (Linha 2) ou Paulista (Linha 4), descendo a Rua Augusta a pé.",
      descricao: "Trecho da Rua Augusta lotado de bares, inferninhos e público alternativo até de madrugada."
    },
    {
      id: "roosevelt", nome: "Praça Roosevelt à noite", categoria: "noite", bairro: "Consolação",
      lat: -23.5490, lng: -46.6460, preco: 0, idade: "Livre", duracao: 90,
      horario: { abre: "18:00", fecha: "02:00", fechado: [] },
      comoChegar: "Metrô República (Linhas 3 e 4) ou Higienópolis-Mackenzie (Linha 4), 10 min a pé.",
      descricao: "Skatistas, teatros independentes (Satyros e outros) e bares com mesas na calçada."
    },
    {
      id: "barbrahma", comida: true, nome: "Bar Brahma", categoria: "noite", bairro: "Centro",
      lat: -23.5430, lng: -46.6418, preco: 100, precoNota: "consumo + couvert", idade: "Livre", duracao: 150,
      horario: { abre: "11:00", fecha: "01:00", fechado: [] },
      comoChegar: "Metrô República (Linhas 3 e 4), 3 min a pé — na esquina da Ipiranga com a São João.",
      descricao: "Bar histórico de 1948 com samba e MPB ao vivo na esquina mais famosa de SP."
    },
    {
      id: "barosarcos", nome: "Bar dos Arcos", categoria: "noite", bairro: "Centro",
      lat: -23.5452, lng: -46.6385, preco: 120, precoNota: "gasto médio por pessoa", idade: "18+", duracao: 120,
      horario: { abre: "18:00", fecha: "01:00", fechado: [0, 1] },
      comoChegar: "Metrô Anhangabaú (Linha 3-Vermelha), 2 min a pé — no subsolo do Theatro Municipal.",
      descricao: "Bar de coquetéis em arcos de tijolo restaurados embaixo do Theatro Municipal."
    },
    {
      id: "donaonca", comida: true, nome: "Bar da Dona Onça", categoria: "noite", bairro: "República",
      lat: -23.5466, lng: -46.6443, preco: 100, precoNota: "gasto médio por pessoa", idade: "Livre", duracao: 120,
      horario: { abre: "12:00", fecha: "00:30", fechado: [] },
      comoChegar: "Metrô República (Linhas 3 e 4), 5 min a pé — no térreo do Copan.",
      descricao: "Comida de boteco caprichada e drinques no térreo do Edifício Copan."
    },
    {
      id: "tokyo", nome: "Tokyo (karaokê e rooftop)", categoria: "noite", bairro: "República",
      lat: -23.5450, lng: -46.6460, preco: 80, precoNota: "gasto médio por pessoa", idade: "18+", duracao: 180,
      horario: { abre: "19:00", fecha: "03:00", fechado: [0, 1, 2] },
      comoChegar: "Metrô República (Linhas 3 e 4), 5 min a pé.",
      descricao: "Prédio com karaokê em salas privadas, pista e terraço com vista para o centro.",
      confirmar: "Confirme horários e reservas de karaokê."
    },
    {
      id: "subastor", nome: "SubAstor", categoria: "noite", bairro: "Vila Madalena",
      lat: -23.5560, lng: -46.6890, preco: 120, precoNota: "gasto médio por pessoa", idade: "18+", duracao: 120,
      horario: { abre: "19:00", fecha: "02:00", fechado: [0, 1] },
      comoChegar: "Metrô Vila Madalena (Linha 2) ou Fradique Coutinho (Linha 4), 10 min a pé.",
      descricao: "Bar de coquetelaria autoral escondido no subsolo, entre os mais premiados do país."
    },
    {
      id: "tantan", comida: true, nome: "Tan Tan", categoria: "noite", bairro: "Pinheiros",
      lat: -23.5655, lng: -46.6880, preco: 120, precoNota: "gasto médio por pessoa", idade: "18+", duracao: 120,
      horario: { abre: "19:00", fecha: "01:00", fechado: [0, 1] },
      comoChegar: "Metrô Fradique Coutinho (Linha 4-Amarela), 10 min a pé.",
      descricao: "Bar de drinques com cozinha asiática e clima de izakaya."
    },
    {
      id: "riviera", nome: "Riviera Bar", categoria: "noite", bairro: "Consolação",
      lat: -23.5555, lng: -46.6612, preco: 90, precoNota: "consumo + couvert", idade: "18+", duracao: 120,
      horario: { abre: "18:00", fecha: "02:00", fechado: [0, 1] },
      comoChegar: "Metrô Consolação (Linha 2-Verde), 1 min a pé — esquina da Paulista com a Consolação.",
      descricao: "Bar histórico dos anos 1940, reaberto com jazz ao vivo no mezanino."
    },
    {
      id: "bluenote", comida: true, nome: "Blue Note São Paulo", categoria: "noite", bairro: "Bela Vista",
      lat: -23.5578, lng: -46.6613, preco: 150, precoNota: "ingresso do show; varia", idade: "16+", duracao: 150,
      horario: { abre: "19:00", fecha: "01:00", fechado: [1] }, inicio: "21:00",
      comoChegar: "Metrô Consolação (Linha 2-Verde), 3 min a pé — no Conjunto Nacional.",
      descricao: "Filial do clube de jazz de Nova York, com shows de jazz, soul e MPB.",
      confirmar: "Consulte o show do dia e compre antes — lota."
    },
    {
      id: "bourbon", comida: true, nome: "Bourbon Street Music Club", categoria: "noite", bairro: "Moema",
      lat: -23.6045, lng: -46.6670, preco: 150, precoNota: "ingresso do show; varia", idade: "16+", duracao: 150,
      horario: { abre: "20:00", fecha: "01:30", fechado: [0, 1] }, inicio: "22:00",
      comoChegar: "Metrô Eucaliptos ou Moema (Linha 5-Lilás), 10 min a pé.",
      descricao: "Casa tradicional de blues e jazz, com artistas nacionais e internacionais.",
      confirmar: "Consulte o show do dia."
    },
    {
      id: "francisca", nome: "Casa de Francisca", categoria: "noite", bairro: "Centro",
      lat: -23.5490, lng: -46.6365, preco: 60, precoNota: "ingresso; varia", idade: "16+", duracao: 150,
      horario: { abre: "19:00", fecha: "01:00", fechado: [1] }, inicio: "21:00",
      comoChegar: "Metrô Sé (Linhas 1 e 3), 5 min a pé.",
      descricao: "Casa de shows intimista num palacete do centro, com MPB, choro e música experimental.",
      confirmar: "Consulte a programação."
    },
    {
      id: "aljaniah", comida: true, nome: "Al Janiah", categoria: "noite", bairro: "Bixiga",
      lat: -23.5590, lng: -46.6440, preco: 60, precoNota: "gasto médio + couvert", idade: "18+", duracao: 180,
      horario: { abre: "18:00", fecha: "02:00", fechado: [1] },
      comoChegar: "Metrô São Joaquim (Linha 1-Azul) ou Brigadeiro (Linha 2), 10 min a pé.",
      descricao: "Bar e restaurante palestino com shows, debates e festas de música árabe, latina e brasileira."
    },
    {
      id: "borogodo", comida: true, nome: "Ó do Borogodó", categoria: "noite", bairro: "Pinheiros",
      lat: -23.5600, lng: -46.6820, preco: 50, precoNota: "couvert + consumo", idade: "18+", duracao: 180,
      horario: { abre: "21:00", fecha: "03:00", fechado: [0] },
      comoChegar: "Metrô Fradique Coutinho (Linha 4) ou Vila Madalena (Linha 2), 15 min a pé.",
      descricao: "Reduto pequeno e lotado de samba de raiz e choro ao vivo."
    },
    {
      id: "sambavela", nome: "Samba da Vela", categoria: "noite", bairro: "Santo Amaro",
      lat: -23.6520, lng: -46.7090, preco: 0, precoNota: "colaborativo", idade: "Livre", duracao: 150,
      horario: { abre: "20:00", fecha: "23:00", fechado: [0, 2, 3, 4, 5, 6] }, inicio: "20:30",
      comoChegar: "Casa de Cultura de Santo Amaro — Metrô Largo Treze (Linha 5-Lilás), 10 min a pé.",
      descricao: "Roda de samba às segundas: a vela acesa marca o tempo da roda e só se canta samba autoral.",
      confirmar: "Confirme se a roda está acontecendo na semana."
    },
    {
      id: "estadao", comida: true, nome: "Bar do Estadão (lanche 24h)", categoria: "noite", bairro: "Centro",
      lat: -23.5480, lng: -46.6420, preco: 40, precoNota: "lanche", idade: "Livre", duracao: 45,
      horario: { abre: "00:00", fecha: "23:59", fechado: [] },
      comoChegar: "Metrô Anhangabaú (Linha 3-Vermelha), 5 min a pé — Viaduto 9 de Julho.",
      descricao: "Clássico pós-balada: sanduíche de pernil aberto 24 horas."
    },
    {
      id: "cinejoia", nome: "Cine Joia", categoria: "noite", bairro: "Liberdade",
      lat: -23.5530, lng: -46.6365, preco: 100, precoNota: "ingresso; varia", idade: "16+", duracao: 240,
      horario: { abre: "21:00", fecha: "04:00", fechado: [0, 1, 2, 3] },
      comoChegar: "Metrô Liberdade (Linha 1-Azul), 2 min a pé.",
      descricao: "Antigo cinema transformado em casa de shows indie e festas.",
      confirmar: "Programação variável — confira o evento do dia."
    },
    // Festivais noturnos com data (pesquisados em out/2026)
    {
      id: "musicon", nome: "Music On Festival", categoria: "noite", bairro: "Centro",
      lat: -23.5455, lng: -46.6375, preco: 300, precoNota: "estimado", idade: "18+", duracao: 480,
      horario: { abre: "16:00", fecha: "02:00", fechado: [] }, inicio: "16:00",
      datas: ["2026-11-07"],
      comoChegar: "Vale do Anhangabaú — Metrô Anhangabaú (Linha 3) ou São Bento (Linha 1).",
      descricao: "Festival de techno e house do selo Music On ao ar livre no centro.",
      confirmar: "Confirme horários e valores no site oficial de venda."
    },
    {
      id: "batekoo", nome: "BATEKOO Festival", categoria: "noite", bairro: "Canindé",
      lat: -23.5255, lng: -46.6230, preco: 150, precoNota: "estimado; venda pelo Shotgun", idade: "18+", duracao: 600,
      horario: { abre: "18:00", fecha: "06:00", fechado: [] }, inicio: "18:00",
      datas: ["2026-11-14"],
      comoChegar: "Estádio do Canindé — Metrô Armênia (Linha 1-Azul), 15 min a pé.",
      descricao: "12 horas de música negra contemporânea em dois palcos: funk, R&B, rap, aparelhagem e baile.",
      confirmar: "Algumas fontes ainda indicam o local como a confirmar."
    },
    {
      id: "bbr", nome: "Best of Blues and Rock", categoria: "festival", bairro: "Ibirapuera",
      lat: -23.5860, lng: -46.6570, preco: 300, precoNota: "estimado", idade: "14+", duracao: 420,
      horario: { abre: "14:00", fecha: "23:30", fechado: [] }, inicio: "14:00",
      datas: ["2026-11-20", "2026-11-21", "2026-11-22"],
      comoChegar: "Parque Ibirapuera — Metrô AACD-Servidor (Linha 5) + 15 min a pé.",
      descricao: "Festival de blues e rock no Ibirapuera, com Eddie Vedder (Pearl Jam) como headliner nas noites de 20 e 22/11.",
      confirmar: "Confirme line-up, classificação e valores no site oficial."
    }
  ],

  // Combos: lugares que combinam bem. "quando" é o melhor dia da semana (0 = domingo);
  // é só uma sugestão — o usuário pode montar o combo em qualquer dia.
  combos: [
    { ids: ["paulista", "masp", "mirante9"], quando: [2], titulo: "Terça na Paulista",
      texto: "Às terças o MASP é grátis. Caminhe pela Paulista e termine no Mirante 9 de Julho, logo atrás do museu." },
    { ids: ["paulista", "ims", "japan"], quando: [0], titulo: "Domingo de Paulista Aberta",
      texto: "Aos domingos a avenida fecha para carros. IMS e Japan House são gratuitos e ficam no caminho." },
    { ids: ["pinacoteca", "mlp"], quando: [6], titulo: "Sábado grátis na Luz",
      texto: "Os dois museus são gratuitos aos sábados e ficam a 200 m um do outro." },
    { ids: ["ibirapuera", "mam", "afro", "planetario"], quando: [0], titulo: "Domingo no Ibirapuera",
      texto: "MAM grátis aos domingos. Museu Afro e Planetário ficam dentro do parque." },
    { ids: ["mercadao", "25marco", "farol"], quando: [], titulo: "Centro: comer, comprar e ver do alto",
      texto: "Sanduíche de mortadela no Mercadão, compras na 25 de Março e a vista do Farol Santander." },
    { ids: ["se", "patio", "ccbb", "sampasky"], quando: [], titulo: "Marco zero de SP",
      texto: "Tudo a menos de 10 min a pé: a Catedral, o local de fundação da cidade, o CCBB e o mirante Sampa Sky." },
    { ids: ["liberdade", "se"], quando: [6, 0], titulo: "Feira da Liberdade + Sé",
      texto: "A feira de comida oriental acontece nos fins de semana; a Sé fica a 10 min a pé." },
    { ids: ["batman", "vilamadalena"], quando: [4, 5, 6], titulo: "Grafite e boteco",
      texto: "Visite o beco no fim da tarde e emende nos bares da Vila Madalena." },
    { ids: ["theatro", "italia"], quando: [], titulo: "Centro ao entardecer",
      texto: "Visita guiada no Theatro Municipal e pôr do sol no Terraço Itália." },
    { ids: ["ipiranga", "aquario"], quando: [], titulo: "Ipiranga em família",
      texto: "Museu do Ipiranga de manhã e Aquário à tarde: ficam a ~15 min de app." },
    { ids: ["zoo", "botanico"], quando: [], titulo: "Zoo + Jardim Botânico",
      texto: "São vizinhos — dá para fazer os dois no mesmo dia." },
    { ids: ["horto", "cantareira"], quando: [0, 6], titulo: "Dia de mata na Zona Norte",
      texto: "Trilha da Pedra Grande pela manhã e descanso nos lagos do Horto à tarde." },
    { ids: ["futebol", "nubanktour"], quando: [], titulo: "Dia do futebol",
      texto: "Museu do Futebol no Pacaembu e tour no estádio do Palmeiras, a ~15 min de app." },
    { ids: ["paranapiacaba", "trilhas-parana"], quando: [0], titulo: "Domingo em Paranapiacaba",
      texto: "Vá de Expresso Turístico (domingos) e faça uma trilha guiada saindo da própria vila." },
    { ids: ["embu", "cemucam"], quando: [6, 0], titulo: "Fim de semana em Embu e Cotia",
      texto: "A feira de Embu é aos sábados e domingos; o Parque Cemucam fica a ~15 min de carro." },
    { ids: ["parnaiba", "pirapora"], quando: [], titulo: "Cidades históricas do Oeste",
      texto: "Casarões coloniais em Santana de Parnaíba e o santuário de Pirapora, a ~30 min um do outro." },
    { ids: ["picourubu", "casaraocha"], quando: [], titulo: "Mogi das Cruzes",
      texto: "Vista do Pico do Urubu pela manhã e a história da imigração japonesa no Casarão do Chá." },
    { ids: ["caminhosmar", "frango-polenta"], quando: [], titulo: "Serra e polenta em São Bernardo",
      texto: "Desça a Estrada Velha de Santos e termine o dia com frango com polenta na volta." },
    { ids: ["theatro", "barosarcos"], quando: [2, 3, 4, 5, 6], titulo: "Theatro e drinque no subsolo",
      texto: "Depois da visita ou do espetáculo, desça para o Bar dos Arcos, embaixo do próprio Theatro." },
    { ids: ["copan", "donaonca", "tokyo"], quando: [4, 5, 6], titulo: "Noite no centro",
      texto: "Fim de tarde no Copan, jantar na Dona Onça e karaokê no Tokyo, tudo a menos de 5 min a pé." },
    { ids: ["roosevelt", "baixoaugusta", "funhouse"], quando: [5, 6], titulo: "Rolê no Baixo Augusta",
      texto: "Comece na Praça Roosevelt, suba a Augusta pelos bares e termine na pista da Funhouse." },
    { ids: ["riviera", "bluenote"], quando: [], titulo: "Jazz na Paulista",
      texto: "Drinque no Riviera e show no Blue Note, um de cada lado da esquina da Consolação." },
    { ids: ["barbrahma", "estadao"], quando: [], titulo: "Samba e sanduíche de madrugada",
      texto: "Samba ao vivo no Bar Brahma e o pernil do Estadão para fechar a noite." },
    { ids: ["dedge", "fabrique"], quando: [5, 6], titulo: "Barra Funda eletrônica",
      texto: "Duas casas a 5 min a pé uma da outra — dá para checar as duas pistas na mesma noite." }
  ],

  // "Leia mais": dicas extras exibidas nos detalhes.
  dicas: {
    paulista: ["Paulista Aberta: aos domingos e feriados a avenida fecha para carros, com artistas de rua.", "Combine com MASP, IMS, Japan House e Casa das Rosas."],
    masp: ["Entrada gratuita às terças — chegue cedo, a fila cresce à tarde.", "O vão livre recebe feira de antiguidades aos domingos."],
    ibirapuera: ["Alugue bicicleta na entrada para percorrer o parque.", "A Oca e o Pavilhão da Bienal costumam ter exposições."],
    mercadao: ["Vá com fome: os sanduíches são enormes — dá para dividir.", "Evite sábados no fim da manhã, o horário mais cheio."],
    jaragua: ["Leve água e tênis com boa aderência: a trilha do Pai Zé é íngreme.", "Vá cedo em dias claros para ver a cidade inteira."],
    cantareira: ["Bilheteria fecha antes do parque — chegue até o meio-dia.", "Leve lanche: não há comércio no caminho."],
    gp: ["Use a CPTM: o trânsito no entorno de Interlagos é muito intenso.", "Leve protetor solar, capa de chuva e documento com foto."],
    "jogo-spcor": ["Clássico com torcida única: vá com a camisa do mandante ou neutra.", "Ingressos costumam esgotar para sócios — compre cedo."],
    liberdade: ["A feira da Praça da Liberdade funciona aos sábados e domingos.", "Experimente o taiyaki e os lámen da região."],
    batman: ["Melhor luz para fotos no fim da tarde.", "Os grafites mudam com frequência."],
    paranapiacaba: ["Leve agasalho: a neblina e o frio são comuns mesmo no verão.", "Em julho acontece o Festival de Inverno de Paranapiacaba.", "Reserve o Expresso Turístico com antecedência — esgota rápido."],
    embu: ["A feira é maior aos domingos; chegue antes das 11h.", "Prove os restaurantes de comida caseira no centrinho."],
    juquery: ["O pôr do sol do Pico do Juquery é o ponto alto — chegue umas 2h antes.", "Pouca sombra: leve chapéu e água."],
    guararema: ["Dá para ir de trem turístico em datas especiais — consulte a CPTM.", "A Ilha Grande tem tirolesa e passeios de caiaque."],
    dedge: ["Leve documento com foto: a entrada é só para maiores de 18.", "Nome na lista costuma dar desconto — veja nas redes da festa.", "O metrô fecha à meia-noite e reabre às 4h40; combine a volta antes."],
    mamba: ["Os ingressos saem em lotes e esgotam rápido.", "Festas costumam ir até de manhã: leve água e combine ponto de encontro."],
    baixoaugusta: ["Movimento forte de quinta a sábado, a partir das 22h.", "Fique atento aos pertences na saída das casas."],
    batekoo: ["Venda exclusiva pelo Shotgun.", "São 12 horas de festa: programe a volta para depois das 4h40, quando o metrô reabre."],
    rafting: ["Leve roupa de banho, toalha e tênis que possa molhar.", "Época de chuva (dez–mar) tem corredeiras mais fortes."]
  }
};
