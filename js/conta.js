/*
 * Contas, viagens salvas e fotos — usando o Supabase.
 *
 * Todo o código que fala com o Supabase está neste arquivo: para trocar de serviço no futuro,
 * basta reescrever as funções daqui mantendo a mesma tela.
 *
 * Sem o Supabase configurado (js/config.js ou /api/config), o site funciona como antes
 * e o botão "Entrar" só explica que as contas ainda não foram ativadas.
 */
(function () {
  "use strict";

  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const LIMITE_FOTOS = 50, LIMITE_BYTES = 20 * 1024 * 1024; // iguais aos de supabase/schema.sql
  const FOTO_MAX = 1600, MINI_MAX = 400;                     // lado maior, em pixels
  const SALVAR_APOS_MS = 1500;

  const TF = window.TF;
  const $ = (s) => document.querySelector(s);
  const esc = TF.esc;

  let sb = null;          // cliente do Supabase
  let user = null;        // usuário logado
  let viagens = [];       // [{ id, nome, atualizado_em }]
  let viagemId = null;    // viagem aberta
  let view = "entrar";    // tela do diálogo
  let aviso = "";         // mensagem no topo do diálogo
  let salvarTimer = null;
  let salvando = "";      // "", "salvando", "salvo", "erro"
  let recuperandoSenha = false;
  let fotos = [], fotoAberta = null, usoFotos = { fotos: 0, bytes: 0 };

  const chaveViagem = () => "travelerfriend:viagem:" + (user ? user.id : "");
  const nomeDe = (u) => (u && u.user_metadata && u.user_metadata.nome) || (u && u.email ? u.email.split("@")[0] : "");
  const mb = (b) => (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";

  // ---------- Configuração e carga ----------
  async function lerConfig() {
    const c = window.TF_CONFIG || {};
    if (c.supabaseUrl && c.supabaseAnonKey) return c;
    if (c.apiBase === null || location.protocol === "file:") return null;
    try {
      const res = await fetch((c.apiBase || "") + "/api/config");
      const j = res.ok ? await res.json() : null;
      return j && j.supabaseUrl && j.supabaseAnonKey ? j : null;
    } catch (_) { return null; }
  }
  function carregarScript(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => falha(new Error("não carregou " + src));
      document.head.appendChild(s);
    });
  }

  // ---------- Ponte para outros módulos (js/dados/*, js/social/*) ----------
  // "pronto" resolve quando já se sabe se há Supabase e quem está logado.
  const ouvintes = [];
  let prontoOk;
  window.TFConta = {
    pronto: new Promise((ok) => (prontoOk = ok)),
    cliente: () => sb,
    usuario: () => user,
    nome: () => nomeDe(user),
    aoMudarUsuario: (fn) => ouvintes.push(fn),
    abrirLogin: () => abrir(sb ? "entrar" : "info"),
    viagemAtual: () => viagemId,
    // Minhas viagens (js/social/viagens.js). Antes de trocar, salva a viagem aberta.
    viagens: async () => { await listarViagens(); return viagens.slice(); },
    abrirViagem: async (id) => { clearTimeout(salvarTimer); await salvarAgora(); await abrirViagem(id); },
    novaViagem: async () => {
      clearTimeout(salvarTimer); await salvarAgora();
      const v = await criarViagem(TF.newState(), "Nova viagem");
      await abrirViagem(v.id);
    },
    apagarViagem: async (id) => {
      if (id === viagemId) throw new Error("Não dá para apagar a viagem aberta.");
      const { error } = await sb.from("viagens").delete().eq("id", id);
      if (error) throw error;
      viagens = viagens.filter((v) => v.id !== id);
    }
  };
  window.dispatchEvent(new Event("tf:conta"));
  const avisarMudanca = () => ouvintes.forEach((fn) => { try { fn(user); } catch (err) { console.warn(err); } });

  async function iniciar() {
    renderBotao();
    const cfg = await lerConfig();
    if (!cfg) { prontoOk(); return; } // contas desativadas
    try {
      await carregarScript(SUPABASE_JS);
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (err) {
      console.warn("[conta] Supabase indisponível:", err);
      sb = null;
      prontoOk();
      return;
    }
    sb.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") { recuperandoSenha = true; abrir("nova-senha"); }
      const antes = user && user.id;
      user = sessao ? sessao.user : null;
      renderBotao();
      if (user && user.id !== antes) setTimeout(aoEntrar, 0); // fora do callback (recomendação do supabase-js)
      if (!user && antes) aoSair();
      if ((user && user.id) !== antes) setTimeout(avisarMudanca, 0);
    });
    TF.onSave(agendarSalvar);
    try { const { data } = await sb.auth.getSession(); user = data && data.session ? data.session.user : user; } catch (_) { /* segue sem sessão */ }
    renderBotao();
    prontoOk();
  }

  // ---------- Botão do topo ----------
  function renderBotao() {
    const b = $("#accountBtn");
    if (!b) return;
    const estado = { salvando: "salvando…", salvo: "salvo ✓", erro: "não salvou ⚠" }[salvando] || "";
    b.innerHTML = user
      ? `<span class="acc-ico">👤</span> ${esc(nomeDe(user))}${estado ? ` <small>${estado}</small>` : ""}`
      : `<span class="acc-ico">👤</span> Entrar`;
    b.classList.toggle("logged", !!user);
  }

  // ---------- Viagens ----------
  function nomePadrao(st) {
    return "São Paulo · " + TF.fmtShort(st.start) + " → " + TF.fmtShort(st.end);
  }
  const CAMPOS_LISTA = "id, nome, atualizado_em, inicio:dados->>start, fim:dados->>end, cidade:dados->>city";
  async function listarViagens() {
    const { data, error } = await sb.from("viagens").select(CAMPOS_LISTA).order("atualizado_em", { ascending: false });
    if (error) throw error;
    viagens = data || [];
  }
  async function criarViagem(dados, nome) {
    const { data, error } = await sb.from("viagens").insert({ nome: nome || nomePadrao(dados), dados }).select(CAMPOS_LISTA).single();
    if (error) throw error;
    viagens.unshift(data);
    return data;
  }
  async function abrirViagem(id) {
    const { data, error } = await sb.from("viagens").select("id, nome, dados").eq("id", id).single();
    if (error) throw error;
    viagemId = data.id;
    try { localStorage.setItem(chaveViagem(), viagemId); } catch (_) { /* ignora */ }
    TF.loadState(data.dados, { silent: true });
    TF.toast("Viagem aberta: " + data.nome);
  }

  // Depois de entrar: decide o que fazer com a viagem que está no navegador.
  async function aoEntrar() {
    try {
      await listarViagens();
      let salva = null;
      try { salva = localStorage.getItem(chaveViagem()); } catch (_) { /* ignora */ }
      if (salva && viagens.some((v) => v.id === salva)) { await abrirViagem(salva); return; }
      if (!viagens.length) {
        if (TF.hasContent()) { aviso = ""; abrir("importar"); return; }
        const v = await criarViagem(TF.getState());
        viagemId = v.id;
        localStorage.setItem(chaveViagem(), viagemId);
        return;
      }
      if (TF.hasContent()) { abrir("importar"); return; }
      await abrirViagem(viagens[0].id);
    } catch (err) {
      console.warn(err);
      TF.toast("Não foi possível carregar suas viagens agora.");
    }
  }

  function aoSair() {
    viagemId = null; viagens = []; fotos = [];
    clearTimeout(salvarTimer);
    // Em computador compartilhado, não deixa a viagem da conta aberta no navegador.
    TF.loadState(TF.newState(), { silent: true });
    TF.toast("Você saiu da conta");
  }

  function agendarSalvar() {
    if (!sb || !user || !viagemId) return;
    clearTimeout(salvarTimer);
    salvando = "salvando"; renderBotao();
    salvarTimer = setTimeout(salvarAgora, SALVAR_APOS_MS);
  }
  async function salvarAgora() {
    if (!sb || !user || !viagemId) return;
    const { error } = await sb.from("viagens").update({ dados: TF.getState() }).eq("id", viagemId);
    salvando = error ? "erro" : "salvo";
    renderBotao();
    if (error) { console.warn(error); salvarTimer = setTimeout(salvarAgora, 15000); } // tenta de novo
  }

  // ---------- Fotos ----------
  // Reduz a foto no navegador; ao redesenhar no canvas, os metadados (inclusive GPS) ficam para trás.
  async function reduzir(file, max, qualidade) {
    let img;
    try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (_) { throw new Error("Formato não suportado. Envie fotos JPG ou PNG."); }
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
    if (!blob) throw new Error("Não foi possível processar a foto.");
    return blob;
  }
  async function carregarFotos() {
    const [{ data, error }, uso] = await Promise.all([
      sb.from("fotos").select("id, caminho, miniatura, bytes, legenda, viagem_id, criado_em").order("criado_em", { ascending: false }),
      sb.rpc("meu_uso_de_fotos")
    ]);
    if (error) throw error;
    fotos = data || [];
    if (uso.data && uso.data[0]) usoFotos = { fotos: uso.data[0].fotos, bytes: Number(uso.data[0].bytes) };
    if (fotos.length) {
      const { data: urls } = await sb.storage.from("fotos").createSignedUrls(fotos.map((f) => f.miniatura), 3600);
      (urls || []).forEach((u, i) => { fotos[i].url = u.signedUrl; });
    }
  }
  async function enviarFotos(arquivos, viagem, legenda) {
    for (const file of arquivos) {
      if (usoFotos.fotos >= LIMITE_FOTOS) throw new Error(`Limite de ${LIMITE_FOTOS} fotos por conta atingido.`);
      const grande = await reduzir(file, FOTO_MAX, 0.8);
      const mini = await reduzir(file, MINI_MAX, 0.7);
      const bytes = grande.size + mini.size;
      if (usoFotos.bytes + bytes > LIMITE_BYTES) throw new Error("Limite de 20 MB por conta atingido.");
      const id = crypto.randomUUID();
      const caminho = `${user.id}/${id}.jpg`, miniatura = `${user.id}/${id}_t.jpg`;
      const st = sb.storage.from("fotos");
      const a = await st.upload(caminho, grande, { contentType: "image/jpeg" });
      if (a.error) throw a.error;
      const b = await st.upload(miniatura, mini, { contentType: "image/jpeg" });
      if (b.error) { await st.remove([caminho]); throw b.error; }
      const { error } = await sb.from("fotos").insert({ id, caminho, miniatura, bytes, legenda: legenda || null, viagem_id: viagem || null });
      if (error) { await st.remove([caminho, miniatura]); throw error; }
      usoFotos.fotos++; usoFotos.bytes += bytes;
    }
  }
  async function apagarFoto(id) {
    const f = fotos.find((x) => x.id === id);
    if (!f) return;
    await sb.storage.from("fotos").remove([f.caminho, f.miniatura]);
    const { error } = await sb.from("fotos").delete().eq("id", id);
    if (error) throw error;
  }

  // ---------- Excluir conta ----------
  async function excluirConta() {
    // 1) arquivos de fotos (o Storage não deixa apagar por SQL); 2) usuário (viagens e fotos vão junto).
    const st = sb.storage.from("fotos");
    for (;;) {
      const { data, error } = await st.list(user.id, { limit: 100 });
      if (error) throw error;
      if (!data || !data.length) break;
      const r = await st.remove(data.map((o) => `${user.id}/${o.name}`));
      if (r.error) throw r.error;
    }
    const pf = sb.storage.from("perfil");
    const pastas = (await pf.list(user.id, { limit: 100 })).data || [];
    for (const pasta of pastas) {
      const prefixo = pasta.id ? user.id : `${user.id}/${pasta.name}`; // arquivo solto ou subpasta da identidade
      const arquivos = pasta.id ? [pasta] : ((await pf.list(prefixo, { limit: 100 })).data || []);
      if (arquivos.length) await pf.remove(arquivos.map((a) => `${prefixo}/${a.name}`));
    }
    const { error } = await sb.rpc("excluir_minha_conta");
    if (error) throw error;
    try { localStorage.removeItem(chaveViagem()); } catch (_) { /* ignora */ }
    await sb.auth.signOut();
  }

  // ---------- Mensagens de erro ----------
  function traduzir(err) {
    const m = String((err && err.message) || err || "");
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada e o spam).";
    if (/already registered|already been registered/i.test(m)) return "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.";
    if (/Password should be|weak/i.test(m)) return "Senha fraca: use pelo menos 8 caracteres, misturando letras e números.";
    if (/rate limit|too many/i.test(m)) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
    if (/limite_fotos/i.test(m)) return m.replace(/^.*limite_fotos:\s*/i, "Limite atingido: ");
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor. Verifique a internet.";
    return m || "Algo deu errado. Tente de novo.";
  }

  // ---------- Diálogo ----------
  function abrir(v) {
    view = v;
    render();
    const d = $("#accountDialog");
    if (!d.open) d.showModal();
  }
  function fechar() { const d = $("#accountDialog"); if (d.open) d.close(); }

  function cabecalho(titulo) {
    return `<div class="modal-head"><div><h3>${titulo}</h3><span class="small-text">Traveler's Friend</span></div>
      <button class="icon-btn" data-acc="fechar" title="Fechar">×</button></div>`;
  }
  const msg = () => aviso ? `<p class="acc-msg">${esc(aviso)}</p>` : "";

  function render() {
    const d = $("#accountDialog");
    if (!sb) {
      d.innerHTML = cabecalho("Contas") + `<div class="modal-body">
        <p>As contas ainda não foram ativadas neste site.</p>
        <p class="small-text muted">Falta ligar o Supabase (veja o README). Enquanto isso, sua viagem fica salva neste navegador.</p></div>`;
      return;
    }
    const telas = {
      entrar: () => cabecalho("Entrar") + `<form class="modal-body acc-form" data-form="entrar">${msg()}
          <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
          <label class="field"><span>Senha</span><input type="password" name="senha" autocomplete="current-password" required></label>
          <button class="btn" type="submit">Entrar</button>
          <p class="small-text"><button type="button" class="reset" data-acc="criar">Criar conta</button> ·
            <button type="button" class="reset" data-acc="esqueci">Esqueci minha senha</button></p>
        </form>`,
      criar: () => cabecalho("Criar conta") + `<form class="modal-body acc-form" data-form="criar">${msg()}
          <label class="field"><span>Nome (aparece no seu perfil)</span><input name="nome" autocomplete="name" maxlength="60" required></label>
          <label class="field"><span>Seu @ (endereço do perfil)</span>
            <span class="pf-handle">@<input name="apelido" maxlength="24" placeholder="seu_nome" autocomplete="off" autocapitalize="none" spellcheck="false" required
              title="3 a 24 letras, números ou _"></span></label>
          <label class="field"><span>Quem pode ver seu perfil</span>
            <select name="visibilidade"><option value="publico">Público — qualquer pessoa com o link</option>
              <option value="amigos">Só amigos — os outros só veem nome e foto</option><option value="privado">Só eu — ninguém encontra</option></select></label>
          <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
          <label class="field"><span>Senha (mínimo 8 caracteres)</span><input type="password" name="senha" minlength="8" autocomplete="new-password" required></label>
          <label class="field"><span>Repita a senha</span><input type="password" name="senha2" minlength="8" autocomplete="new-password" required></label>
          <label class="check"><input type="checkbox" name="idade" required> Tenho 18 anos ou mais</label>
          <label class="check"><input type="checkbox" name="aceite" required> Li e aceito a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade e as regras de uso</a></label>
          <p class="small-text muted">Seu perfil fica pronto quando você entrar pela primeira vez. Dá para mudar tudo depois em Meu perfil.</p>
          <button class="btn" type="submit">Criar conta</button>
          <p class="small-text">Já tem conta? <button type="button" class="reset" data-acc="entrar">Entrar</button></p>
        </form>`,
      esqueci: () => cabecalho("Recuperar senha") + `<form class="modal-body acc-form" data-form="esqueci">${msg()}
          <p class="small-text muted">Enviaremos um link para você criar uma nova senha.</p>
          <label class="field"><span>E-mail da conta</span><input type="email" name="email" autocomplete="email" required></label>
          <button class="btn" type="submit">Enviar link</button>
          <p class="small-text"><button type="button" class="reset" data-acc="entrar">Voltar para entrar</button></p>
        </form>`,
      "nova-senha": () => cabecalho("Nova senha") + `<form class="modal-body acc-form" data-form="nova-senha">${msg()}
          <label class="field"><span>Nova senha (mínimo 8 caracteres)</span><input type="password" name="senha" minlength="8" autocomplete="new-password" required></label>
          <label class="field"><span>Repita a nova senha</span><input type="password" name="senha2" minlength="8" autocomplete="new-password" required></label>
          <button class="btn" type="submit">Salvar nova senha</button>
        </form>`,
      importar: () => cabecalho("Sua viagem neste navegador") + `<div class="modal-body">
          <p>Você já montou uma viagem neste navegador. Quer guardá-la na sua conta?</p>
          <div class="modal-actions">
            <button class="btn" data-acc="importar-sim">Salvar na minha conta</button>
            ${viagens.length ? `<button class="btn ghost" data-acc="importar-nao">Abrir minha viagem mais recente</button>`
              : `<button class="btn ghost" data-acc="importar-zero">Começar uma viagem nova</button>`}
          </div></div>`,
      conta: () => cabecalho(esc(nomeDe(user))) + `<div class="modal-body">${msg()}
          <p class="small-text muted">${esc(user.email)}</p>
          <h4 class="acc-h">Minhas viagens</h4>
          <ul class="acc-trips">${viagens.map((v) => `
            <li class="${v.id === viagemId ? "on" : ""}">
              <span class="acc-trip-name">${v.id === viagemId ? "▶ " : ""}${esc(v.nome)}</span>
              <span class="acc-trip-actions">
                ${v.id === viagemId ? `<span class="tag">aberta</span>` : `<button class="reset" data-acc="abrir" data-id="${v.id}">abrir</button>`}
                <button class="reset" data-acc="renomear" data-id="${v.id}">renomear</button>
                ${v.id === viagemId ? "" : `<button class="reset" data-acc="apagar-viagem" data-id="${v.id}">apagar</button>`}
              </span>
            </li>`).join("") || `<li class="muted">Nenhuma viagem salva.</li>`}
          </ul>
          <div class="modal-actions">
            <button class="btn ghost small" data-acc="nova-viagem">+ Nova viagem</button>
            <a class="btn small" href="#/perfil" data-acc="fechar">👤 Meu perfil</a>
            <a class="btn ghost small" href="#/identidades" data-acc="fechar">🎭 Identidades</a>
            <a class="btn ghost small" href="#/amigos" data-acc="fechar">👥 Amigos</a>
            <button class="btn ghost small" data-acc="fotos">📷 Minhas fotos</button>
          </div>
          <div class="modal-actions acc-foot">
            <button class="btn small" data-acc="sair">Sair</button>
            <button class="reset" data-acc="excluir">Excluir minha conta</button>
          </div>
        </div>`,
      renomear: () => {
        const v = viagens.find((x) => x.id === aviso.split("|")[0]) || {};
        return cabecalho("Renomear viagem") + `<form class="modal-body acc-form" data-form="renomear" data-id="${v.id}">
          <label class="field"><span>Nome da viagem</span><input name="nome" maxlength="80" value="${esc(v.nome || "")}" required></label>
          <div class="modal-actions"><button class="btn" type="submit">Salvar</button>
          <button type="button" class="btn ghost" data-acc="conta">Cancelar</button></div></form>`;
      },
      excluir: () => cabecalho("Excluir conta") + `<form class="modal-body acc-form" data-form="excluir">${msg()}
          <p>Isso apaga <b>para sempre</b> sua conta, todas as viagens salvas e todas as fotos. Não dá para desfazer.</p>
          <label class="field"><span>Para confirmar, digite EXCLUIR</span><input name="conf" autocomplete="off" required></label>
          <div class="modal-actions"><button class="btn danger" type="submit">Excluir tudo</button>
          <button type="button" class="btn ghost" data-acc="conta">Cancelar</button></div></form>`,
      fotos: () => cabecalho("Minhas fotos") + `<div class="modal-body">${msg()}
          <div class="acc-quota">
            <span>${usoFotos.fotos} de ${LIMITE_FOTOS} fotos · ${mb(usoFotos.bytes)} de ${mb(LIMITE_BYTES)}</span>
            <span class="bar"><i style="width:${Math.min(100, Math.max(usoFotos.fotos / LIMITE_FOTOS, usoFotos.bytes / LIMITE_BYTES) * 100)}%"></i></span>
          </div>
          <form class="acc-form acc-upload" data-form="fotos">
            <label class="field"><span>Fotos (JPG ou PNG)</span><input type="file" name="arquivos" accept="image/jpeg,image/png,image/webp" multiple required></label>
            <label class="field"><span>Viagem (opcional)</span><select name="viagem"><option value="">—</option>
              ${viagens.map((v) => `<option value="${v.id}">${esc(v.nome)}</option>`).join("")}</select></label>
            <label class="field"><span>Legenda (opcional)</span><input name="legenda" maxlength="200"></label>
            <button class="btn" type="submit">Enviar</button>
            <p class="small-text muted">As fotos são reduzidas antes do envio e a localização (GPS) gravada nelas é removida. Só você vê suas fotos.</p>
          </form>
          <div class="acc-grid">${fotos.map((f) => `
            <figure><button class="acc-thumb" data-acc="ver-foto" data-id="${f.id}"><img src="${esc(f.url || "")}" alt="${esc(f.legenda || "Foto de viagem")}" loading="lazy"></button>
              <figcaption>${esc(f.legenda || "")}${f.viagem_id ? ` <span class="muted">· ${esc((viagens.find((v) => v.id === f.viagem_id) || {}).nome || "")}</span>` : ""}</figcaption></figure>`).join("")
            || `<p class="muted small-text">Nenhuma foto ainda.</p>`}</div>
          <p><button class="reset" data-acc="conta">← Voltar para a conta</button></p>
        </div>`,
      "foto": () => cabecalho(esc((fotoAberta && fotoAberta.legenda) || "Foto")) + `<div class="modal-body">
          <img class="acc-full" src="${esc(fotoAberta ? fotoAberta.full : "")}" alt="${esc((fotoAberta && fotoAberta.legenda) || "Foto de viagem")}">
          <div class="modal-actions"><button class="btn ghost small" data-acc="fotos">← Voltar</button>
            <button class="reset" data-acc="apagar-foto" data-id="${fotoAberta ? fotoAberta.id : ""}">Apagar esta foto</button></div>
        </div>`
    };
    d.innerHTML = (telas[view] || telas.entrar)();
    const primeiro = d.querySelector("input:not([type=checkbox]):not([type=file])");
    if (primeiro) setTimeout(() => primeiro.focus(), 0);
  }

  // Ações de botão dentro do diálogo.
  async function acao(nome, el) {
    aviso = "";
    try {
      switch (nome) {
        case "fechar": fechar(); return el.tagName === "A" ? (location.hash = el.getAttribute("href")) : undefined;
        case "entrar": case "criar": case "esqueci": case "excluir": return abrir(nome);
        case "conta": return abrir("conta");
        case "abrir": await abrirViagem(el.dataset.id); return abrir("conta");
        case "renomear": aviso = el.dataset.id + "|"; return abrir("renomear");
        case "apagar-viagem": {
          const { error } = await sb.from("viagens").delete().eq("id", el.dataset.id);
          if (error) throw error;
          viagens = viagens.filter((v) => v.id !== el.dataset.id);
          TF.toast("Viagem apagada");
          return abrir("conta");
        }
        case "nova-viagem": {
          const v = await criarViagem(TF.newState(), "Nova viagem");
          await abrirViagem(v.id);
          return abrir("conta");
        }
        case "importar-sim": {
          const v = await criarViagem(TF.getState());
          viagemId = v.id;
          localStorage.setItem(chaveViagem(), viagemId);
          TF.toast("Viagem salva na sua conta");
          return fechar();
        }
        case "importar-nao": await abrirViagem(viagens[0].id); return fechar();
        case "importar-zero": {
          const v = await criarViagem(TF.newState(), "Nova viagem");
          await abrirViagem(v.id);
          return fechar();
        }
        case "fotos": await carregarFotos(); return abrir("fotos");
        case "ver-foto": {
          const f = fotos.find((x) => x.id === el.dataset.id);
          const { data, error } = await sb.storage.from("fotos").createSignedUrl(f.caminho, 3600);
          if (error) throw error;
          fotoAberta = { ...f, full: data.signedUrl };
          return abrir("foto");
        }
        case "apagar-foto": await apagarFoto(el.dataset.id); await carregarFotos(); TF.toast("Foto apagada"); return abrir("fotos");
        case "sair": await sb.auth.signOut(); return fechar();
      }
    } catch (err) {
      aviso = traduzir(err);
      render();
    }
  }

  // Envio de formulários dentro do diálogo.
  async function enviar(form) {
    const f = Object.fromEntries(new FormData(form));
    const botao = form.querySelector("button[type=submit]");
    if (botao) { botao.disabled = true; botao.dataset.txt = botao.textContent; botao.textContent = "Aguarde…"; }
    aviso = "";
    try {
      switch (form.dataset.form) {
        case "entrar": {
          const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.senha });
          if (error) throw error;
          return fechar();
        }
        case "criar": {
          if (f.senha !== f.senha2) throw new Error("As senhas não são iguais.");
          const apelido = f.apelido.trim().replace(/^@/, "").toLowerCase();
          if (!/^[a-z0-9_]{3,24}$/.test(apelido)) throw new Error("O @ precisa ter de 3 a 24 letras sem acento, números ou _ (sem espaços).");
          const { data, error } = await sb.auth.signUp({
            email: f.email.trim(), password: f.senha,
            // Registro do aceite (idade mínima e versão da política) junto da conta
            // e o perfil escolhido, criado na primeira entrada (js/social/perfil.js)
            options: { data: { nome: f.nome.trim(), idade_minima: 18, politica_aceita: "2026-10-31",
              perfil_apelido: apelido, perfil_privacidade: ["publico", "amigos", "privado"].includes(f.visibilidade) ? f.visibilidade : "publico" },
              emailRedirectTo: location.origin + location.pathname }
          });
          if (error) throw error;
          if (!data.session) { aviso = "Conta criada! Enviamos um e-mail para " + f.email.trim() + ". Confirme pelo link e depois entre."; return abrir("entrar"); }
          return fechar();
        }
        case "esqueci": {
          const { error } = await sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: location.origin + location.pathname });
          if (error) throw error;
          aviso = "Se existir uma conta com esse e-mail, o link chega em alguns minutos (confira o spam).";
          return render();
        }
        case "nova-senha": {
          if (f.senha !== f.senha2) throw new Error("As senhas não são iguais.");
          const { error } = await sb.auth.updateUser({ password: f.senha });
          if (error) throw error;
          recuperandoSenha = false;
          TF.toast("Senha alterada");
          return fechar();
        }
        case "renomear": {
          const nome = f.nome.trim();
          const { error } = await sb.from("viagens").update({ nome }).eq("id", form.dataset.id);
          if (error) throw error;
          const v = viagens.find((x) => x.id === form.dataset.id);
          if (v) v.nome = nome;
          return abrir("conta");
        }
        case "excluir": {
          if (f.conf.trim().toUpperCase() !== "EXCLUIR") throw new Error("Digite EXCLUIR para confirmar.");
          await excluirConta();
          TF.toast("Conta excluída");
          return fechar();
        }
        case "fotos": {
          const arquivos = [...form.querySelector("input[type=file]").files];
          await enviarFotos(arquivos, f.viagem, f.legenda && f.legenda.trim());
          await carregarFotos();
          TF.toast(arquivos.length === 1 ? "Foto enviada" : arquivos.length + " fotos enviadas");
          return abrir("fotos");
        }
      }
    } catch (err) {
      aviso = traduzir(err);
      // Mesmo se uma foto falhar no meio, mostra as que já subiram.
      if (form.dataset.form === "fotos") { try { await carregarFotos(); } catch (_) { /* ignora */ } }
      render();
      // O formulário é redesenhado com a mensagem de erro: devolve o que foi digitado (menos senhas e arquivos).
      const novo = document.querySelector(`#accountDialog form[data-form="${form.dataset.form}"]`);
      if (novo) Object.entries(f).forEach(([k, v]) => {
        const el = novo.elements[k];
        if (!el || el.type === "password" || el.type === "file" || typeof v !== "string") return;
        if (el.type === "checkbox") el.checked = true; else el.value = v;
      });
    } finally {
      if (botao && botao.isConnected) { botao.disabled = false; botao.textContent = botao.dataset.txt; }
    }
  }

  // ---------- Eventos ----------
  document.addEventListener("click", (e) => {
    if (e.target.closest("#accountBtn")) {
      if (!sb) return abrir("info");
      if (recuperandoSenha) return abrir("nova-senha");
      if (!user) return abrir("entrar");
      return listarViagens().catch(() => {}).then(() => abrir("conta"));
    }
    const el = e.target.closest("#accountDialog [data-acc]");
    if (el) { e.preventDefault(); acao(el.dataset.acc, el); }
  });
  document.addEventListener("submit", (e) => {
    const form = e.target.closest("#accountDialog form[data-form]");
    if (form) { e.preventDefault(); enviar(form); }
  });
  document.addEventListener("click", (e) => {
    const d = $("#accountDialog");
    if (e.target === d) fechar(); // clique fora do conteúdo
  });

  iniciar();
})();
