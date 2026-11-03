/*
 * Sugestões personalizadas: questionário opcional de 8 perguntas (nota 0 a 5) que pesa as categorias na ordem do Explorar.
 *   Preferências = { notas: { museus: 0..5, ... }, puladas: ["noite", ...], ligado: true|false, atualizado: "2026-11-02" }
 *   - nota 0 é resposta ("nada a ver comigo"); pergunta pulada vai para "puladas"; sem nenhum dos dois = não respondida.
 *   - Com conta: ficam nos dados da conta (user_metadata.preferencias_sugestoes), então valem para todas as viagens,
 *     em qualquer aparelho, e as identidades extras usam as mesmas (são da pessoa, não do perfil).
 *   - Sem conta: só neste navegador (localStorage).
 * A oferta logo após o cadastro aparece uma vez só (user_metadata.sugestoes_oferta_vista).
 */
import { GOSTO } from "./core/constantes.js";
import { esc } from "./core/util.js";
import { contaPronta } from "./dados/perfis.js";

const CHAVE_LOCAL = "travelerfriend:sugestoes";
const vazio = () => ({ notas: {}, puladas: [], ligado: true });
const IDS = GOSTO.map((g) => g.id);

// Aceita só o que o questionário produz (dados antigos ou editados à mão não quebram a ordenação).
function normal(g) {
  const out = vazio();
  if (!g || typeof g !== "object") return out;
  for (const id of IDS) {
    const n = g.notas && g.notas[id];
    if (Number.isInteger(n) && n >= 0 && n <= 5) out.notas[id] = n;
    else if (Array.isArray(g.puladas) && g.puladas.includes(id)) out.puladas.push(id);
  }
  out.ligado = g.ligado !== false;
  if (typeof g.atualizado === "string") out.atualizado = g.atualizado.slice(0, 10);
  return out;
}
function lerLocal() {
  try { return normal(JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "null")); } catch (_) { return vazio(); }
}

let local = lerLocal();     // de quem está sem conta
let daConta = null;         // da conta logada (null = sem conta)
let conta = null;
const ouvintes = [];
const avisar = () => ouvintes.forEach((fn) => { try { fn(); } catch (err) { console.warn(err); } });

export const preferencias = () => daConta || local;
export const respondeu = () => Object.keys(preferencias().notas).length > 0;
export const ativa = () => preferencias().ligado && respondeu();
export const aoMudar = (fn) => ouvintes.push(fn);

// Peso do lugar na ordenação: -2,5 (nota 0) a +2,5 (nota 5); 0 = desligado, pulada ou sem resposta.
export function peso(categoria) {
  if (!ativa()) return 0;
  const g = GOSTO.find((x) => x.cats.includes(categoria));
  const n = g && preferencias().notas[g.id];
  return n == null ? 0 : n - 2.5;
}

async function salvar(novo) {
  const g = normal({ ...novo, atualizado: new Date().toLocaleDateString("sv-SE") }); // data local, AAAA-MM-DD
  const u = conta && conta.usuario();
  if (u) {
    const { error } = await conta.cliente().auth.updateUser({ data: { preferencias_sugestoes: g } });
    if (error) throw error;
    daConta = g;
  } else {
    local = g;
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(g)); } catch (_) { /* storage indisponível */ }
  }
  avisar();
}
const toast = (m) => window.TF && window.TF.toast(m);
export async function ligar(on) {
  try { await salvar({ ...preferencias(), ligado: !!on }); }
  catch (err) { console.warn("[sugestões]", err); toast("Não foi possível salvar agora. Tente de novo."); avisar(); }
}

// Conta: lê do servidor (getUser) para pegar o que foi salvo em outro aparelho, não a cópia da sessão guardada aqui.
async function carregarDaConta(u) {
  if (!u) { daConta = null; avisar(); return; }
  let md = u.user_metadata || {};
  try { const { data } = await conta.cliente().auth.getUser(); if (data && data.user) md = data.user.user_metadata || {}; } catch (_) { /* usa a da sessão */ }
  daConta = normal(md.preferencias_sugestoes);
  avisar();
}
contaPronta().then((c) => {
  conta = c;
  if (c.usuario()) carregarDaConta(c.usuario());
  c.aoMudarUsuario(carregarDaConta);
});

// ---------- Questionário (janela, uma pergunta por tela) ----------
// tela: "intro" → 0..7 (perguntas) → "fim". Respostas ficam num rascunho até o fim; fechar no meio não muda nada.
let q = null;
const NOTA_TXT = ["nada a ver comigo", "pouco", "mais ou menos", "gosto", "gosto muito", "adoro"];

export function abrirQuestionario({ intro = true, aoFechar } = {}) {
  if (q) return;
  const atual = preferencias();
  const d = document.createElement("dialog");
  d.className = "modal tf-quiz";
  d.setAttribute("aria-labelledby", "tfQuizTitulo");
  document.body.appendChild(d);
  q = { d, tela: intro ? "intro" : 0, notas: { ...atual.notas }, puladas: [...atual.puladas], aoFechar, salvando: false, erro: "" };
  d.addEventListener("click", cliqueQuiz);
  d.addEventListener("close", () => { const fn = q && q.aoFechar; d.remove(); q = null; if (fn) fn(); });
  d.showModal();
  desenhar(); // depois do showModal: o foco inicial só funciona com a janela aberta
}

function desenhar(dir = 0) {
  const { d, tela } = q;
  let corpo;
  if (tela === "intro") {
    corpo = `
      <p class="tf-quiz-lead">Quer personalizar suas sugestões? São apenas <b>8 perguntas rápidas</b> — leva menos de 5 minutos.</p>
      <p class="muted small-text">Para cada tipo de passeio, você dá uma nota de 0 a 5. As notas só mudam a <b>ordem</b> das sugestões:
        nada some da lista, e os eventos do dia continuam aparecendo primeiro. Dá para mudar ou desligar quando quiser.</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-quiz="comecar">Começar</button>
        <button type="button" class="btn ghost" data-quiz="agora-nao">Agora não</button>
      </div>`;
  } else if (tela === "fim") {
    const n = Object.keys(q.notas).length;
    corpo = `
      <p class="tf-quiz-lead">${n ? "Pronto! As sugestões agora seguem o seu gosto." : "Você pulou todas as perguntas, então as sugestões continuam na ordem padrão."}</p>
      ${n ? resumoHtml({ notas: q.notas, puladas: q.puladas }) : ""}
      <p class="muted small-text">Para mudar depois: Explorar → Filtros → ✨ Sugestões personalizadas${conta && conta.usuario() ? ", ou em Editar perfil" : ""}.</p>
      ${q.erro ? `<p class="warning">${esc(q.erro)}</p>` : ""}
      <div class="modal-actions">
        ${q.erro ? `<button type="button" class="btn" data-quiz="salvar">Tentar de novo</button>` : `<button type="button" class="btn" data-quiz="fechar">Ver sugestões</button>`}
        <button type="button" class="btn ghost" data-quiz="voltar">← Voltar</button>
      </div>`;
  } else {
    const g = GOSTO[tela], nota = q.notas[g.id];
    corpo = `
      <div class="tf-quiz-prog" aria-hidden="true"><span style="width:${((tela + 1) / GOSTO.length) * 100}%"></span></div>
      <p class="tf-quiz-num mono small-text">Pergunta ${tela + 1} de ${GOSTO.length}</p>
      <h4 class="tf-quiz-pergunta" id="tfQuizPergunta" tabindex="-1"><span aria-hidden="true">${g.icone}</span> ${esc(g.nome)}</h4>
      <p class="muted small-text">Quanto isso combina com você numa viagem?</p>
      <div class="tf-quiz-notas" role="group" aria-labelledby="tfQuizPergunta">
        ${[0, 1, 2, 3, 4, 5].map((v) => `<button type="button" data-nota="${v}" class="${nota === v ? "on" : ""}" aria-pressed="${nota === v}"
          aria-label="${v} — ${NOTA_TXT[v]}">${v}</button>`).join("")}
      </div>
      <div class="tf-quiz-legenda small-text muted" aria-hidden="true"><span>0 · nada a ver comigo</span><span>5 · adoro</span></div>
      <div class="tf-quiz-nav">
        <button type="button" class="btn ghost small" data-quiz="voltar" ${tela === 0 ? "disabled" : ""}>← Voltar</button>
        <button type="button" class="link" data-quiz="pular">Pular esta pergunta</button>
      </div>`;
  }
  d.innerHTML = `
    <div class="modal-head"><h3 id="tfQuizTitulo">✨ Sugestões personalizadas</h3>
      <button type="button" class="icon-btn" data-quiz="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-body tf-quiz-tela ${dir > 0 ? "entra-dir" : dir < 0 ? "entra-esq" : ""}">${corpo}</div>`;
  // Foco na nota já marcada ou no título da pergunta (focar o "0" faria parecer que ele já está escolhido).
  const foco = d.querySelector(".tf-quiz-notas button.on") || d.querySelector("#tfQuizPergunta, [data-quiz='comecar'], [data-quiz='fechar'].btn, [data-quiz='salvar']");
  if (foco) foco.focus();
}

// Passa de tela com uma transição curta (some → aparece); sem animação se a pessoa pediu menos movimento.
function irPara(tela, dir) {
  const corpo = q.d.querySelector(".tf-quiz-tela");
  const semMov = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!corpo || semMov) { q.tela = tela; desenhar(dir); return; }
  q.travado = true;
  corpo.classList.add(dir < 0 ? "sai-dir" : "sai-esq");
  setTimeout(() => { if (!q) return; q.travado = false; q.tela = tela; desenhar(dir); }, 160);
}

async function cliqueQuiz(e) {
  if (!q) return;
  if (e.target === q.d) return q.d.close();
  const b = e.target.closest("button");
  if (!b || b.disabled || q.travado) return;
  const tela = q.tela;
  if (b.dataset.nota != null) {
    const g = GOSTO[tela];
    q.notas[g.id] = +b.dataset.nota;
    q.puladas = q.puladas.filter((x) => x !== g.id);
    q.d.querySelectorAll(".tf-quiz-notas button").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    q.travado = true;
    // Uma pausa curta para a pessoa ver a nota marcada antes de passar.
    setTimeout(() => { if (!q) return; q.travado = false; avancar(); }, 220);
    return;
  }
  switch (b.dataset.quiz) {
    case "comecar": return irPara(0, 1);
    case "agora-nao": case "fechar": return q.d.close();
    case "voltar": return irPara(tela === "fim" ? GOSTO.length - 1 : Math.max(0, tela - 1), -1);
    case "pular": {
      const id = GOSTO[tela].id;
      delete q.notas[id];
      if (!q.puladas.includes(id)) q.puladas.push(id);
      return avancar();
    }
    case "salvar": return concluir();
  }
}
function avancar() {
  if (q.tela < GOSTO.length - 1) return irPara(q.tela + 1, 1);
  concluir();
}
async function concluir() {
  q.erro = "";
  try { await salvar({ notas: q.notas, puladas: q.puladas, ligado: true }); }
  catch (err) { console.warn("[sugestões]", err); q.erro = "Não foi possível salvar na sua conta agora (sem conexão?)."; }
  if (!q) return;
  q.tela === "fim" ? desenhar() : irPara("fim", 1);
}

// Notas por categoria (resultado do questionário e seção do perfil).
export function resumoHtml(g = preferencias()) {
  return `<ul class="tf-quiz-resumo">${GOSTO.map((x) => {
    const n = g.notas[x.id], pulou = g.puladas.includes(x.id);
    return `<li><span>${x.icone} ${esc(x.nome)}</span><b class="${n == null ? "muted" : ""}">${n != null ? n + " de 5" : pulou ? "pulada" : "sem resposta"}</b></li>`;
  }).join("")}</ul>`;
}

// ---------- Seção "Sugestões personalizadas" no editor do perfil (js/social/perfil.js) ----------
export function secaoPerfilHtml() {
  const g = preferencias();
  return `<section class="pf-bloco" id="pfSugestoes">${secaoPerfilCorpo(g)}</section>`;
}
function secaoPerfilCorpo(g) {
  return `
    <h3>✨ Sugestões personalizadas</h3>
    <p class="muted small-text">Suas notas de 0 a 5 mudam a ordem das sugestões no Explorar, em todas as viagens. Nada some da lista,
      e os eventos do dia continuam primeiro. Valem para a conta toda, inclusive as identidades extras.</p>
    ${respondeu() ? `
      ${resumoHtml(g)}
      <label class="check"><input type="checkbox" data-sug="ligar" ${g.ligado ? "checked" : ""}> Ordenar as sugestões pelo meu gosto</label>
      <div><button type="button" class="btn ghost small" data-sug="refazer">Refazer o questionário</button></div>`
    : `<p class="small-text">Você ainda não respondeu. São 8 perguntas rápidas.</p>
      <div><button type="button" class="btn small" data-sug="refazer">Responder agora</button></div>`}`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("#pfSugestoes [data-sug='refazer']");
  if (b) abrirQuestionario({ intro: false });
});
document.addEventListener("change", (e) => {
  if (e.target.matches("#pfSugestoes [data-sug='ligar']")) ligar(e.target.checked);
});
aoMudar(() => { const s = document.getElementById("pfSugestoes"); if (s) s.innerHTML = secaoPerfilCorpo(preferencias()); });

// ---------- Oferta logo após o cadastro (uma vez só) ----------
export async function oferecerAposCadastro() {
  if (!conta || !conta.usuario()) return;
  const md = conta.usuario().user_metadata || {};
  if (md.sugestoes_oferta_vista || respondeu()) return;
  // Marca antes de mostrar: "Agora não", fechar ou abandonar no meio contam como vista.
  conta.cliente().auth.updateUser({ data: { sugestoes_oferta_vista: true } }).catch(() => {});
  abrirQuestionario({ intro: true });
}
