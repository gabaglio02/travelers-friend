/*
 * Ajuda (#/ajuda): perguntas frequentes, em blocos que abrem e fecham, e a caixa de perguntas.
 * Conteúdo fixo; cada resposta descreve o que o site faz hoje.
 * A caixa grava pela função enviar_pergunta (supabase/008_perguntas.sql); ninguém lê as perguntas pelo site.
 */
import { rota } from "../core/router.js";
import { esc } from "../core/util.js";
import { contaPronta } from "../dados/perfis.js";
import { mostrar } from "./perfil.js";

const CONTATO = "travelersfriend.contato@gmail.com";

const BLOCOS = [
  { titulo: "Planejar a viagem", perguntas: [
    ["Preciso criar conta?",
      "Não. Sem conta, o roteiro fica guardado neste navegador. A conta serve para guardar várias viagens, usar em outro aparelho, " +
      "ter perfil e fotos. Contas são só para maiores de 18 anos."],
    ["Quais cidades o site cobre?",
      "Por enquanto, São Paulo e Grande SP. Outras cidades aparecem como \"em breve\" na escolha da cidade."],
    ["Como adiciono um lugar ao roteiro?",
      "No Explorar, toque no + do lugar ou evento. Ele entra no dia que está aberto no Roteiro. Lá dá para mudar a ordem, " +
      "o tempo em cada lugar e o horário de início do dia."],
    ["Para que serve a \"idade mínima\"?",
      "Coloque a idade da pessoa mais nova do grupo. O site esconde shows, festas e lugares com classificação acima dessa idade."],
    ["Como o site monta os horários?",
      "Ele soma o tempo em cada lugar, o deslocamento entre eles e as refeições, e respeita o horário de funcionamento. " +
      "Se um lugar ainda não abriu, ele espera; se não cabe, avisa. Os horários das refeições ficam em \"Refeições\", no Roteiro."],
    ["O que são as recomendações embaixo do mapa?",
      "Os destaques do dia: primeiro os eventos daquela data, depois o que é grátis só naquele dia e o que é sempre grátis. " +
      "Toque num item do roteiro para ver só o que fica perto dele."],
    ["Onde coloco o hotel ou a casa onde vou ficar?",
      "No Roteiro, em \"Hospedagem neste dia\": busque o endereço ou marque no mapa. Cada dia começa saindo da hospedagem " +
      "e termina nela. Dá para ter mais de uma hospedagem na mesma viagem."],
    ["Como mando o roteiro para alguém?",
      "No Roteiro, toque em \"Compartilhar\". O link leva os lugares e horários, mas não as hospedagens nem o orçamento."]
  ] },
  { titulo: "Custos", perguntas: [
    ["Os preços são exatos?",
      "Não. \"Confirmado\" é entrada gratuita ou preço verificado; \"estimado\" é um valor aproximado. Deslocamentos são sempre estimados, " +
      "pela distância. Hospedagem e alimentação usam os valores que você informar em Custos. Confira sempre no site oficial do lugar."],
    ["Por que um evento aparece como \"a confirmar\" ou \"exemplo\"?",
      "\"A confirmar\" tem data real, mas horário ou preço ainda podem mudar. \"Exemplo\" é ilustrativo: mostra o tipo de programa, não um evento marcado."],
    ["Como funciona o orçamento?",
      "Em Custos, informe quanto o grupo pode gastar. O site compara com o total previsto e mostra quanto sobra ou quanto passa."]
  ] },
  { titulo: "Conta e privacidade", perguntas: [
    ["Quem vê o meu perfil?",
      "Você escolhe: público, só amigos ou só eu. Dá para mudar a qualquer hora em Meu perfil, e também escolher seção por seção."],
    ["Minhas fotos ficam públicas?",
      "As fotos de \"Minhas fotos\" só você vê. Antes do envio, elas são reduzidas e a localização (GPS) gravada nelas é removida."],
    ["Como excluo minha conta?",
      "Toque no botão com seu nome, no alto da tela, e depois em \"Excluir minha conta\". Isso apaga a conta, as viagens e as fotos para sempre."]
  ] }
];

rota("/ajuda", () => {
  mostrar(`
    <section class="idt ajuda">
      <div class="pf-form-head">
        <div><h1>Ajuda</h1>
          <p class="muted">Perguntas frequentes sobre o Traveler's Friend. Toque numa pergunta para ver a resposta.</p></div>
        <a class="btn" href="#/planejar">Voltar a planejar</a>
      </div>
      ${BLOCOS.map((b) => `<section class="pf-bloco">
        <h3>${esc(b.titulo)}</h3>
        ${b.perguntas.map(([p, r]) => `<details class="faq"><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join("")}
      </section>`).join("")}
      <section class="pf-bloco" id="caixaPerguntas">
        <h3>Não achou sua dúvida?</h3>
        <form class="pf-form acc-form" data-pergunta>
          <label class="field"><span>Sua pergunta</span>
            <textarea name="texto" rows="4" minlength="10" maxlength="1000" required></textarea></label>
          <label class="field"><span>Seu e-mail (opcional, só se quiser resposta)</span>
            <input type="email" name="email" maxlength="200" autocomplete="email"></label>
          <p class="small-text muted">Lemos todas. As mais comuns viram resposta aqui na Ajuda. Não escreva dados pessoais na pergunta.
            Veja a <a href="privacidade.html">Política de Privacidade</a>.</p>
          <p class="acc-msg" data-pergunta-msg hidden></p>
          <button class="btn" type="submit">Enviar pergunta</button>
        </form>
      </section>
      <p class="muted small-text">Também dá para escrever para <a href="mailto:${CONTATO}">${CONTATO}</a>.</p>
    </section>`);
  // Com conta, já sugere o e-mail dela (a pessoa pode apagar).
  contaPronta().then((conta) => {
    const u = conta.usuario(), campo = document.querySelector("#caixaPerguntas [name=email]");
    if (u && u.email && campo && !campo.value) campo.value = u.email;
  }).catch(() => {});
});

function avisoErro(err) {
  const m = String((err && err.message) || err || "");
  if (/pergunta_curta/.test(m)) return "Escreva pelo menos 10 caracteres.";
  if (/pergunta_longa/.test(m)) return "A pergunta pode ter até 1000 caracteres.";
  if (/email_invalido/.test(m)) return "Confira o e-mail (ou deixe em branco).";
  if (/limite_perguntas/.test(m)) return "Muitas perguntas agora. Tente de novo mais tarde.";
  if (/enviar_pergunta|PGRST202|function/i.test(m)) return `A caixa de perguntas ainda não está ativa. Escreva para ${CONTATO}.`;
  return "Não foi possível enviar agora (sem conexão?). Tente de novo em instantes.";
}

document.addEventListener("submit", async (e) => {
  const form = e.target.closest("#socialView form[data-pergunta]");
  if (!form) return;
  e.preventDefault();
  const msg = form.querySelector("[data-pergunta-msg]"), botao = form.querySelector("button[type=submit]");
  const mostrarMsg = (t) => { msg.textContent = t; msg.hidden = false; };
  botao.disabled = true;
  try {
    const conta = await contaPronta();
    const sb = conta.cliente();
    if (!sb) { mostrarMsg(`A caixa de perguntas ainda não está ativa. Escreva para ${CONTATO}.`); return; }
    const { error } = await sb.rpc("enviar_pergunta", { p_texto: form.texto.value, p_email: form.email.value || null });
    if (error) throw error;
    form.texto.value = "";
    mostrarMsg("Pergunta enviada. Obrigado!" + (form.email.value ? " Se precisar, respondemos por e-mail." : ""));
  } catch (err) { mostrarMsg(avisoErro(err)); }
  finally { botao.disabled = false; }
});
