/*
 * Lado de quem é convidado para o grupo de uma viagem (supabase/009_grupo_conexoes.sql):
 *   #/grupo/<código> → vê o convite (só viagem, cidade, datas, quem organiza e a vaga), escolhe as notas
 *                      (as pessoais atuais ou respondidas só para esta viagem), confere e confirma o envio.
 *   #/grupos         → "Grupos de viagem": atualizar as notas enviadas ou sair do grupo.
 * As notas enviadas são uma cópia: as preferências pessoais (js/gosto.js) não mudam e mudanças nelas não chegam
 * sozinhas à viagem. Quem organiza não vê nada além das 8 notas.
 */
import { rota } from "../core/router.js";
import { esc, fmtShort } from "../core/util.js";
import { CITY_OPTIONS } from "../core/constantes.js";
import { contaPronta } from "../dados/perfis.js";
import { mostrar, carregando, aviso } from "./perfil.js";
import { confirmar } from "./confirmar.js";
import * as gosto from "../gosto.js";

const toast = (m) => window.TF && window.TF.toast(m);
const nomeCidade = (id) => (CITY_OPTIONS.find((c) => c.id === id) || { nome: "São Paulo, SP" }).nome.split(",")[0];
const datas = (c) => (c.inicio && c.fim ? `${fmtShort(c.inicio)} → ${fmtShort(c.fim)}` : "");
// Data e hora do banco (UTC) → dia local, "09/11".
const dataCurta = (iso) => (iso ? fmtShort(new Date(iso).toLocaleDateString("sv-SE")) : "");
// O banco não manda o nome de quem organiza se o perfil dessa pessoa estiver em "Só eu" (organizador = null).
const quem = (o) => o || "quem organiza a viagem";
const ENTRAR = `<button class="btn" data-pf="login">Entrar ou criar conta</button>`;

function mensagemErro(err) {
  const m = String((err && err.message) || err);
  if (/convite_invalido/.test(m)) return "Este convite é inválido, já foi usado ou venceu. Peça um novo link a quem organiza a viagem — cada link vale para uma pessoa e por 7 dias.";
  if (/ja_no_grupo/.test(m)) return "Você já está no grupo desta viagem, em outra vaga.";
  if (/sem_permissao/.test(m)) return "Este grupo não está mais disponível: quem organiza removeu a sua vaga ou apagou a viagem.";
  if (/respostas_invalidas/.test(m)) return "As respostas não estão no formato certo. Responda o questionário de novo.";
  if (/nao_autenticado/.test(m)) return "Entre na sua conta para continuar.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com a internet. Tente de novo.";
  return m;
}

// Tela de conferência antes de enviar: as 8 categorias com as notas, e o que acontece com elas.
function conferencia({ titulo, organizador, notas, puladas, botao, voltar, extra = "" }) {
  return `
    <section class="idt grupo-conv">
      <div class="pf-form-head"><div><h1>${esc(titulo)}</h1></div></div>
      <section class="pf-bloco">
        <h3>Notas que serão enviadas</h3>
        ${gosto.resumoHtml({ notas, puladas })}
        ${extra}
      </section>
      <section class="pf-bloco">
        <ul class="grupo-avisos">
          <li>Estas notas serão compartilhadas com <b>${esc(quem(organizador))}</b>, só no grupo desta viagem. Nada mais da sua conta é mostrado.</li>
          <li>Suas preferências pessoais (✨ Sugestões personalizadas) não mudam.</li>
          <li>Se você mudar o seu questionário pessoal depois, esta viagem <b>não</b> é atualizada sozinha.</li>
          <li>Você pode atualizar ou retirar estas notas quando quiser, em <a href="#/grupos">Grupos de viagem</a>.</li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="btn" data-gc="confirmar">${esc(botao)}</button>
          <button type="button" class="btn ghost" data-gc="${voltar}">← Voltar</button>
        </div>
        <p class="warning" id="gcErro" role="alert" hidden></p>
      </section>
    </section>`;
}

// ---------- #/grupo/<código> ----------
// pagina = { codigo, convite, tela: "escolha"|"conferir"|"pronto", notas, puladas, origem }
let pagina = null;
rota("/grupo/:codigo", async ({ codigo }) => {
  pagina = null;
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return aviso("Convite indisponível", "As contas deste site ainda não estão ativas.");
  if (!conta.usuario()) return aviso("Convite para um grupo de viagem",
    "Alguém te convidou para o grupo de uma viagem. Entre na sua conta (ou crie uma) para ver o convite — o link continua valendo até vencer.", ENTRAR);
  try {
    const { data, error } = await conta.cliente().rpc("ver_convite", { p_codigo: codigo });
    if (error) throw error;
    if (data.ja_no_grupo) return aviso("Você já está neste grupo", "Você já entrou no grupo desta viagem, em outra vaga.",
      `<a class="btn" href="#/grupos">Ver meus grupos de viagem</a>`);
    pagina = { codigo, convite: data, tela: "escolha" };
    desenhar();
  } catch (err) { aviso("Convite inválido", esc(mensagemErro(err)), `<a class="btn" href="#/planejar">Planejar minha viagem</a>`); }
});

function desenhar() {
  const p = pagina, c = p.convite;
  if (p.tela === "conferir") {
    return mostrar(conferencia({ titulo: "Confira antes de enviar", organizador: c.organizador, notas: p.notas, puladas: p.puladas,
      botao: c.organizador ? `Compartilhar com ${c.organizador}` : "Compartilhar com quem organiza", voltar: "escolha",
      extra: `<p class="small-text muted">${p.origem === "pessoal" ? "São as suas notas pessoais de hoje." : "Respondidas só para esta viagem."}</p>` }));
  }
  if (p.tela === "pronto") {
    return mostrar(`<div class="pf-vazio"><h2>Pronto! Você está no grupo</h2>
      <p class="muted">${esc(c.organizador || "Quem organiza a viagem")} já pode ver as suas notas no grupo da viagem <b>${esc(c.viagem)}</b>. Para atualizar ou sair, use Grupos de viagem.</p>
      <div class="pf-vazio-acoes"><a class="btn" href="#/grupos">Ver meus grupos de viagem</a><a class="btn ghost" href="#/planejar">Ir para o planejador</a></div></div>`);
  }
  const tem = gosto.respondeu();
  mostrar(`
    <section class="idt grupo-conv">
      <div class="pf-form-head"><div>
        <p class="muted small-text">Convite para um grupo de viagem</p>
        <h1>${esc(c.viagem)}</h1>
        <p class="muted">${esc(nomeCidade(c.cidade))} · ${esc(datas(c))}</p>
      </div></div>
      <section class="pf-bloco">
        <p class="tf-quiz-lead">${c.organizador ? `<b>${esc(c.organizador)}</b> te convidou` : "Alguém te convidou"} para o grupo desta viagem, na vaga <b>${esc(c.vaga)}</b>.</p>
        <p class="small-text muted">O grupo usa as notas de cada pessoa (de 0 a 5, em 8 tipos de passeio) para combinar o roteiro.
          Você escolhe quais notas mandar e confere tudo antes de enviar. O convite vale até ${esc(dataCurta(c.expira_em))}.</p>
        <div class="grupo-escolha">
          ${tem ? `<button type="button" class="btn" data-gc="pessoais">Usar minhas notas atuais</button>` : ""}
          <button type="button" class="btn ${tem ? "ghost" : ""}" data-gc="responder">Responder só para esta viagem</button>
          <a class="link" href="#/planejar">Agora não</a>
        </div>
        ${tem ? "" : `<p class="small-text muted">Você ainda não respondeu o questionário pessoal, então as perguntas aparecem agora (8 perguntas rápidas).</p>`}
      </section>
    </section>`);
}

// Questionário só para a viagem: começa em branco (ou com as notas já enviadas, ao atualizar) e não toca as pessoais.
function responderParaViagem({ inicial, organizador, aoTerminar }) {
  let resp = null;
  gosto.abrirQuestionario({
    intro: false,
    aoFechar: () => { if (resp) aoTerminar(resp); },
    outra: { quem: "", titulo: "👥 Notas para esta viagem", respostas: inicial || { notas: {}, puladas: [] },
      fim: `Pronto! Na próxima tela você confere as notas antes de enviar para ${quem(organizador)}.`,
      salvar: async (r) => { resp = r; } }
  });
}

async function enviar(botao) {
  const p = pagina, conta = await contaPronta();
  botao.disabled = true;
  try {
    const { error } = await conta.cliente().rpc("aceitar_convite_grupo", { p_codigo: p.codigo, p_notas: p.notas, p_puladas: p.puladas, p_origem: p.origem });
    if (error) throw error;
    p.tela = "pronto"; desenhar();
  } catch (err) {
    const el = document.getElementById("gcErro");
    if (el) { el.textContent = mensagemErro(err); el.hidden = false; }
    botao.disabled = false;
  }
}

// ---------- #/grupos ----------
let grupos = [], editando = null; // editando = { id, organizador, notas, puladas, origem }
rota("/grupos", async () => {
  editando = null;
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return aviso("Grupos de viagem", "As contas deste site ainda não estão ativas.");
  if (!conta.usuario()) return aviso("Grupos de viagem", "Entre na sua conta para ver os grupos de viagem em que você entrou.", ENTRAR);
  await carregarGrupos();
});
async function carregarGrupos() {
  try {
    const conta = await contaPronta();
    const { data, error } = await conta.cliente().rpc("minhas_conexoes_grupo");
    if (error) throw error;
    grupos = data || [];
    desenharGrupos();
  } catch (err) { aviso("Não foi possível abrir os grupos", esc(mensagemErro(err))); }
}
function desenharGrupos() {
  if (editando) {
    return mostrar(conferencia({ titulo: "Atualizar as notas deste grupo", organizador: editando.organizador, notas: editando.notas, puladas: editando.puladas,
      botao: "Enviar e substituir as anteriores", voltar: "lista",
      extra: `<p class="small-text muted">${editando.origem === "pessoal" ? "São as suas notas pessoais de hoje." : "Respondidas só para esta viagem."} Elas substituem as que você tinha enviado.</p>` }));
  }
  const tem = gosto.respondeu();
  mostrar(`
    <section class="idt grupo-conv">
      <div class="pf-form-head"><div><h1>Grupos de viagem</h1>
        <p class="muted small-text">Viagens de outras pessoas em que você entrou com a sua conta. Quem organiza vê só as 8 notas que você mandou.</p></div></div>
      ${grupos.length ? grupos.map((g) => `
        <section class="pf-bloco">
          <h3>${esc(g.viagem)} <small class="muted">${esc(nomeCidade(g.cidade))} · ${esc(datas(g))}</small></h3>
          <p class="small-text">${g.organizador ? `Organizado por <b>${esc(g.organizador)}</b> · sua vaga:` : "Sua vaga:"} <b>${esc(g.vaga)}</b> ·
            ${g.origem === "pessoal" ? "suas notas pessoais" : "notas respondidas para esta viagem"}, enviadas em ${esc(dataCurta(g.atualizado_em))}</p>
          <details><summary class="small-text">Ver as notas enviadas</summary>${gosto.resumoHtml({ notas: g.notas || {}, puladas: g.puladas || [] })}</details>
          <div class="grupo-escolha">
            ${tem ? `<button type="button" class="btn small" data-gc-atualizar="${esc(g.id)}">Atualizar com minhas notas atuais</button>` : ""}
            <button type="button" class="btn ghost small" data-gc-responder="${esc(g.id)}">Responder de novo para esta viagem</button>
            <button type="button" class="link" data-gc-sair="${esc(g.id)}">Sair deste grupo</button>
          </div>
        </section>`).join("")
        : `<div class="pf-vazio"><p class="muted">Você não está no grupo de nenhuma viagem. Quando alguém te convidar, o link traz você para cá.</p></div>`}
    </section>`);
}
async function atualizar(botao) {
  const e = editando, conta = await contaPronta();
  botao.disabled = true;
  try {
    const { error } = await conta.cliente().rpc("atualizar_respostas_grupo", { p_conexao: e.id, p_notas: e.notas, p_puladas: e.puladas, p_origem: e.origem });
    if (error) throw error;
    editando = null;
    toast("Notas atualizadas no grupo");
    await carregarGrupos();
  } catch (err) {
    const el = document.getElementById("gcErro");
    if (el) { el.textContent = mensagemErro(err); el.hidden = false; }
    botao.disabled = false;
  }
}

// ---------- Eventos ----------
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("#socialView [data-gc], #socialView [data-gc-atualizar], #socialView [data-gc-responder], #socialView [data-gc-sair]");
  if (!b || b.disabled) return;
  const acao = b.dataset.gc;
  // Página do convite
  if (pagina && location.hash.startsWith("#/grupo/")) {
    if (acao === "pessoais") {
      const g = gosto.preferencias();
      Object.assign(pagina, { tela: "conferir", notas: { ...g.notas }, puladas: [...g.puladas], origem: "pessoal" });
      return desenhar();
    }
    if (acao === "responder") {
      return responderParaViagem({ organizador: pagina.convite.organizador,
        aoTerminar: (r) => { Object.assign(pagina, { tela: "conferir", notas: r.notas, puladas: r.puladas, origem: "viagem" }); desenhar(); } });
    }
    if (acao === "escolha") { pagina.tela = "escolha"; return desenhar(); }
    if (acao === "confirmar") return enviar(b);
    return;
  }
  // Grupos de viagem
  const g = grupos.find((x) => x.id === (b.dataset.gcAtualizar || b.dataset.gcResponder || b.dataset.gcSair));
  if (b.dataset.gcAtualizar && g) {
    const p = gosto.preferencias();
    editando = { id: g.id, organizador: g.organizador, notas: { ...p.notas }, puladas: [...p.puladas], origem: "pessoal" };
    return desenharGrupos();
  }
  if (b.dataset.gcResponder && g) {
    return responderParaViagem({ inicial: { notas: g.notas || {}, puladas: g.puladas || [] }, organizador: g.organizador,
      aoTerminar: (r) => { editando = { id: g.id, organizador: g.organizador, notas: r.notas, puladas: r.puladas, origem: "viagem" }; desenharGrupos(); } });
  }
  if (b.dataset.gcSair && g) {
    if (!(await confirmar({ titulo: `Sair do grupo da viagem "${g.viagem}"?`, botao: "Sair do grupo",
      texto: `As notas que você enviou são apagadas desta viagem e ${quem(g.organizador)} deixa de vê-las. A vaga "${g.vaga}" fica livre. Suas preferências pessoais não mudam.` }))) return;
    try {
      const conta = await contaPronta();
      const { error } = await conta.cliente().rpc("sair_do_grupo", { p_conexao: g.id });
      if (error) throw error;
      toast("Você saiu do grupo e suas notas foram apagadas da viagem");
      await carregarGrupos();
    } catch (err) { toast(mensagemErro(err)); }
    return;
  }
  if (acao === "lista") { editando = null; return desenharGrupos(); }
  if (acao === "confirmar" && editando) return atualizar(b);
});

// Entrou ou saiu da conta numa destas páginas: recarrega a página atual.
contaPronta().then((conta) => conta.aoMudarUsuario(() => {
  if (/^#\/grupos?(\/|$)/.test(location.hash)) window.dispatchEvent(new HashChangeEvent("hashchange"));
}));
