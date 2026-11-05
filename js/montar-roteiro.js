/*
 * "✨ Montar roteiro": janela em três passos sobre o motor (js/roteiro-auto.js).
 *   Configurar (gostos, dias e ritmo) → Conflitos, se houver (o grupo decide, nada some em silêncio) → Prévia (Aplicar, Gerar outra opção).
 * Nada muda na viagem até tocar em Aplicar. Os motivos de cada escolha ficam só na prévia: não vão para a viagem salva.
 */
import { esc, fmtDay, money, toHHMM } from "./core/util.js";
import { gerarRoteiro, RITMOS } from "./roteiro-auto.js";
import * as gosto from "./gosto.js";

let ctx = null; // ver grupo de funções em js/app.js (montar.iniciar)
export function iniciar(opcoes) { ctx = opcoes; }

let d = null, m = null;
const nomesE = (l) => (l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]);

// De quem são os gostos: o grupo, se alguém respondeu; senão as notas pessoais (se ligadas); senão a ordem padrão.
function escolherGostos(grupo) {
  const resp = grupo.participantes.filter((p) => p.respondeu && Object.keys(p.notas).length);
  if (resp.length) return { fonte: "grupo", pessoas: resp.map((p) => ({ id: p.id, nome: p.nome, notas: p.notas })) };
  if (gosto.ativa()) return { fonte: "pessoal", pessoas: [{ id: "voce", nome: "Você", notas: gosto.preferencias().notas }] };
  return { fonte: "padrao", pessoas: [] };
}

// Limpa na hora, sem depender do evento "close" (que pode atrasar): assim a janela sempre abre de novo.
function limpar() { if (d) d.remove(); d = null; m = null; }
function fechar() { if (d) d.close(); limpar(); }

export async function abrir() {
  if (d && d.open) return;
  limpar();
  const grupo = await ctx.grupo(); // busca antes as notas das contas conectadas
  const dias = ctx.dias();
  m = { tela: "config", ritmo: "equilibrado", dias: new Set(dias), decisoes: {}, escolhas: {}, variacao: 0, grupo, gostos: escolherGostos(grupo), r: null, erro: "" };
  d = document.createElement("dialog");
  d.className = "modal tf-montar";
  d.setAttribute("aria-labelledby", "tfMontarTitulo");
  document.body.appendChild(d);
  d.addEventListener("click", clique);
  d.addEventListener("change", mudanca);
  const esta = d;
  d.addEventListener("close", () => { if (d === esta) limpar(); }); // Esc
  d.showModal();
  desenhar();
}

function gerar() {
  const dias = ctx.dias().filter((iso) => m.dias.has(iso));
  return gerarRoteiro({
    dias, atuais: ctx.atuais(dias), candidatos: ctx.candidatos(), gostos: m.gostos, indispensaveis: m.grupo.indispensaveis,
    ritmo: m.ritmo, decisoes: m.decisoes, variacao: m.variacao, combos: ctx.combos(), regras: ctx.regras()
  });
}
function executar() {
  m.r = gerar();
  m.escolhas = {};
  m.tela = m.r.pronta ? "previa" : "conflitos";
  desenhar();
}

function telaConfig() {
  const { grupo, gostos: g } = m;
  const falta = grupo.participantes.filter((p) => !p.respondeu && !p.indisponivel).map((p) => p.nome);
  const indisp = grupo.participantes.filter((p) => p.indisponivel).map((p) => p.nome);
  const fonte = g.fonte === "grupo" ? `<b>Notas do grupo:</b> ${esc(nomesE(g.pessoas.map((p) => p.nome)))}.`
    : g.fonte === "pessoal" ? "<b>Suas notas pessoais</b> (✨ Sugestões personalizadas)."
      : "<b>Ordem padrão do site:</b> ninguém respondeu ao questionário.";
  const n = grupo.indispensaveis.length;
  const todos = ctx.dias();
  return `
    <p class="small-text">${fonte}</p>
    ${falta.length && g.fonte === "grupo" ? `<p class="small-text muted">${esc(nomesE(falta))} ainda não ${falta.length > 1 ? "responderam e ficam" : "respondeu e fica"} de fora das notas.</p>` : ""}
    ${indisp.length ? `<p class="warning small-text">Sem internet: as notas de ${esc(nomesE(indisp))} (conta conectada) não entram.</p>` : ""}
    ${n ? `<p class="small-text">⭐ ${n} ${n === 1 ? "lugar que não pode faltar" : "lugares que não podem faltar"}.</p>` : ""}
    <div class="field"><span>Dias</span>
      <div class="nao-faltar-chips">${todos.map((iso, i) => { const on = m.dias.has(iso);
        return `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-montar-dia="${iso}">Dia ${i + 1} · ${esc(fmtDay(iso))}</button>`; }).join("")}</div></div>
    <div class="field"><span>Ritmo</span>
      <div class="seg" role="group" aria-label="Ritmo da viagem">${Object.entries(RITMOS).map(([k, r]) =>
        `<button type="button" class="${m.ritmo === k ? "on" : ""}" aria-pressed="${m.ritmo === k}" data-montar-ritmo="${k}">${esc(r.nome)}</button>`).join("")}</div>
      <p class="small-text muted montar-nota">${esc(RITMOS[m.ritmo].texto)}, sem contar refeições e trajetos.</p></div>
    <p class="small-text muted">O que já está no roteiro fica como está: só o tempo livre é preenchido. Cada dia começa no horário de "Começar às"; ajuste antes os dias de chegada e de partida.</p>
    <div class="modal-actions">
      <button type="button" class="btn" data-montar="gerar" ${m.dias.size ? "" : "disabled"}>Gerar roteiro</button>
      <button type="button" class="btn ghost" data-montar="fechar">Cancelar</button>
    </div>`;
}

function telaConflitos() {
  const cs = m.r.conflitos;
  const prontos = cs.every((c) => m.escolhas[c.lugarId] != null);
  return `
    <p class="small-text">Estes lugares não podem faltar, mas ${cs.length === 1 ? "um deles precisa" : "precisam"} de uma decisão. Nada sai do roteiro sem você escolher.</p>
    <div class="montar-conflitos">${cs.map((c) => `
      <fieldset class="montar-conflito">
        <legend><b>⭐ ${esc(c.nome)}</b> <span class="muted small-text">· marcado por ${esc(c.quem)}</span></legend>
        <p class="small-text">${esc(c.texto)}</p>
        ${c.opcoes.map((o, i) => o.acao === "datas"
          ? `<button type="button" class="link small-text" data-montar="datas">${esc(o.rotulo)}</button>`
          : `<label class="check"><input type="radio" name="c-${esc(c.lugarId)}" data-montar-conflito="${esc(c.lugarId)}" value="${i}" ${m.escolhas[c.lugarId] === i ? "checked" : ""}> ${esc(o.rotulo)}</label>`).join("")}
      </fieldset>`).join("")}</div>
    <div class="modal-actions">
      <button type="button" class="btn" data-montar="resolver" ${prontos ? "" : "disabled"}>Continuar</button>
      <button type="button" class="btn ghost" data-montar="config">← Voltar</button>
    </div>`;
}

function telaPrevia() {
  const r = m.r, dias = Object.keys(r.dias), todos = ctx.dias();
  const novos = dias.flatMap((iso) => r.dias[iso]).filter((i) => i.novo).length;
  const c = ctx.custos(r.dias);
  const lista = dias.map((iso) => {
    const s = ctx.detalhe(iso, r.dias[iso]);
    const motivos = Object.fromEntries(r.dias[iso].map((i) => [i.uid, i]));
    const linhas = s.entries.map((e) => {
      if (e.kind === "stop") {
        const it = motivos[e.row.item.uid] || {};
        return `<li class="${it.novo ? "novo" : "ja"}"><span class="mono montar-hora">${toHHMM(e.row.start)}</span>
          <div><b>${esc(e.row.place.nome)}</b> <span class="muted small-text">· ${esc(ctx.duracao(e.row.item.dur))}</span>
          <div class="small-text muted">${(it.motivos || []).map(esc).join(" · ")}</div>
          ${e.row.warnings.map((w) => `<div class="small-text warning">⚠ ${esc(w)}</div>`).join("")}</div></li>`;
      }
      if (e.kind === "meal") return `<li class="refeicao"><span class="mono montar-hora">${toHHMM(e.start)}</span><div class="small-text muted">${e.m.icon} ${esc(e.m.label)}</div></li>`;
      if (e.kind === "missed") return `<li class="refeicao"><span class="mono montar-hora"></span><div class="small-text warning">⚠ Sem ${esc(e.m.label.toLowerCase())}: ${esc(e.why)}</div></li>`;
      return "";
    }).join("");
    return `<section class="montar-dia"><h4>Dia ${todos.indexOf(iso) + 1} · ${esc(fmtDay(iso))}</h4>
      ${r.dias[iso].length ? `<ol>${linhas}</ol>` : `<p class="small-text muted">Nada coube neste dia.</p>`}</section>`;
  }).join("");
  const orc = c.orcamento, passou = orc && c.total > orc;
  return `
    ${!novos ? `<p class="warning small-text">Não coube nenhum lugar novo com este ritmo. Tente um ritmo mais puxado ou mais dias.</p>` : ""}
    ${lista}
    ${r.foraPorDecisao.length ? `<div class="small-text"><b>Deixados de fora por decisão do grupo:</b> ${esc(r.foraPorDecisao.map((x) => x.nome).join(", "))}.</div>` : ""}
    ${m.gostos.fonte === "grupo" && r.atendimento.length ? `<p class="small-text muted"><b>De que cada pessoa gosta aqui:</b> ${r.atendimento.map((a) => `${esc(a.nome)} ${a.lugares}`).join(" · ")}.</p>` : ""}
    <p class="small-text ${passou ? "warning" : "muted"}">Total previsto da viagem com este roteiro: ${money(c.total)}${orc ? ` · orçamento ${money(orc)}${passou ? " (passa do orçamento)" : ""}` : ""}.</p>
    <p class="small-text muted">Horários e preços de muitos lugares são estimados. Confirme antes de ir.</p>
    ${m.erro ? `<p class="warning" role="alert">${esc(m.erro)}</p>` : ""}
    <div class="modal-actions">
      <button type="button" class="btn" data-montar="aplicar" ${novos ? "" : "disabled"}>Aplicar ao roteiro</button>
      <button type="button" class="btn ghost" data-montar="outra">Gerar outra opção</button>
      <button type="button" class="btn ghost" data-montar="config">← Voltar</button>
    </div>`;
}

function desenhar() {
  if (!d) return;
  const corpo = m.tela === "conflitos" ? telaConflitos() : m.tela === "previa" ? telaPrevia() : telaConfig();
  const titulo = m.tela === "conflitos" ? "Decisões do grupo" : m.tela === "previa" ? "Prévia do roteiro" : "Montar roteiro";
  d.innerHTML = `
    <div class="modal-head"><h3 id="tfMontarTitulo">✨ ${titulo}</h3>
      <button type="button" class="icon-btn" data-montar="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-body">${corpo}</div>`;
  d.scrollTop = 0;
}

function clique(e) {
  if (e.target === d) return fechar();
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.montarDia) {
    const iso = b.dataset.montarDia;
    m.dias.has(iso) ? m.dias.delete(iso) : m.dias.add(iso);
    return desenhar();
  }
  if (b.dataset.montarRitmo) { m.ritmo = b.dataset.montarRitmo; return desenhar(); }
  switch (b.dataset.montar) {
    case "fechar": return fechar();
    case "config": m.tela = "config"; m.decisoes = {}; m.erro = ""; return desenhar();
    case "gerar": m.variacao = 0; m.decisoes = {}; return executar();
    case "outra": m.variacao++; return executar();
    case "datas": fechar(); return ctx.abrirDatas();
    case "resolver":
      m.r.conflitos.forEach((c) => Object.assign(m.decisoes, c.opcoes[m.escolhas[c.lugarId]].decisoes));
      return executar();
    case "aplicar":
      if (ctx.aplicar(m.r.dias)) return fechar();
      m.erro = "O roteiro mudou enquanto esta janela estava aberta. Gere de novo.";
      return desenhar();
  }
}
function mudanca(e) {
  const id = e.target.dataset.montarConflito;
  if (id == null) return;
  m.escolhas[id] = +e.target.value;
  const b = d.querySelector('[data-montar="resolver"]');
  if (b) b.disabled = !m.r.conflitos.every((c) => m.escolhas[c.lugarId] != null);
}
