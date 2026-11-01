/*
 * Minhas viagens (#/viagens): as viagens da conta separadas em "Por vir" (inclui as que estão acontecendo)
 * e "Antigas". Abrir uma viagem leva para o planejador (#/planejar).
 * Sem conta, mostra a viagem guardada neste navegador.
 */
import { rota, ir } from "../core/router.js";
import { esc, parseISO, toISO, fmtDay } from "../core/util.js";
import { CITY_OPTIONS } from "../core/constantes.js";
import { contaPronta } from "../dados/perfis.js";
import { mostrar, carregando, aviso, traduzir } from "./perfil.js";
import { confirmar } from "./confirmar.js";

const toast = (m) => window.TF && window.TF.toast(m);
const DIA = 24 * 60 * 60 * 1000;
const hoje = () => toISO(new Date());
const dias = (de, ate) => Math.round((parseISO(ate) - parseISO(de)) / DIA);
const nomeCidade = (id) => (CITY_OPTIONS.find((c) => c.id === id) || { nome: "São Paulo, SP" }).nome.split(",")[0];

// "Começa em 5 dias", "Acontecendo agora", "Terminou há 2 meses"...
function quando(v) {
  if (!v.inicio || !v.fim) return "";
  const h = hoje();
  if (v.inicio <= h && v.fim >= h) return "Acontecendo agora";
  const n = v.inicio > h ? dias(h, v.inicio) : dias(v.fim, h);
  const txt = n === 1 ? "1 dia" : n < 45 ? n + " dias" : n < 365 ? Math.round(n / 30) + " meses" : Math.round(n / 365) === 1 ? "1 ano" : Math.round(n / 365) + " anos";
  return v.inicio > h ? (n === 1 ? "Começa amanhã" : "Começa em " + txt) : (n === 1 ? "Terminou ontem" : "Terminou há " + txt);
}

function cartao(v, aberta, logado) {
  const n = v.inicio && v.fim ? dias(v.inicio, v.fim) + 1 : 0;
  const datas = v.inicio && v.fim ? `${fmtDay(v.inicio)} → ${fmtDay(v.fim)} · ${n} ${n === 1 ? "dia" : "dias"}` : "Sem datas";
  return `<li class="vg-card ${aberta ? "on" : ""}">
    <div class="vg-info">
      <span><b>${esc(v.nome)}</b>${aberta ? ` <span class="tag">aberta</span>` : ""}</span>
      <span class="muted small-text">${esc(nomeCidade(v.cidade))} · ${datas}</span>
      ${quando(v) ? `<span class="vg-quando">${quando(v)}</span>` : ""}
    </div>
    <div class="vg-botoes">
      ${logado ? `<button class="btn small" data-vg="abrir" data-id="${esc(v.id)}">${aberta ? "Continuar" : "Abrir"}</button>`
        : `<a class="btn small" href="#/planejar">Continuar</a>`}
      ${logado && !aberta ? `<button class="btn ghost small" data-vg="apagar" data-id="${esc(v.id)}" data-nome="${esc(v.nome)}">Apagar</button>` : ""}
    </div></li>`;
}

async function render() {
  const conta = await contaPronta();
  const logado = !!(conta.cliente() && conta.usuario());
  const st = window.TF.getState();
  let lista;
  if (logado) {
    // A viagem aberta usa as datas do planejador (podem ser mais novas que as salvas).
    lista = (await conta.viagens()).map((v) => v.id === conta.viagemAtual() ? { ...v, inicio: st.start, fim: st.end, cidade: st.city } : v);
  } else {
    lista = [{ id: "", nome: "Viagem neste navegador", inicio: st.start, fim: st.end, cidade: st.city }];
  }
  const h = hoje();
  const porVir = lista.filter((v) => !v.fim || v.fim >= h).sort((a, b) => (a.inicio || "9").localeCompare(b.inicio || "9"));
  const antigas = lista.filter((v) => v.fim && v.fim < h).sort((a, b) => b.fim.localeCompare(a.fim));
  const aberta = logado ? conta.viagemAtual() : "";
  const bloco = (titulo, itens, vazio) => `<section class="pf-bloco"><h3>${titulo} <small class="muted">${itens.length}</small></h3>
    ${itens.length ? `<ul class="vg-lista">${itens.map((v) => cartao(v, logado ? v.id === aberta : true, logado)).join("")}</ul>` : `<p class="muted">${vazio}</p>`}</section>`;
  mostrar(`
    <section class="idt vg">
      <div class="pf-form-head">
        <div><h1>Minhas viagens</h1>
          <p class="muted">${logado ? "Suas viagens salvas na conta. Abra uma para continuar planejando." : "Sem conta, a viagem fica só neste navegador."}</p></div>
        ${logado ? `<button class="btn" data-vg="nova">+ Nova viagem</button>` : `<button class="btn" data-pf="login">Entrar para guardar várias</button>`}
      </div>
      ${bloco("Por vir", porVir, "Nenhuma viagem marcada. Crie uma nova!")}
      ${bloco("Antigas", antigas, "As viagens que já passaram aparecem aqui.")}
    </section>`, true);
}

rota("/viagens", async () => {
  carregando();
  try { await render(); }
  catch (err) { aviso("Não foi possível abrir suas viagens", esc(traduzir(err))); }
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("#socialView [data-vg]");
  if (!el) return;
  const conta = await contaPronta();
  try {
    switch (el.dataset.vg) {
      case "abrir":
        el.disabled = true;
        if (el.dataset.id !== conta.viagemAtual()) await conta.abrirViagem(el.dataset.id);
        return ir("/planejar");
      case "nova":
        el.disabled = true;
        await conta.novaViagem();
        return ir("/planejar");
      case "apagar":
        if (!(await confirmar({ titulo: `Apagar “${el.dataset.nome}”?`, texto: "O roteiro dessa viagem some para sempre. As fotos e lembranças continuam.", botao: "Apagar viagem", perigo: true }))) return;
        await conta.apagarViagem(el.dataset.id);
        toast("Viagem apagada");
        return render();
    }
  } catch (err) { toast(traduzir(err)); el.disabled = false; }
});
