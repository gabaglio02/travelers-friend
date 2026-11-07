/*
 * Preferências do grupo de UMA viagem: até 5 pessoas respondem, cada uma por si, o mesmo questionário de 8 categorias
 * das sugestões personalizadas (js/gosto.js) e marcam lugares que "não podem faltar".
 * Duas formas de responder, que convivem no mesmo grupo:
 *   - neste aparelho, sem conta: as notas ficam dentro da viagem (state.grupo);
 *   - pela conta da pessoa, com um convite de uso único (supabase/009_grupo_conexoes.sql): as notas ficam SÓ no
 *     servidor; aqui ficam apenas na memória (conexoes), nunca em state, localStorage ou viagens.dados.
 * O grupo vai junto quando a viagem é salva na conta, nunca se mistura com outra viagem e não toca as preferências
 * pessoais da conta. O link de compartilhar o roteiro não leva o grupo.
 *
 *   state.grupo = {
 *     participantes: [{ id: "p1a2b", nome: "Ana", notas: { museus: 5, noite: 0 }, puladas: ["compras"], respondido: "2026-11-02" | null,
 *                       conectado: true }],   // conectado = a vaga está ligada a uma conta (sem as notas)
 *     indispensaveis: { "<id do lugar>": ["p1a2b", "voce"] },   // quem marcou cada lugar (separado das notas);
 *                                                               // "voce" = quem organiza, que não ocupa vaga no grupo
 *     removidos: ["p7k2m"]   // vagas tiradas de propósito: o banco apaga as conexões delas ao salvar a viagem
 *   }
 *
 * Nada calculado é guardado: dadosDoGrupo() refaz média, distribuição, consenso e divergência a partir das respostas,
 * então nunca fica desatualizado. É por ele que o roteiro automático (Fase 3, tarefa 3) vai ler o grupo:
 * window.TF.grupo() devolve dadosDoGrupo(state.grupo, …, conexões carregadas).
 */
import { GOSTO } from "./core/constantes.js";
import { esc, fmtShort } from "./core/util.js";
import { idValido, idLugarValido } from "./core/sanitizar.js";
import { abrirQuestionario, normalRespostas, ativa as gostoAtivo, preferencias as preferenciasPessoais, respondeu as respondeuPessoal } from "./gosto.js";

export const MAX_PARTICIPANTES = 5;
const NOME_MAX = 30, REMOVIDOS_MAX = 100;
export const grupoVazio = () => ({ participantes: [], indispensaveis: {}, removidos: [] });
// Quem organiza a viagem: entra com as notas pessoais (js/gosto.js) e marca "não pode faltar" sem ocupar vaga.
// O id é reservado: nenhuma vaga do grupo pode usá-lo.
export const VOCE = "voce";
const NOME_VOCE = "Você";

// Completa/limpa o grupo de uma viagem salva (viagens antigas não têm; dados estranhos não quebram).
export function normalGrupo(g) {
  const out = grupoVazio();
  if (!g || typeof g !== "object") return out;
  out.removidos = [...new Set(Array.isArray(g.removidos) ? g.removidos.filter((x) => typeof x === "string") : [])].slice(-REMOVIDOS_MAX);
  const ids = new Set();
  for (const p of Array.isArray(g.participantes) ? g.participantes : []) {
    if (!p || !idValido(p.id) || p.id === VOCE || ids.has(p.id) || out.removidos.includes(p.id) || out.participantes.length >= MAX_PARTICIPANTES) continue;
    const nome = String(p.nome || "").trim().slice(0, NOME_MAX);
    if (!nome) continue;
    const r = normalRespostas(p);
    ids.add(p.id);
    out.participantes.push({ id: p.id, nome, notas: r.notas, puladas: r.puladas, respondido: typeof p.respondido === "string" ? p.respondido.slice(0, 10) : null,
      ...(p.conectado === true ? { conectado: true } : {}) });
  }
  for (const [lugar, quem] of Object.entries(g.indispensaveis || {})) {
    const lista = [...new Set(Array.isArray(quem) ? quem : [])].filter((id) => ids.has(id) || id === VOCE);
    if (lista.length && idLugarValido(lugar)) out.indispensaveis[lugar] = lista;
  }
  return out;
}

// ---------- Cálculos ----------
// Situação de uma categoria entre quem deu nota (pulou ou não respondeu não entra):
//   "consenso"   = notas a no máximo 1 ponto umas das outras (ex.: 5, 4, 5, 4)
//   "divergencia" = diferença de 3 pontos ou mais, ou alguém gosta muito (4–5) e alguém quase nada (0–1) (ex.: 5, 5, 0, 0)
//   "parcial"    = no meio (ex.: 4, 3, 4, 5);  "uma resposta" / "sem respostas" quando não dá para comparar.
export function analisarCategoria(notas) {
  const n = notas.length;
  const distribuicao = [0, 0, 0, 0, 0, 0];
  notas.forEach((v) => distribuicao[v]++);
  if (!n) return { n, media: null, min: null, max: null, amplitude: null, distribuicao, situacao: "sem respostas" };
  const min = Math.min(...notas), max = Math.max(...notas), amplitude = max - min;
  const media = Math.round((notas.reduce((a, b) => a + b, 0) / n) * 10) / 10;
  let situacao = "parcial";
  if (n === 1) situacao = "uma resposta";
  else if (amplitude <= 1) situacao = "consenso";
  else if (amplitude >= 3 || (max >= 4 && min <= 1)) situacao = "divergencia";
  return { n, media, min, max, amplitude, distribuicao, situacao };
}

// Participante como entra nas contas: vaga conectada usa as notas da conta (se carregadas), as outras as do aparelho.
//   origem: "aparelho" | "conta";  indisponivel: conta conectada cujas notas não foram carregadas (sem internet).
function comConexao(p, conexoes) {
  const c = conexoes && conexoes.get(p.id);
  if (c && c.estado === "conectado") {
    const r = normalRespostas(c);
    return { ...p, notas: r.notas, puladas: r.puladas, respondido: (c.atualizado_em || "").slice(0, 10) || null, origem: "conta", origemNotas: c.origem };
  }
  if (p.conectado) return { ...p, notas: {}, puladas: [], respondido: null, origem: "conta", indisponivel: true };
  return { ...p, origem: "aparelho" };
}

// Tudo o que o grupo respondeu, pronto para mostrar ou para o roteiro automático usar.
//   participantes: [{ id, nome, respondeu, notas, puladas, origem: "aparelho" | "conta", atualizado, indisponivel? }]
//   respondentes:  quantas pessoas responderam (no aparelho ou pela conta)
//   categorias:    na ordem do questionário, cada uma com { id, nome, icone, cats, respostas: [{ participante, nome, nota }],
//                  puladas: [ids], semResposta: [ids], n, media, min, max, amplitude, distribuicao[0..5], situacao }
//   ranking:       ids das categorias da maior média para a menor (sem respostas no fim)
//   indispensaveis: [{ lugarId, lugar (ou null se saiu do catálogo), nome, categoria, por: [{ id, nome }], contagem, todos }]
//                  do mais marcado para o menos; "todos" = marcado por todos os participantes (com 2 ou mais)
//   voce (opcional): { notas, puladas } de quem organiza; entra como mais uma pessoa (origem "pessoal") só nesta conta.
export function dadosDoGrupo(g, lugarPorId = () => null, conexoes = null, voce = null) {
  g = normalGrupo(g);
  const ps = g.participantes.map((p) => comConexao(p, conexoes));
  if (voce) ps.unshift({ id: VOCE, nome: NOME_VOCE, notas: voce.notas, puladas: voce.puladas || [], respondido: "sim", origem: "pessoal" });
  const nomeDe = (id) => (id === VOCE ? NOME_VOCE : (ps.find((p) => p.id === id) || {}).nome || "");
  const categorias = GOSTO.map((c) => {
    const respostas = ps.filter((p) => p.notas[c.id] != null).map((p) => ({ participante: p.id, nome: p.nome, nota: p.notas[c.id] }));
    return {
      id: c.id, nome: c.nome, icone: c.icone, cats: c.cats, respostas,
      puladas: ps.filter((p) => p.puladas.includes(c.id)).map((p) => p.id),
      semResposta: ps.filter((p) => p.notas[c.id] == null && !p.puladas.includes(c.id)).map((p) => p.id),
      ...analisarCategoria(respostas.map((r) => r.nota))
    };
  });
  const ranking = [...categorias].sort((a, b) => (b.media ?? -1) - (a.media ?? -1)).map((c) => c.id);
  // "todos" conta quem organiza: mesmo sem notas, é da viagem e pode marcar.
  const membros = ps.some((p) => p.id === VOCE) ? ps.map((p) => p.id) : [VOCE, ...ps.map((p) => p.id)];
  const indispensaveis = Object.entries(g.indispensaveis).map(([lugarId, quem]) => {
    const lugar = lugarPorId(lugarId) || null;
    return { lugarId, lugar, nome: lugar ? lugar.nome : "Lugar que não está mais no site", categoria: lugar ? lugar.categoria : null,
      por: quem.map((id) => ({ id, nome: nomeDe(id) })), contagem: quem.length, todos: ps.length > 0 && membros.every((id) => quem.includes(id)) };
  }).sort((a, b) => b.contagem - a.contagem || a.nome.localeCompare(b.nome));
  return {
    participantes: ps.map((p) => ({ id: p.id, nome: p.nome, respondeu: !!p.respondido, notas: { ...p.notas }, puladas: [...p.puladas],
      origem: p.origem, atualizado: p.respondido, ...(p.indisponivel ? { indisponivel: true } : {}) })),
    respondentes: ps.filter((p) => p.respondido).length,
    categorias, ranking, indispensaveis
  };
}

// Notas pessoais de quem organiza, se devem contar junto com o grupo (resumo e roteiro automático); senão null.
// Contam se as sugestões personalizadas estão ligadas. Vaga respondida neste aparelho com notas idênticas é, quase
// sempre, a própria pessoa: não conta duas vezes. Conta conectada com as mesmas notas é outra pessoa e conta normalmente.
export function minhasNotas(dados) {
  if (!gostoAtivo()) return null;
  const minhas = preferenciasPessoais(), chaves = Object.keys(minhas.notas);
  const iguais = (notas) => Object.keys(notas).length === chaves.length && chaves.every((k) => notas[k] === minhas.notas[k]);
  if (dados.participantes.some((p) => p.origem === "aparelho" && p.respondeu && iguais(p.notas))) return null;
  return { notas: { ...minhas.notas }, puladas: [...minhas.puladas] };
}

// ---------- Contas conectadas (servidor) ----------
// conexoes: Map vaga → { estado: pendente|vencido|conectado|saiu, vaga_nome, expira_em, notas, puladas, origem, atualizado_em }
// Só da viagem "viagemSync"; trocar de viagem, sair da conta ou a vaga sair limpa daqui também.
let conexoes = new Map(), viagemSync = null, sync = "sem-conta"; // sem-conta | carregando | ok | offline
let linkGerado = null; // { participante, url, expira } — o código só existe na tela em que foi gerado
const conta = () => window.TFConta || null;
const contaAtiva = () => { const c = conta(); return !!(c && c.cliente() && c.usuario() && c.viagemAtual()); };
export const conexoesAtuais = () => (contaAtiva() && viagemSync === conta().viagemAtual() ? conexoes : null);

function limparConexoes() { conexoes = new Map(); viagemSync = null; linkGerado = null; }
// Chamado quando outra viagem é aberta, ao entrar/sair da conta e ao abrir a janela do grupo.
export async function sincronizar() {
  const c = conta();
  if (!contaAtiva()) { limparConexoes(); sync = "sem-conta"; desenhar(); return; }
  const vid = c.viagemAtual();
  if (viagemSync !== vid) limparConexoes();
  sync = "carregando";
  try {
    const { data, error } = await c.cliente().rpc("conexoes_do_grupo", { p_viagem: vid });
    if (error) throw error;
    if (c.viagemAtual() !== vid) return; // trocou de viagem no meio
    conexoes = new Map((data || []).map((x) => [x.participante, x]));
    viagemSync = vid; sync = "ok";
    reconciliar();
  } catch (err) {
    console.warn("[grupo]", err);
    sync = "offline";
  }
  desenhar();
  if (ctx) ctx.redesenhar();
}

// Acerta as vagas da viagem com o servidor:
//  - conexão de uma vaga que sumiu desta versão da viagem (aberta antes em outro aparelho) → a vaga volta;
//  - vaga conectada → marca "conectado" e descarta respostas antigas dadas neste aparelho (vale a da conta);
//  - vaga que deixou de estar conectada (saiu ou foi removida) → tira a marca.
function reconciliar() {
  const g = grupo();
  let mudou = false;
  for (const [id, c] of conexoes) {
    if (g.participantes.some((p) => p.id === id) || g.removidos.includes(id)) continue;
    if (c.estado !== "conectado" || g.participantes.length >= MAX_PARTICIPANTES) continue;
    g.participantes.push({ id, nome: c.vaga_nome, notas: {}, puladas: [], respondido: null });
    mudou = true;
  }
  for (const p of g.participantes) {
    const ligada = (conexoes.get(p.id) || {}).estado === "conectado";
    if (ligada && (!p.conectado || p.respondido || Object.keys(p.notas).length || p.puladas.length)) {
      Object.assign(p, { conectado: true, notas: {}, puladas: [], respondido: null }); mudou = true;
    } else if (!ligada && p.conectado) { delete p.conectado; mudou = true; }
  }
  if (mudou) ctx.mudou();
}

// ---------- Alterações (sempre sobre o grupo da viagem aberta) ----------
let ctx = null; // { obter: () => state.grupo, mudou: () => salvar e redesenhar, redesenhar, lugar: (id) => lugar, abrirDetalhe }
export function iniciar(opcoes) {
  ctx = opcoes;
  const quandoPronta = () => { const c = conta(); if (c) { c.pronto.then(() => { c.aoMudarUsuario(() => sincronizar()); sincronizar(); }); } };
  if (window.TFConta) quandoPronta(); else window.addEventListener("tf:conta", quandoPronta, { once: true });
}
// Outra viagem aberta (TF.loadState): o que estava na memória era da viagem anterior.
export function aoTrocarViagem() { limparConexoes(); sincronizar(); }
const grupo = () => ctx.obter();
const novoId = () => "p" + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);

export function adicionarParticipante(nome) {
  const g = grupo();
  nome = String(nome || "").trim().slice(0, NOME_MAX);
  if (!nome) return { erro: "Escreva o nome ou apelido da pessoa." };
  if (g.participantes.length >= MAX_PARTICIPANTES) return { erro: `O grupo pode ter até ${MAX_PARTICIPANTES} pessoas.` };
  if (g.participantes.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) return { erro: `Já existe alguém chamado ${nome} no grupo. Use um apelido diferente.` };
  const p = { id: novoId(), nome, notas: {}, puladas: [], respondido: null };
  g.participantes.push(p);
  ctx.mudou();
  return { participante: p };
}
export function renomearParticipante(id, nome) {
  const g = grupo(), p = g.participantes.find((x) => x.id === id);
  nome = String(nome || "").trim().slice(0, NOME_MAX);
  if (!p || !nome || g.participantes.some((x) => x !== p && x.nome.toLowerCase() === nome.toLowerCase())) return false;
  p.nome = nome; ctx.mudou(); return true;
}
// Tira a pessoa, as respostas dela e as marcações de "não pode faltar" que só ela tinha.
// A vaga vai para "removidos": ao salvar a viagem, o banco apaga a conexão dela mesmo se a chamada abaixo falhar.
export async function removerParticipante(id) {
  const g = grupo();
  g.participantes = g.participantes.filter((p) => p.id !== id);
  for (const [lugar, quem] of Object.entries(g.indispensaveis)) {
    const resto = quem.filter((x) => x !== id);
    if (resto.length) g.indispensaveis[lugar] = resto; else delete g.indispensaveis[lugar];
  }
  g.removidos = [...g.removidos.filter((x) => x !== id), id].slice(-REMOVIDOS_MAX);
  const tinha = conexoes.delete(id);
  if (linkGerado && linkGerado.participante === id) linkGerado = null;
  ctx.mudou();
  if (tinha && contaAtiva()) {
    try { await conta().cliente().rpc("cancelar_conexao_grupo", { p_viagem: conta().viagemAtual(), p_participante: id }); }
    catch (err) { console.warn("[grupo] remover conexão:", err); }
  }
}
export function guardarRespostas(id, { notas, puladas }) {
  const p = grupo().participantes.find((x) => x.id === id);
  if (!p) throw new Error("Essa pessoa saiu do grupo.");
  if ((conexoes.get(id) || {}).estado === "conectado" || p.conectado) throw new Error("Esta vaga está ligada a uma conta: só a própria pessoa muda as respostas.");
  p.notas = { ...notas }; p.puladas = [...puladas]; p.respondido = new Date().toLocaleDateString("sv-SE");
  ctx.mudou();
}
export const marcouIndispensavel = (lugarId, pessoaId) => (grupo().indispensaveis[lugarId] || []).includes(pessoaId);
export function alternarIndispensavel(lugarId, pessoaId) {
  const g = grupo();
  if (pessoaId !== VOCE && !g.participantes.some((p) => p.id === pessoaId)) return;
  const quem = g.indispensaveis[lugarId] || [];
  const resto = quem.includes(pessoaId) ? quem.filter((x) => x !== pessoaId) : [...quem, pessoaId];
  if (resto.length) g.indispensaveis[lugarId] = resto; else delete g.indispensaveis[lugarId];
  ctx.mudou();
}

// Convite: salva a viagem antes (o banco confere se a vaga existe nela) e pede o código.
async function convidar(id) {
  const c = conta();
  aviso = "";
  try {
    if (c.salvarJa && !(await c.salvarJa())) throw new Error("Não foi possível salvar a viagem agora (sem conexão?).");
    const { data, error } = await c.cliente().rpc("criar_convite_grupo", { p_viagem: c.viagemAtual(), p_participante: id });
    if (error) throw error;
    linkGerado = { participante: id, url: location.origin + location.pathname + "#/grupo/" + data.codigo, expira: data.expira_em };
    await sincronizar();
  } catch (err) {
    const m = String(err && err.message);
    aviso = /vaga_ocupada/.test(m) ? "Esta vaga já está ligada a uma conta." : /limite_convites/.test(m) ? "Você gerou muitos convites hoje. Tente amanhã."
      : /vaga_inexistente|grupo_invalido/.test(m) ? "A viagem ainda não foi salva com esta pessoa. Tente de novo em alguns segundos." : m;
    desenhar();
  }
}
async function cancelarConvite(id) {
  try {
    const { error } = await conta().cliente().rpc("cancelar_conexao_grupo", { p_viagem: conta().viagemAtual(), p_participante: id });
    if (error) throw error;
    if (linkGerado && linkGerado.participante === id) linkGerado = null;
    await sincronizar();
  } catch (err) { aviso = String(err && err.message); desenhar(); }
}

// ---------- Pedaços usados no Explorar e no detalhe do lugar (js/app.js) ----------
const nomesE = (lista) => lista.length <= 1 ? lista.join("") : lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1];
// "⭐ Não pode faltar para Ana e Bruno" (cards e detalhe); vazio se ninguém marcou.
export function notaIndispensavel(lugarId) {
  const g = grupo(), quem = g.indispensaveis[lugarId] || [];
  if (!quem.length) return "";
  const nomes = quem.map((id) => (id === VOCE ? "você" : (g.participantes.find((p) => p.id === id) || {}).nome)).filter(Boolean);
  return `<div class="nao-faltar-nota">⭐ Não pode faltar para ${esc(nomesE(nomes))}</div>`;
}
// Botões por pessoa no detalhe do lugar.
export function blocoDetalhe(lugarId) {
  const ps = [{ id: VOCE, nome: NOME_VOCE }, ...grupo().participantes];
  return `<div class="nao-faltar" role="group" aria-label="Não pode faltar na viagem">
    <span class="small-text">⭐ Não pode faltar na viagem para:</span>
    <div class="nao-faltar-chips">${ps.map((p) => { const on = marcouIndispensavel(lugarId, p.id);
      return `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-indisp="${esc(lugarId)}" data-pessoa="${esc(p.id)}">${on ? "✓ " : ""}${esc(p.nome)}</button>`; }).join("")}</div>
    ${ps.length === 1 ? `<p class="small-text muted nao-faltar-vazio">Vai com mais gente? <button type="button" class="link" data-grupo-abrir>Cadastre quem vai viajar</button>.</p>` : ""}
  </div>`;
}

// ---------- Janela "Preferências do grupo" ----------
let d = null, tela = "lista", aviso = "";
export function abrirJanela(qual = "lista") {
  tela = qual; aviso = "";
  if (!d) {
    d = document.createElement("dialog");
    d.className = "modal tf-grupo";
    d.setAttribute("aria-labelledby", "tfGrupoTitulo");
    document.body.appendChild(d);
    d.addEventListener("click", clique);
    d.addEventListener("change", mudanca);
    d.addEventListener("submit", (e) => { e.preventDefault(); adicionar(); });
    d.addEventListener("close", () => { d.remove(); d = null; linkGerado = null; });
  }
  desenhar();
  if (!d.open) d.showModal();
  sincronizar();
}
// Data e hora do banco (UTC) → dia local, "09/11".
const dataCurta = (iso) => (iso ? fmtShort(new Date(iso).toLocaleDateString("sv-SE")) : "");
// Estado discreto de cada vaga: respondeu aqui · conta conectada · convite enviado · saiu · ainda não respondeu.
function estadoVaga(p, proximo) {
  const c = conexoes.get(p.id);
  if (c && c.estado === "conectado") return ["ok", `🔗 conta conectada · ${c.origem === "viagem" ? "respondeu para esta viagem" : "notas pessoais"}, ${dataCurta(c.atualizado_em)}`];
  if (p.conectado) return ["muted", sync === "sem-conta" ? "🔗 conta conectada · entre na sua conta para ver as notas" : "🔗 conta conectada · notas indisponíveis sem internet"];
  if (c && c.estado === "pendente") return ["muted", `✉️ convite enviado · vale até ${dataCurta(c.expira_em)}`];
  if (c && c.estado === "vencido") return ["muted", "✉️ convite vencido"];
  const saiu = c && c.estado === "saiu" ? " · saiu do grupo, vaga livre" : "";
  if (p.respondido) return ["ok", "📱 respondeu neste aparelho" + saiu];
  return ["muted", (proximo === p ? "próxima vez de responder" : "ainda não respondeu") + saiu];
}
function desenhar() {
  if (!d) return;
  const g = grupo();
  let dados = dadosDoGrupo(g, ctx.lugar, conexoesAtuais());
  const cheio = g.participantes.length >= MAX_PARTICIPANTES;
  const ligada = (p) => (conexoes.get(p.id) || {}).estado === "conectado" || p.conectado;
  const proximo = g.participantes.find((p) => !p.respondido && !ligada(p));
  const podeConvidar = contaAtiva() && sync !== "offline";
  let corpo;
  if (tela === "resumo") {
    // Quem organiza entra no resumo com as notas pessoais (só nesta tela, nada é gravado na viagem).
    const voce = minhasNotas(dados);
    if (voce) dados = dadosDoGrupo(g, ctx.lugar, conexoesAtuais(), voce);
    const notaVoce = voce ? `<p class="small-text muted">Você entra com as suas notas pessoais (✨ Sugestões personalizadas).</p>`
      : !respondeuPessoal() ? `<p class="small-text muted">Você não aparece aqui porque ainda não respondeu ao questionário de ✨ Sugestões personalizadas (Explorar → Filtros).</p>` : "";
    const cat = (id) => dados.categorias.find((c) => c.id === id);
    const SIT = { consenso: ["todos concordam", "ok"], divergencia: ["opiniões divididas", "div"], parcial: ["", ""], "uma resposta": ["", ""], "sem respostas": ["sem respostas", ""] };
    const nomeP = (pid) => (dados.participantes.find((p) => p.id === pid) || {}).nome || "";
    const indisp = dados.participantes.filter((p) => p.indisponivel).map((p) => p.nome);
    corpo = `
      <p class="muted small-text">${dados.respondentes} de ${dados.participantes.length} ${dados.participantes.length === 1 ? "pessoa respondeu" : "pessoas responderam"}. Média de 0 a 5; as notas de cada um ficam logo abaixo.</p>
      ${notaVoce}
      ${indisp.length ? `<p class="warning small-text">Sem internet: as notas de ${esc(nomesE(indisp))} (conta conectada) não entraram nesta conta.</p>` : ""}
      <ol class="grupo-cats">${dados.ranking.map((id) => { const c = cat(id), [sit, cls] = SIT[c.situacao];
        const cada = [...c.respostas.map((r) => `${esc(r.nome)} ${r.nota}`), ...c.puladas.map((pid) => `${esc(nomeP(pid))} pulou`)];
        return `<li>
          <div class="grupo-cat-top"><span>${c.icone} ${esc(c.nome)}</span><b class="mono">${c.media == null ? "—" : String(c.media).replace(".", ",")}</b></div>
          <div class="grupo-barra" aria-hidden="true"><span style="width:${((c.media || 0) / 5) * 100}%"></span></div>
          <div class="grupo-cat-pe small-text">${sit ? `<em class="grupo-sit ${cls}">${sit}</em>` : ""}<span class="muted">${cada.join(" · ")}</span></div>
        </li>`; }).join("")}</ol>
      <h4 class="grupo-sub">⭐ Não pode faltar</h4>
      ${dados.indispensaveis.length ? `<ul class="grupo-indisp">${dados.indispensaveis.map((x) => `<li>
          <div><button type="button" class="link" data-grupo-lugar="${esc(x.lugarId)}" ${x.lugar ? "" : "disabled"}>${esc(x.nome)}</button>
            ${x.todos ? `<em class="grupo-sit ok">todos</em>` : x.contagem > 1 ? `<em class="grupo-sit">${x.contagem} pessoas</em>` : ""}</div>
          <div class="grupo-indisp-quem">${x.por.map((p) => `<span class="chip on">${esc(p.nome)}
            <button type="button" data-grupo-desmarcar="${esc(x.lugarId)}" data-pessoa="${esc(p.id)}" aria-label="Tirar a marcação de ${esc(p.nome)} em ${esc(x.nome)}">×</button></span>`).join("")}</div>
        </li>`).join("")}</ul>`
      : `<p class="small-text muted">Nenhum lugar marcado ainda. No Explorar, abra um lugar e toque no nome de quem acha que ele não pode faltar.</p>`}
      <div class="modal-actions"><button type="button" class="btn ghost" data-grupo="lista">← Participantes</button></div>`;
  } else {
    corpo = `
      <p class="small-text">Cada pessoa da viagem responde sozinha às mesmas 8 perguntas (até ${MAX_PARTICIPANTES} pessoas): aqui mesmo, passando o aparelho,
        ou pela própria conta, com um convite. As respostas ficam só nesta viagem e não mudam as suas sugestões pessoais.</p>
      ${g.participantes.length ? `<ul class="grupo-lista">${g.participantes.map((p) => {
        const c = conexoes.get(p.id), [cls, txt] = estadoVaga(p, proximo), lig = ligada(p);
        const pendente = c && (c.estado === "pendente" || c.estado === "vencido");
        const link = linkGerado && linkGerado.participante === p.id ? linkGerado : null;
        return `<li class="${proximo === p ? "proximo" : ""}">
          <input class="grupo-nome" value="${esc(p.nome)}" maxlength="${NOME_MAX}" data-grupo-nome="${esc(p.id)}" aria-label="Nome de ${esc(p.nome)}">
          <span class="small-text grupo-estado ${cls}">${txt}</span>
          ${link ? `<div class="grupo-link">
              <input readonly value="${esc(link.url)}" aria-label="Link do convite de ${esc(p.nome)}">
              <div class="grupo-link-acoes"><button type="button" class="btn small" data-grupo-copiar>Copiar</button>
                ${navigator.share ? `<button type="button" class="btn ghost small" data-grupo-enviar="${esc(p.nome)}">Enviar…</button>` : ""}</div>
              <p class="small-text muted">Mande só para ${esc(p.nome)}. Vale até ${dataCurta(link.expira)} e para uma pessoa; não dá acesso ao roteiro.
                O link aparece só agora — se perder, gere outro (o anterior deixa de valer).</p></div>` : ""}
          <span class="grupo-acoes">
            ${lig ? "" : `<button type="button" class="btn small ${p.respondido ? "ghost" : ""}" data-grupo-responder="${esc(p.id)}">${p.respondido ? "Mudar respostas" : "Responder aqui"}</button>`}
            ${!lig && podeConvidar ? `<button type="button" class="link" data-grupo-convidar="${esc(p.id)}">${pendente ? "gerar novo link" : "🔗 convidar a conta"}</button>` : ""}
            ${pendente && podeConvidar ? `<button type="button" class="link" data-grupo-cancelar="${esc(p.id)}">cancelar convite</button>` : ""}
            <button type="button" class="link" data-grupo-remover="${esc(p.id)}">remover</button>
          </span></li>`; }).join("")}</ul>` : ""}
      <form class="grupo-add" novalidate>
        <label class="field"><span>${g.participantes.length ? "Mais uma pessoa" : "Quem vai viajar?"}</span>
          <input name="nome" maxlength="${NOME_MAX}" placeholder="${cheio ? "Grupo completo" : "Nome ou apelido"}" ${cheio ? "disabled" : ""} autocomplete="off"></label>
        <button class="btn small" ${cheio ? "disabled" : ""}>Adicionar</button>
      </form>
      ${cheio ? `<p class="small-text muted">O grupo já tem ${MAX_PARTICIPANTES} pessoas, o máximo.</p>` : ""}
      ${!contaAtiva() && g.participantes.length ? `<p class="small-text muted">Quem tem conta no Traveler's Friend pode responder pelo próprio celular: entre na sua conta para convidar.</p>` : ""}
      ${sync === "offline" ? `<p class="small-text muted">Sem conexão com o servidor: convites e contas conectadas ficam indisponíveis por enquanto.</p>` : ""}
      ${aviso ? `<p class="warning" role="alert">${esc(aviso)}</p>` : ""}
      <div class="modal-actions">
        <button type="button" class="btn" data-grupo="resumo" ${dados.respondentes ? "" : "disabled"}>Ver resumo do grupo</button>
        ${proximo ? `<span class="small-text muted">Falta: ${esc(g.participantes.filter((p) => !p.respondido && !ligada(p)).map((p) => p.nome).join(", "))}</span>` : ""}
      </div>`;
  }
  const foco = document.activeElement && d.contains(document.activeElement) ? document.activeElement.getAttribute("data-grupo-nome") : null;
  d.innerHTML = `
    <div class="modal-head"><h3 id="tfGrupoTitulo">👥 ${tela === "resumo" ? "Resumo do grupo" : "Preferências do grupo"}</h3>
      <button type="button" class="icon-btn" data-grupo="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-body">${corpo}</div>`;
  if (foco) d.querySelector(`[data-grupo-nome="${foco}"]`)?.focus();
}
const redesenhar = () => desenhar();

function adicionar() {
  const campo = d.querySelector(".grupo-add input[name=nome]");
  const r = adicionarParticipante(campo.value);
  aviso = r.erro || "";
  desenhar();
  if (r.participante) responder(r.participante.id);
  else d.querySelector(".grupo-add input[name=nome]")?.focus();
}
// Antes das perguntas, uma tela deixa claro de quem é a vez (o aparelho passa de mão em mão).
function responder(id) {
  const p = grupo().participantes.find((x) => x.id === id);
  if (!p) return;
  abrirQuestionario({
    intro: true,
    aoFechar: redesenhar,
    outra: {
      quem: p.nome, respostas: { notas: p.notas, puladas: p.puladas },
      intro: `<p class="tf-quiz-lead">Agora é a vez de <b>${esc(p.nome)}</b>.</p>
        <p class="small-text">Se você não é ${esc(p.nome)}, passe o aparelho para quem é. Cada pessoa responde sozinha às 8 perguntas, com notas de 0 a 5 — dá para pular as que quiser.</p>
        ${p.respondido ? `<p class="small-text muted">${esc(p.nome)} já respondeu: as notas anteriores aparecem marcadas e podem ser trocadas.</p>` : ""}`,
      botao: `Sou ${p.nome}, começar`,
      salvar: async (r) => guardarRespostas(p.id, r)
    }
  });
}

async function clique(e) {
  if (e.target === d) return d.close();
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.grupo === "fechar") return d.close();
  if (b.dataset.grupo) { tela = b.dataset.grupo; aviso = ""; return desenhar(); }
  if (b.dataset.grupoResponder) return responder(b.dataset.grupoResponder);
  if (b.dataset.grupoConvidar) { b.disabled = true; return convidar(b.dataset.grupoConvidar); }
  if (b.dataset.grupoCancelar) { b.disabled = true; return cancelarConvite(b.dataset.grupoCancelar); }
  if (b.hasAttribute("data-grupo-copiar")) {
    const campo = b.closest(".grupo-link").querySelector("input");
    try { await navigator.clipboard.writeText(campo.value); b.textContent = "Copiado ✓"; }
    catch (_) { campo.select(); b.textContent = "Selecionado: copie"; }
    return;
  }
  if (b.dataset.grupoEnviar) {
    const url = b.closest(".grupo-link").querySelector("input").value;
    try { await navigator.share({ title: "Convite do Traveler's Friend", text: `${b.dataset.grupoEnviar}, conecte sua conta ao grupo da nossa viagem:`, url }); } catch (_) { /* cancelou */ }
    return;
  }
  if (b.dataset.grupoRemover) {
    const p = grupo().participantes.find((x) => x.id === b.dataset.grupoRemover);
    const lig = p && ((conexoes.get(p.id) || {}).estado === "conectado" || p.conectado);
    const { confirmar } = await import("./social/confirmar.js");
    if (p && await confirmar({ titulo: `Remover ${p.nome}?`, botao: "Remover",
      texto: lig ? `A conta de ${p.nome} é desconectada desta viagem e as notas compartilhadas por ${p.nome} são apagadas. Os lugares marcados por ${p.nome} também saem.`
        : `As respostas e os lugares marcados por ${p.nome} saem desta viagem.` })) {
      await removerParticipante(p.id); desenhar();
    }
    return;
  }
  if (b.dataset.grupoDesmarcar) { alternarIndispensavel(b.dataset.grupoDesmarcar, b.dataset.pessoa); return desenhar(); }
  if (b.dataset.grupoLugar) { d.close(); ctx.abrirDetalhe(b.dataset.grupoLugar); }
}
function mudanca(e) {
  const id = e.target.dataset.grupoNome;
  if (!id) return;
  if (!renomearParticipante(id, e.target.value)) { aviso = "Nome vazio ou repetido: o nome anterior foi mantido."; }
  else aviso = "";
  desenhar();
}
