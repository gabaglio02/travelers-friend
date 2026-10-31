/*
 * Identidades: além do perfil principal, cada conta pode ter personas temáticas
 * (figura histórica, animal, objeto, personagem original), cada uma com página própria.
 *   #/identidades              lista "Minhas identidades"
 *   #/identidades/nova         assistente: escolher o tipo → formulário (o mesmo do perfil)
 *   #/identidades/editar/<id>  editar uma persona
 */
import { rota, ir } from "../core/router.js";
import { esc } from "../core/util.js";
import { contaPronta, minhasIdentidades, identidadePorId, LIMITE_IDENTIDADES } from "../dados/perfis.js";
import { abrirEditor, mostrar, carregando, aviso, traduzir, avatarHtml, TIPOS, STATUS } from "./perfil.js";

// Verifica conta e perfil principal; devolve { conta, lista, principal } ou null (já mostrou o aviso).
async function preparar() {
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) { aviso("Identidades ainda não estão ativas", "As contas deste site ainda não foram ligadas ao banco de dados."); return null; }
  if (!conta.usuario()) { aviso("Minhas identidades", "Entre na sua conta para criar e gerenciar identidades.", `<button class="btn" data-pf="login">Entrar</button>`); return null; }
  const lista = await minhasIdentidades();
  const principal = lista.find((i) => i.tipo === "principal");
  if (!principal) {
    aviso("Primeiro, o seu perfil", "As identidades temáticas ficam ligadas ao seu perfil principal. Crie o seu perfil e depois volte aqui.", `<a class="btn" href="#/perfil">Criar meu perfil</a>`);
    return null;
  }
  return { conta, lista, principal };
}

function renderLista({ lista }) {
  const cheio = lista.length >= LIMITE_IDENTIDADES;
  mostrar(`
    <section class="idt">
      <div class="pf-form-head">
        <div><h1>Minhas identidades</h1>
          <p class="muted">Seu perfil e as personas que você criou — cada uma com página, tema e status próprios. ${lista.length} de ${LIMITE_IDENTIDADES}.</p></div>
        ${cheio ? `<span class="muted small-text">Limite de ${LIMITE_IDENTIDADES} atingido</span>` : `<a class="btn" href="#/identidades/nova">+ Nova identidade</a>`}
      </div>
      <ul class="idt-lista">
        ${lista.map((i) => {
          const t = TIPOS[i.tipo] || TIPOS.original;
          return `<li class="idt-card" style="--pf-cor:${esc((i.tema && i.tema.cor) || "#ffe14d")}">
            <span class="idt-faixa est-${esc((i.tema && i.tema.estampa) || "lisa")}"></span>
            ${avatarHtml(i, "md")}
            <div class="idt-info">
              <b>${esc(i.nome)}${i.tema && i.tema.emoticon ? " " + esc(i.tema.emoticon) : ""}</b>
              <span class="pf-apelido">@${esc(i.apelido)}</span>
              <span class="idt-tipo">${t.icone} ${t.nome}${i.status ? ` · <i class="dot st-${i.status}"></i> ${STATUS[i.status].nome}` : ""}</span>
              ${i.mensagem ? `<span class="idt-msg">${esc(i.mensagem)}</span>` : ""}
            </div>
            <div class="idt-acoes">
              <a class="btn ghost small" href="#/@${esc(i.apelido)}">Ver</a>
              <a class="btn small" href="${i.tipo === "principal" ? "#/perfil/editar" : "#/identidades/editar/" + esc(i.id)}">Editar</a>
            </div>
          </li>`;
        }).join("")}
      </ul>
      ${lista.length === 1 ? `<p class="idt-convite">Que tal criar uma persona? Um <b>Santos Dumont</b> que caça mirantes, o seu <b>cachorro</b> contando os passeios, uma <b>mala</b> com carimbos de viagem… ${cheio ? "" : `<a href="#/identidades/nova">Criar a primeira</a>.`}</p>` : ""}
    </section>`);
}

function renderTipos() {
  const tipos = Object.entries(TIPOS).filter(([k]) => k !== "principal");
  mostrar(`
    <section class="idt">
      <div class="pf-form-head">
        <div><h1>Nova identidade</h1><p class="muted">Passo 1 de 2 · Que tipo de personagem você quer criar?</p></div>
        <a class="btn ghost small" href="#/identidades">Voltar</a>
      </div>
      <div class="idt-tipos">
        ${tipos.map(([k, t]) => `<button class="idt-tipo-card" data-idt-tipo="${k}">
          <span class="idt-tipo-ico">${t.icone}</span>
          <b>${t.nome}</b>
          <span class="muted">${t.desc}</span>
          <span class="idt-exemplos">${t.emojis.slice(0, 5).join(" ")}</span>
        </button>`).join("")}
      </div>
      <p class="muted small-text">Perfis de figuras históricas recebem o selo "perfil temático — não é a conta oficial". Pessoas vivas e marcas não são permitidas.</p>
    </section>`);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("#socialView [data-idt-tipo]");
  if (!el) return;
  // Passo 2: o mesmo formulário do perfil, já preparado para o tipo escolhido.
  abrirEditor(null, { tipo: el.dataset.idtTipo });
});

rota("/identidades", async () => {
  try { const d = await preparar(); if (d) renderLista(d); }
  catch (err) { aviso("Não foi possível abrir as identidades", esc(traduzir(err))); }
});
rota("/identidades/nova", async () => {
  try {
    const d = await preparar();
    if (!d) return;
    if (d.lista.length >= LIMITE_IDENTIDADES) return aviso("Limite atingido", `Cada conta pode ter até ${LIMITE_IDENTIDADES} identidades.`, `<a class="btn" href="#/identidades">Voltar</a>`);
    renderTipos();
  } catch (err) { aviso("Não foi possível criar identidade", esc(traduzir(err))); }
});
rota("/identidades/editar/:id", async ({ id }) => {
  try {
    const d = await preparar();
    if (!d) return;
    const ident = await identidadePorId(id);
    if (!ident) return aviso("Identidade não encontrada", "Ela pode ter sido apagada.", `<a class="btn" href="#/identidades">Minhas identidades</a>`);
    if (ident.tipo === "principal") return ir("/perfil/editar");
    abrirEditor(ident);
  } catch (err) { aviso("Não foi possível abrir a identidade", esc(traduzir(err))); }
});
