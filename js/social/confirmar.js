/*
 * Confirmação no estilo do site, no lugar do confirm() nativo: alguns navegadores, apps (WhatsApp, Instagram)
 * e o painel do app bloqueiam a caixa nativa e ela volta "cancelar" sem aparecer.
 *   if (!(await confirmar({ titulo: "Apagar foto?", texto: "…", botao: "Apagar" }))) return;
 */
import { esc } from "../core/util.js";

export function confirmar({ titulo, texto = "", botao = "Confirmar", perigo = true }) {
  return new Promise((ok) => {
    const d = document.createElement("dialog");
    d.className = "modal tf-confirmar";
    d.setAttribute("aria-labelledby", "tfConfTitulo");
    d.innerHTML = `<form method="dialog">
      <div class="modal-head"><h3 id="tfConfTitulo">${esc(titulo)}</h3></div>
      <div class="modal-body">
        ${texto ? `<p>${esc(texto)}</p>` : ""}
        <div class="modal-actions">
          <button class="btn ${perigo ? "danger" : ""}" value="sim">${esc(botao)}</button>
          <button class="btn ghost" value="nao" autofocus>Cancelar</button>
        </div>
      </div></form>`;
    document.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d) d.close("nao"); });
    d.addEventListener("close", () => { ok(d.returnValue === "sim"); d.remove(); });
    d.showModal();
  });
}
