/*
 * Dados de perfis (Supabase). Junto com js/conta.js, é o único lugar que fala com o banco
 * sobre identidades: trocar de serviço = reescrever estas funções mantendo as mesmas assinaturas.
 * Tabelas e regras: supabase/002_perfis.sql.
 */

// Espera o js/conta.js terminar de iniciar (saber se há Supabase e quem está logado).
export async function contaPronta() {
  if (!window.TFConta) await new Promise((ok) => window.addEventListener("tf:conta", ok, { once: true }));
  await window.TFConta.pronto;
  return window.TFConta;
}
const cli = () => window.TFConta && window.TFConta.cliente();
const uid = () => { const u = window.TFConta && window.TFConta.usuario(); return u ? u.id : null; };
function falhou(error) { if (error) throw error; }

export const APELIDO_RE = /^[a-z0-9_]{3,24}$/;
export const NIVEIS = ["publico", "amigos", "privado"];
export const SECOES = {
  perfil: "Perfil inteiro", status: "Status e mensagem", bio: "Sobre mim",
  destinos: "Quero conhecer", visitados: "Lugares visitados", amigos: "Lista de amigos"
};
export const PRIVACIDADE_PADRAO = { perfil: "publico", bio: "publico", status: "publico", destinos: "publico", visitados: "amigos", amigos: "amigos" };

// Perfil como um visitante (ou o dono) pode ver — o banco já filtra por seção. null = não existe ou é privado.
export async function perfilPublico(apelido) {
  const { data, error } = await cli().rpc("perfil_publico", { p_apelido: apelido });
  falhou(error);
  return data || null;
}

// Identidade principal da conta logada (ou null se ainda não criou).
export async function minhaPrincipal() {
  const { data, error } = await cli().from("identidades").select("*").eq("tipo", "principal").maybeSingle();
  falhou(error);
  return data || null;
}

export async function apelidoDisponivel(apelido) {
  if (!APELIDO_RE.test(apelido)) return false;
  const { data, error } = await cli().rpc("apelido_disponivel", { p_apelido: apelido });
  falhou(error);
  return !!data;
}

const CAMPOS = ["tipo", "apelido", "nome", "bio", "mensagem", "status", "avatar", "avatar_emoji", "capa", "tema", "destinos_desejados", "privacidade", "maior_de_idade"];
export async function salvarIdentidade(dados) {
  const linha = Object.fromEntries(CAMPOS.filter((k) => k in dados).map((k) => [k, dados[k]]));
  const q = dados.id
    ? cli().from("identidades").update(linha).eq("id", dados.id).select("*").single()
    : cli().from("identidades").insert(linha).select("*").single();
  const { data, error } = await q;
  falhou(error);
  return data;
}

// ---------- Lugares visitados ----------
export async function meusVisitados(identidadeId) {
  const { data, error } = await cli().from("lugares_visitados").select("*").eq("identidade_id", identidadeId).order("data", { ascending: false });
  falhou(error);
  return data || [];
}
export async function adicionarVisitado(identidadeId, v) {
  const { data, error } = await cli().from("lugares_visitados")
    .insert({ identidade_id: identidadeId, lugar_id: v.lugar_id || null, nome: v.nome, cidade: v.cidade || null, lat: v.lat ?? null, lng: v.lng ?? null, data: v.data || null, nota: v.nota || null })
    .select("*").single();
  falhou(error);
  return data;
}
export async function removerVisitado(id) {
  const { error } = await cli().from("lugares_visitados").delete().eq("id", id);
  falhou(error);
}

// ---------- Avatar e capa (bucket público "perfil": <conta>/<identidade>/<arquivo>) ----------
export function urlImagem(caminho) {
  if (!caminho || !cli()) return null;
  return cli().storage.from("perfil").getPublicUrl(caminho).data.publicUrl;
}
export async function enviarImagem(identidadeId, tipo, blob, anterior) {
  const caminho = `${uid()}/${identidadeId}/${tipo}-${Date.now()}.jpg`;
  const st = cli().storage.from("perfil");
  const { error } = await st.upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  falhou(error);
  if (anterior) await st.remove([anterior]); // não deixa arquivo velho ocupando espaço
  return caminho;
}
export async function removerImagem(caminho) {
  if (caminho) await cli().storage.from("perfil").remove([caminho]);
}

// ---------- Identidades (perfil principal + personas) ----------
export const LIMITE_IDENTIDADES = 3; // perfil principal + 2 personas; igual ao do banco (supabase/003_limite_identidades.sql)
export async function minhasIdentidades() {
  const { data, error } = await cli().from("identidades").select("*").order("criado_em", { ascending: true });
  falhou(error);
  // Principal sempre primeiro.
  return (data || []).sort((a, b) => (a.tipo === "principal" ? -1 : b.tipo === "principal" ? 1 : 0));
}
export async function identidadePorId(id) {
  const { data, error } = await cli().from("identidades").select("*").eq("id", id).maybeSingle();
  falhou(error);
  return data || null;
}
// Apaga a persona e os arquivos dela (avatar/capa). Lugares visitados e amizades saem junto (on delete cascade).
export async function apagarIdentidade(id) {
  const st = cli().storage.from("perfil");
  const pasta = `${uid()}/${id}`;
  const { data } = await st.list(pasta, { limit: 100 });
  if (data && data.length) await st.remove(data.map((a) => `${pasta}/${a.name}`));
  const { error } = await cli().from("identidades").delete().eq("id", id).neq("tipo", "principal");
  falhou(error);
}
