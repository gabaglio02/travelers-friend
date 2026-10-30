// Testa supabase/schema.sql + 002_perfis.sql num Postgres real (PGlite), com auth/storage simulados.
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const raiz = process.argv[2];
const db = new PGlite();

const STUBS = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, storage, auth to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
`;
const A = "aaaaaaaa-0000-0000-0000-000000000001", B = "bbbbbbbb-0000-0000-0000-000000000002", C = "cccccccc-0000-0000-0000-000000000003";
let ok = 0, falhas = 0;
const check = (nome, cond, extra = "") => { if (cond) { ok++; console.log("  ✓", nome); } else { falhas++; console.log("  ✗", nome, extra); } };

async function como(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { erro: e.message }; }
  finally { await db.exec("reset role;"); }
}
const perfil = async (uid, apelido) => (await como(uid, "select public.perfil_publico($1) as p", [apelido])).rows[0].p;

await db.exec(STUBS);
await db.exec(fs.readFileSync(raiz + "/supabase/schema.sql", "utf8"));
await db.exec(fs.readFileSync(raiz + "/supabase/002_perfis.sql", "utf8"));
console.log("✓ schema.sql e 002_perfis.sql rodaram sem erro");
console.log("✓ rodar 002 de novo (idempotente):"); await db.exec(fs.readFileSync(raiz + "/supabase/002_perfis.sql", "utf8")); console.log("  ok");
// Como no Supabase: as tabelas do public ficam liberadas para anon/authenticated e quem restringe é a RLS.
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  insert into auth.users values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x');`);

console.log("\nCriar perfis");
let r = await como(A, `insert into public.identidades (apelido, nome, bio, mensagem, destinos_desejados, maior_de_idade) values ('ana', 'Ana', 'Viajante', 'Partiu SP!', '{Paranapiacaba,Liberdade}', true) returning id, privacidade`);
check("A cria perfil principal", !r.erro, r.erro);
const idAna = r.rows[0].id;
r = await como(A, `insert into public.identidades (apelido, nome) values ('ana2', 'Ana de novo')`);
check("A não cria um segundo perfil principal", !!r.erro);
r = await como(A, `insert into public.identidades (apelido, nome, tipo) values ('Nome Ruim', 'x', 'animal')`);
check("apelido inválido é recusado", !!r.erro);
r = await como(B, `insert into public.identidades (apelido, nome, bio, maior_de_idade, privacidade) values ('bia', 'Bia', 'segredo', false, '{"perfil":"publico","bio":"publico","status":"publico","destinos":"publico","visitados":"amigos","amigos":"amigos"}') returning privacidade`);
check("sem 18+, 'publico' vira 'amigos'", r.rows && r.rows[0].privacidade.perfil === "amigos" && r.rows[0].privacidade.bio === "amigos", JSON.stringify(r));
const idBia = (await como(B, "select id from public.identidades")).rows[0].id;
r = await como(C, `insert into public.identidades (apelido, nome, maior_de_idade) values ('caio', 'Caio', true) returning id`);
const idCaio = r.rows[0].id;
r = await como(A, `insert into public.identidades (apelido, nome, privacidade, maior_de_idade) values ('x1', 'x', '{"perfil":"todo mundo"}', true)`);
check("nível de privacidade inválido é recusado", !!r.erro);
r = await como(A, `insert into public.lugares_visitados (identidade_id, lugar_id, nome, data, nota) values ('${idAna}', 'ibirapuera', 'Parque Ibirapuera', '2026-10-01', 'Lindo!') returning id`);
check("A registra lugar visitado", !r.erro, r.erro);
r = await como(B, `insert into public.lugares_visitados (identidade_id, nome) values ('${idAna}', 'invasão')`);
check("B não registra visitado no perfil de A", !!r.erro);

console.log("\nLeitura direta da tabela (RLS)");
r = await como(B, "select apelido from public.identidades");
check("B só enxerga a própria identidade", r.rows.length === 1 && r.rows[0].apelido === "bia", JSON.stringify(r.rows));
r = await como(null, "select apelido from public.identidades");
check("visitante anônimo não lê a tabela", r.rows ? r.rows.length === 0 : true);
r = await como(B, `update public.identidades set nome = 'hackeado' where id = '${idAna}' returning id`);
check("B não altera o perfil de A", (r.rows || []).length === 0);
r = await como(null, "select * from public.lugares_visitados");
check("anônimo não lê lugares visitados direto", (r.rows || []).length === 0);

console.log("\nPerfil público por seção");
let p = await perfil(null, "ana");
check("anônimo vê perfil público de A", p && p.nome === "Ana");
check("…com bio, mensagem e destinos", p.bio === "Viajante" && p.mensagem === "Partiu SP!" && p.destinos_desejados.length === 2);
check("…sem visitados nem amigos (são 'amigos')", !("visitados" in p) && !("amigos" in p));
check("…relação = visitante", p.relacao === "visitante");
check("anônimo não vê perfil de B (só amigos)", (await perfil(null, "bia")) === null);
check("apelido maiúsculo acha o mesmo perfil", (await perfil(null, "ANA"))?.nome === "Ana");
p = await perfil(A, "ana");
check("dono vê tudo do próprio perfil", p.relacao === "dono" && p.visitados.length === 1 && Array.isArray(p.amigos));

console.log("\nAmizade");
r = await como(B, `insert into public.amizades (de, para) values ('${idBia}', '${idAna}')`);
check("B pede amizade para A", !r.erro, r.erro);
r = await como(B, `update public.amizades set estado = 'aceita' where de = '${idBia}' returning *`);
check("B não pode aceitar o próprio pedido", !!r.erro || (r.rows || []).length === 0, JSON.stringify(r));
r = await como(C, `insert into public.amizades (de, para) values ('${idAna}', '${idCaio}')`);
check("C não pede amizade em nome de A", !!r.erro);
r = await como(A, `update public.amizades set estado = 'aceita' where de = '${idBia}' and para = '${idAna}' returning estado`);
check("A aceita o pedido", r.rows && r.rows[0]?.estado === "aceita", JSON.stringify(r));
p = await perfil(B, "ana");
check("amiga B vê visitados e amigos de A", p.relacao === "amigo" && p.visitados.length === 1 && p.amigos.some((x) => x.apelido === "bia"));
check("A agora vê o perfil de B (amigos)", (await perfil(A, "bia"))?.bio === "segredo");
check("C (não amigo) continua sem ver B", (await perfil(C, "bia")) === null);

console.log("\nStatus invisível");
await como(A, `update public.identidades set status = 'invisivel' where id = '${idAna}'`);
check("outros não veem 'invisível' (aparece offline)", (await perfil(null, "ana")).status === null);
check("o dono vê 'invisivel'", (await perfil(A, "ana")).status === "invisivel");

console.log("\nBloqueio");
r = await como(C, `insert into public.amizades (de, para, estado) values ('${idCaio}', '${idAna}', 'bloqueada')`);
check("C bloqueia A", !r.erro, r.erro);
check("C não vê mais A", (await perfil(C, "ana")) === null);
check("A não vê C", (await perfil(A, "caio")) === null);
check("anônimo continua vendo C", (await perfil(null, "caio"))?.nome === "Caio");

console.log("\nPrivacidade 'privado'");
await como(A, `update public.identidades set privacidade = privacidade || '{"bio":"privado"}' where id = '${idAna}'`);
check("bio privada some até para amigos", !("bio" in (await perfil(B, "ana"))));
check("…mas o dono vê", (await perfil(A, "ana")).bio === "Viajante");

console.log("\nApelido disponível");
check("'ana' ocupado para B", (await como(B, "select public.apelido_disponivel('ana') v")).rows[0].v === false);
check("'ana' livre para a própria A", (await como(A, "select public.apelido_disponivel('ana') v")).rows[0].v === true);
check("'novo_nome' livre", (await como(B, "select public.apelido_disponivel('novo_nome') v")).rows[0].v === true);
r = await como(null, "select public.apelido_disponivel('ana') v");
check("visitante anônimo não consulta apelidos", !!r.erro, JSON.stringify(r));

console.log("\nLimite de identidades");
for (let k = 1; k <= 9; k++) await como(A, `insert into public.identidades (apelido, nome, tipo) values ('persona${k}', 'P${k}', 'animal')`);
r = await como(A, `insert into public.identidades (apelido, nome, tipo) values ('persona10', 'P10', 'objeto')`);
check("11ª identidade é recusada", !!r.erro && /limite_identidades/.test(r.erro), r.erro);

console.log("\nStorage (bucket perfil)");
check("bucket 'perfil' criado como público", (await db.query("select public from storage.buckets where id = 'perfil'")).rows[0]?.public === true);
r = await como(A, `insert into storage.objects (bucket_id, name) values ('perfil', '${A}/${idAna}/avatar.jpg')`);
check("A envia avatar na própria pasta", !r.erro, r.erro);
r = await como(A, `insert into storage.objects (bucket_id, name) values ('perfil', '${B}/x.jpg')`);
check("A não envia na pasta de B", !!r.erro);

console.log("\nExcluir conta");
await como(A, "select public.excluir_minha_conta()");
check("excluir conta apaga identidades e visitados de A", (await db.query(`select count(*)::int n from public.identidades where owner_id = '${A}'`)).rows[0].n === 0
  && (await db.query(`select count(*)::int n from public.lugares_visitados where owner_id = '${A}'`)).rows[0].n === 0);
check("…e a amizade com B", (await db.query(`select count(*)::int n from public.amizades`)).rows[0].n === 0);

console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
