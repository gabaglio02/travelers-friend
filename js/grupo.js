/*
 * Preferências do grupo de UMA viagem: até 5 pessoas (sem conta) respondem, cada uma por si, o mesmo questionário
 * de 8 categorias das sugestões personalizadas (js/gosto.js) e marcam lugares que "não podem faltar".
 * Ficam dentro da viagem (state.grupo): vão junto quando a viagem é salva na conta (viagens.dados), nunca se misturam
 * com outra viagem e não tocam as preferências pessoais da conta. O link de compartilhar não leva o grupo.
 *
 *   state.grupo = {
 *     participantes: [{ id: "p1a2b", nome: "Ana", notas: { museus: 5, noite: 0 }, puladas: ["compras"], respondido: "2026-11-02" | null }],
 *     indispensaveis: { "<id do lugar>": ["p1a2b", "p9x8y"] }   // quem marcou cada lugar (separado das notas)
 *   }
 *
 * Nada calculado é guardado: dadosDoGrupo() refaz média, distribuição, consenso e divergência a partir das respostas,
 * então nunca fica desatualizado. É por ele que o roteiro automático (Fase 3, tarefa 3) vai ler o grupo:
 * window.TF.grupo() devolve dadosDoGrupo(state.grupo).
 */
import { GOSTO } from "./core/constantes.js";
import { esc } from "./core/util.js";
import { abrirQuestionario, normalRespostas } from "./gosto.js";

export const MAX_PARTICIPANTES = 5;
const NOME_MAX = 30;
export const grupoVazio = () => ({ participantes: [], indispensaveis: {} });

// Completa/limpa o grupo de uma viagem salva (viagens antigas não têm; dados estranhos não quebram).
export function normalGrupo(g) {
  const out = grupoVazio();
  if (!g || typeof g !== "object") return out;
  const ids = new Set();
  for (const p of Array.isArray(g.participantes) ? g.participantes : []) {
    if (!p || typeof p.id !== "string" || ids.has(p.id) || out.participantes.length >= MAX_PARTICIPANTES) continue;
    const nome = String(p.nome || "").trim().slice(0, NOME_MAX);
    if (!nome) continue;
    const r = normalRespostas(p);
    ids.add(p.id);
    out.participantes.push({ id: p.id, nome, notas: r.notas, puladas: r.puladas, respondido: typeof p.respondido === "string" ? p.respondido.slice(0, 10) : null });
  }
  for (const [lugar, quem] of Object.entries(g.indispensaveis || {})) {
    const lista = [...new Set(Array.isArray(quem) ? quem : [])].filter((id) => ids.has(id));
    if (lista.length) out.indispensaveis[lugar] = lista;
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

// Tudo o que o grupo respondeu, pronto para mostrar ou para o roteiro automático usar.
//   participantes: [{ id, nome, respondeu, notas, puladas }]
//   respondentes:  quantas pessoas terminaram o questionário
//   categorias:    na ordem do questionário, cada uma com { id, nome, icone, cats, respostas: [{ participante, nome, nota }],
//                  puladas: [ids], semResposta: [ids], n, media, min, max, amplitude, distribuicao[0..5], situacao }
//   ranking:       ids das categorias da maior média para a menor (sem respostas no fim)
//   indispensaveis: [{ lugarId, lugar (ou null se saiu do catálogo), nome, categoria, por: [{ id, nome }], contagem, todos }]
//                  do mais marcado para o menos; "todos" = marcado por todos os participantes (com 2 ou mais)
export function dadosDoGrupo(g, lugarPorId = () => null) {
  g = normalGrupo(g);
  const ps = g.participantes;
  const nomeDe = (id) => (ps.find((p) => p.id === id) || {}).nome || "";
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
  const indispensaveis = Object.entries(g.indispensaveis).map(([lugarId, quem]) => {
    const lugar = lugarPorId(lugarId) || null;
    return { lugarId, lugar, nome: lugar ? lugar.nome : "Lugar que não está mais no site", categoria: lugar ? lugar.categoria : null,
      por: quem.map((id) => ({ id, nome: nomeDe(id) })), contagem: quem.length, todos: ps.length > 1 && quem.length === ps.length };
  }).sort((a, b) => b.contagem - a.contagem || a.nome.localeCompare(b.nome));
  return {
    participantes: ps.map((p) => ({ id: p.id, nome: p.nome, respondeu: !!p.respondido, notas: { ...p.notas }, puladas: [...p.puladas] })),
    respondentes: ps.filter((p) => p.respondido).length,
    categorias, ranking, indispensaveis
  };
}

// ---------- Alterações (sempre sobre o grupo da viagem aberta) ----------
let ctx = null; // { obter: () => state.grupo, mudou: () => salvar e redesenhar, lugar: (id) => lugar, abrirDetalhe }
export function iniciar(opcoes) { ctx = opcoes; }
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
export function removerParticipante(id) {
  const g = grupo();
  g.participantes = g.participantes.filter((p) => p.id !== id);
  for (const [lugar, quem] of Object.entries(g.indispensaveis)) {
    const resto = quem.filter((x) => x !== id);
    if (resto.length) g.indispensaveis[lugar] = resto; else delete g.indispensaveis[lugar];
  }
  ctx.mudou();
}
export function guardarRespostas(id, { notas, puladas }) {
  const p = grupo().participantes.find((x) => x.id === id);
  if (!p) throw new Error("Essa pessoa saiu do grupo.");
  p.notas = { ...notas }; p.puladas = [...puladas]; p.respondido = new Date().toLocaleDateString("sv-SE");
  ctx.mudou();
}
export const marcouIndispensavel = (lugarId, pessoaId) => (grupo().indispensaveis[lugarId] || []).includes(pessoaId);
export function alternarIndispensavel(lugarId, pessoaId) {
  const g = grupo();
  if (!g.participantes.some((p) => p.id === pessoaId)) return;
  const quem = g.indispensaveis[lugarId] || [];
  const resto = quem.includes(pessoaId) ? quem.filter((x) => x !== pessoaId) : [...quem, pessoaId];
  if (resto.length) g.indispensaveis[lugarId] = resto; else delete g.indispensaveis[lugarId];
  ctx.mudou();
}

// ---------- Pedaços usados no Explorar e no detalhe do lugar (js/app.js) ----------
const nomesE = (lista) => lista.length <= 1 ? lista.join("") : lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1];
// "⭐ Não pode faltar para Ana e Bruno" (cards e detalhe); vazio se ninguém marcou.
export function notaIndispensavel(lugarId) {
  const g = grupo(), quem = g.indispensaveis[lugarId] || [];
  if (!quem.length) return "";
  const nomes = quem.map((id) => (g.participantes.find((p) => p.id === id) || {}).nome).filter(Boolean);
  return `<div class="nao-faltar-nota">⭐ Não pode faltar para ${esc(nomesE(nomes))}</div>`;
}
// Botões por pessoa no detalhe do lugar.
export function blocoDetalhe(lugarId) {
  const ps = grupo().participantes;
  if (!ps.length) return `<p class="small-text muted nao-faltar-vazio">⭐ Quer marcar este lugar como "não pode faltar"?
    <button type="button" class="link" data-grupo-abrir>Cadastre quem vai viajar</button>.</p>`;
  return `<div class="nao-faltar" role="group" aria-label="Não pode faltar na viagem">
    <span class="small-text">⭐ Não pode faltar na viagem para:</span>
    <div class="nao-faltar-chips">${ps.map((p) => { const on = marcouIndispensavel(lugarId, p.id);
      return `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-indisp="${esc(lugarId)}" data-pessoa="${esc(p.id)}">${on ? "✓ " : ""}${esc(p.nome)}</button>`; }).join("")}</div>
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
    d.addEventListener("close", () => { d.remove(); d = null; });
  }
  desenhar();
  if (!d.open) d.showModal();
}
function desenhar() {
  if (!d) return;
  const g = grupo(), dados = dadosDoGrupo(g, ctx.lugar);
  const cheio = g.participantes.length >= MAX_PARTICIPANTES;
  const proximo = g.participantes.find((p) => !p.respondido);
  let corpo;
  if (tela === "resumo") {
    const cat = (id) => dados.categorias.find((c) => c.id === id);
    const SIT = { consenso: ["todos concordam", "ok"], divergencia: ["opiniões divididas", "div"], parcial: ["", ""], "uma resposta": ["", ""], "sem respostas": ["sem respostas", ""] };
    corpo = `
      <p class="muted small-text">${dados.respondentes} de ${dados.participantes.length} ${dados.participantes.length === 1 ? "pessoa respondeu" : "pessoas responderam"}. Média de 0 a 5; as notas de cada um ficam logo abaixo.</p>
      <ol class="grupo-cats">${dados.ranking.map((id) => { const c = cat(id), [sit, cls] = SIT[c.situacao];
        const cada = [...c.respostas.map((r) => `${esc(r.nome)} ${r.nota}`), ...c.puladas.map((pid) => `${esc(g.participantes.find((p) => p.id === pid).nome)} pulou`)];
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
      <p class="small-text">Cada pessoa da viagem responde sozinha às mesmas 8 perguntas (até ${MAX_PARTICIPANTES} pessoas, sem precisar de conta).
        As respostas ficam só nesta viagem e não mudam as suas sugestões pessoais.</p>
      ${g.participantes.length ? `<ul class="grupo-lista">${g.participantes.map((p) => `<li class="${proximo === p ? "proximo" : ""}">
          <input class="grupo-nome" value="${esc(p.nome)}" maxlength="${NOME_MAX}" data-grupo-nome="${esc(p.id)}" aria-label="Nome de ${esc(p.nome)}">
          <span class="small-text ${p.respondido ? "ok" : "muted"}">${p.respondido ? "✓ respondeu" : proximo === p ? "próxima vez de responder" : "ainda não respondeu"}</span>
          <span class="grupo-acoes">
            <button type="button" class="btn small ${p.respondido ? "ghost" : ""}" data-grupo-responder="${esc(p.id)}">${p.respondido ? "Mudar respostas" : "Responder"}</button>
            <button type="button" class="link" data-grupo-remover="${esc(p.id)}">remover</button>
          </span></li>`).join("")}</ul>` : ""}
      <form class="grupo-add" novalidate>
        <label class="field"><span>${g.participantes.length ? "Mais uma pessoa" : "Quem vai viajar?"}</span>
          <input name="nome" maxlength="${NOME_MAX}" placeholder="${cheio ? "Grupo completo" : "Nome ou apelido"}" ${cheio ? "disabled" : ""} autocomplete="off"></label>
        <button class="btn small" ${cheio ? "disabled" : ""}>Adicionar</button>
      </form>
      ${cheio ? `<p class="small-text muted">O grupo já tem ${MAX_PARTICIPANTES} pessoas, o máximo.</p>` : ""}
      ${aviso ? `<p class="warning" role="alert">${esc(aviso)}</p>` : ""}
      <div class="modal-actions">
        <button type="button" class="btn" data-grupo="resumo" ${dados.respondentes ? "" : "disabled"}>Ver resumo do grupo</button>
        ${proximo ? `<span class="small-text muted">Falta: ${esc(g.participantes.filter((p) => !p.respondido).map((p) => p.nome).join(", "))}</span>` : ""}
      </div>`;
  }
  d.innerHTML = `
    <div class="modal-head"><h3 id="tfGrupoTitulo">👥 ${tela === "resumo" ? "Resumo do grupo" : "Preferências do grupo"}</h3>
      <button type="button" class="icon-btn" data-grupo="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-body">${corpo}</div>`;
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
  if (b.dataset.grupoRemover) {
    const p = grupo().participantes.find((x) => x.id === b.dataset.grupoRemover);
    const { confirmar } = await import("./social/confirmar.js");
    if (p && await confirmar({ titulo: `Remover ${p.nome}?`, texto: `As respostas e os lugares marcados por ${p.nome} saem desta viagem.`, botao: "Remover" })) {
      removerParticipante(p.id); desenhar();
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
