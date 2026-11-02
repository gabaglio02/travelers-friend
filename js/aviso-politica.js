/*
 * Faixa no topo avisando que a Política de Privacidade mudou (a própria política promete avisar no site).
 * Some ao fechar (lembrado neste navegador) e para de aparecer sozinha depois de AVISO_ATE.
 * Para a próxima mudança, troque VERSAO, AVISO_ATE e o texto.
 */
const VERSAO = "2026-11-02";
const AVISO_ATE = "2026-12-02";
const CHAVE = "travelerfriend:politica-vista";

function jaViu() {
  try { return localStorage.getItem(CHAVE) === VERSAO; } catch (_) { return false; }
}

if (new Date().toISOString().slice(0, 10) <= AVISO_ATE && !jaViu()) {
  const faixa = document.createElement("div");
  faixa.className = "aviso-politica";
  faixa.setAttribute("role", "status");
  faixa.innerHTML = `<p>Atualizamos a Política de Privacidade em 2/11/2026: agora existe uma caixa de perguntas na Ajuda.
      <a href="privacidade.html#mudancas">Ver o que mudou</a></p>
    <button type="button" class="btn small" aria-label="Fechar aviso">Ok</button>`;
  faixa.querySelector("button").addEventListener("click", () => {
    try { localStorage.setItem(CHAVE, VERSAO); } catch (_) { /* sem storage: some só nesta visita */ }
    faixa.remove();
  });
  document.body.prepend(faixa);
}
