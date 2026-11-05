/*
 * Motor do roteiro automático: recebe os dados da viagem e devolve uma proposta, sem tocar em nada (a tela e o
 * "Aplicar" ficam em js/montar-roteiro.js). Para os mesmos dados, o resultado é sempre o mesmo.
 *
 * Ordem das decisões:
 *   1. o que já está no roteiro fica como está;
 *   2. "não pode faltar": nunca sai em silêncio. Se não couber, vira um conflito com alternativas para o grupo escolher;
 *   3. o tempo que sobra é preenchido por pontos (evento do dia, grátis, perto dos outros, combos, gosto de cada pessoa).
 * Toda inserção é conferida por regras.simular, que usa o cálculo real de horários do site: um lugar opcional só entra
 * se não criar nenhum alerta novo no dia.
 */
import { GOSTO } from "./core/constantes.js";

// Tempo de passeio por dia (refeições e trajetos à parte).
export const RITMOS = {
  tranquilo: { nome: "Tranquilo", min: 6 * 60, texto: "até umas 6h de passeio por dia" },
  equilibrado: { nome: "Equilibrado", min: 8 * 60, texto: "até umas 8h de passeio por dia" },
  puxado: { nome: "Puxado", min: 10 * 60, texto: "até umas 10h de passeio por dia" }
};
const MAX_OBRIGATORIO_MIN = 12 * 60; // "não pode faltar" pode passar do ritmo, até este limite
const DUR_LONGA = 8 * 60;             // opcional deste tamanho só entra em dia vazio
const ENCURTAR = 0.6, ENCURTAR_MIN = 60;
const NOTA_MIN_PONTOS = -4;           // abaixo disto, um dia que já tem 2 lugares prefere ficar com tempo livre
const TOP_TENTATIVAS = 10;            // quantos candidatos de cada dia passam pela conferência de horários
const UMA_POR_DIA = new Set(["noite", "compras"]);

const perguntaDe = (categoria) => GOSTO.find((g) => g.cats.includes(categoria));
// Ruído fixo por lugar e variação: "Gerar outra opção" muda só as escolhas opcionais.
function ruido(id, variacao) {
  if (!variacao) return 0;
  let h = 2166136261;
  for (const c of id + ":" + variacao) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000 * 3;
}
const nomesE = (l) => (l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]);

export function gerarRoteiro(e) {
  const { dias, atuais = {}, candidatos = [], gostos = { fonte: "padrao", pessoas: [] }, indispensaveis = [],
    ritmo = "equilibrado", decisoes = {}, variacao = 0, combos = [], regras } = e;
  const limite = (RITMOS[ritmo] || RITMOS.equilibrado).min;
  const pessoas = gostos.pessoas || [];
  const satisfacao = Object.fromEntries(pessoas.map((p) => [p.id, 0]));
  const notasDe = (lugar) => {
    const g = perguntaDe(lugar.categoria);
    if (!g) return [];
    return pessoas.filter((p) => p.notas[g.id] != null).map((p) => ({ pessoa: p, nota: p.notas[g.id] }));
  };
  // Quem foi menos atendido até aqui pesa mais na próxima escolha.
  function pontosGosto(lugar) {
    const ns = notasDe(lugar);
    if (!ns.length) return 0;
    const topo = Math.max(...pessoas.map((p) => satisfacao[p.id]));
    let soma = 0, pesos = 0;
    ns.forEach(({ pessoa, nota }) => { const w = 1 + 0.35 * (topo - satisfacao[pessoa.id]); soma += w * (nota - 2.5); pesos += w; });
    return (soma / pesos) * 2;
  }
  const atender = (lugar, marcadoPor = []) => {
    notasDe(lugar).forEach(({ pessoa, nota }) => { satisfacao[pessoa.id] += nota - 2.5; });
    marcadoPor.forEach((p) => { if (p.id in satisfacao) satisfacao[p.id] += 2.5; });
  };

  // Estado da proposta: uma cópia dos dias, nunca os originais.
  const proposta = {};
  const usados = new Set();
  dias.forEach((iso) => {
    proposta[iso] = (atuais[iso] || []).map((it) => ({ ...it, motivos: ["Já estava no roteiro"], novo: false }));
    proposta[iso].forEach((it) => usados.add(it.id));
  });
  const lugarDoItem = (it) => regras.lugar(it.id);
  dias.forEach((iso) => proposta[iso].forEach((it) => { const l = lugarDoItem(it); if (l) atender(l); }));

  // Melhor posição para um item no dia: sem alertas novos e terminando o dia o mais cedo possível.
  function melhorInsercao(iso, item, { folga = 0, fimMax = Infinity, passeioMax = Infinity } = {}) {
    const itens = proposta[iso];
    const base = regras.simular(iso, itens).alertas;
    let melhor = null;
    for (let pos = 0; pos <= itens.length; pos++) {
      const teste = [...itens.slice(0, pos), item, ...itens.slice(pos)];
      const s = regras.simular(iso, teste);
      if (s.alertas > base + folga || s.fim > fimMax || s.passeio > passeioMax) continue;
      if (!melhor || s.fim < melhor.s.fim) melhor = { pos, s, teste };
    }
    return melhor;
  }
  const passeioDo = (iso) => regras.simular(iso, proposta[iso]).passeio;
  const kmMaisPerto = (iso, lugar) => {
    const refs = proposta[iso].map(lugarDoItem).filter(Boolean);
    const origem = refs.length ? null : regras.origem && regras.origem(iso);
    if (origem) refs.push(origem);
    if (!refs.length) return { km: null, de: null };
    let km = Infinity, de = null;
    refs.forEach((r) => { const d = regras.km(r, lugar); if (d < km) { km = d; de = r; } });
    return { km, de };
  };
  const diasPossiveis = (l) => dias.filter((iso) => regras.acontece(l, iso) && !regras.fechado(l, iso));

  // ---------- "Não pode faltar" ----------
  const conflitos = [], foraPorDecisao = [];
  const lista = [];
  for (const x of indispensaveis) {
    const decisao = decisoes[x.lugarId];
    const quem = nomesE((x.por || []).map((p) => p.nome));
    const conflito = (tipo, texto, opcoes) => conflitos.push({ tipo, lugarId: x.lugarId, nome: x.nome, quem, texto, opcoes });
    const OP_FORA = { rotulo: "Deixar de fora", decisoes: { [x.lugarId]: "fora" } };
    const OP_MANTER = (r) => ({ rotulo: r, decisoes: { [x.lugarId]: "manter" } });
    if (decisao === "fora") { foraPorDecisao.push({ lugarId: x.lugarId, nome: x.nome, quem }); continue; }
    if (usados.has(x.lugarId)) continue; // já está no roteiro
    const l = x.lugar;
    if (!l) { conflito("saiu", "Este lugar não está mais no site, então não dá para colocar no roteiro.", [OP_FORA]); continue; }
    if (l.ilustrativo && decisao !== "manter") { conflito("ilustrativo", "É um exemplo ilustrativo, ainda sem dados confirmados.", [OP_MANTER("Colocar mesmo assim"), OP_FORA]); continue; }
    if (regras.semLocal(l) && decisao !== "manter") { conflito("sem_local", "O local ainda não está confirmado, então o trajeto até ele é só uma estimativa.", [OP_MANTER("Colocar mesmo assim"), OP_FORA]); continue; }
    let folga = 0;
    if (!regras.idadeOk(l)) {
      if (decisao !== "manter") { conflito("idade", `A classificação é ${l.idade}, acima da idade da pessoa mais nova do grupo.`, [OP_MANTER("Manter, com alerta no roteiro"), OP_FORA]); continue; }
      folga = 1;
    }
    const possiveis = diasPossiveis(l);
    if (!possiveis.length) {
      conflito("fora_datas", "Não acontece ou está fechado em todos os dias escolhidos.", [OP_FORA, { rotulo: "Mudar as datas da viagem", acao: "datas" }]);
      continue;
    }
    lista.push({ x, l, possiveis, folga, decisao, quem });
  }
  // Primeiro o que tem menos opção de dia e hora marcada; depois o mais marcado.
  lista.sort((a, b) => a.possiveis.length - b.possiveis.length || (b.l.inicio ? 1 : 0) - (a.l.inicio ? 1 : 0)
    || (b.x.contagem || 0) - (a.x.contagem || 0) || a.l.id.localeCompare(b.l.id));
  const colocados = [];
  for (const { x, l, possiveis, folga, decisao, quem } of lista) {
    const dur = decisao === "encurtar" ? Math.max(ENCURTAR_MIN, Math.round(l.duracao * ENCURTAR)) : l.duracao;
    const item = { uid: "novo-" + l.id, id: l.id, dur, novo: true, obrigatorio: true,
      motivos: [`⭐ Não pode faltar para ${quem}`, ...(decisao === "encurtar" ? [`Visita encurtada para caber (${dur} min)`] : [])] };
    let escolha = null;
    for (const iso of possiveis) {
      const r = melhorInsercao(iso, item, { folga, passeioMax: Math.max(MAX_OBRIGATORIO_MIN, dur) });
      if (!r) continue;
      const { km } = kmMaisPerto(iso, l);
      // Prefere o dia que não estoura o ritmo, depois o mais perto e o mais leve.
      const custo = (r.s.passeio > limite ? 1000 : 0) + (km == null ? 0 : km) + r.s.passeio / 60;
      if (!escolha || custo < escolha.custo) escolha = { iso, r, custo };
    }
    if (escolha) {
      proposta[escolha.iso] = escolha.r.teste;
      usados.add(l.id);
      atender(l, x.por || []);
      colocados.push({ l, iso: escolha.iso, dur });
      continue;
    }
    // Não coube: quem disputa o tempo nos dias possíveis vira opção de escolha.
    const rivais = colocados.filter((c) => possiveis.includes(c.iso));
    const sobrepoe = (a) => a.l.inicio && l.inicio && regras.minutos(a.l.inicio) < regras.minutos(l.inicio) + l.duracao && regras.minutos(l.inicio) < regras.minutos(a.l.inicio) + a.dur;
    const choque = l.inicio ? rivais.filter((c) => sobrepoe(c)) : [];
    const opcoes = [];
    (choque.length ? choque : rivais).slice(0, 3).forEach((c) => opcoes.push({ rotulo: `Ficar com este e tirar ${c.l.nome}`, decisoes: { [c.l.id]: "fora" } }));
    if (!choque.length && decisao !== "encurtar" && l.duracao * ENCURTAR >= ENCURTAR_MIN) opcoes.push({ rotulo: "Encurtar a visita", decisoes: { [l.id]: "encurtar" } });
    opcoes.push({ rotulo: choque.length ? `Ficar com ${choque[0].l.nome} e deixar este de fora` : "Deixar de fora", decisoes: { [l.id]: "fora" } });
    if (!choque.length) opcoes.push({ rotulo: "Mudar as datas da viagem", acao: "datas" });
    conflitos.push({ tipo: choque.length ? "mesma_hora" : "sem_tempo", lugarId: l.id, nome: l.nome, quem, opcoes,
      texto: choque.length ? `Acontece na mesma hora que ${nomesE(choque.map((c) => c.l.nome))}.` : "Não cabe nos dias da viagem junto com o resto do roteiro." });
  }

  // Com conflito pendente, a proposta não está pronta: o grupo decide antes.
  if (conflitos.length) return { pronta: false, conflitos, foraPorDecisao, dias: proposta, atendimento: [], limite };

  // ---------- Tempo que sobra ----------
  const contaCat = {};
  const contar = (l, iso) => {
    contaCat[l.categoria] = contaCat[l.categoria] || { total: 0 };
    contaCat[l.categoria].total++;
    contaCat[l.categoria][iso] = (contaCat[l.categoria][iso] || 0) + 1;
  };
  dias.forEach((iso) => proposta[iso].forEach((it) => { const l = lugarDoItem(it); if (l) contar(l, iso); }));
  // Comida é das refeições ("Onde comer perto"): lugar gastronômico só entra como passeio se o grupo der nota 3 ou mais.
  const gostaDeComer = (l) => { const ns = notasDe(l); return ns.length > 0 && ns.reduce((t, n) => t + n.nota, 0) / ns.length >= 3; };
  const opcionais = candidatos.filter((l) => !l.restaurante && !l.secundario && !l.ilustrativo && !regras.semLocal(l) && regras.idadeOk(l)
    && !(l.id in decisoes && decisoes[l.id] === "fora")
    && !(pessoas.length && notasDe(l).length && notasDe(l).every((n) => n.nota === 0)) // nota 0 de todos: nada de sugerir sozinho
    && (l.categoria !== "gastronomia" || gostaDeComer(l)));
  const comboCom = (l, iso) => {
    const noDia = new Set(proposta[iso].map((i) => i.id));
    // Combo com dia da semana ("Terça na Paulista") só vale nesse dia.
    const dia = regras.diaSemana(iso);
    return combos.find((c) => c.ids.includes(l.id) && c.ids.some((id) => noDia.has(id)) && (!(c.quando || []).length || c.quando.includes(dia))) || null;
  };
  function pontos(l, iso) {
    const nivel = regras.nivel(l, iso);
    let p = nivel === 3 ? 6 : nivel === 2 ? 4 : nivel === 1 ? 1 : 0;
    p += pontosGosto(l);
    if (l.destaque) p += 1.5;
    const { km } = kmMaisPerto(iso, l);
    if (km != null) p -= Math.min(km * 0.5, 10);
    const cat = contaCat[l.categoria] || {};
    p -= (cat.total || 0) * 1.5 + (cat[iso] || 0) * 2;
    if (comboCom(l, iso)) p += 2;
    if (combos.some((c) => c.ids.includes(l.id) && (c.quando || []).includes(regras.diaSemana(iso)))) p += 1;
    p -= Math.min(regras.preco(l, iso) / 40, 12); // ingresso caro só entra sozinho se o gosto compensar
    if (regras.dataIncerta(l)) p -= 3;
    return p + ruido(l.id, variacao);
  }
  function motivos(l, iso) {
    const out = [];
    const nivel = regras.nivel(l, iso);
    if (nivel === 3) out.push("Evento neste dia");
    else if (nivel === 2) out.push("Grátis neste dia");
    const g = perguntaDe(l.categoria), fas = notasDe(l).filter((n) => n.nota >= 4);
    if (fas.length && g) out.push(gostos.fonte === "pessoal" ? `Você deu ${fas[0].nota} a ${g.nome}` : `${nomesE(fas.map((n) => n.pessoa.nome))} ${fas.length > 1 ? "gostam" : "gosta"} de ${g.nome.toLowerCase()}`);
    const c = comboCom(l, iso);
    if (c) out.push("Combo: " + c.titulo);
    const { km, de } = kmMaisPerto(iso, l);
    if (km != null && km <= 1.5 && de && !c) out.push("Perto de " + de.nome);
    if (nivel === 1 && !out.length) out.push("Grátis");
    if (!out.length) out.push(l.destaque ? "Destaque do site" : "Boa opção para este dia");
    return out;
  }
  const cheio = new Set();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const iso of dias) {
      if (cheio.has(iso)) continue;
      const passeio = passeioDo(iso);
      const vazio = !proposta[iso].length;
      const tentativas = opcionais
        .filter((l) => !usados.has(l.id) && regras.acontece(l, iso) && !regras.fechado(l, iso) && passeio + l.duracao <= limite
          && (l.duracao < DUR_LONGA || vazio) && !(UMA_POR_DIA.has(l.categoria) && (contaCat[l.categoria] || {})[iso]))
        .map((l) => ({ l, p: pontos(l, iso) }))
        .filter((x) => proposta[iso].length < 2 || x.p >= NOTA_MIN_PONTOS)
        .sort((a, b) => b.p - a.p || a.l.id.localeCompare(b.l.id))
        .slice(0, TOP_TENTATIVAS);
      let achou = false;
      for (const { l } of tentativas) {
        const item = { uid: "novo-" + l.id, id: l.id, dur: l.duracao, novo: true, motivos: motivos(l, iso) };
        const r = melhorInsercao(iso, item, { fimMax: regras.noturno(l) ? Infinity : 23 * 60 + 30, passeioMax: limite });
        if (!r) continue;
        proposta[iso] = r.teste;
        usados.add(l.id);
        atender(l);
        contar(l, iso);
        achou = mudou = true;
        break;
      }
      if (!achou) cheio.add(iso);
    }
  }

  // Quantos lugares de cada pessoa entraram: nota 4 ou mais, ou marcado por ela como "não pode faltar".
  const marcados = Object.fromEntries(indispensaveis.map((x) => [x.lugarId, (x.por || []).map((p) => p.id)]));
  const todos = dias.flatMap((iso) => proposta[iso]);
  const atendimento = pessoas.map((p) => ({ id: p.id, nome: p.nome, lugares: todos.filter((it) => {
    const l = lugarDoItem(it), g = l && perguntaDe(l.categoria);
    return (marcados[it.id] || []).includes(p.id) || (g && p.notas[g.id] >= 4);
  }).length }));
  return { pronta: true, conflitos: [], foraPorDecisao, dias: proposta, atendimento, limite };
}
