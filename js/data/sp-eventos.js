/*
 * Agenda de eventos de São Paulo (shows, exposições temporárias, concertos, festas, jogos).
 * Fica separada de sp.js para poder ser atualizada sem mexer nos lugares fixos.
 *
 * Para atualizar: adicione/edite itens em EVENTOS, troque ATUALIZADO_EM e cite a fonte.
 * Eventos cujas datas já passaram somem sozinhos do site.
 *
 * Campos extras em relação a sp.js:
 *  local    chave de LOCAIS (preenche bairro, coordenadas e "como chegar")
 *  datas    lista de dias (AAAA-MM-DD) — evento único ou com poucas datas
 *  periodo  { de, ate } — evento temporário (exposição, temporada); "ate" pode ser null
 *  fonte    link de onde a data foi verificada
 */
(function () {
  const ATUALIZADO_EM = "2026-10-28";

  const LOCAIS = {
    unimed: { bairro: "Barra Funda", lat: -23.5238, lng: -46.6650,
      comoChegar: "Espaço Unimed (Rua Tagipuru, 795) — Metrô Palmeiras-Barra Funda (Linha 3) + 20 min a pé ou app." },
    vibra: { bairro: "Santo Amaro", lat: -23.6510, lng: -46.7215,
      comoChegar: "Vibra São Paulo (Av. das Nações Unidas, 17955) — CPTM Socorro (Linha 9-Esmeralda) + 10 min a pé, ou app." },
    suhai: { bairro: "Endereço a confirmar", lat: -23.6337, lng: -46.7115,
      comoChegar: "Suhai Music Hall — confirme o endereço no ingresso; pino no mapa aproximado." },
    tokio: { bairro: "Chácara Santo Antônio", lat: -23.6337, lng: -46.7115,
      comoChegar: "Tokio Marine Hall (Rua Bragança Paulista, 1281) — CPTM Morumbi (Linha 9) + app, ou app direto." },
    salasp: { bairro: "Campos Elíseos", lat: -23.5345, lng: -46.6400,
      comoChegar: "Sala São Paulo — CPTM Júlio Prestes ou Metrô Luz (Linhas 1 e 4), 5 min a pé." },
    b32: { bairro: "Itaim Bibi", lat: -23.5870, lng: -46.6810,
      comoChegar: "Teatro B32 (Av. Faria Lima, 3732) — CPTM Cidade Jardim (Linha 9) + 10 min a pé, ou app." },
    villalobos: { bairro: "Alto de Pinheiros", lat: -23.5460, lng: -46.7230,
      comoChegar: "Parque Villa-Lobos — CPTM Villa-Lobos–Jaguaré (Linha 9), 10 min a pé." },
    komplexo: { bairro: "Local a confirmar", lat: -23.5550, lng: -46.6000,
      comoChegar: "Komplexo Tempo — confirme o endereço no ingresso; pino no mapa aproximado." },
    arenapinheiros: { bairro: "Pinheiros", lat: -23.5600, lng: -46.7020,
      comoChegar: "Centro de Eventos Arena Pinheiros — região do Metrô Pinheiros (Linha 4); confirme o endereço no ingresso." },
    caninde: { bairro: "Canindé", lat: -23.5255, lng: -46.6230,
      comoChegar: "Estádio do Canindé — Metrô Armênia (Linha 1-Azul), 15 min a pé." },
    morumbis: { bairro: "Morumbi", lat: -23.6000, lng: -46.7203,
      comoChegar: "MorumBIS — Metrô São Paulo-Morumbi (Linha 4-Amarela) + 20 min a pé. Chegue cedo." },
    ibirapuera: { bairro: "Ibirapuera", lat: -23.5860, lng: -46.6570,
      comoChegar: "Parque Ibirapuera — Metrô AACD-Servidor (Linha 5) + 15 min a pé." },
    masp: { bairro: "Bela Vista", lat: -23.5614, lng: -46.6559,
      comoChegar: "MASP — Metrô Trianon-MASP (Linha 2-Verde)." },
    ims: { bairro: "Consolação", lat: -23.5560, lng: -46.6627,
      comoChegar: "IMS Paulista — Metrô Consolação (Linha 2-Verde), 2 min a pé." },
    tomie: { bairro: "Pinheiros", lat: -23.5625, lng: -46.6930,
      comoChegar: "Instituto Tomie Ohtake — Metrô Faria Lima (Linha 4-Amarela), 5 min a pé." },
    casatomie: { bairro: "Campo Belo", lat: -23.6230, lng: -46.6690,
      comoChegar: "Casa-ateliê Tomie Ohtake (Campo Belo) — app ou Metrô Campo Belo (Linha 5) + 15 min a pé." },
    padrebento: { bairro: "Centro", municipio: "Guarulhos", lat: -23.4680, lng: -46.5330,
      comoChegar: "Teatro Padre Bento (Guarulhos) — ônibus intermunicipal a partir do Metrô Armênia/Tucuruvi, ou app." },
    embuguacu: { bairro: "Centro", municipio: "Embu-Guaçu", lat: -23.8320, lng: -46.8120,
      comoChegar: "Centro de Embu-Guaçu — carro ou app (~1h do centro de SP)." }
  };

  const CONFIRMAR = "Confirme data, horário e valores no site oficial de venda.";

  // Monta o item no mesmo formato de sp.js.
  function ev(o) {
    const l = LOCAIS[o.local] || {};
    const inicio = o.inicio || "21:00";
    return Object.assign({
      bairro: l.bairro, municipio: l.municipio, lat: l.lat, lng: l.lng, comoChegar: l.comoChegar,
      idade: "16+", duracao: 150, preco: 0,
      horario: { abre: inicio, fecha: "23:59", fechado: [] }, inicio,
      confirmar: CONFIRMAR
    }, o);
  }

  const EVENTOS = [
    // ---------- Shows: Espaço Unimed (nov/2026) ----------
    ev({ id: "ev-opeth", nome: "Opeth", categoria: "show", local: "unimed", preco: 350, precoNota: "estimado", datas: ["2026-11-06"],
      descricao: "Metal progressivo sueco.", fonte: "https://visitesaopaulo.com/evento/opeth-2026/" }),
    ev({ id: "ev-jorja", nome: "Jorja Smith", categoria: "show", local: "unimed", preco: 350, precoNota: "estimado", datas: ["2026-10-30", "2026-11-06"],
      descricao: "Cantora britânica de R&B e soul.", confirmar: "As fontes divergem entre 30/10 e 06/11 — confirme a data.",
      fonte: "https://www.jambase.com/venue/espaco-unimed" }),
    ev({ id: "ev-daniel", nome: "Daniel", categoria: "show", local: "unimed", preco: 200, precoNota: "estimado", idade: "Livre", datas: ["2026-11-07", "2026-11-08"],
      descricao: "Show do cantor sertanejo.", confirmar: "As listagens divergem entre 7 e 8/11 — confirme a data.",
      fonte: "https://www.ticket360.com.br/local/1047/espaco-unimed" }),
    ev({ id: "ev-hayley", nome: "Hayley Williams", categoria: "show", local: "unimed", preco: 400, precoNota: "estimado", datas: ["2026-11-12", "2026-11-13"],
      descricao: "Vocalista do Paramore em turnê solo. Duas noites.", fonte: "https://www.blogdoarcanjo.com/2026/10/27/new-order-ronnie-wood-e-caetano-veloso-agitam-novembro-do-espaco-unimed-em-sp/" }),
    ev({ id: "ev-mioto", nome: "Gustavo Mioto", categoria: "show", local: "unimed", preco: 180, precoNota: "estimado", idade: "Livre", datas: ["2026-11-14"],
      descricao: "Sertanejo pop.", fonte: "https://www.blogdoarcanjo.com/2026/10/27/new-order-ronnie-wood-e-caetano-veloso-agitam-novembro-do-espaco-unimed-em-sp/" }),
    ev({ id: "ev-ca7riel", nome: "Ca7riel & Paco Amoroso", categoria: "show", local: "unimed", preco: 250, precoNota: "estimado", datas: ["2026-11-18"],
      descricao: "Dupla argentina que mistura trap, funk e rock.", fonte: "https://www.blogdoarcanjo.com/2026/10/27/new-order-ronnie-wood-e-caetano-veloso-agitam-novembro-do-espaco-unimed-em-sp/" }),
    ev({ id: "ev-caetano", nome: "Caetano Veloso", categoria: "show", local: "unimed", preco: 300, precoNota: "estimado", idade: "Livre", datas: ["2026-11-21"],
      descricao: "Um dos maiores nomes da MPB.", fonte: "https://www.blogdoarcanjo.com/2026/10/27/new-order-ronnie-wood-e-caetano-veloso-agitam-novembro-do-espaco-unimed-em-sp/" }),
    ev({ id: "ev-neworder", nome: "New Order", categoria: "show", local: "unimed", preco: 450, precoNota: "estimado", datas: ["2026-11-23", "2026-11-25"],
      descricao: "Lendas do synth-pop britânico; data extra aberta após esgotar.", fonte: "https://www.baressp.com.br/casas-de-show/espaco-unimed" }),
    ev({ id: "ev-babymetal", nome: "BABYMETAL", categoria: "show", local: "unimed", preco: 400, precoNota: "estimado", datas: ["2026-11-28"],
      descricao: "Kawaii metal japonês.", fonte: "https://www.blogdoarcanjo.com/2026/10/27/new-order-ronnie-wood-e-caetano-veloso-agitam-novembro-do-espaco-unimed-em-sp/" }),
    ev({ id: "ev-reggae", nome: "Reggae Live Station", categoria: "show", local: "unimed", preco: 150, precoNota: "estimado", datas: ["2026-11-29"], inicio: "18:00", duracao: 300,
      descricao: "Groundation, Edson Gomes e Leões de Israel.", fonte: "https://www.blogdoarcanjo.com/2026/10/27/new-order-ronnie-wood-e-caetano-veloso-agitam-novembro-do-espaco-unimed-em-sp/" }),

    // ---------- Shows: dezembro/2026 ----------
    ev({ id: "ev-caesar", nome: "Daniel Caesar", categoria: "show", local: "suhai", preco: 350, precoNota: "estimado", datas: ["2026-12-02"],
      descricao: "R&B canadense.", fonte: "https://www.wikimetal.com.br/en/concerts-brazil-2026-rock-heavy-metal/" }),
    ev({ id: "ev-fresno", nome: "Fresno — Sinfonia'26", categoria: "show", local: "vibra", preco: 200, precoNota: "estimado", datas: ["2026-12-05"],
      descricao: "Fresno em formato sinfônico.", fonte: "https://uhuu.com/v/vibrasp-107" }),
    ev({ id: "ev-paula", nome: "Paula Fernandes", categoria: "show", local: "vibra", preco: 180, precoNota: "estimado", idade: "Livre", datas: ["2026-12-05", "2026-12-07"],
      descricao: "Sertanejo romântico.", confirmar: "As listagens divergem entre 5 e 7/12 — confirme a data.", fonte: "https://uhuu.com/v/vibra-107" }),
    ev({ id: "ev-take6", nome: "Take 6", categoria: "show", local: "vibra", preco: 250, precoNota: "estimado", idade: "Livre", datas: ["2026-12-10"],
      descricao: "Grupo vocal americano de gospel e jazz a cappella.", fonte: "https://uhuu.com/v/vibrasp-107" }),
    ev({ id: "ev-raca", nome: "Raça Negra", categoria: "show", local: "vibra", preco: 150, precoNota: "estimado", idade: "Livre", datas: ["2026-12-11"],
      descricao: "Clássicos do pagode romântico.", fonte: "https://www.ticketle.com.br/sao-paulo" }),
    ev({ id: "ev-gato", nome: "Gato Galáctico — Especial de Natal", categoria: "show", local: "tokio", preco: 120, precoNota: "estimado", idade: "Livre", datas: ["2026-12-20"], inicio: "16:00", duracao: 90,
      descricao: "Show infantil do youtuber, edição de Natal.", tags: ["crianças"], fonte: "https://www.ticketmaster.com.br/page/tokio-marine-hall" }),

    // ---------- Música clássica ----------
    ev({ id: "ev-gerstein", nome: "Recital Kirill Gerstein (piano)", categoria: "teatro", local: "salasp", preco: 100, precoNota: "estimado", idade: "Livre", datas: ["2026-11-01"], inicio: "16:00", duracao: 120,
      descricao: "Recital de piano na Sala São Paulo.", fonte: "https://salasaopaulo.art.br/salasp/pt/programacao-ingressos" }),
    ev({ id: "ev-ojesp", nome: "OJESP — Réquiem Alemão de Brahms", categoria: "teatro", local: "salasp", preco: 50, precoNota: "estimado", idade: "Livre", datas: ["2026-11-08"], inicio: "16:00", duracao: 120,
      descricao: "Orquestra Jovem do Estado com solistas Lina Mendes e Lício Bruno.",
      fonte: "https://emesp.org.br/wp-content/uploads/sites/2/2026/07/PROGRAMA-TEMPORADA-OJESP-2026_PERIODO-ELEITORAL.pdf" }),
    ev({ id: "ev-osesp-b32", nome: "Osesp no Teatro B32", categoria: "teatro", local: "b32", preco: 75, precoNota: "R$ 50 a R$ 100", idade: "Livre", datas: ["2026-11-16"], inicio: "19:30", duracao: 120,
      descricao: "Série da Osesp fora da Sala São Paulo.", fonte: "https://abcdoabc.com.br/osesp-emporada-2026-teatro-b32/" }),

    // ---------- Festas e festivais eletrônicos ----------
    ev({ id: "ev-solomun", nome: "Solomun no Parque Villa-Lobos", categoria: "noite", local: "villalobos", preco: 350, precoNota: "estimado", idade: "18+", datas: ["2026-11-01"], inicio: "14:00", duracao: 480,
      descricao: "Set longo do DJ bósnio-alemão ao ar livre.", fonte: "https://eletrovibez.com/2026-agenda-de-eventos-de-musica-eletronica-em-sao-paulo/" }),
    ev({ id: "ev-unreal", nome: "UNREAL x The Grid", categoria: "noite", local: "komplexo", preco: 150, precoNota: "estimado", idade: "18+", datas: ["2026-11-21"], inicio: "22:00", duracao: 480,
      horario: { abre: "22:00", fecha: "08:00", fechado: [] },
      descricao: "Festa de techno.", fonte: "https://eletrovibez.com/2026-agenda-de-eventos-de-musica-eletronica-em-sao-paulo/" }),
    ev({ id: "ev-life", nome: "Life São Paulo — Michael Bibi", categoria: "noite", local: "arenapinheiros", preco: 300, precoNota: "estimado", idade: "18+", datas: ["2026-11-28"], inicio: "16:00", duracao: 480,
      horario: { abre: "16:00", fecha: "02:00", fechado: [] },
      descricao: "Festival de tech house com o DJ inglês Michael Bibi.", fonte: "https://www.songkick.com/festivals/countries/br" }),
    ev({ id: "ev-todayland", nome: "Todayland Nexus", categoria: "noite", local: "komplexo", preco: 200, precoNota: "estimado", idade: "18+", datas: ["2026-12-11"], inicio: "22:00", duracao: 480,
      horario: { abre: "22:00", fecha: "08:00", fechado: [] },
      descricao: "Festival de música eletrônica.", fonte: "https://eletrovibez.com/2026-agenda-de-eventos-de-musica-eletronica-em-sao-paulo/" }),
    ev({ id: "ev-psicodelico", nome: "Mundo Psicodélico", categoria: "noite", local: "caninde", preco: 150, precoNota: "estimado", idade: "18+", datas: ["2026-12-19"], inicio: "16:00", duracao: 600,
      horario: { abre: "16:00", fecha: "08:00", fechado: [] },
      descricao: "Festival de psytrance.", fonte: "https://eletrovibez.com/2026-agenda-de-eventos-de-musica-eletronica-em-sao-paulo/" }),

    // ---------- Futebol ----------
    ev({ id: "ev-spremo", nome: "São Paulo x Remo — Brasileirão", categoria: "esporte", local: "morumbis", preco: 100, precoNota: "setor popular; estimado", idade: "Livre", datas: ["2026-11-28", "2026-11-29"], inicio: "16:00", duracao: 180,
      descricao: "Jogo pela 37ª rodada.", confirmar: "CBF ainda pode mudar o dia (28 ou 29/11) e o horário.",
      fonte: "https://www.saopaulofc.net/cbf-divulga-tabela-do-brasileirao-de-2026/" }),

    // ---------- Exposições temporárias ----------
    ev({ id: "ex-masp-latino", nome: "Histórias latino-americanas — MASP", categoria: "exposicao", local: "masp", preco: 75, gratisDias: [2], idade: "Livre", duracao: 90,
      periodo: { de: "2026-09-04", ate: "2027-01-31" }, inicio: undefined, horario: { abre: "10:00", fecha: "18:00", fechado: [1] },
      descricao: "Grande coletiva sobre arte da América Latina. Ingresso do MASP dá acesso.", confirmar: "Confirme horários no site do museu.",
      fonte: "https://masp.org.br/exposicoes" }),
    ev({ id: "ex-masp-soto", nome: "Jesús Soto — MASP", categoria: "exposicao", local: "masp", preco: 75, gratisDias: [2], idade: "Livre", duracao: 60,
      periodo: { de: "2026-11-27", ate: "2027-04-04" }, inicio: undefined, horario: { abre: "10:00", fecha: "18:00", fechado: [1] },
      descricao: "Obras cinéticas do venezuelano Jesús Soto.", confirmar: "Confirme horários no site do museu.", fonte: "https://masp.org.br/exposicoes" }),
    ev({ id: "ex-masp-venezuela", nome: "Herreros & Manaure: mi nombre es Venezuela — MASP", categoria: "exposicao", local: "masp", preco: 75, gratisDias: [2], idade: "Livre", duracao: 60,
      periodo: { de: "2026-11-27", ate: "2027-04-04" }, inicio: undefined, horario: { abre: "10:00", fecha: "18:00", fechado: [1] },
      descricao: "Manuel Herreros e Mateo Manaure, nomes da abstração venezuelana.", confirmar: "Confirme horários no site do museu.", fonte: "https://masp.org.br/exposicoes" }),
    ev({ id: "ex-ims-marilia", nome: "Marília Mendonça — Sentimento Louco (IMS)", categoria: "exposicao", local: "ims", preco: 0, idade: "Livre", duracao: 60,
      periodo: { de: "2026-10-09", ate: "2026-11-29" }, inicio: undefined, horario: { abre: "10:00", fecha: "20:00", fechado: [1] },
      descricao: "Exposição sobre a trajetória da cantora.", confirmar: "Confirme horários no site do IMS.", fonte: "https://rolezero.com.br/sao-paulo/exposicoes" }),
    ev({ id: "ex-ims-belezas", nome: "Belezas brasileiras (IMS)", categoria: "exposicao", local: "ims", preco: 0, idade: "Livre", duracao: 45,
      periodo: { de: "2026-10-13", ate: "2026-11-22" }, inicio: undefined, horario: { abre: "10:00", fecha: "20:00", fechado: [1] },
      descricao: "Mostra de fotografia no IMS Paulista.", confirmar: "Confirme horários no site do IMS.", fonte: "https://rolezero.com.br/sao-paulo/exposicoes" }),
    ev({ id: "ex-zanine", nome: "Zanine Caldas — Criação de mundos", categoria: "exposicao", local: "casatomie", preco: 50, precoNota: "meia R$ 25", idade: "Livre", duracao: 60,
      periodo: { de: null, ate: "2026-11-07" }, inicio: undefined, horario: { abre: "10:00", fecha: "17:00", fechado: [1, 2, 3] },
      descricao: "Móveis e arquitetura de José Zanine Caldas na casa onde viveu Tomie Ohtake.", confirmar: "Funciona de quinta a domingo.",
      fonte: "https://elle.com.br/lifestyle/5-exposicoes-de-arte-imperdiveis-para-visitar-nas-proximas-semanas" }),
    ev({ id: "ex-tomie-montanha", nome: "Montanha e vale — Alice Shintani e Tomie Ohtake", categoria: "exposicao", local: "tomie", preco: 0, idade: "Livre", duracao: 60,
      periodo: { de: "2026-10-30", ate: null }, inicio: undefined, horario: { abre: "11:00", fecha: "20:00", fechado: [1] },
      descricao: "Diálogo entre as obras das duas artistas.", confirmar: "Data de encerramento não divulgada.",
      fonte: "https://elle.com.br/lifestyle/5-exposicoes-de-arte-imperdiveis-para-visitar-nas-proximas-semanas" }),

    // ---------- Grande SP ----------
    ev({ id: "ev-abba-gru", nome: "Tributo ABBA & Elvis — Teatro Padre Bento", categoria: "show", local: "padrebento", preco: 80, precoNota: "estimado", idade: "Livre", datas: ["2026-11-01"], inicio: "19:00", duracao: 120,
      descricao: "Espetáculo de tributo em Guarulhos.", fonte: "https://www.vibeindex.com.br/events/guarulhos-sp" }),
    ev({ id: "ev-natal-embuguacu", nome: "Natal Iluminado de Embu-Guaçu", categoria: "festival", local: "embuguacu", preco: 0, idade: "Livre", duracao: 120,
      periodo: { de: "2026-11-28", ate: "2027-01-03" }, inicio: undefined, horario: { abre: "18:00", fecha: "22:00", fechado: [] },
      descricao: "Decoração e iluminação de Natal no centro da cidade.", confirmar: "Informação de calendário antigo — confirme com a prefeitura.",
      fonte: "https://www.turismo.gov.br/agenda-eventos/views/calendario.php" })
  ];

  const sp = window.TF_CITIES.sp;
  sp.atualizadoEm = ATUALIZADO_EM;
  sp.lugares.push(...EVENTOS);
})();
