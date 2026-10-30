/*
 * Perfil: página pública (#/@apelido), "meu perfil" (#/perfil) e edição (#/perfil/editar).
 * Os dados vêm de js/dados/perfis.js; o banco já entrega só o que quem está vendo pode ver.
 */
import { rota, ir } from "../core/router.js";
import { esc } from "../core/util.js";
import {
  contaPronta, perfilPublico, minhaPrincipal, apelidoDisponivel, salvarIdentidade,
  meusVisitados, adicionarVisitado, removerVisitado, urlImagem, enviarImagem, removerImagem, apagarIdentidade,
  APELIDO_RE, NIVEIS, SECOES, PRIVACIDADE_PADRAO
} from "../dados/perfis.js";

// ---------- Opções de personalização ----------
export const STATUS = {
  disponivel: { nome: "Disponível" }, ocupado: { nome: "Ocupado" },
  ausente: { nome: "Ausente" }, invisivel: { nome: "Invisível" }
};
export const CORES = [
  { v: "#ffe14d", n: "Amarelo" }, { v: "#ff8a65", n: "Coral" }, { v: "#7fd1b9", n: "Menta" },
  { v: "#b9a7ff", n: "Lilás" }, { v: "#8ec9ff", n: "Céu" }, { v: "#0b0b0b", n: "Preto" }
];
export const ESTAMPAS = { lisa: "Lisa", bolinhas: "Bolinhas", xadrez: "Xadrez", listras: "Listras", ondas: "Ondas" };
export const EMOJIS = ["🧳", "✈️", "🗺️", "🧭", "📷", "🎒", "🏖️", "🏔️", "🌎", "🚲", "🐶", "🐱", "🦜", "🐢", "🦊", "🌵"];

// Tipos de identidade. "ideias" preenchem nome e @ com um clique (pura sugestão).
export const TIPOS = {
  principal: { nome: "Perfil principal", icone: "👤", emojis: EMOJIS },
  historica: {
    nome: "Figura histórica", icone: "🎩", desc: "Exploradores, inventores e viajantes que já fizeram história.",
    emojis: ["🎩", "🛩️", "🧭", "📜", "🖋️", "🗺️", "⚓", "🔭", "🏛️", "⛵"],
    ideias: [{ nome: "Santos Dumont Viajante", figura: "Santos Dumont", emoji: "🛩️" }, { nome: "Marco Polo em SP", figura: "Marco Polo", emoji: "🧭" },
      { nome: "Leonardo Inventor", figura: "Leonardo da Vinci", emoji: "🖋️" }, { nome: "Amelia nos Céus", figura: "Amelia Earhart", emoji: "✈️" }],
    bio: "Ex.: Em 1906 voei com o 14-Bis em Paris. Hoje procuro os melhores mirantes de São Paulo."
  },
  animal: {
    nome: "Animal", icone: "🐾", desc: "Seu pet viajante ou um bicho imaginário.",
    emojis: ["🐶", "🐱", "🦜", "🐢", "🦊", "🐧", "🦙", "🐒", "🐸", "🦉"],
    ideias: [{ nome: "Caramelo Viajante", emoji: "🐶" }, { nome: "Gata Mochileira", emoji: "🐱" }, { nome: "Papagaio Guia", emoji: "🦜" }, { nome: "Tartaruga Sem Pressa", emoji: "🐢" }],
    bio: "Ex.: Vira-lata caramelo, especialista em parques e em pedir petisco no Mercadão."
  },
  objeto: {
    nome: "Objeto", icone: "🧳", desc: "Uma mala, uma câmera, um mapa… com história para contar.",
    emojis: ["🧳", "📷", "✈️", "🗺️", "🧭", "🎒", "⛺", "🚂", "🎟️", "📮"],
    ideias: [{ nome: "Mala de Rodinhas", emoji: "🧳" }, { nome: "Câmera Analógica", emoji: "📷" }, { nome: "Mapa Amassado", emoji: "🗺️" }, { nome: "Bússola Desorientada", emoji: "🧭" }],
    bio: "Ex.: Já rodei 12 países no porão de aviões e ainda carrego a etiqueta de Lisboa."
  },
  original: {
    nome: "Personagem original", icone: "✨", desc: "Alguém que só existe na sua imaginação.",
    emojis: ["👽", "🤖", "🧚", "🦸", "🧙", "🐉", "🧜", "👻", "🦄", "🌈"],
    ideias: [{ nome: "Robô Turista", emoji: "🤖" }, { nome: "Fada das Calçadas", emoji: "🧚" }, { nome: "Viajante do Tempo", emoji: "🕰️" }, { nome: "Agente do Metrô", emoji: "🕶️" }],
    bio: "Ex.: Viajante do tempo preso em 2026, colecionando pores do sol pela cidade."
  }
};
// Moldura do avatar ("retrô" lembra as fotos de exibição do MSN, com cantos arredondados).
export const MOLDURAS = { circulo: "Círculo", quadrado: "Quadrado", retro: "Retrô" };
// Emoticons (Unicode, sem arte de terceiros) para a mensagem pessoal e a assinatura.
export const EMOTICONS = ["😀", "😎", "🥳", "😴", "🤩", "😍", "🤔", "😅", "🙃", "😇", "🤠", "🥶", "☕", "🍕", "🎉", "✈️", "🌧️", "☀️", "🌙", "❤️", "⭐", "🎵", "📸", "🗺️"];
// "Santos Dumont Viajante" → "santos_dumont_viajante"
export const paraApelido = (txt) => txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "";
const NIVEL_NOME = { publico: "Público", amigos: "Só amigos", privado: "Só eu" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataCurta = (iso) => iso ? MESES[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4) : "";
const toast = (m) => window.TF && window.TF.toast(m);
const catalogo = () => ((window.TF_CITIES || {}).sp || {}).lugares?.filter((p) => !p.datas && !p.periodo) || [];

// ---------- Tela ----------
const view = () => document.getElementById("socialView");
function mostrar(html, manterRolagem = false) {
  const y = window.scrollY;
  document.body.classList.remove("landing");
  document.body.classList.add("v-social");
  view().hidden = false;
  view().innerHTML = html;
  window.scrollTo(0, manterRolagem ? y : 0);
}
export { mostrar };
export const carregando = () => mostrar(`<div class="pf-vazio"><p class="muted">Carregando…</p></div>`);
export const aviso = (titulo, texto, acoes = "") => mostrar(`<div class="pf-vazio"><h2>${titulo}</h2><p class="muted">${texto}</p><div class="pf-vazio-acoes">${acoes}</div></div>`);

export function avatarHtml(p, cls = "") {
  const url = p.avatar && urlImagem(p.avatar);
  const st = p.status ? ` st-${p.status}` : "";
  const dentro = url ? `<img src="${esc(url)}" alt="">` : `<span>${esc(p.avatar_emoji || (p.nome || "?").trim().charAt(0).toUpperCase())}</span>`;
  const mold = p.tema && MOLDURAS[p.tema.moldura] ? " mold-" + p.tema.moldura : "";
  return `<span class="pf-avatar ${cls}${st}${mold}" aria-hidden="true">${dentro}</span>`;
}
// Selo das identidades temáticas (deixa claro que não é conta oficial nem pessoa real).
function seloHtml(p) {
  if (!p.tipo || p.tipo === "principal") return "";
  const t = TIPOS[p.tipo] || TIPOS.original;
  const figura = (p.tema && p.tema.figura) || p.nome;
  const txt = p.tipo === "historica"
    ? `Perfil temático criado por um usuário do Traveler's Friend — não é a conta oficial de ${esc(figura)} nem tem ligação com seus herdeiros.`
    : `Personagem fictício (${esc(t.nome.toLowerCase())}) criado por um usuário do Traveler's Friend.`;
  return `<p class="pf-selo"><span>${t.icone}</span>${txt}</p>`;
}
const editarHref = (p) => !p.tipo || p.tipo === "principal" ? "#/perfil/editar" : "#/identidades/editar/" + p.id;
function capaHtml(p) {
  const url = p.capa && urlImagem(p.capa);
  const estampa = (p.tema && p.tema.estampa) || "lisa";
  return `<div class="pf-capa est-${esc(estampa)}">${url ? `<img src="${esc(url)}" alt="">` : ""}</div>`;
}
const corDe = (p) => (p.tema && CORES.some((c) => c.v === p.tema.cor) ? p.tema.cor : "#ffe14d");

// ---------- Página do perfil ----------
export function renderPerfil(p) {
  const dono = p.relacao === "dono";
  const link = location.origin + location.pathname + "#/@" + p.apelido;
  const secao = (titulo, corpo, cls = "") => `<section class="pf-sec ${cls}"><h3>${titulo}</h3>${corpo}</section>`;
  const destinos = p.destinos_desejados;
  const visitados = p.visitados;
  const amigos = p.amigos;
  mostrar(`
    <article class="pf" style="--pf-cor:${corDe(p)}">
      ${capaHtml(p)}
      <header class="pf-head">
        ${avatarHtml(p, "lg")}
        <div class="pf-id">
          <h1>${esc(p.nome)}${p.tema && p.tema.emoticon ? ` <span class="pf-emo" aria-hidden="true">${esc(p.tema.emoticon)}</span>` : ""}</h1>
          <span class="pf-apelido">@${esc(p.apelido)}</span>
          ${p.status !== undefined ? `<span class="pf-status">${p.status ? `<i class="dot st-${p.status}"></i>${STATUS[p.status].nome}` : `<i class="dot st-off"></i>Offline`}</span>` : ""}
        </div>
        <div class="pf-acoes">
          ${dono ? `<a class="btn small" href="${editarHref(p)}">Editar perfil</a><a class="btn ghost small" href="#/identidades">Minhas identidades</a>` : ""}
          <button class="btn ghost small" data-pf="copiar" data-link="${esc(link)}">Copiar link</button>
          ${dono ? "" : `<span class="mu-relacao" id="muRelacao"></span>`}
        </div>
        ${p.mensagem ? `<p class="pf-msg">${esc(p.mensagem)}</p>` : ""}
      </header>
      ${seloHtml(p)}
      ${dono ? `<p class="pf-dica">Você está vendo o seu perfil completo. Visitantes só veem as seções que você deixou públicas — <a href="${editarHref(p)}">ajustar privacidade</a>.</p>` : ""}
      <div class="pf-grid">
        <div class="pf-col">
          ${"bio" in p ? secao("Sobre", p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : `<p class="muted">${dono ? "Conte um pouco sobre você em Editar perfil." : "Sem descrição."}</p>`) : ""}
          ${destinos ? secao("Quero conhecer", destinos.length
            ? `<ul class="pf-chips">${destinos.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
            : `<p class="muted">${dono ? "Adicione destinos dos seus sonhos." : "Nenhum destino ainda."}</p>`) : ""}
          ${amigos ? secao(`Amigos <small>${amigos.length}</small>`, amigos.length
            ? `<ul class="pf-amigos">${amigos.map((a) => `<li><a href="#/@${esc(a.apelido)}">${avatarHtml(a, "sm")}<span>${esc(a.nome)}</span></a></li>`).join("")}</ul>`
            : `<p class="muted">Nenhum amigo ainda.</p>`) : ""}
        </div>
        <div class="pf-col">
          ${visitados ? secao(`Lugares visitados <small>${visitados.length}</small>`, visitados.length
            ? `<ol class="pf-visitados">${visitados.map((v) => `<li>
                <span class="pv-data">${esc(dataCurta(v.data))}</span>
                <div><b>${v.lugar_id && catalogo().some((c) => c.id === v.lugar_id)
                  ? `<button class="link" data-pf="lugar" data-id="${esc(v.lugar_id)}">${esc(v.nome)}</button>` : esc(v.nome)}</b>
                ${v.cidade ? `<span class="muted"> · ${esc(v.cidade)}</span>` : ""}
                ${v.nota ? `<p>${esc(v.nota)}</p>` : ""}</div></li>`).join("")}</ol>`
            : `<p class="muted">${dono ? "Registre os lugares que você já conheceu em Editar perfil." : "Nenhum lugar registrado."}</p>`, "pf-sec-visitados") : ""}
        </div>
      </div>
      <div class="pf-mural" id="muMural"></div>
    </article>`);
  // Álbuns, recados e botões de amizade/denúncia entram depois (js/social/mural.js).
  document.dispatchEvent(new CustomEvent("tf:perfil", { detail: p }));
}

// ---------- Edição / criação ----------
let ed = null; // rascunho do formulário
// ident: identidade existente (ou null para criar). opts.tipo: tipo da nova; opts.maior: herda o 18+ do perfil principal.
export async function abrirEditor(ident, opts = {}) {
  const tipo = ident ? ident.tipo : (opts.tipo || "principal");
  const base = ident || {
    tipo, nome: tipo === "principal" ? (window.TFConta.nome() || "").slice(0, 60) : "", apelido: "", bio: "", mensagem: "",
    status: "disponivel", tema: { cor: tipo === "principal" ? "#ffe14d" : CORES[Math.floor(Math.random() * 5)].v, estampa: tipo === "principal" ? "lisa" : "bolinhas" },
    destinos_desejados: [], privacidade: { ...PRIVACIDADE_PADRAO }, maior_de_idade: !!opts.maior,
    avatar_emoji: tipo === "principal" ? null : (TIPOS[tipo].emojis || [])[0]
  };
  ed = {
    ...JSON.parse(JSON.stringify(base)),
    destinos_desejados: base.destinos_desejados || [],
    privacidade: { ...PRIVACIDADE_PADRAO, ...(base.privacidade || {}) },
    tema: { cor: "#ffe14d", estampa: "lisa", moldura: tipo === "principal" ? "circulo" : "retro", ...(base.tema || {}) },
    criando: !ident, avatarBlob: null, capaBlob: null, tirarAvatar: false, tirarCapa: false, confirmandoApagar: false,
    visitados: ident ? await meusVisitados(ident.id) : []
  };
  renderEditor();
}

function previa(tipo) {
  const blob = ed[tipo + "Blob"];
  if (blob) return URL.createObjectURL(blob);
  if (ed["tirar" + (tipo === "avatar" ? "Avatar" : "Capa")]) return null;
  return ed[tipo] ? urlImagem(ed[tipo]) : null;
}

function renderEditor() {
  const av = previa("avatar"), cp = previa("capa");
  const opcoesCat = catalogo().map((c) => `<option value="${esc(c.nome)}">`).join("");
  const redesenho = !!document.getElementById("pfForm");
  const persona = ed.tipo && ed.tipo !== "principal";
  const T = TIPOS[ed.tipo] || TIPOS.principal;
  mostrar(`
    <form class="pf-form" id="pfForm" novalidate>
      <div class="pf-form-head">
        <h1>${persona ? `${TIPOS[ed.tipo].icone} ${ed.criando ? "Nova identidade" : "Editar identidade"}` : ed.criando ? "Criar meu perfil" : "Editar perfil"}</h1>
        <div class="pf-acoes">
          ${persona ? `<a class="btn ghost small" href="#/identidades">Minhas identidades</a>` : ""}
          ${ed.criando ? "" : `<a class="btn ghost small" href="#/@${esc(ed.apelido)}">Ver perfil</a>`}
          <button class="btn" type="submit">Salvar</button>
        </div>
      </div>
      <p class="pf-erro" id="pfErro" role="alert" hidden></p>
      ${persona ? `
      <section class="pf-bloco pf-persona">
        <h3>${T.icone} ${T.nome}</h3>
        <p class="muted small-text">${T.desc}</p>
        ${ed.criando && T.ideias ? `<div class="pf-linha"><span class="small-text">Precisa de ideia?</span>
          ${T.ideias.map((i, n) => `<button type="button" class="chip" data-pf="ideia" data-i="${n}">${esc(i.emoji || "")} ${esc(i.nome)}</button>`).join("")}</div>` : ""}
        ${ed.tipo === "historica" ? `
        <div class="pf-campos">
          <label class="field"><span>Quem esta identidade representa</span><input name="figura" maxlength="60" required value="${esc(ed.tema.figura || "")}" placeholder="Ex.: Santos Dumont"></label>
        </div>
        <label class="check pf-declara"><input type="checkbox" name="declaracao" ${ed.tema.declaracao ? "checked" : ""}>
          Confirmo que é uma figura histórica já falecida e que este perfil é uma homenagem/brincadeira, não uma conta oficial.</label>
        <p class="muted small-text">Pessoas vivas, marcas e contas que se passam por alguém não são permitidas.</p>` : ""}
      </section>` : ""}

      <section class="pf-bloco pf-visual" style="--pf-cor:${esc(ed.tema.cor)}">
        <div class="pf-capa est-${esc(ed.tema.estampa)}">${cp ? `<img src="${esc(cp)}" alt="">` : ""}</div>
        <div class="pf-visual-av">${av ? `<span class="pf-avatar lg mold-${esc(ed.tema.moldura)}"><img src="${esc(av)}" alt=""></span>` : `<span class="pf-avatar lg mold-${esc(ed.tema.moldura)}"><span>${esc(ed.avatar_emoji || (ed.nome || "?").charAt(0).toUpperCase())}</span></span>`}</div>
        <div class="pf-visual-ctrl">
          <div class="pf-linha">
            <label class="btn ghost small">Foto de perfil<input type="file" accept="image/*" data-pf-img="avatar" hidden></label>
            ${av ? `<button type="button" class="link" data-pf="tirar-avatar">remover foto</button>` : ""}
            <span class="muted small-text">ou um emoji:</span>
          </div>
          <div class="pf-emojis" role="radiogroup" aria-label="Avatar em emoji">${T.emojis.map((e) => `<button type="button" class="${!av && ed.avatar_emoji === e ? "on" : ""}" data-pf="emoji" data-v="${e}" aria-label="Avatar ${e}">${e}</button>`).join("")}</div>
          <div class="pf-linha"><span class="small-text">Moldura</span>
            ${Object.entries(MOLDURAS).map(([k, n]) => `<button type="button" class="chip ${ed.tema.moldura === k ? "on" : ""}" data-pf="moldura" data-v="${k}">${n}</button>`).join("")}
          </div>
          <div class="pf-linha">
            <label class="btn ghost small">Foto de capa<input type="file" accept="image/*" data-pf-img="capa" hidden></label>
            ${cp ? `<button type="button" class="link" data-pf="tirar-capa">remover capa</button>` : ""}
          </div>
          <div class="pf-linha"><span class="small-text">Cor do tema</span>
            ${CORES.map((c) => `<button type="button" class="pf-cor ${ed.tema.cor === c.v ? "on" : ""}" style="background:${c.v}" data-pf="cor" data-v="${c.v}" title="${c.n}" aria-label="Cor ${c.n}"></button>`).join("")}
          </div>
          <div class="pf-linha"><span class="small-text">Estampa da capa</span>
            ${Object.entries(ESTAMPAS).map(([k, n]) => `<button type="button" class="chip ${ed.tema.estampa === k ? "on" : ""}" data-pf="estampa" data-v="${k}">${n}</button>`).join("")}
          </div>
          <p class="muted small-text">Foto de perfil e capa são públicas para quem abre o seu link.</p>
        </div>
      </section>

      <section class="pf-bloco">
        <h3>Identificação</h3>
        <div class="pf-campos">
          <label class="field"><span>Nome ou apelido de exibição</span><input name="nome" maxlength="60" required value="${esc(ed.nome)}"></label>
          <label class="field"><span>Endereço do perfil</span>
            <span class="pf-handle">@<input name="apelido" maxlength="24" required pattern="[a-z0-9_]{3,24}" value="${esc(ed.apelido)}" placeholder="seu_apelido" autocomplete="off"></span>
            <small class="muted" id="pfApelidoMsg">3 a 24 caracteres: letras minúsculas, números e _</small></label>
          <label class="field"><span>Status</span><select name="status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${ed.status === k ? "selected" : ""}>${s.nome}</option>`).join("")}</select></label>
          <label class="field pf-wide"><span>Mensagem pessoal <small class="muted" id="pfMsgConta"></small></span><input name="mensagem" maxlength="140" value="${esc(ed.mensagem || "")}" placeholder="Ex.: Contando os dias para Paranapiacaba ☁️"></label>
          <div class="pf-wide pf-emoticons" aria-label="Emoticons">
            <span class="small-text">Emoticons <span class="muted">(toque para pôr na mensagem)</span></span>
            <div>${EMOTICONS.map((e) => `<button type="button" data-pf="emoticon" data-v="${e}" aria-label="Inserir ${e}">${e}</button>`).join("")}</div>
            <span class="small-text">Emoticon ao lado do nome</span>
            <div>${["", ...EMOTICONS.slice(0, 12)].map((e) => `<button type="button" class="${(ed.tema.emoticon || "") === e ? "on" : ""}" data-pf="assinatura" data-v="${e}" aria-label="${e ? "Usar " + e : "Nenhum"}">${e || "∅"}</button>`).join("")}</div>
          </div>
          <label class="field pf-wide"><span>${persona ? "História" : "Sobre mim"}</span><textarea name="bio" maxlength="500" rows="4" placeholder="${esc(T.bio || "Que tipo de viagem você curte?")}">${esc(ed.bio || "")}</textarea></label>
        </div>
      </section>

      <section class="pf-bloco">
        <h3>Quero conhecer <small class="muted">${ed.destinos_desejados.length}/30</small></h3>
        <ul class="pf-chips editavel">${ed.destinos_desejados.map((d, i) => `<li>${esc(d)} <button type="button" data-pf="tirar-destino" data-i="${i}" aria-label="Remover ${esc(d)}">×</button></li>`).join("")}</ul>
        <div class="pf-linha">
          <input id="pfNovoDestino" aria-label="Novo destino" maxlength="60" placeholder="Ex.: Paranapiacaba, Japão, Chapada Diamantina" ${ed.destinos_desejados.length >= 30 ? "disabled" : ""}>
          <button type="button" class="btn ghost small" data-pf="add-destino">Adicionar</button>
        </div>
      </section>

      <section class="pf-bloco">
        <h3>Lugares visitados <small class="muted">${ed.visitados.length}</small></h3>
        ${ed.criando ? `<p class="muted small-text">Salve o perfil primeiro para registrar lugares.</p>` : `
        <div class="pf-visit-add">
          <label class="field"><span>Lugar</span><input id="pfVisNome" list="pfCatalogo" maxlength="120" placeholder="Escolha da lista ou escreva"><datalist id="pfCatalogo">${opcoesCat}</datalist></label>
          <label class="field"><span>Quando</span><input id="pfVisData" type="date"></label>
          <label class="field pf-wide"><span>Nota (opcional)</span><input id="pfVisNota" maxlength="300" placeholder="Uma lembrança curtinha"></label>
          <button type="button" class="btn small" data-pf="add-visitado">Registrar</button>
        </div>`}
        <ol class="pf-visitados editavel">${ed.visitados.map((v) => `<li><span class="pv-data">${esc(dataCurta(v.data))}</span>
          <div><b>${esc(v.nome)}</b>${v.cidade ? ` <span class="muted">· ${esc(v.cidade)}</span>` : ""}${v.nota ? `<p>${esc(v.nota)}</p>` : ""}</div>
          <button type="button" class="link" data-pf="tirar-visitado" data-id="${esc(v.id)}">remover</button></li>`).join("")}</ol>
      </section>

      <section class="pf-bloco">
        <h3>Privacidade</h3>
        <label class="check pf-maior"><input type="checkbox" name="maior_de_idade" ${ed.maior_de_idade ? "checked" : ""}> Tenho 18 anos ou mais</label>
        <p class="muted small-text">${ed.maior_de_idade ? "Você pode deixar seções públicas." : "Sem esta confirmação, nada do perfil fica público: o máximo é \"só amigos\"."}</p>
        <div class="pf-priv">${Object.entries(SECOES).map(([k, nome]) => `<label class="field"><span>${nome}</span>
          <select name="priv_${k}">${NIVEIS.map((n) => `<option value="${n}" ${privacidadeEfetiva()[k] === n ? "selected" : ""} ${n === "publico" && !ed.maior_de_idade ? "disabled" : ""}>${NIVEL_NOME[n]}</option>`).join("")}</select></label>`).join("")}</div>
      </section>

      ${persona && !ed.criando ? `
      <section class="pf-bloco pf-perigo">
        <h3>Apagar identidade</h3>
        ${ed.confirmandoApagar ? `
          <p class="small-text">Isso apaga <b>@${esc(ed.apelido)}</b> com foto, capa e lugares visitados. Não dá para desfazer. Digite o endereço para confirmar:</p>
          <div class="pf-linha"><input id="pfApagarConf" placeholder="${esc(ed.apelido)}" autocomplete="off">
            <button type="button" class="btn danger small" data-pf="apagar-confirmar">Apagar para sempre</button>
            <button type="button" class="link" data-pf="apagar-cancelar">cancelar</button></div>`
        : `<button type="button" class="btn ghost small" data-pf="apagar">Apagar esta identidade…</button>`}
      </section>` : ""}
      <div class="pf-form-foot"><button class="btn" type="submit">${persona ? "Salvar identidade" : "Salvar perfil"}</button></div>
    </form>`, redesenho);
  atualizarContador();
}

// Lê os campos de texto para o rascunho (antes de redesenhar ou salvar).
function lerCampos() {
  const f = document.getElementById("pfForm");
  if (!f) return;
  const v = (n) => f.elements[n] ? f.elements[n].value : undefined;
  ed.nome = v("nome").trim(); ed.apelido = v("apelido").trim().toLowerCase();
  ed.status = v("status"); ed.mensagem = v("mensagem").trim(); ed.bio = v("bio").trim();
  if (f.elements.figura) ed.tema.figura = f.elements.figura.value.trim();
  if (f.elements.declaracao) ed.tema.declaracao = f.elements.declaracao.checked;
  const eraMaior = ed.maior_de_idade;
  ed.maior_de_idade = f.elements.maior_de_idade.checked;
  Object.keys(SECOES).forEach((k) => {
    const sel = v("priv_" + k);
    // Sem 18+ a tela mostra "Só amigos" no lugar de "Público"; isso não apaga a escolha guardada.
    if (!eraMaior && ed.privacidade[k] === "publico" && sel === "amigos") return;
    ed.privacidade[k] = sel;
  });
}
// O que vai para o banco: sem 18+, nada público (o banco também garante isso).
const privacidadeEfetiva = () => Object.fromEntries(Object.entries(ed.privacidade).map(([k, n]) => [k, !ed.maior_de_idade && n === "publico" ? "amigos" : n]));
function atualizarContador() {
  const f = document.getElementById("pfForm"), el = document.getElementById("pfMsgConta");
  if (f && el) el.textContent = f.elements.mensagem.value.length + "/140";
}
function erro(msg) {
  const el = document.getElementById("pfErro");
  if (!el) return toast(msg);
  el.textContent = msg; el.hidden = !msg;
  if (msg) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
export function traduzir(err) {
  const m = String((err && err.message) || err || "");
  if (/identidades_apelido_idx/i.test(m)) return "Esse endereço de perfil já está em uso. Escolha outro.";
  if (/identidades_um_principal/i.test(m)) return "Você já tem um perfil principal.";
  if (/limite_identidades/i.test(m)) return "Limite de 3 identidades por conta (seu perfil + 2 personas) atingido.";
  if (/limite_albuns/i.test(m)) return "Limite de 30 álbuns por conta atingido.";
  if (/limite_fotos/i.test(m)) return m.replace(/^.*limite_fotos:s*/i, "Limite atingido: ");
  if (/limite_recados/i.test(m)) return "Você deixou muitos recados na última hora. Tente mais tarde.";
  if (/limite_amizades/i.test(m)) return "Você mandou muitos pedidos de amizade hoje. Tente amanhã.";
  if (/limite_denuncias/i.test(m)) return "Você já enviou muitas denúncias hoje.";
  if (/recado_so_amigos/i.test(m)) return "Só amigos podem deixar recados.";
  if (/recado_desligado/i.test(m)) return "Este mural não está recebendo recados.";
  if (/bloquead/i.test(m)) return "Não é possível: há um bloqueio entre as contas.";
  if (/amizade_existente/i.test(m)) return "Essa pessoa já te mandou um pedido — aceite em Amigos.";
  if (/amizades_pkey|duplicate key value.*amizades/i.test(m)) return "Você já mandou um pedido para esse perfil.";
  if (/seção desconhecida/i.test(m)) return "O banco ainda não foi atualizado: é preciso rodar supabase/004_mural.sql no Supabase.";
  if (/row-level security|permission denied/i.test(m)) return "Sem permissão para isso. Entre de novo na sua conta.";
  if (/relation .* does not exist|function .* does not exist|Could not find the (function|table)/i.test(m))
    return "O banco ainda não tem as tabelas novas. É preciso rodar os arquivos de supabase/ (002 a 004) no Supabase.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor.";
  return m || "Não foi possível salvar.";
}

// Recorta no centro e reduz (sem metadados como GPS, porque passa pelo canvas).
async function recortar(file, w, h, qualidade) {
  let img;
  try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch (_) { throw new Error("Formato de imagem não suportado. Use JPG ou PNG."); }
  const escala = Math.max(w / img.width, h / img.height);
  const sw = w / escala, sh = h / escala;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", qualidade));
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return blob;
}

async function salvar() {
  lerCampos();
  if (!ed.nome) return erro("Escreva um nome de exibição.");
  if (!APELIDO_RE.test(ed.apelido)) return erro("Endereço do perfil: use 3 a 24 caracteres (a–z, 0–9 e _).");
  if (ed.tipo === "historica" && !ed.tema.figura) return erro("Diga quem esta identidade representa.");
  if (ed.tipo === "historica" && !ed.tema.declaracao) return erro("Confirme que é uma figura histórica já falecida e que o perfil não é oficial.");
  const botoes = [...document.querySelectorAll("#pfForm button[type=submit]")];
  const rotulos = botoes.map((b) => b.textContent);
  botoes.forEach((b) => { b.disabled = true; b.textContent = "Salvando…"; });
  try {
    if (!(await apelidoDisponivel(ed.apelido))) return erro("Esse endereço de perfil já está em uso. Escolha outro.");
    const dados = {
      id: ed.id, tipo: ed.tipo || "principal", nome: ed.nome, apelido: ed.apelido, status: ed.status, mensagem: ed.mensagem || null,
      bio: ed.bio || null, tema: ed.tema, destinos_desejados: ed.destinos_desejados, privacidade: privacidadeEfetiva(),
      maior_de_idade: ed.maior_de_idade, avatar_emoji: ed.avatar_emoji || null
    };
    let salvo = await salvarIdentidade(dados);
    const extra = {};
    if (ed.avatarBlob) { extra.avatar = await enviarImagem(salvo.id, "avatar", ed.avatarBlob, salvo.avatar); extra.avatar_emoji = null; }
    else if (ed.tirarAvatar && salvo.avatar) { await removerImagem(salvo.avatar); extra.avatar = null; }
    if (ed.capaBlob) extra.capa = await enviarImagem(salvo.id, "capa", ed.capaBlob, salvo.capa);
    else if (ed.tirarCapa && salvo.capa) { await removerImagem(salvo.capa); extra.capa = null; }
    if (Object.keys(extra).length) salvo = await salvarIdentidade({ id: salvo.id, ...extra });
    toast(ed.criando ? (ed.tipo && ed.tipo !== "principal" ? "Identidade criada!" : "Perfil criado!") : "Salvo");
    ed = null;
    ir("/@" + salvo.apelido);
  } catch (err) {
    erro(traduzir(err));
  } finally {
    botoes.forEach((b, n) => { if (b.isConnected) { b.disabled = false; b.textContent = rotulos[n]; } });
  }
}

// ---------- Eventos ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("#socialView [data-pf]");
  if (!el) return;
  const acao = el.dataset.pf;
  if (acao === "login") return window.TFConta && window.TFConta.abrirLogin();
  if (acao === "copiar") {
    try { await navigator.clipboard.writeText(el.dataset.link); toast("Link do perfil copiado"); }
    catch (_) { window.prompt("Copie o link do perfil:", el.dataset.link); }
    return;
  }
  if (acao === "lugar") {
    ir("/planejar");
    setTimeout(() => window.TF && window.TF.abrirDetalhe(el.dataset.id), 50);
    return;
  }
  if (!ed) return;
  e.preventDefault();
  if (acao === "emoticon") {
    // Insere onde o cursor estava na mensagem (ou no fim).
    const inp = document.querySelector("#pfForm [name=mensagem]");
    const ini = inp.selectionStart ?? inp.value.length, fim = inp.selectionEnd ?? ini;
    const novo = (inp.value.slice(0, ini) + el.dataset.v + inp.value.slice(fim)).slice(0, 140);
    inp.value = novo; atualizarContador();
    inp.focus(); const pos = Math.min(140, ini + el.dataset.v.length); inp.setSelectionRange(pos, pos);
    return;
  }
  lerCampos();
  try {
    switch (acao) {
      case "emoji": ed.avatar_emoji = el.dataset.v; ed.avatarBlob = null; ed.tirarAvatar = true; break;
      case "tirar-avatar": ed.avatarBlob = null; ed.tirarAvatar = true; break;
      case "tirar-capa": ed.capaBlob = null; ed.tirarCapa = true; break;
      case "cor": ed.tema.cor = el.dataset.v; break;
      case "moldura": ed.tema.moldura = el.dataset.v; break;
      case "assinatura": ed.tema.emoticon = el.dataset.v || null; break;
      case "ideia": {
        const i = TIPOS[ed.tipo].ideias[+el.dataset.i];
        ed.nome = i.nome; ed.apelido = paraApelido(i.nome);
        if (i.figura) ed.tema.figura = i.figura;
        if (i.emoji) { ed.avatar_emoji = i.emoji; ed.avatarBlob = null; }
        break;
      }
      case "apagar": ed.confirmandoApagar = true; break;
      case "apagar-cancelar": ed.confirmandoApagar = false; break;
      case "apagar-confirmar": {
        if (document.getElementById("pfApagarConf").value.trim().toLowerCase() !== ed.apelido) return erro("Digite o endereço exato para confirmar.");
        await apagarIdentidade(ed.id);
        toast("Identidade apagada");
        ed = null;
        ir("/identidades");
        return;
      }
      case "estampa": ed.tema.estampa = el.dataset.v; break;
      case "add-destino": {
        const inp = document.getElementById("pfNovoDestino"), v = inp.value.trim();
        if (v && ed.destinos_desejados.length < 30 && !ed.destinos_desejados.some((d) => d.toLowerCase() === v.toLowerCase())) ed.destinos_desejados.push(v);
        break;
      }
      case "tirar-destino": ed.destinos_desejados.splice(+el.dataset.i, 1); break;
      case "add-visitado": {
        const nome = document.getElementById("pfVisNome").value.trim();
        if (!nome) return erro("Escreva ou escolha o lugar visitado.");
        const c = catalogo().find((x) => x.nome.toLowerCase() === nome.toLowerCase());
        const v = await adicionarVisitado(ed.id, {
          nome: c ? c.nome : nome, lugar_id: c ? c.id : null, cidade: c ? (c.municipio || "São Paulo") : null,
          lat: c ? c.lat : null, lng: c ? c.lng : null,
          data: document.getElementById("pfVisData").value || null, nota: document.getElementById("pfVisNota").value.trim() || null
        });
        ed.visitados.unshift(v);
        ed.visitados.sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
        toast("Lugar registrado");
        break;
      }
      case "tirar-visitado": await removerVisitado(el.dataset.id); ed.visitados = ed.visitados.filter((v) => v.id !== el.dataset.id); break;
      default: return;
    }
    renderEditor();
  } catch (err) { erro(traduzir(err)); }
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  if (!ed || !el.closest("#pfForm")) return;
  if (el.dataset.pfImg) {
    const tipo = el.dataset.pfImg, file = el.files && el.files[0];
    if (!file) return;
    lerCampos();
    try {
      ed[tipo + "Blob"] = tipo === "avatar" ? await recortar(file, 400, 400, 0.85) : await recortar(file, 1500, 500, 0.8);
      ed[tipo === "avatar" ? "tirarAvatar" : "tirarCapa"] = false;
      renderEditor();
    } catch (err) { erro(err.message); }
    return;
  }
  if (el.name === "maior_de_idade") { lerCampos(); renderEditor(); }
});
document.addEventListener("input", (e) => {
  if (e.target.name === "mensagem" && e.target.closest("#pfForm")) atualizarContador();
  if (e.target.name === "apelido" && e.target.closest("#pfForm")) {
    const v = e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const msg = document.getElementById("pfApelidoMsg");
    msg.textContent = APELIDO_RE.test(v) ? "Seu perfil: …/#/@" + v : "3 a 24 caracteres: letras minúsculas, números e _";
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "pfNovoDestino") { e.preventDefault(); document.querySelector('[data-pf="add-destino"]').click(); }
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "pfForm") return;
  e.preventDefault();
  salvar();
});

// ---------- Rotas ----------
async function semContas() {
  aviso("Perfis ainda não estão ativos", "As contas deste site ainda não foram ligadas ao banco de dados.", `<a class="btn" href="#/planejar">Voltar ao planejamento</a>`);
}
rota("/@:apelido", async ({ apelido }) => {
  ed = null;
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return semContas();
  try {
    const p = await perfilPublico(apelido);
    if (!p) return aviso("Perfil não encontrado", `Não há perfil público em @${esc(apelido)}, ou ele é visível só para amigos.`, `<a class="btn" href="#/planejar">Ir para o planejamento</a>`);
    renderPerfil(p);
  } catch (err) { aviso("Não foi possível abrir o perfil", esc(traduzir(err))); }
});
rota("/perfil", async () => {
  ed = null;
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return semContas();
  if (!conta.usuario()) return aviso("Seu perfil", "Entre na sua conta para criar ou ver o seu perfil.", `<button class="btn" data-pf="login">Entrar</button>`);
  try {
    const p = await minhaPrincipal();
    if (p) { history.replaceState(null, "", "#/@" + p.apelido); window.dispatchEvent(new HashChangeEvent("hashchange")); return; }
    abrirEditor(null, conta.usuario());
  } catch (err) { aviso("Não foi possível abrir o perfil", esc(traduzir(err))); }
});
rota("/perfil/editar", async () => {
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return semContas();
  if (!conta.usuario()) return aviso("Editar perfil", "Entre na sua conta para editar o seu perfil.", `<button class="btn" data-pf="login">Entrar</button>`);
  try { abrirEditor(await minhaPrincipal(), conta.usuario()); }
  catch (err) { aviso("Não foi possível abrir o editor", esc(traduzir(err))); }
});

// Entrou ou saiu da conta enquanto está numa página de perfil: recarrega a página atual.
contaPronta().then((conta) => conta.aoMudarUsuario(() => {
  if (document.body.classList.contains("v-social")) window.dispatchEvent(new HashChangeEvent("hashchange"));
}));
