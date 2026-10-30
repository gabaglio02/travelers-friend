/*
 * Mural de lembranças: álbuns e recados no perfil, página do álbum, editor de lembrança,
 * botões de amizade/bloqueio e denúncia.
 *   #/@apelido                 (perfil.js desenha; aqui entram álbuns, recados e botões — evento "tf:perfil")
 *   #/@apelido/album/<id>      página do álbum com fotos
 *   #/lembrancas/nova          nova lembrança (também a partir do roteiro: "Virar lembrança")
 *   #/lembrancas/editar/<id>   editar lembrança
 */
import { rota, ir } from "../core/router.js";
import { esc } from "../core/util.js";
import { contaPronta, minhasIdentidades, meusVisitados, adicionarVisitado } from "../dados/perfis.js";
import * as M from "../dados/mural.js";
import { mostrar, carregando, aviso, traduzir, avatarHtml, CORES } from "./perfil.js";
import { atualizarAvisoAmigos } from "./amigos.js";

const toast = (m) => window.TF && window.TF.toast(m);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PREFILL = "travelerfriend:lembranca";
const corDe = (i) => (i && i.tema && CORES.some((c) => c.v === i.tema.cor) ? i.tema.cor : "#ffe14d");
const catalogo = () => ((window.TF_CITIES || {}).sp || {}).lugares || [];

// "2026-10-01","2026-10-05" → "1–5 out 2026"
export function periodo(a, b) {
  if (!a) return "";
  const d = (iso) => ({ d: +iso.slice(8, 10), m: MESES[+iso.slice(5, 7) - 1], y: iso.slice(0, 4) });
  const x = d(a);
  if (!b || b === a) return `${x.d} ${x.m} ${x.y}`;
  const y = d(b);
  if (x.y === y.y && x.m === y.m) return `${x.d}–${y.d} ${x.m} ${x.y}`;
  if (x.y === y.y) return `${x.d} ${x.m} – ${y.d} ${y.m} ${x.y}`;
  return `${x.d} ${x.m} ${x.y} – ${y.d} ${y.m} ${y.y}`;
}
function quando(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  if (min < 48 * 60) return "ontem";
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`;
}
const seloVis = (v) => `<span class="mu-vis mu-vis-${esc(v)}">${{ publico: "🌎", amigos: "👥", privado: "🔒" }[v] || ""} ${esc(M.VISIBILIDADES[v] || v)}</span>`;

// =====================================================================
// No perfil: álbuns, recados e relação (amizade, bloqueio, denúncia)
// =====================================================================
let perfilAtual = null;

document.addEventListener("tf:perfil", (e) => {
  perfilAtual = e.detail;
  preencherPerfil(e.detail).catch((err) => console.warn("[mural]", err));
});

async function preencherPerfil(p) {
  const conta = await contaPronta();
  const logado = !!conta.usuario(), dono = p.relacao === "dono";
  let erro = null;
  const [albuns, mu, amz] = await Promise.all([
    M.albunsDe(p.id).catch((err) => { erro = err; return []; }),
    M.mural(p.id).catch((err) => { erro = err; return null; }),
    logado && !dono ? M.amizadeCom(p.id).catch(() => null) : null
  ]);
  if (perfilAtual !== p || !document.getElementById("muMural")) return; // já mudou de página
  renderRelacao(p, logado, amz);
  renderMural(p, albuns, mu, logado, erro);
  // Capas dos álbuns (links temporários do bucket privado).
  const urls = await M.urlsDe(albuns.map((a) => a.capa)).catch(() => ({}));
  document.querySelectorAll("#muMural img[data-caminho]").forEach((img) => { if (urls[img.dataset.caminho]) img.src = urls[img.dataset.caminho]; });
}

function renderRelacao(p, logado, amz) {
  const el = document.getElementById("muRelacao");
  if (!el) return;
  const menu = (itens) => `<details class="mu-menu"><summary class="btn ghost small" aria-label="Mais opções">⋯</summary><div>${itens}</div></details>`;
  if (!logado) {
    el.innerHTML = `<button class="btn small" data-pf="login">Adicionar amigo</button>`;
    return;
  }
  let principal = `<button class="btn small" data-mu="pedir">Adicionar amigo</button>`;
  let extra = "";
  if (amz && amz.estado === "aceita") {
    principal = `<span class="mu-amigo-ok" title="Amizade com @${esc(amz.minha_apelido)}">✓ Amigos</span>`;
    extra = `<button data-mu="desfazer" data-de="${esc(amz.enviado ? amz.minha : p.id)}" data-para="${esc(amz.enviado ? p.id : amz.minha)}" data-confirma="Desfazer a amizade com @${esc(p.apelido)}?">Desfazer amizade</button>`;
  } else if (amz && amz.enviado) {
    principal = `<button class="btn ghost small" data-mu="desfazer" data-de="${esc(amz.minha)}" data-para="${esc(p.id)}">Pedido enviado · cancelar</button>`;
  } else if (amz) {
    principal = `<button class="btn small" data-mu="aceitar" data-de="${esc(p.id)}" data-para="${esc(amz.minha)}">Aceitar pedido</button>
      <button class="btn ghost small" data-mu="desfazer" data-de="${esc(p.id)}" data-para="${esc(amz.minha)}">Recusar</button>`;
  }
  el.innerHTML = principal + menu(`${extra}
    <button data-mu="denunciar" data-tipo="identidade" data-id="${esc(p.id)}" data-nome="@${esc(p.apelido)}">Denunciar perfil</button>
    <button data-mu="bloquear" class="perigo">Bloquear</button>`);
}

function renderMural(p, albuns, mu, logado, erro) {
  const dono = p.relacao === "dono";
  const box = document.getElementById("muMural");
  const cards = albuns.map((a) => `
    <li><a class="mu-card" href="#/@${esc(p.apelido)}/album/${esc(a.id)}">
      <span class="mu-capa">${a.capa ? `<img data-caminho="${esc(a.capa)}" alt="">` : `<span aria-hidden="true">📷</span>`}</span>
      <b>${esc(a.titulo)}</b>
      <span class="muted small-text">${[a.local && "📍 " + esc(a.local), esc(periodo(a.data_inicio, a.data_fim)), `${a.fotos} foto${a.fotos === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span>
      ${dono ? seloVis(a.visibilidade) : ""}
    </a></li>`).join("");
  const nova = dono ? `<button class="btn small" data-mu="nova" data-ident="${esc(p.id)}">+ Nova lembrança</button>` : "";
  const avisoBanco = dono && erro ? `<p class="pf-erro">${esc(traduzir(erro))}</p>` : "";

  let recados = "";
  if (mu) {
    const podeEscrever = mu.autores && mu.autores.length;
    const form = podeEscrever ? `
      <form class="mu-recado-form" id="muRecadoForm">
        <textarea name="texto" maxlength="500" rows="2" required placeholder="Deixe um recado para ${esc(p.nome)}…"></textarea>
        <div class="pf-linha">
          ${mu.autores.length > 1 ? `<label class="small-text">Assinar como <select name="autor">${mu.autores.map((a) => `<option value="${esc(a.id)}">@${esc(a.apelido)}</option>`).join("")}</select></label>`
            : `<input type="hidden" name="autor" value="${esc(mu.autores[0].id)}">`}
          <button class="btn small" type="submit">Enviar recado</button>
        </div>
      </form>` : "";
    const nota = dono
      ? (mu.nivel === "privado" ? `<p class="muted small-text">Seu mural está desligado. <a href="${p.tipo === "principal" ? "#/perfil/editar" : "#/identidades/editar/" + esc(p.id)}">Ligar em Privacidade</a>.</p>`
        : `<p class="muted small-text">Só amigos escrevem aqui. Quem lê: ${esc(M.VISIBILIDADES[mu.nivel] || mu.nivel).toLowerCase()}.</p>`)
      : (!podeEscrever && logado && mu.nivel !== "privado" && p.relacao !== "bloqueado" ? `<p class="muted small-text">Só amigos de @${esc(p.apelido)} podem deixar recados.</p>` : "");
    const lista = !mu.visivel
      ? `<p class="muted">${mu.nivel === "privado" ? "Este mural está fechado." : "Os recados são visíveis só para amigos."}</p>`
      : mu.recados.length
        ? `<ol class="mu-recados">${mu.recados.map((r) => `<li>
            <a href="#/@${esc(r.autor.apelido)}" class="mu-recado-av">${avatarHtml(r.autor, "sm")}</a>
            <div><p class="mu-recado-quem"><a href="#/@${esc(r.autor.apelido)}">${esc(r.autor.nome)}</a> <time class="muted" datetime="${esc(r.criado_em)}">${esc(quando(r.criado_em))}</time></p>
            <p class="mu-recado-txt">${esc(r.texto)}</p>
            <p class="mu-recado-acoes">
              ${r.pode_apagar ? `<button class="link" data-mu="apagar-recado" data-id="${esc(r.id)}">apagar</button>` : ""}
              ${logado && (dono || !r.pode_apagar) ? `<button class="link" data-mu="denunciar" data-tipo="recado" data-id="${esc(r.id)}" data-nome="este recado">denunciar</button>` : ""}
            </p></div></li>`).join("")}</ol>`
        : `<p class="muted">${dono ? "Nenhum recado ainda. Quando seus amigos escreverem, aparece aqui." : "Nenhum recado ainda."}</p>`;
    recados = `<section class="pf-sec mu-sec">
      <div class="mu-sec-head"><h3>Recados <small>${mu.visivel ? mu.recados.length : ""}</small></h3></div>
      ${nota}${form}${lista}</section>`;
  }

  box.innerHTML = `
    <section class="pf-sec mu-sec">
      <div class="mu-sec-head"><h3>Lembranças <small>${albuns.length}</small></h3>${nova}</div>
      ${avisoBanco}
      ${albuns.length ? `<ul class="mu-cards">${cards}</ul>`
        : `<p class="muted">${dono ? "Crie um álbum com fotos, lugares e datas — ou transforme um roteiro em lembrança pelo botão \"📸 Virar lembrança\" no planejamento." : "Nenhuma lembrança visível."}</p>`}
    </section>
    ${recados}`;
}

// =====================================================================
// Página do álbum
// =====================================================================
let album = null;        // album_detalhe
let urlsMini = {};       // miniatura → url
let importando = null;   // fotos sem álbum (quando o painel "Minhas fotos" está aberto)
let enviando = "";

rota("/@:apelido/album/:id", async ({ apelido, id }) => {
  perfilAtual = null;
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return aviso("Álbuns ainda não estão ativos", "As contas deste site ainda não foram ligadas ao banco de dados.");
  try {
    const a = await M.albumDetalhe(id);
    if (!a) return aviso("Álbum não encontrado", "Ele pode ser visível só para amigos, ou ter sido apagado.", `<a class="btn" href="#/@${esc(apelido)}">Ver perfil</a>`);
    if (a.identidade.apelido.toLowerCase() !== apelido.toLowerCase()) { history.replaceState(null, "", `#/@${a.identidade.apelido}/album/${a.id}`); }
    album = a; importando = null; enviando = "";
    urlsMini = await M.urlsDe(a.fotos.map((f) => f.miniatura));
    renderAlbum();
  } catch (err) { aviso("Não foi possível abrir o álbum", esc(traduzir(err))); }
});
async function recarregarAlbum() {
  const a = await M.albumDetalhe(album.id);
  if (!a) return ir("/@" + album.identidade.apelido);
  album = a;
  urlsMini = await M.urlsDe(a.fotos.map((f) => f.miniatura));
  renderAlbum(true);
}

function renderAlbum(manterRolagem = false) {
  const a = album, i = a.identidade;
  const logado = !!(window.TFConta && window.TFConta.usuario());
  const info = [a.local && "📍 " + esc(a.local), esc(periodo(a.data_inicio, a.data_fim)), `${a.fotos.length} foto${a.fotos.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
  const lugares = (a.lugares || []).filter((l) => l && l.nome);
  const naCidade = (id) => catalogo().some((c) => c.id === id);
  mostrar(`
    <article class="mu-album" style="--pf-cor:${corDe(i)}">
      <a class="mu-voltar" href="#/@${esc(i.apelido)}">${avatarHtml(i, "sm")}<span>← ${esc(i.nome)}</span></a>
      <header class="mu-album-head">
        <div>
          <h1>${esc(a.titulo)}</h1>
          <p class="muted">${info}${a.dono ? " · " + seloVis(a.visibilidade) : ""}</p>
        </div>
        <div class="pf-acoes">
          ${a.dono ? `
            <label class="btn small">+ Fotos<input type="file" accept="image/*" multiple data-mu-up hidden></label>
            <button class="btn ghost small" data-mu="importar">Das minhas fotos</button>
            <a class="btn ghost small" href="#/lembrancas/editar/${esc(a.id)}">Editar</a>`
          : logado ? `<button class="btn ghost small" data-mu="denunciar" data-tipo="album" data-id="${esc(a.id)}" data-nome="este álbum">Denunciar</button>` : ""}
        </div>
      </header>
      ${a.descricao ? `<p class="mu-desc">${esc(a.descricao)}</p>` : ""}
      ${lugares.length ? `<ul class="pf-chips mu-lugares">${lugares.map((l) => `<li>${l.id && naCidade(l.id) ? `<button class="link" data-pf="lugar" data-id="${esc(l.id)}">${esc(l.nome)}</button>` : esc(l.nome)}</li>`).join("")}</ul>` : ""}
      ${enviando ? `<p class="mu-progresso" role="status">${esc(enviando)}</p>` : ""}
      ${importando ? renderImportar() : ""}
      ${a.fotos.length ? `<ul class="mu-fotos">${a.fotos.map((f, n) => `<li><button class="mu-foto" data-mu="ver" data-i="${n}" aria-label="Abrir foto ${n + 1}${f.legenda ? ": " + esc(f.legenda) : ""}">
          ${urlsMini[f.miniatura] ? `<img src="${esc(urlsMini[f.miniatura])}" alt="${esc(f.legenda || "")}" loading="lazy">` : ""}
          ${a.capa_foto === f.id ? `<span class="mu-capa-tag">capa</span>` : ""}</button></li>`).join("")}</ul>`
        : `<div class="pf-vazio"><p class="muted">${a.dono ? "Este álbum ainda não tem fotos. Use \"+ Fotos\" (elas são reduzidas e perdem a localização GPS antes do envio) ou traga fotos que você já enviou." : "Sem fotos ainda."}</p></div>`}
    </article>`, manterRolagem);
}

function renderImportar() {
  if (!importando.length) return `<div class="pf-bloco mu-importar"><p class="muted">Você não tem fotos fora de álbuns. <button class="link" data-mu="importar-fechar">fechar</button></p></div>`;
  return `<form class="pf-bloco mu-importar" id="muImportar">
    <h3>Minhas fotos fora de álbuns</h3>
    <ul class="mu-fotos mini">${importando.map((f) => `<li><label class="mu-foto-sel"><input type="checkbox" name="foto" value="${esc(f.id)}">
      ${f.url ? `<img src="${esc(f.url)}" alt="${esc(f.legenda || "")}">` : ""}</label></li>`).join("")}</ul>
    <div class="pf-linha"><button class="btn small" type="submit">Colocar no álbum</button><button type="button" class="btn ghost small" data-mu="importar-fechar">Cancelar</button></div>
  </form>`;
}

// ---------- Visualizador de fotos ----------
let lbIndice = 0;
function lightbox() {
  let d = document.getElementById("muLightbox");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "muLightbox";
    d.className = "mu-lightbox";
    d.setAttribute("aria-label", "Foto");
    document.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); else acaoLightbox(e); });
    d.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); verFoto(lbIndice + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); verFoto(lbIndice - 1); }
    });
  }
  return d;
}
async function verFoto(n) {
  const fotos = album.fotos;
  if (!fotos.length) return;
  lbIndice = (n + fotos.length) % fotos.length;
  const f = fotos[lbIndice], d = lightbox();
  const logado = !!(window.TFConta && window.TFConta.usuario());
  const meta = [f.tirada_em && esc(periodo(f.tirada_em)), f.local && "📍 " + esc(f.local)].filter(Boolean).join(" · ");
  d.innerHTML = `
    <div class="mu-lb-top"><span class="mono small-text">${lbIndice + 1} / ${fotos.length}</span><button class="icon-btn" data-lb="fechar" aria-label="Fechar">×</button></div>
    <figure><img src="${esc(urlsMini[f.miniatura] || "")}" alt="${esc(f.legenda || "")}" id="muLbImg">
      <figcaption>${f.legenda ? esc(f.legenda) : ""}${meta ? `<span class="muted">${meta}</span>` : ""}</figcaption></figure>
    ${fotos.length > 1 ? `<button class="mu-lb-nav ant" data-lb="ant" aria-label="Foto anterior">‹</button><button class="mu-lb-nav prox" data-lb="prox" aria-label="Próxima foto">›</button>` : ""}
    <div class="mu-lb-acoes">
      ${album.dono ? `
        <form class="mu-lb-form" id="muLbForm">
          <input name="legenda" maxlength="200" placeholder="Legenda" value="${esc(f.legenda || "")}">
          <input name="tirada_em" type="date" value="${esc(f.tirada_em || "")}" aria-label="Data da foto">
          <input name="local" maxlength="120" placeholder="Local" value="${esc(f.local || "")}">
          <button class="btn small" type="submit">Salvar</button>
        </form>
        <div class="pf-linha">
          ${album.capa_foto === f.id ? `<span class="muted small-text">É a capa do álbum</span>` : `<button class="btn ghost small" data-lb="capa">Usar como capa</button>`}
          <button class="btn ghost small" data-lb="tirar">Tirar do álbum</button>
          <button class="btn ghost small perigo" data-lb="apagar">Apagar foto</button>
        </div>`
      : logado ? `<button class="link" data-lb="denunciar">Denunciar foto</button>` : ""}
    </div>`;
  if (!d.open) d.showModal();
  // Troca a miniatura pela foto grande.
  const urls = await M.urlsDe([f.caminho]).catch(() => ({}));
  const img = document.getElementById("muLbImg");
  if (img && urls[f.caminho] && album.fotos[lbIndice] === f) img.src = urls[f.caminho];
}
async function acaoLightbox(e) {
  const el = e.target.closest("[data-lb]");
  if (!el) return;
  const d = lightbox(), f = album.fotos[lbIndice];
  try {
    switch (el.dataset.lb) {
      case "fechar": return d.close();
      case "ant": return verFoto(lbIndice - 1);
      case "prox": return verFoto(lbIndice + 1);
      case "denunciar": d.close(); return abrirDenuncia("foto", f.id, "esta foto");
      case "capa": await M.salvarAlbum({ id: album.id, capa_foto: f.id }); toast("Capa do álbum trocada"); break;
      case "tirar": await M.editarFoto(f.id, { album_id: null }); toast("Foto tirada do álbum (continua em Minhas fotos)"); d.close(); break;
      case "apagar":
        if (!confirm("Apagar esta foto para sempre?")) return;
        await M.apagarFoto(f); toast("Foto apagada"); d.close(); break;
      default: return;
    }
    await recarregarAlbum();
    if (d.open) verFoto(lbIndice);
  } catch (err) { toast(traduzir(err)); }
}
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "muLbForm") return;
  e.preventDefault();
  const f = album.fotos[lbIndice], fd = new FormData(e.target);
  try {
    await M.editarFoto(f.id, { legenda: fd.get("legenda").trim() || null, tirada_em: fd.get("tirada_em") || null, local: fd.get("local").trim() || null });
    toast("Foto atualizada");
    await recarregarAlbum();
    verFoto(lbIndice);
  } catch (err) { toast(traduzir(err)); }
});

// =====================================================================
// Editor de lembrança (álbum)
// =====================================================================
let lb = null; // rascunho

async function abrirEditorAlbum(existente, prefill = {}) {
  const ids = await minhasIdentidades();
  if (!ids.length) return aviso("Primeiro, o seu perfil", "As lembranças ficam no seu perfil. Crie o seu perfil e depois volte aqui.", `<a class="btn" href="#/perfil">Criar meu perfil</a>`);
  const base = existente || {};
  lb = {
    id: base.id || null,
    identidade_id: base.identidade_id || (ids.some((i) => i.id === prefill.identidade_id) ? prefill.identidade_id : ids[0].id),
    titulo: base.titulo || prefill.titulo || "",
    local: base.local || prefill.local || "",
    data_inicio: base.data_inicio || prefill.data_inicio || "",
    data_fim: base.data_fim || prefill.data_fim || "",
    descricao: base.descricao || prefill.descricao || "",
    lugares: JSON.parse(JSON.stringify(base.lugares || prefill.lugares || [])),
    visibilidade: base.visibilidade || "amigos",
    viagem_id: base.viagem_id || prefill.viagem_id || null,
    datas: prefill.datas || {},             // lugar → dia do roteiro (para "lugares visitados")
    deRoteiro: !existente && !!prefill.deRoteiro,
    marcarVisitados: !existente && !!prefill.deRoteiro,
    identidades: ids, confirmandoApagar: false, apagarFotos: false, erro: ""
  };
  renderEditorAlbum();
}

function lerAlbum() {
  const f = document.getElementById("lbForm");
  if (!f) return;
  ["identidade_id", "titulo", "local", "data_inicio", "data_fim", "descricao", "visibilidade"].forEach((k) => {
    if (f.elements[k]) lb[k] = f.elements[k].value.trim ? f.elements[k].value.trim() : f.elements[k].value;
  });
  if (f.elements.marcarVisitados) lb.marcarVisitados = f.elements.marcarVisitados.checked;
  if (f.elements.apagarFotos) lb.apagarFotos = f.elements.apagarFotos.checked;
}

function renderEditorAlbum() {
  const ident = lb.identidades.find((i) => i.id === lb.identidade_id) || lb.identidades[0];
  const maior = !!ident.maior_de_idade;
  if (lb.visibilidade === "publico" && !maior) lb.visibilidade = "amigos";
  const voltar = lb.id ? `#/@${esc(ident.apelido)}/album/${esc(lb.id)}` : `#/@${esc(ident.apelido)}`;
  const opcoesCat = catalogo().map((p) => `<option value="${esc(p.nome)}"></option>`).join("");
  mostrar(`
    <form class="pf-form lb-form" id="lbForm" novalidate>
      <div class="pf-form-head">
        <div><h1>${lb.id ? "Editar lembrança" : "Nova lembrança"}</h1>
          <p class="muted">${lb.deRoteiro ? "Criada a partir do seu roteiro — revise e salve." : "Um álbum com fotos, lugares e datas da viagem."}</p></div>
        <a class="btn ghost small" href="${voltar}">Voltar</a>
      </div>
      ${lb.erro ? `<p class="pf-erro" role="alert">${esc(lb.erro)}</p>` : ""}

      <section class="pf-bloco">
        <h3>Sobre a lembrança</h3>
        <div class="pf-campos">
          ${lb.identidades.length > 1 ? `<label class="field"><span>No perfil de</span><select name="identidade_id" ${lb.id ? "disabled" : ""}>
            ${lb.identidades.map((i) => `<option value="${esc(i.id)}" ${i.id === lb.identidade_id ? "selected" : ""}>${esc(i.nome)} (@${esc(i.apelido)})</option>`).join("")}</select></label>` : ""}
          <label class="field ${lb.identidades.length > 1 ? "" : "pf-wide"}"><span>Título</span><input name="titulo" maxlength="80" required value="${esc(lb.titulo)}" placeholder="Ex.: Fim de semana em SP"></label>
          <label class="field"><span>Local</span><input name="local" maxlength="120" value="${esc(lb.local)}" placeholder="Ex.: São Paulo"></label>
          <label class="field"><span>De</span><input name="data_inicio" type="date" value="${esc(lb.data_inicio)}"></label>
          <label class="field"><span>Até</span><input name="data_fim" type="date" value="${esc(lb.data_fim)}"></label>
          <label class="field pf-wide"><span>Descrição</span><textarea name="descricao" maxlength="1000" rows="4" placeholder="O que fez essa viagem especial?">${esc(lb.descricao)}</textarea></label>
        </div>
      </section>

      <section class="pf-bloco">
        <h3>Lugares <small class="muted">${lb.lugares.length}/40</small></h3>
        <ul class="pf-chips editavel">${lb.lugares.map((l, n) => `<li>${esc(l.nome)} <button type="button" data-mu="tirar-lugar" data-i="${n}" aria-label="Remover ${esc(l.nome)}">×</button></li>`).join("")}</ul>
        <div class="pf-linha">
          <input id="lbNovoLugar" list="lbCatalogo" maxlength="120" placeholder="Escolha da lista ou escreva" ${lb.lugares.length >= 40 ? "disabled" : ""}>
          <datalist id="lbCatalogo">${opcoesCat}</datalist>
          <button type="button" class="btn ghost small" data-mu="add-lugar">Adicionar</button>
        </div>
        ${lb.deRoteiro ? `<label class="check pf-declara"><input type="checkbox" name="marcarVisitados" ${lb.marcarVisitados ? "checked" : ""}> Marcar também como "lugares visitados" no perfil</label>` : ""}
      </section>

      <section class="pf-bloco">
        <h3>Quem vê</h3>
        <div class="lb-vis">${Object.entries(M.VISIBILIDADES).map(([k, n]) => `<label class="lb-vis-op ${lb.visibilidade === k ? "on" : ""} ${k === "publico" && !maior ? "off" : ""}">
          <input type="radio" name="visibilidade" value="${k}" ${lb.visibilidade === k ? "checked" : ""} ${k === "publico" && !maior ? "disabled" : ""}>
          <b>${{ publico: "🌎", amigos: "👥", privado: "🔒" }[k]} ${n}</b>
          <span class="muted small-text">${{ publico: "Qualquer pessoa com o link do perfil.", amigos: "Só quem é seu amigo.", privado: "Só você." }[k]}</span></label>`).join("")}</div>
        ${maior ? "" : `<p class="muted small-text">"Público" exige confirmar 18 anos ou mais no perfil.</p>`}
        <p class="muted small-text">As fotos seguem a visibilidade do álbum e são abertas por links temporários.</p>
      </section>

      ${lb.id ? `
      <section class="pf-bloco pf-perigo">
        <h3>Apagar lembrança</h3>
        ${lb.confirmandoApagar ? `
          <label class="check"><input type="checkbox" name="apagarFotos" ${lb.apagarFotos ? "checked" : ""}> Apagar também as fotos (senão, elas voltam para "Minhas fotos")</label>
          <div class="pf-linha"><button type="button" class="btn danger small" data-mu="apagar-album">Apagar álbum</button>
            <button type="button" class="btn ghost small" data-mu="apagar-cancelar">Cancelar</button></div>`
          : `<button type="button" class="btn ghost small" data-mu="apagar-pedir">Apagar este álbum…</button>`}
      </section>` : ""}

      <div class="pf-form-foot"><button class="btn" type="submit">${lb.id ? "Salvar" : "Criar lembrança"}</button></div>
    </form>`, true);
}

async function salvarAlbumForm() {
  lerAlbum();
  lb.erro = "";
  if (!lb.titulo) lb.erro = "Dê um título para a lembrança.";
  else if (lb.data_inicio && lb.data_fim && lb.data_fim < lb.data_inicio) lb.erro = "A data final é antes da inicial.";
  if (lb.erro) { renderEditorAlbum(); return document.querySelector(".pf-erro")?.scrollIntoView({ block: "center" }); }
  const btn = document.querySelector("#lbForm button[type=submit]");
  const rotulo = btn.textContent;
  btn.disabled = true; btn.textContent = "Salvando…";
  try {
    const salvo = await M.salvarAlbum({
      id: lb.id || undefined, identidade_id: lb.identidade_id, titulo: lb.titulo, local: lb.local || null,
      data_inicio: lb.data_inicio || null, data_fim: lb.data_fim || null, descricao: lb.descricao || null,
      lugares: lb.lugares, visibilidade: lb.visibilidade, viagem_id: lb.viagem_id || null
    });
    if (lb.marcarVisitados && lb.lugares.length) {
      const ja = new Set((await meusVisitados(lb.identidade_id)).map((v) => v.lugar_id || v.nome));
      for (const l of lb.lugares) {
        if (ja.has(l.id || l.nome)) continue;
        const p = catalogo().find((c) => c.id === l.id);
        await adicionarVisitado(lb.identidade_id, { lugar_id: l.id || null, nome: l.nome, cidade: lb.local || null, lat: p ? p.lat : null, lng: p ? p.lng : null, data: lb.datas[l.id] || lb.data_inicio || null });
      }
    }
    try { sessionStorage.removeItem(PREFILL); } catch (_) { /* ignora */ }
    const ident = lb.identidades.find((i) => i.id === salvo.identidade_id);
    toast(lb.id ? "Lembrança salva" : "Lembrança criada!");
    lb = null;
    ir(`/@${ident.apelido}/album/${salvo.id}`);
  } catch (err) {
    lb.erro = traduzir(err);
    renderEditorAlbum();
  } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = rotulo; } }
}

function addLugar() {
  const inp = document.getElementById("lbNovoLugar");
  const nome = inp.value.trim();
  if (!nome) return;
  lerAlbum();
  const p = catalogo().find((c) => c.nome.toLowerCase() === nome.toLowerCase());
  const novo = p ? { id: p.id, nome: p.nome } : { nome: nome.slice(0, 120) };
  if (!lb.lugares.some((l) => (l.id && l.id === novo.id) || l.nome.toLowerCase() === novo.nome.toLowerCase())) lb.lugares.push(novo);
  renderEditorAlbum();
  document.getElementById("lbNovoLugar").focus();
}

async function preparar(titulo) {
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) { aviso("Lembranças ainda não estão ativas", "As contas deste site ainda não foram ligadas ao banco de dados."); return null; }
  if (!conta.usuario()) { aviso(titulo, "Entre na sua conta para criar lembranças.", `<button class="btn" data-pf="login">Entrar</button>`); return null; }
  return conta;
}
rota("/lembrancas/nova", async () => {
  perfilAtual = null;
  if (!(await preparar("Nova lembrança"))) return;
  let prefill = {};
  try { prefill = JSON.parse(sessionStorage.getItem(PREFILL) || "{}"); } catch (_) { /* ignora */ }
  try { await abrirEditorAlbum(null, prefill); } catch (err) { aviso("Não foi possível abrir o editor", esc(traduzir(err))); }
});
rota("/lembrancas/editar/:id", async ({ id }) => {
  perfilAtual = null;
  if (!(await preparar("Editar lembrança"))) return;
  try {
    const a = await M.meuAlbum(id);
    if (!a) return aviso("Lembrança não encontrada", "Ela pode ter sido apagada.", `<a class="btn" href="#/perfil">Meu perfil</a>`);
    await abrirEditorAlbum(a);
  } catch (err) { aviso("Não foi possível abrir a lembrança", esc(traduzir(err))); }
});

// "📸 Virar lembrança" no roteiro: leva os lugares e datas da viagem para o editor.
document.addEventListener("click", (e) => {
  if (!e.target.closest("#toMemory")) return;
  const r = window.TF.lembranca();
  if (!r.lugares.length) return toast("Adicione lugares ao roteiro primeiro.");
  const prefill = {
    titulo: `${r.cidade} · ${periodo(r.inicio, r.fim)}`.slice(0, 80), local: r.cidade, data_inicio: r.inicio, data_fim: r.fim,
    lugares: r.lugares.slice(0, 40).map((l) => ({ id: l.id, nome: l.nome })),
    datas: Object.fromEntries(r.lugares.map((l) => [l.id, l.data])),
    viagem_id: window.TFConta && window.TFConta.viagemAtual ? window.TFConta.viagemAtual() : null,
    deRoteiro: true
  };
  try { sessionStorage.setItem(PREFILL, JSON.stringify(prefill)); } catch (_) { /* ignora */ }
  ir("/lembrancas/nova");
});

// =====================================================================
// Denúncia
// =====================================================================
function abrirDenuncia(tipo, id, nome) {
  let d = document.getElementById("muDenuncia");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "muDenuncia";
    d.className = "modal mu-denuncia";
    document.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-den=fechar]")) d.close(); });
    d.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector("button[type=submit]");
      if (!fd.get("motivo")) return (e.target.querySelector(".mu-den-erro").textContent = "Escolha um motivo.");
      btn.disabled = true;
      try {
        await M.denunciar(d.dataset.tipo, d.dataset.id, fd.get("motivo"), fd.get("detalhe").trim());
        d.close();
        toast("Denúncia enviada. Obrigado por avisar.");
      } catch (err) { e.target.querySelector(".mu-den-erro").textContent = traduzir(err); btn.disabled = false; }
    });
  }
  d.dataset.tipo = tipo; d.dataset.id = id;
  d.innerHTML = `<form>
    <div class="modal-head"><h3>Denunciar</h3><button type="button" class="icon-btn" data-den="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-body">
      <p>O que há de errado com ${esc(nome)}?</p>
      <div class="mu-den-motivos">${Object.entries(M.MOTIVOS).map(([k, n]) => `<label class="check"><input type="radio" name="motivo" value="${k}"> ${n}</label>`).join("")}</div>
      <label class="field"><span>Detalhes (opcional)</span><textarea name="detalhe" maxlength="500" rows="3"></textarea></label>
      <p class="muted small-text">A pessoa denunciada não sabe quem denunciou. A moderação do Traveler's Friend analisa e pode remover o conteúdo. Para deixar de ver essa pessoa, use também "Bloquear".</p>
      <p class="mu-den-erro pf-erro-txt" role="alert"></p>
      <div class="modal-actions"><button class="btn" type="submit">Enviar denúncia</button><button type="button" class="btn ghost" data-den="fechar">Cancelar</button></div>
    </div></form>`;
  d.showModal();
}

// =====================================================================
// Ações (cliques dentro da área social)
// =====================================================================
document.addEventListener("click", async (e) => {
  const el = e.target.closest("#socialView [data-mu]");
  if (!el) return;
  const acao = el.dataset.mu;
  if (el.closest("details.mu-menu")) el.closest("details.mu-menu").open = false;
  try {
    switch (acao) {
      // ----- perfil -----
      case "nova":
        try { sessionStorage.setItem(PREFILL, JSON.stringify({ identidade_id: el.dataset.ident })); } catch (_) { /* ignora */ }
        return ir("/lembrancas/nova");
      case "pedir": {
        const ids = await minhasIdentidades();
        if (!ids.length) { toast("Crie o seu perfil para adicionar amigos."); return ir("/perfil"); }
        if (ids.length > 1) {
          document.getElementById("muRelacao").innerHTML = `<span class="mu-como small-text">Pedir como:
            ${ids.map((i) => `<button class="btn ghost small" data-mu="pedir-como" data-de="${esc(i.id)}">@${esc(i.apelido)}</button>`).join("")}</span>`;
          return;
        }
        await M.pedirAmizade(ids[0].id, perfilAtual.id);
        break;
      }
      case "pedir-como": await M.pedirAmizade(el.dataset.de, perfilAtual.id); break;
      case "aceitar": await M.aceitarAmizade(el.dataset.de, el.dataset.para); toast("Agora vocês são amigos!"); break;
      case "desfazer":
        if (el.dataset.confirma && !confirm(el.dataset.confirma)) return;
        await M.desfazerAmizade(el.dataset.de, el.dataset.para); break;
      case "bloquear": {
        const p = perfilAtual;
        if (!confirm(`Bloquear @${p.apelido}?\n\nVocês deixam de ver os perfis um do outro (inclusive personas da mesma conta), a amizade é desfeita e não dá mais para trocar pedidos nem recados. Você pode desbloquear depois em Amigos.`)) return;
        await M.bloquear(p.id);
        toast("Perfil bloqueado");
        atualizarAvisoAmigos();
        return ir("/amigos");
      }
      case "denunciar": return abrirDenuncia(el.dataset.tipo, el.dataset.id, el.dataset.nome);
      case "apagar-recado":
        if (!confirm("Apagar este recado?")) return;
        await M.apagarRecado(el.dataset.id); toast("Recado apagado"); break;
      // ----- álbum -----
      case "ver": return verFoto(+el.dataset.i);
      case "importar": {
        const fotos = await M.fotosSemAlbum();
        const urls = await M.urlsDe(fotos.map((f) => f.miniatura));
        importando = fotos.map((f) => ({ ...f, url: urls[f.miniatura] }));
        return renderAlbum(true);
      }
      case "importar-fechar": importando = null; return renderAlbum(true);
      // ----- editor -----
      case "add-lugar": return addLugar();
      case "tirar-lugar": lerAlbum(); lb.lugares.splice(+el.dataset.i, 1); return renderEditorAlbum();
      case "apagar-pedir": lerAlbum(); lb.confirmandoApagar = true; return renderEditorAlbum();
      case "apagar-cancelar": lerAlbum(); lb.confirmandoApagar = false; return renderEditorAlbum();
      case "apagar-album": {
        lerAlbum();
        const ident = lb.identidades.find((i) => i.id === lb.identidade_id);
        await M.apagarAlbum(lb.id, lb.apagarFotos);
        toast(lb.apagarFotos ? "Álbum e fotos apagados" : "Álbum apagado (as fotos continuam em Minhas fotos)");
        lb = null;
        return ir("/@" + ident.apelido);
      }
      default: return;
    }
    // Ações do perfil: redesenha só a parte de relação/mural.
    if (perfilAtual && document.getElementById("muMural")) {
      if (["pedir", "pedir-como"].includes(acao)) toast("Pedido de amizade enviado");
      atualizarAvisoAmigos();
      window.dispatchEvent(new HashChangeEvent("hashchange")); // recarrega o perfil (amizade muda o que dá para ver)
    }
  } catch (err) {
    toast(traduzir(err));
    if (lb && document.getElementById("lbForm")) { lb.erro = traduzir(err); renderEditorAlbum(); }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "lbNovoLugar") { e.preventDefault(); addLugar(); }
});
document.addEventListener("change", async (e) => {
  if (e.target.matches("#lbForm [name=identidade_id], #lbForm [name=visibilidade]")) { lerAlbum(); return renderEditorAlbum(); }
  if (!e.target.matches("[data-mu-up]")) return;
  const arquivos = [...e.target.files];
  if (!arquivos.length) return;
  try {
    enviando = `Enviando 0 de ${arquivos.length} foto(s)…`;
    renderAlbum(true);
    await M.enviarFotos(album.id, arquivos, { local: album.local || null }, (n) => {
      enviando = `Enviando ${n} de ${arquivos.length} foto(s)…`;
      const el = document.querySelector(".mu-progresso");
      if (el) el.textContent = enviando;
    });
    toast(arquivos.length === 1 ? "Foto enviada" : arquivos.length + " fotos enviadas");
  } catch (err) { toast(traduzir(err)); }
  enviando = "";
  await recarregarAlbum();
});
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "lbForm") { e.preventDefault(); return salvarAlbumForm(); }
  if (f.id === "muImportar") {
    e.preventDefault();
    const ids = [...new FormData(f).getAll("foto")];
    if (!ids.length) return toast("Escolha pelo menos uma foto.");
    try { await M.moverFotos(ids, album.id); importando = null; toast("Fotos colocadas no álbum"); await recarregarAlbum(); }
    catch (err) { toast(traduzir(err)); }
    return;
  }
  if (f.id === "muRecadoForm") {
    e.preventDefault();
    const fd = new FormData(f), texto = fd.get("texto").trim();
    if (!texto) return;
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await M.deixarRecado(perfilAtual.id, fd.get("autor"), texto);
      toast("Recado enviado");
      const mu = await M.mural(perfilAtual.id);
      renderMural(perfilAtual, await M.albunsDe(perfilAtual.id), mu, true, null);
      const urls = await M.urlsDe([...document.querySelectorAll("#muMural img[data-caminho]")].map((i) => i.dataset.caminho));
      document.querySelectorAll("#muMural img[data-caminho]").forEach((img) => { if (urls[img.dataset.caminho]) img.src = urls[img.dataset.caminho]; });
    } catch (err) { toast(traduzir(err)); btn.disabled = false; }
  }
});

// Fecha o menu "⋯" ao clicar fora.
document.addEventListener("click", (e) => {
  document.querySelectorAll("details.mu-menu[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
});
