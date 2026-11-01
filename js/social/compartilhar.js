/*
 * Compartilhar roteiro por link.
 *   Botão "Compartilhar" no Roteiro → gera #/r/<código> (supabase/007_compartilhar_e_erros.sql) e mostra o link.
 *   #/r/<código> → quem recebe vê o roteiro e pode copiá-lo para as próprias viagens, escolhendo a data de ida.
 * Vai junto só o essencial (cidade, datas, pessoas, lugares, horários e refeições); hospedagens e orçamento ficam de fora.
 */
import { rota, ir } from "../core/router.js";
import { esc, parseISO, toISO, fmtDay, fmtDur } from "../core/util.js";
import { CITY_OPTIONS } from "../core/constantes.js";
import { contaPronta } from "../dados/perfis.js";
import { mostrar, carregando, aviso, traduzir } from "./perfil.js";
import { confirmar } from "./confirmar.js";

const toast = (m) => window.TF && window.TF.toast(m);
const DIA = 24 * 60 * 60 * 1000;
const nomeCidade = (id) => (CITY_OPTIONS.find((c) => c.id === id) || { nome: "São Paulo, SP" }).nome.split(",")[0];

// ---------- Gerar o link ----------
async function compartilhar(botao) {
  const conta = await contaPronta();
  if (!conta.cliente()) return toast("As contas ainda não estão ativas neste site.");
  if (!conta.usuario()) {
    if (await confirmar({ titulo: "Entre para compartilhar", texto: "O link do roteiro fica guardado na sua conta. Entre ou crie uma conta (é rápido).", botao: "Entrar" })) conta.abrirLogin();
    return;
  }
  const { nome, dados, lugares } = window.TF.compartilhavel();
  if (!lugares) return toast("Adicione lugares ao roteiro antes de compartilhar.");
  botao.disabled = true;
  try {
    const salva = (await conta.viagens().catch(() => [])).find((v) => v.id === conta.viagemAtual());
    const { data, error } = await conta.cliente().rpc("compartilhar_roteiro", {
      p_nome: (salva && salva.nome !== "Nova viagem" && salva.nome) || nome, p_dados: dados, p_autor_nome: conta.nome() || null
    });
    if (error) throw error;
    mostrarLink(location.origin + location.pathname + "#/r/" + data);
  } catch (err) {
    toast(/limite_compartilhar/.test(String(err.message)) ? "Você gerou muitos links hoje. Tente amanhã." : traduzir(err));
  } finally { botao.disabled = false; }
}

function mostrarLink(link) {
  let d = document.getElementById("shareDialog");
  if (!d) { d = document.createElement("dialog"); d.id = "shareDialog"; d.className = "modal tf-confirmar"; document.body.appendChild(d); }
  const texto = "Olha o roteiro que montei no Traveler's Friend: " + link;
  d.innerHTML = `
    <div class="modal-head"><h3>Link do roteiro</h3></div>
    <div class="modal-body">
      <p class="small-text muted">Quem abrir vê os lugares e horários e pode copiar a viagem. Hospedagem e orçamento não vão junto.</p>
      <input class="share-link" readonly value="${esc(link)}" aria-label="Link do roteiro">
      <div class="modal-actions share-botoes">
        <button class="btn" data-share="copiar">Copiar link</button>
        <a class="btn ghost" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">WhatsApp</a>
        ${navigator.share ? `<button class="btn ghost" data-share="nativo">Mais opções…</button>` : ""}
        <button class="btn ghost" data-share="fechar">Fechar</button>
      </div>
    </div>`;
  d.onclick = async (e) => {
    const b = e.target.closest("[data-share]");
    if (e.target === d || (b && b.dataset.share === "fechar")) return d.close();
    if (!b) return;
    if (b.dataset.share === "copiar") {
      try { await navigator.clipboard.writeText(link); toast("Link copiado!"); }
      catch (_) { d.querySelector(".share-link").select(); toast("Selecione e copie o link."); }
    }
    if (b.dataset.share === "nativo") navigator.share({ title: "Roteiro no Traveler's Friend", text: texto, url: link }).catch(() => {});
  };
  d.showModal();
  d.querySelector(".share-link").select();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("#shareTrip");
  if (b) compartilhar(b);
});

// ---------- Abrir um roteiro recebido ----------
// Muda as datas da viagem para começar em "novoInicio", mantendo a ordem dos dias.
function moverDatas(dados, novoInicio) {
  const delta = Math.round((parseISO(novoInicio) - parseISO(dados.start)) / DIA);
  const mover = (iso) => { const d = parseISO(iso); d.setDate(d.getDate() + delta); return toISO(d); };
  const days = {};
  Object.entries(dados.days || {}).forEach(([iso, dia]) => { days[mover(iso)] = dia; });
  return { ...dados, start: mover(dados.start), end: mover(dados.end), activeDay: mover(dados.start), days };
}

let recebido = null;
rota("/r/:id", async ({ id }) => {
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return aviso("Roteiro indisponível", "As contas deste site ainda não estão ativas.");
  try {
    const { data, error } = await conta.cliente().rpc("roteiro_compartilhado", { p_id: id });
    if (error) throw error;
    if (!data) return aviso("Roteiro não encontrado", "O link pode estar incompleto ou o roteiro foi apagado junto com a conta de quem compartilhou.",
      `<a class="btn" href="#/planejar">Planejar minha viagem</a>`);
    recebido = data;
    render();
  } catch (err) { aviso("Não foi possível abrir o roteiro", esc(traduzir(err))); }
});

function render() {
  const r = recebido, d = r.dados;
  const lugares = (window.TF_CITIES[d.city] || {}).lugares || [];
  const nomeDe = (id) => (lugares.find((p) => p.id === id) || {}).nome || (d.nomes || {})[id] || "Lugar";
  const dias = Object.keys(d.days || {}).sort();
  const total = Math.round((parseISO(d.end) - parseISO(d.start)) / DIA) + 1;
  const hoje = toISO(new Date());
  const ida = d.start >= hoje ? d.start : hoje;
  mostrar(`
    <section class="idt rot">
      <div class="pf-form-head">
        <div><p class="muted small-text">${r.autor_nome ? esc(r.autor_nome) + " compartilhou um roteiro com você" : "Roteiro compartilhado"}</p>
          <h1>${esc(r.nome)}</h1>
          <p class="muted">${esc(nomeCidade(d.city))} · ${fmtDay(d.start)} → ${fmtDay(d.end)} · ${total} ${total === 1 ? "dia" : "dias"} · ${d.people || 1} ${d.people === 1 ? "pessoa" : "pessoas"}</p></div>
      </div>
      <form class="pf-bloco rot-copiar" id="rotCopiar">
        <label class="field"><span>Quando você vai?</span><input type="date" name="ida" value="${ida}" min="${hoje}" required></label>
        <button class="btn" type="submit">Copiar para minhas viagens</button>
        <p class="muted small-text">Os dias mudam junto com a data de ida. Shows e eventos com data marcada podem não acontecer nas novas datas — o planejador avisa.</p>
      </form>
      ${dias.map((iso, i) => {
        const itens = d.days[iso].items || [];
        return `<section class="pf-bloco"><h3>Dia ${Math.round((parseISO(iso) - parseISO(d.start)) / DIA) + 1} <small class="muted">${fmtDay(iso)}</small></h3>
          ${itens.length ? `<ol class="rot-lista">${itens.map((it) => `<li><b>${esc(nomeDe(it.id))}</b>
            <span class="muted small-text">${it.at ? "às " + esc(it.at) + " · " : ""}${fmtDur(it.dur)}</span></li>`).join("")}</ol>`
            : `<p class="muted small-text">Dia livre</p>`}</section>`;
      }).join("") || `<p class="muted">Este roteiro não tem lugares.</p>`}
    </section>`, true);
}

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "rotCopiar" || !recebido) return;
  e.preventDefault();
  const botao = e.target.querySelector("button[type=submit]");
  const dados = moverDatas(recebido.dados, e.target.elements.ida.value);
  const conta = await contaPronta();
  botao.disabled = true;
  try {
    if (conta.cliente() && conta.usuario()) {
      await conta.importarViagem(dados, recebido.nome);
    } else {
      if (window.TF.hasContent() && !(await confirmar({ titulo: "Trocar a viagem deste navegador?",
        texto: "Você já tem um roteiro montado aqui. Ele será substituído. Para guardar os dois, entre numa conta antes.", botao: "Trocar", perigo: true }))) return;
      window.TF.loadState(dados, { silent: true });
    }
    toast("Roteiro copiado! Agora é só ajustar.");
    ir("/planejar");
  } catch (err) { toast(traduzir(err)); }
  finally { botao.disabled = false; }
});
