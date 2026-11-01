/*
 * Amigos (#/amigos): pedidos recebidos e enviados, amigos de cada identidade, bloqueados e busca por @.
 * O número de pedidos recebidos aparece no link "Amigos" do topo.
 */
import { rota, ir } from "../core/router.js";
import { esc } from "../core/util.js";
import { contaPronta, minhasIdentidades, APELIDO_RE } from "../dados/perfis.js";
import * as M from "../dados/mural.js";
import { mostrar, carregando, aviso, traduzir, avatarHtml } from "./perfil.js";
import { confirmar } from "./confirmar.js";

const toast = (m) => window.TF && window.TF.toast(m);

// Contador de pedidos recebidos no link do topo.
export async function atualizarAvisoAmigos() {
  const el = document.getElementById("navAmigos");
  if (!el) return;
  try {
    const conta = await contaPronta();
    if (!conta.cliente() || !conta.usuario()) { el.hidden = true; return; }
    const n = (await M.minhasAmizades()).filter((a) => a.estado === "pendente" && !a.enviado).length;
    el.textContent = n > 99 ? "99+" : n;
    el.hidden = !n;
    el.setAttribute("aria-label", n === 1 ? "1 pedido de amizade" : `${n > 99 ? "mais de 99" : n} pedidos de amizade`);
  } catch (_) { el.hidden = true; } // banco ainda sem a 004: sem contador
}
contaPronta().then((conta) => { atualizarAvisoAmigos(); conta.aoMudarUsuario(atualizarAvisoAmigos); });

function linha(a, botoes, variasIdentidades) {
  const o = a.outra;
  return `<li class="am-linha">
    <a href="#/@${esc(o.apelido)}" class="am-quem">${avatarHtml(o, "sm")}<span><b>${esc(o.nome)}</b><span class="pf-apelido">@${esc(o.apelido)}</span></span></a>
    ${variasIdentidades ? `<span class="muted small-text am-minha">${a.enviado ? "de" : "para"} @${esc(a.minha.apelido)}</span>` : ""}
    <span class="am-botoes">${botoes}</span></li>`;
}

async function render() {
  const [lista, bloqueios, ids] = await Promise.all([M.minhasAmizades(), M.meusBloqueios(), minhasIdentidades()]);
  if (!ids.length) return aviso("Primeiro, o seu perfil", "Amizades ficam ligadas ao seu perfil. Crie o seu perfil e depois volte aqui.", `<a class="btn" href="#/perfil">Criar meu perfil</a>`);
  const varias = ids.length > 1;
  const par = (a) => `data-de="${esc(a.de)}" data-para="${esc(a.para)}"`;
  const recebidos = lista.filter((a) => a.estado === "pendente" && !a.enviado);
  const enviados = lista.filter((a) => a.estado === "pendente" && a.enviado);
  const amigos = lista.filter((a) => a.estado === "aceita");
  const bloco = (titulo, n, corpo, vazio) => `<section class="pf-bloco"><h3>${titulo} <small class="muted">${n}</small></h3>
    ${n ? `<ul class="am-lista">${corpo}</ul>` : `<p class="muted">${vazio}</p>`}</section>`;
  mostrar(`
    <section class="idt am">
      <div class="pf-form-head">
        <div><h1>Amigos</h1><p class="muted">Amizade é com pedido e aceite. Amigos veem o que você deixou "só amigos" e podem deixar recados.</p></div>
      </div>
      <form class="pf-bloco am-busca" id="amBusca">
        <label class="field"><span>Encontrar alguém pelo @</span>
          <span class="pf-handle">@<input name="apelido" maxlength="24" placeholder="apelido" autocomplete="off" autocapitalize="none"></span></label>
        <button class="btn small" type="submit">Abrir perfil</button>
      </form>
      ${bloco("Pedidos recebidos", recebidos.length, recebidos.map((a) => linha(a,
        `<button class="btn small" data-am="aceitar" ${par(a)}>Aceitar</button><button class="btn ghost small" data-am="desfazer" ${par(a)}>Recusar</button>`, varias)).join(""),
        "Nenhum pedido esperando.")}
      ${bloco("Amigos", amigos.length, amigos.map((a) => linha(a,
        `<button class="btn ghost small" data-am="desfazer" ${par(a)} data-confirma="Desfazer a amizade com @${esc(a.outra.apelido)}?">Desfazer</button>`, varias)).join(""),
        "Ainda sem amigos. Encontre alguém pelo @ e mande um pedido no perfil da pessoa.")}
      ${bloco("Pedidos enviados", enviados.length, enviados.map((a) => linha(a,
        `<button class="btn ghost small" data-am="desfazer" ${par(a)}>Cancelar</button>`, varias)).join(""),
        "Nenhum pedido enviado esperando resposta.")}
      ${bloco("Bloqueados", bloqueios.length, bloqueios.map((b) => `<li class="am-linha">
          <span class="am-quem"><span><b>${b.apelido ? esc(b.nome) : "Perfil apagado"}</b>${b.apelido ? `<span class="pf-apelido">@${esc(b.apelido)}</span>` : ""}</span></span>
          <span class="muted small-text am-minha">e as outras identidades da mesma conta</span>
          <span class="am-botoes">${b.identidade ? `<button class="btn ghost small" data-am="desbloquear" data-id="${esc(b.identidade)}">Desbloquear</button>` : ""}</span></li>`).join(""),
        "Ninguém bloqueado.")}
    </section>`, true);
}

rota("/amigos", async () => {
  carregando();
  const conta = await contaPronta();
  if (!conta.cliente()) return aviso("Amigos ainda não estão ativos", "As contas deste site ainda não foram ligadas ao banco de dados.");
  if (!conta.usuario()) return aviso("Amigos", "Entre na sua conta para ver seus amigos e pedidos.", `<button class="btn" data-pf="login">Entrar</button>`);
  try { await render(); atualizarAvisoAmigos(); }
  catch (err) { aviso("Não foi possível abrir seus amigos", esc(traduzir(err))); }
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("#socialView [data-am]");
  if (!el) return;
  if (el.dataset.confirma && !(await confirmar({ titulo: el.dataset.confirma, botao: "Desfazer amizade" }))) return;
  el.disabled = true;
  try {
    const { de, para, id } = el.dataset;
    switch (el.dataset.am) {
      case "aceitar": await M.aceitarAmizade(de, para); toast("Agora vocês são amigos!"); break;
      case "desfazer": await M.desfazerAmizade(de, para); break;
      case "desbloquear": await M.desbloquear(id); toast("Desbloqueado"); break;
    }
    await render();
    atualizarAvisoAmigos();
  } catch (err) { toast(traduzir(err)); el.disabled = false; }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "amBusca") return;
  e.preventDefault();
  const v = e.target.elements.apelido.value.trim().replace(/^@/, "").toLowerCase();
  if (!APELIDO_RE.test(v)) return toast("Digite um @ com 3 a 24 letras, números ou _.");
  ir("/@" + v);
});
