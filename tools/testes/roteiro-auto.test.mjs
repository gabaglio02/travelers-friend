// Testes do motor do roteiro automático (js/roteiro-auto.js). Uso: node tools/testes/roteiro-auto.test.mjs
const { gerarRoteiro, RITMOS } = await import(new URL("../../js/roteiro-auto.js", import.meta.url));
let ok = 0, falhou = 0;
const certo = (c, m, extra = "") => { c ? ok++ : falhou++; console.log((c ? "OK   " : "FALHA") + " " + m + (c ? "" : " " + extra)); };
const toM = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

const L = (id, categoria, extra = {}) => ({ id, nome: id.toUpperCase(), categoria, duracao: 120, preco: 0, lat: 0, lng: 0, horario: { abre: "09:00", fecha: "22:00", fechado: [] }, idade: "Livre", ...extra });
const CAT = [
  L("mus1", "museu"), L("mus2", "museu"), L("mus3", "museu"), L("mus4", "museu"),
  L("par1", "parque"), L("par2", "parque"), L("par3", "parque"),
  L("tri1", "trilha", { duracao: 240 }), L("tri2", "trilha", { duracao: 240 }), L("tri3", "trilha"),
  L("pon1", "ponto"), L("pon2", "ponto"), L("com1", "compras"), L("gas1", "gastronomia"),
  L("bar1", "noite", { horario: { abre: "18:00", fecha: "23:30", fechado: [] }, idade: "18 anos" }),
  L("bar2", "noite", { horario: { abre: "18:00", fecha: "23:30", fechado: [] } }),
  L("exemplo", "festival", { ilustrativo: true, destaque: true }),
  L("restau", "gastronomia", { restaurante: true }),
  L("semlocal", "ponto", { bairro: "a confirmar" }),
  L("seg", "museu", { horario: { abre: "09:00", fecha: "18:00", fechado: [1, 2, 3, 4, 5, 6, 0] } }),
  L("longo", "esporte", { duracao: 540 }),
  L("show1", "show", { inicio: "20:00", duracao: 150, datas: ["2026-11-14"] }),
  L("show2", "show", { inicio: "21:00", duracao: 150, datas: ["2026-11-14"] }),
  L("caro", "festival", { preco: 1200, datas: ["2026-11-13", "2026-11-14", "2026-11-15"] })
];
const porId = (id) => CAT.find((p) => p.id === id);
let chamadas = 0;
// Simulador: um lugar depois do outro, 30 min entre eles; alerta se começar depois de fechar, atrasar ou não acontecer.
function simular(iso, itens) {
  chamadas++;
  let t = 9 * 60, alertas = 0, passeio = 0;
  itens.forEach((it, i) => {
    const p = porId(it.id);
    if (i) t += 30;
    if (p.inicio) { if (t > toM(p.inicio) + 5) alertas++; else t = toM(p.inicio); }
    else if (t < toM(p.horario.abre)) t = toM(p.horario.abre);
    if (!p.inicio && t + it.dur > toM(p.horario.fecha)) alertas++;
    if (p.idade === "18 anos") alertas++;
    t += it.dur; passeio += it.dur;
  });
  return { alertas, passeio, fim: t };
}
const regras = (extra = {}) => ({
  lugar: porId, simular, km: () => 2, origem: () => null,
  acontece: (p, iso) => !p.datas || p.datas.includes(iso), fechado: (p) => (p.horario.fechado || []).length === 7,
  nivel: (p, iso) => (p.datas && p.datas.includes(iso) ? 3 : p.preco === 0 ? 1 : 0), preco: (p) => p.preco, dataIncerta: () => false,
  semLocal: (p) => /a confirmar/.test(p.bairro || ""), idadeOk: (p) => p.idade !== "18 anos", noturno: (p) => p.categoria === "noite",
  minutos: toM, diaSemana: () => 6, ...extra
});
const DIAS = ["2026-11-13", "2026-11-14", "2026-11-15"];
const gerar = (o = {}) => gerarRoteiro({ dias: DIAS, candidatos: CAT, regras: regras(), ...o });
const ids = (r, iso) => r.dias[iso].map((i) => i.id);
const tudo = (r) => Object.values(r.dias).flat().map((i) => i.id);
const P = (id, nome, notas) => ({ id, nome, notas });
const indisp = (id, ...nomes) => ({ lugarId: id, lugar: porId(id) || null, nome: (porId(id) || {}).nome || "Lugar", por: nomes.map((n) => ({ id: n, nome: n })), contagem: nomes.length });

// Sem gostos
let r = gerar();
certo(r.pronta && tudo(r).length > 3, "sem grupo e sem quiz: gera um roteiro");
certo(new Set(tudo(r)).size === tudo(r).length, "nenhum lugar repetido na viagem");
certo(!tudo(r).some((i) => ["exemplo", "restau", "semlocal", "bar1", "seg"].includes(i)), "nunca escolhe sozinho: exemplo, restaurante, sem local, acima da idade, sempre fechado");
certo(DIAS.every((d) => simular(d, r.dias[d]).alertas === 0), "opcionais não criam alertas");
certo(JSON.stringify(gerar().dias) === JSON.stringify(r.dias), "mesmos dados, mesmo resultado");
certo(!tudo(r).includes("longo"), "opcional de 8h+ não entra em dia já com outros lugares (ou passa do ritmo)");
certo(!tudo(gerar({ ritmo: "tranquilo" })).includes("caro"), "ingresso caro não entra no lugar de opções grátis");

// Ritmo
for (const [k, v] of Object.entries(RITMOS)) {
  const x = gerar({ ritmo: k });
  certo(DIAS.every((d) => simular(d, x.dias[d]).passeio <= v.min), `ritmo ${k}: não passa de ${v.min / 60}h de passeio por dia`);
}
const t = gerar({ ritmo: "tranquilo" }), pu = gerar({ ritmo: "puxado" });
certo(tudo(pu).length > tudo(t).length, "ritmo puxado coloca mais lugares que o tranquilo");

// Dia já preenchido
const atuais = { "2026-11-13": [{ uid: "a1", id: "mus1", dur: 90, at: "10:00", mode: "metro" }] };
r = gerar({ atuais });
const mant = r.dias["2026-11-13"].find((i) => i.uid === "a1");
certo(mant && mant.at === "10:00" && mant.mode === "metro" && mant.dur === 90 && !mant.novo, "item já no roteiro fica, com seus ajustes");
certo(tudo(r).filter((i) => i === "mus1").length === 1, "e não é sugerido de novo");
certo(atuais["2026-11-13"].length === 1 && !atuais["2026-11-13"][0].motivos, "a entrada não é alterada");

// Gostos
const museus = { fonte: "grupo", pessoas: [P("a", "Ana", { museus: 5, parques: 0, aventura: 0, pontos: 0, comer: 0, compras: 0, noite: 0, palco: 0 })] };
r = gerar({ gostos: museus, ritmo: "tranquilo" });
certo(tudo(r).filter((i) => i.startsWith("mus")).length >= 2 && !tudo(r).some((i) => i.startsWith("par")), "uma pessoa: favorece a nota alta; nota 0 não é sugerida sozinha");
const zero = { fonte: "grupo", pessoas: [P("a", "Ana", { museus: 0 }), P("b", "Bia", { museus: 0 })] };
r = gerar({ gostos: zero });
certo(!tudo(r).some((i) => i.startsWith("mus")), "nota 0 de todos: categoria fica de fora das sugestões");
const pulou = { fonte: "grupo", pessoas: [P("a", "Ana", { aventura: 5 })] };
r = gerar({ gostos: pulou });
certo(tudo(r).some((i) => i.startsWith("mus")), "pergunta pulada é neutra, diferente de nota 0");
// Opiniões divididas: as duas pessoas são atendidas
const div = { fonte: "grupo", pessoas: [P("a", "Ana", { museus: 5, aventura: 0, parques: 0 }), P("b", "Bia", { museus: 5, aventura: 0, parques: 0 }), P("c", "Caio", { museus: 0, aventura: 5, parques: 5 }), P("d", "Davi", { museus: 0, aventura: 5, parques: 5 })] };
r = gerar({ gostos: div, ritmo: "equilibrado" });
const nMus = tudo(r).filter((i) => i.startsWith("mus")).length, nFora = tudo(r).filter((i) => /^(tri|par)/.test(i)).length;
certo(nMus >= 1 && nFora >= 1, "opiniões divididas: os dois lados entram", `museus ${nMus}, fora ${nFora}`);
certo(r.atendimento.every((a) => a.lugares > 0), "todas as pessoas têm lugares de que gostam", JSON.stringify(r.atendimento));
const motivos = Object.values(r.dias).flat().flatMap((i) => i.motivos).join(" | ");
certo(/Ana e Bia gostam de museus/.test(motivos) || /Caio e Davi gostam/.test(motivos), "o motivo cita quem gosta");
const pess = gerar({ gostos: { fonte: "pessoal", pessoas: [P("eu", "Você", { museus: 5 })] } });
certo(/Você deu 5/.test(Object.values(pess.dias).flat().flatMap((i) => i.motivos).join("|")), "com notas pessoais, o motivo fala 'você'");
const motivosGerados = (x) => Object.values(x.dias).flat().flatMap((i) => i.motivos).join("|");
certo(/Você e Ana gostam de/.test(motivosGerados(gerar({ gostos: { fonte: "grupo", pessoas: [P("voce", "Você", { museus: 5 }), P("a", "Ana", { museus: 5 })] } }))), "quem organiza e o grupo com o mesmo gosto: o motivo cita os dois");
const doisGostos = motivosGerados(gerar({ gostos: { fonte: "grupo", pessoas: [P("voce", "Você", { museus: 5, parques: 0 }), P("a", "Ana", { museus: 0, parques: 5 })] } }));
certo(/Você gosta de/.test(doisGostos) && /Ana gosta de/.test(doisGostos), "gostos diferentes: o roteiro atende quem organiza e o grupo");

// Gastronomia e distância
certo(!tudo(gerar({ ritmo: "puxado" })).includes("gas1"), "sem notas: lugar gastronômico não vira passeio");
certo(!tudo(gerar({ ritmo: "puxado", gostos: { fonte: "grupo", pessoas: [P("a", "Ana", { comer: 2 })] } })).includes("gas1"), "nota baixa de gastronomia: também não");
certo(tudo(gerar({ ritmo: "puxado", gostos: { fonte: "grupo", pessoas: [P("a", "Ana", { comer: 5 })] } })).includes("gas1"), "nota alta de gastronomia: entra");
const longe = (a, b) => { const z = (p) => (/^(mus|par)/.test(p.id) ? 0 : 40); return Math.abs(z(a) - z(b)); };
r = gerarRoteiro({ dias: ["2026-11-13"], candidatos: CAT, regras: regras({ km: longe }), atuais: { "2026-11-13": [{ uid: "a", id: "mus1", dur: 120 }] } });
certo(tudo(r).every((i) => /^(mus|par)/.test(i)), "prefere lugares perto; longe demais não entra só para encher o dia", tudo(r).join());

// Combos: só no dia da semana deles (regras.diaSemana = 6, sábado)
const comboTer = [{ ids: ["mus1", "mus2"], quando: [2], titulo: "Terça X" }], comboSab = [{ ids: ["mus1", "mus2"], quando: [6], titulo: "Sábado X" }], comboLivre = [{ ids: ["mus1", "mus2"], quando: [], titulo: "Livre X" }];
const motivosDe = (c) => Object.values(gerar({ combos: c, gostos: museus, atuais: { "2026-11-13": [{ uid: "a", id: "mus1", dur: 120 }] } }).dias).flat().flatMap((i) => i.motivos).join("|");
certo(!/Terça X/.test(motivosDe(comboTer)), "combo de terça não é citado em outro dia");
certo(/Sábado X/.test(motivosDe(comboSab)) && /Livre X/.test(motivosDe(comboLivre)), "combo do dia certo e combo sem dia são citados");

// Não pode faltar
r = gerar({ gostos: museus, indispensaveis: [indisp("tri1", "Ana")] });
certo(tudo(r).includes("tri1") && r.pronta, "marcado por uma pessoa entra, mesmo com nota 0 da categoria");
certo(Object.values(r.dias).flat().find((i) => i.id === "tri1").motivos[0] === "⭐ Não pode faltar para Ana", "com o motivo");
r = gerar({ indispensaveis: [indisp("show1", "Ana")] });
certo(ids(r, "2026-11-14").includes("show1"), "evento com data vai para o dia dele");
r = gerar({ atuais: { "2026-11-15": [{ uid: "x", id: "par1", dur: 120 }] }, indispensaveis: [indisp("par1", "Ana")] });
certo(tudo(r).filter((i) => i === "par1").length === 1 && r.pronta, "já estava no roteiro: não duplica nem vira conflito");

// Conflitos
const conf = (o) => gerar(o).conflitos;
let c = conf({ indispensaveis: [indisp("exemplo", "Ana")] });
certo(c[0] && c[0].tipo === "ilustrativo" && c[0].opcoes.length === 2, "exemplo ilustrativo marcado: o grupo decide");
r = gerar({ indispensaveis: [indisp("exemplo", "Ana")], decisoes: { exemplo: "manter" } });
certo(r.pronta && tudo(r).includes("exemplo"), "…colocar mesmo assim");
r = gerar({ indispensaveis: [indisp("exemplo", "Ana")], decisoes: { exemplo: "fora" } });
certo(r.pronta && !tudo(r).includes("exemplo") && r.foraPorDecisao[0].lugarId === "exemplo", "…ou fica listado como deixado de fora");
c = conf({ indispensaveis: [indisp("semlocal", "Ana")] });
certo(c[0] && c[0].tipo === "sem_local", "local a confirmar: o grupo decide");
c = conf({ indispensaveis: [indisp("bar1", "Ana")] });
certo(c[0] && c[0].tipo === "idade", "acima da idade: o grupo decide");
r = gerar({ indispensaveis: [indisp("bar1", "Ana")], decisoes: { bar1: "manter" } });
certo(r.pronta && tudo(r).includes("bar1"), "…manter com alerta");
c = conf({ indispensaveis: [indisp("seg", "Ana")] });
certo(c[0] && c[0].tipo === "fora_datas" && c[0].opcoes.some((o) => o.acao === "datas"), "fechado em todos os dias: oferece mudar as datas");
c = conf({ indispensaveis: [{ lugarId: "sumiu", lugar: null, nome: "Lugar que não está mais no site", por: [{ id: "a", nome: "Ana" }], contagem: 1 }] });
certo(c[0] && c[0].tipo === "saiu", "lugar que saiu do site não some em silêncio");
c = conf({ indispensaveis: [indisp("show1", "Ana"), indisp("show2", "Bia")] });
certo(c.length === 1 && c[0].tipo === "mesma_hora" && c[0].opcoes.length === 2, "dois shows na mesma hora: o grupo escolhe um", JSON.stringify(c));
const escolha = c[0].opcoes[0].decisoes;
r = gerar({ indispensaveis: [indisp("show1", "Ana"), indisp("show2", "Bia")], decisoes: escolha });
certo(r.pronta && r.foraPorDecisao.length === 1 && tudo(r).filter((i) => i.startsWith("show")).length === 1, "…e a escolha resolve", JSON.stringify(r.conflitos));
// Mais obrigatórios do que tempo: 1 dia, várias visitas longas
const muitos = ["tri1", "tri2", "mus1", "mus2", "mus3", "mus4", "par1"].map((id) => indisp(id, "Ana"));
r = gerarRoteiro({ dias: ["2026-11-13"], candidatos: CAT, regras: regras(), indispensaveis: muitos });
certo(!r.pronta && r.conflitos.some((x) => x.tipo === "sem_tempo"), "mais 'não pode faltar' do que tempo: conflito, nada some");
const presentes = (rr) => new Set([...Object.values(rr.dias).flat().map((i) => i.id), ...rr.conflitos.map((x) => x.lugarId)]);
certo(muitos.every((m) => presentes(r).has(m.lugarId)), "cada marcado está no roteiro ou num conflito");
const sc = r.conflitos.find((x) => x.tipo === "sem_tempo");
certo(sc.opcoes.some((o) => /Encurtar/.test(o.rotulo)) && sc.opcoes.some((o) => o.acao === "datas") && sc.opcoes.some((o) => /tirar/.test(o.rotulo)), "alternativas: encurtar, mudar datas, trocar por outro");
// Encurtar reduz a duração
r = gerarRoteiro({ dias: ["2026-11-13"], candidatos: [], regras: regras(), indispensaveis: [indisp("tri1", "Ana"), indisp("tri2", "Ana"), indisp("tri3", "Ana"), indisp("par1", "Ana"), indisp("par2", "Ana")], decisoes: { tri1: "encurtar", tri2: "encurtar" } });
const enc = Object.values(r.dias).flat().find((i) => i.id === "tri1");
certo(enc && enc.dur === 144 && /encurtada/.test(enc.motivos.join()), "encurtar usa 60% do tempo e avisa", JSON.stringify(r.conflitos));

// Gerar outra opção
const v0 = gerar({ variacao: 0 }), v1 = gerar({ variacao: 1 }), v2 = gerar({ variacao: 2 });
certo(JSON.stringify(v0.dias) !== JSON.stringify(v1.dias) || JSON.stringify(v0.dias) !== JSON.stringify(v2.dias), "outra opção muda as escolhas");
const vi = gerar({ variacao: 3, indispensaveis: [indisp("tri1", "Ana")] });
certo(tudo(vi).includes("tri1"), "…sem perder o que não pode faltar");
const ent = { dias: DIAS, candidatos: CAT, regras: regras() }; const antes = JSON.stringify(CAT); gerarRoteiro(ent);
certo(JSON.stringify(CAT) === antes, "catálogo não é alterado");
console.log(`\n${ok} ok, ${falhou} falha(s); ${chamadas} simulações`);
process.exit(falhou ? 1 : 0);
