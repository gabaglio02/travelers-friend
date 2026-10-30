/*
 * Dados do mural de lembranças, recados, amizades, bloqueios e denúncias (Supabase).
 * Regras e permissões: supabase/004_mural.sql. Visitantes leem por funções (albuns_de, album_detalhe, mural),
 * que já devolvem só o que quem está vendo pode ver.
 */
const cli = () => window.TFConta && window.TFConta.cliente();
const uid = () => { const u = window.TFConta && window.TFConta.usuario(); return u ? u.id : null; };
function falhou(error) { if (error) throw error; }
async function rpc(nome, args) {
  const { data, error } = await cli().rpc(nome, args);
  falhou(error);
  return data;
}

export const VISIBILIDADES = { publico: "Público", amigos: "Só amigos", privado: "Só eu" };
export const MOTIVOS = {
  se_passa_por_alguem: "Se passa por outra pessoa ou marca",
  assedio: "Assédio, ofensa ou ameaça",
  conteudo_improprio: "Conteúdo impróprio (violência, nudez, ódio)",
  spam: "Spam ou golpe",
  menor_de_idade: "Parece ser de menor de idade",
  outro: "Outro motivo"
};
// Iguais aos de supabase/schema.sql e 004_mural.sql.
export const LIMITE_FOTOS = 50, LIMITE_BYTES = 20 * 1024 * 1024, LIMITE_ALBUNS = 30;
const FOTO_MAX = 1600, MINI_MAX = 400;

// ---------- Álbuns ----------
export const albunsDe = (identidadeId) => rpc("albuns_de", { p_identidade: identidadeId }).then((d) => d || []);
export const albumDetalhe = (id) => rpc("album_detalhe", { p_album: id });

export async function meuAlbum(id) {
  const { data, error } = await cli().from("albuns").select("*").eq("id", id).maybeSingle();
  falhou(error);
  return data || null;
}
const CAMPOS_ALBUM = ["identidade_id", "titulo", "descricao", "local", "lugares", "data_inicio", "data_fim", "viagem_id", "visibilidade", "capa_foto"];
export async function salvarAlbum(dados) {
  const linha = Object.fromEntries(CAMPOS_ALBUM.filter((k) => k in dados).map((k) => [k, dados[k]]));
  const q = dados.id
    ? cli().from("albuns").update(linha).eq("id", dados.id).select("*").single()
    : cli().from("albuns").insert(linha).select("*").single();
  const { data, error } = await q;
  falhou(error);
  return data;
}
// Apaga o álbum. As fotos voltam para "Minhas fotos", a menos que apagarFotos = true.
export async function apagarAlbum(id, apagarFotos) {
  if (apagarFotos) {
    const { data, error } = await cli().from("fotos").select("id, caminho, miniatura").eq("album_id", id);
    falhou(error);
    for (const f of data || []) await apagarFoto(f);
  }
  const { error } = await cli().from("albuns").delete().eq("id", id);
  falhou(error);
}

// Links temporários (1 h) para arquivos do bucket privado "fotos". Devolve { caminho: url }.
export async function urlsDe(caminhos) {
  const lista = [...new Set(caminhos.filter(Boolean))];
  if (!lista.length) return {};
  const { data } = await cli().storage.from("fotos").createSignedUrls(lista, 3600);
  const out = {};
  (data || []).forEach((u, i) => { if (u && u.signedUrl) out[lista[i]] = u.signedUrl; });
  return out;
}

// ---------- Fotos ----------
export async function usoDeFotos() {
  const d = await rpc("meu_uso_de_fotos");
  const u = (d && d[0]) || { fotos: 0, bytes: 0 };
  return { fotos: u.fotos, bytes: Number(u.bytes) };
}
// Reduz no navegador; ao redesenhar no canvas, os metadados (inclusive GPS) ficam para trás.
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
// Envia fotos direto para um álbum. aoAvancar(n) é chamado depois de cada foto.
export async function enviarFotos(albumId, arquivos, extra = {}, aoAvancar = () => {}) {
  const uso = await usoDeFotos();
  let n = 0;
  for (const file of arquivos) {
    if (uso.fotos >= LIMITE_FOTOS) throw new Error(`Limite de ${LIMITE_FOTOS} fotos por conta atingido.`);
    const grande = await reduzir(file, FOTO_MAX, 0.8);
    const mini = await reduzir(file, MINI_MAX, 0.7);
    const bytes = grande.size + mini.size;
    if (uso.bytes + bytes > LIMITE_BYTES) throw new Error("Limite de 20 MB por conta atingido.");
    const id = crypto.randomUUID();
    const caminho = `${uid()}/${id}.jpg`, miniatura = `${uid()}/${id}_t.jpg`;
    const st = cli().storage.from("fotos");
    const a = await st.upload(caminho, grande, { contentType: "image/jpeg" });
    falhou(a.error);
    const b = await st.upload(miniatura, mini, { contentType: "image/jpeg" });
    if (b.error) { await st.remove([caminho]); throw b.error; }
    const { error } = await cli().from("fotos").insert({
      id, caminho, miniatura, bytes, album_id: albumId, tirada_em: extra.tirada_em || null, local: extra.local || null
    });
    if (error) { await st.remove([caminho, miniatura]); throw error; }
    uso.fotos++; uso.bytes += bytes;
    aoAvancar(++n);
  }
}
export async function fotosSemAlbum() {
  const { data, error } = await cli().from("fotos").select("id, caminho, miniatura, legenda, criado_em").is("album_id", null).order("criado_em", { ascending: false });
  falhou(error);
  return data || [];
}
export async function moverFotos(ids, albumId) {
  if (!ids.length) return;
  const { error } = await cli().from("fotos").update({ album_id: albumId }).in("id", ids);
  falhou(error);
}
export async function editarFoto(id, campos) {
  const { error } = await cli().from("fotos").update(campos).eq("id", id);
  falhou(error);
}
export async function apagarFoto(f) {
  await cli().storage.from("fotos").remove([f.caminho, f.miniatura]);
  const { error } = await cli().from("fotos").delete().eq("id", f.id);
  falhou(error);
}

// ---------- Recados ----------
export const mural = (identidadeId) => rpc("mural", { p_identidade: identidadeId });
export async function deixarRecado(alvo, autor, texto) {
  const { error } = await cli().from("recados").insert({ alvo, autor, texto });
  falhou(error);
}
export async function apagarRecado(id) {
  const { error } = await cli().from("recados").delete().eq("id", id);
  falhou(error);
}

// ---------- Amizades e bloqueios ----------
export const minhasAmizades = () => rpc("minhas_amizades").then((d) => d || []);
export const amizadeCom = (identidadeId) => rpc("amizade_com", { p_identidade: identidadeId });
export async function pedirAmizade(de, para) {
  const { error } = await cli().from("amizades").insert({ de, para });
  falhou(error);
}
export async function aceitarAmizade(de, para) {
  const { error } = await cli().from("amizades").update({ estado: "aceita" }).eq("de", de).eq("para", para);
  falhou(error);
}
// Recusar, cancelar pedido ou desfazer amizade.
export async function desfazerAmizade(de, para) {
  const { error } = await cli().from("amizades").delete().eq("de", de).eq("para", para);
  falhou(error);
}
export const bloquear = (identidadeId) => rpc("bloquear", { p_identidade: identidadeId });
export const desbloquear = (identidadeId) => rpc("desbloquear", { p_identidade: identidadeId });
export const meusBloqueios = () => rpc("meus_bloqueios").then((d) => d || []);

// ---------- Denúncias ----------
export async function denunciar(alvoTipo, alvoId, motivo, detalhe) {
  const { error } = await cli().from("denuncias").insert({ alvo_tipo: alvoTipo, alvo_id: alvoId, motivo, detalhe: detalhe || null });
  falhou(error);
}
