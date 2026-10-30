// Testa supabase/004_mural.sql (sobre schema + 002 + 003) num Postgres real (PGlite), com auth/storage simulados.
// Uso: numa pasta com @electric-sql/pglite@0.2.17 instalado, `node mural.test.mjs <pasta-do-projeto>`.
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const raiz = process.argv[2];
const db = new PGlite();
const ler = (f) => fs.readFileSync(raiz + "/supabase/" + f, "utf8");

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
const um = async (uid, sql, params) => { const r = await como(uid, sql, params); if (r.erro) throw new Error(r.erro); return r.rows[0]; };
const fn = async (uid, nome, arg) => (await como(uid, `select public.${nome}($1) as v`, [arg]));
const val = async (uid, nome, arg) => { const r = await fn(uid, nome, arg); return r.erro ? { erro: r.erro } : r.rows[0].v; };

await db.exec(STUBS);
for (const f of ["schema.sql", "002_perfis.sql", "003_limite_identidades.sql", "004_mural.sql"]) await db.exec(ler(f));
console.log("✓ schema, 002, 003 e 004 rodaram sem erro");
await db.exec(ler("004_mural.sql"));
console.log("✓ 004 rodou de novo (idempotente)");
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  insert into auth.users values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x');`);

// Ana (18+, com uma persona), Bia (sem 18+), Caio (18+)
const ana = (await um(A, `insert into public.identidades (apelido, nome, maior_de_idade) values ('ana', 'Ana', true) returning id`)).id;
const mala = (await um(A, `insert into public.identidades (apelido, nome, tipo, maior_de_idade) values ('mala', 'Mala', 'objeto', true) returning id`)).id;
const bia = (await um(B, `insert into public.identidades (apelido, nome) values ('bia', 'Bia') returning id`)).id;
const caio = (await um(C, `insert into public.identidades (apelido, nome, maior_de_idade) values ('caio', 'Caio', true) returning id`)).id;

console.log("\nPrivacidade da seção recados");
let r = await como(A, `update public.identidades set privacidade = privacidade || '{"recados":"amigos"}' where id = '${ana}' returning privacidade`);
check("seção 'recados' é aceita", !r.erro && r.rows[0].privacidade.recados === "amigos", r.erro);

console.log("\nAmizades");
r = await como(B, `insert into public.amizades (de, para) values ('${bia}', '${ana}')`);
check("Bia pede amizade para Ana", !r.erro, r.erro);
r = await como(A, `insert into public.amizades (de, para) values ('${ana}', '${bia}')`);
check("pedido duplicado (no sentido contrário) é recusado", !!r.erro && /amizade_existente/.test(r.erro), r.erro);
r = await como(A, `update public.amizades set estado = 'aceita', de = '${caio}' where de = '${bia}' and para = '${ana}' returning *`);
check("quem aceita não troca o remetente (falsificar amizade)", !!r.erro, JSON.stringify(r));
r = await como(B, `update public.amizades set estado = 'aceita' where de = '${bia}' returning *`);
check("Bia não aceita o próprio pedido", !!r.erro || (r.rows || []).length === 0, JSON.stringify(r));
r = await como(A, `update public.amizades set estado = 'aceita' where de = '${bia}' and para = '${ana}' returning estado`);
check("Ana aceita", r.rows && r.rows[0]?.estado === "aceita", JSON.stringify(r));
r = await como(B, `insert into public.amizades (de, para, estado) values ('${bia}', '${caio}', 'bloqueada')`);
check("não dá mais para criar o estado antigo 'bloqueada'", !!r.erro);
r = await como(A, `insert into public.amizades (de, para) values ('${ana}', '${mala}')`);
check("não pede amizade para a própria persona", !!r.erro);
const am = (await como(A, "select public.minhas_amizades() v")).rows[0].v;
check("minhas_amizades lista a Bia como amiga", am.length === 1 && am[0].outra.apelido === "bia" && am[0].estado === "aceita" && am[0].enviado === false, JSON.stringify(am));
check("…sem expor dados da conta", !JSON.stringify(am).includes(B));
r = await val(B, "amizade_com", ana);
check("amizade_com(ana) para Bia = aceita", r && r.estado === "aceita", JSON.stringify(r));
check("amizade_com para quem não é amigo = null", (await val(C, "amizade_com", ana)) === null);

console.log("\nÁlbuns e visibilidade");
const albPub = (await um(A, `insert into public.albuns (identidade_id, titulo, local, visibilidade, data_inicio, data_fim, lugares) values ('${ana}', 'SP em outubro', 'São Paulo', 'publico', '2026-10-01', '2026-10-05', '[{"id":"ibirapuera","nome":"Parque Ibirapuera"}]') returning id`)).id;
const albAmi = (await um(A, `insert into public.albuns (identidade_id, titulo) values ('${ana}', 'Só amigos') returning id`)).id;
const albPriv = (await um(A, `insert into public.albuns (identidade_id, titulo, visibilidade) values ('${ana}', 'Só eu', 'privado') returning id`)).id;
r = await como(A, `insert into public.albuns (identidade_id, titulo) values ('${bia}', 'invasão')`);
check("Ana não cria álbum numa identidade da Bia", !!r.erro);
r = await como(A, `insert into public.albuns (identidade_id, titulo, data_inicio, data_fim) values ('${ana}', 'datas', '2026-10-05', '2026-10-01')`);
check("data final antes da inicial é recusada", !!r.erro);
r = await um(B, `insert into public.albuns (identidade_id, titulo, visibilidade) values ('${bia}', 'Bia pública?', 'publico') returning visibilidade`);
check("sem 18+, álbum 'publico' vira 'amigos'", r.visibilidade === "amigos", JSON.stringify(r));

// Fotos no álbum público e no de amigos (arquivos no bucket privado "fotos")
for (const [id, alb] of [["11111111-0000-0000-0000-000000000001", albPub], ["11111111-0000-0000-0000-000000000002", albAmi], ["11111111-0000-0000-0000-000000000003", albPriv]]) {
  await um(A, `insert into storage.objects (bucket_id, name) values ('fotos', '${A}/${id}.jpg'), ('fotos', '${A}/${id}_t.jpg') returning id`);
  await um(A, `insert into public.fotos (id, caminho, miniatura, bytes, album_id, legenda) values ('${id}', '${A}/${id}.jpg', '${A}/${id}_t.jpg', 1000, '${alb}', 'foto') returning id`);
}
r = await como(B, `insert into public.fotos (caminho, miniatura, bytes, album_id) values ('${B}/x.jpg', '${B}/x_t.jpg', 10, '${albPub}')`);
check("Bia não põe foto no álbum da Ana", !!r.erro && /não pertence/.test(r.erro), r.erro);
r = await como(A, `update public.albuns set capa_foto = '11111111-0000-0000-0000-000000000002' where id = '${albPub}' returning capa_foto`);
check("capa precisa ser foto do próprio álbum", r.rows[0].capa_foto === null, JSON.stringify(r));

const vistos = async (uid) => ((await val(uid, "albuns_de", ana)) || []).map((a) => a.titulo).sort().join(",");
check("dona vê os 3 álbuns", (await vistos(A)) === "SP em outubro,Só amigos,Só eu", await vistos(A));
check("amiga (Bia) vê público + amigos", (await vistos(B)) === "SP em outubro,Só amigos", await vistos(B));
check("Caio (não amigo) vê só o público", (await vistos(C)) === "SP em outubro", await vistos(C));
check("visitante sem login vê só o público", (await vistos(null)) === "SP em outubro", await vistos(null));
r = await val(null, "album_detalhe", albPub);
check("album_detalhe público traz fotos e lugares", r && r.fotos.length === 1 && r.lugares[0].id === "ibirapuera" && r.dono === false, JSON.stringify(r));
check("…sem expor a conta nem a viagem", !("owner_id" in r) && !("viagem_id" in r));
check("Caio não abre o álbum de amigos", (await val(C, "album_detalhe", albAmi)) === null);
check("Bia não abre o álbum privado", (await val(B, "album_detalhe", albPriv)) === null);
r = await como(B, "select * from public.albuns where owner_id <> auth.uid()");
check("tabela albuns não é lida direto por outros", (r.rows || []).length === 0);

const arq = async (uid, nome) => ((await como(uid, `select name from storage.objects where bucket_id = 'fotos' and name = $1`, [nome])).rows || []).length === 1;
check("visitante acessa arquivo de foto do álbum público", await arq(null, `${A}/11111111-0000-0000-0000-000000000001_t.jpg`));
check("visitante NÃO acessa foto do álbum de amigos", !(await arq(null, `${A}/11111111-0000-0000-0000-000000000002.jpg`)));
check("amiga acessa foto do álbum de amigos", await arq(B, `${A}/11111111-0000-0000-0000-000000000002.jpg`));
check("amiga NÃO acessa foto do álbum privado", !(await arq(B, `${A}/11111111-0000-0000-0000-000000000003.jpg`)));

await como(A, `update public.identidades set privacidade = privacidade || '{"perfil":"privado"}' where id = '${ana}'`);
check("perfil privado esconde até o álbum público", (await vistos(null)) === "" && !(await arq(null, `${A}/11111111-0000-0000-0000-000000000001_t.jpg`)));
await como(A, `update public.identidades set privacidade = privacidade || '{"perfil":"publico"}' where id = '${ana}'`);

console.log("\nRecados");
r = await como(B, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${bia}', '  Que viagem linda!  ') returning texto`);
check("amiga deixa recado (texto sem espaços sobrando)", r.rows && r.rows[0].texto === "Que viagem linda!", JSON.stringify(r));
r = await como(C, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${caio}', 'oi')`);
check("não amigo não deixa recado", !!r.erro && /recado_so_amigos/.test(r.erro), r.erro);
r = await como(C, `insert into public.recados (alvo, autor, autor_conta, texto) values ('${ana}', '${bia}', '${B}', 'falso')`);
check("ninguém assina recado em nome de outra conta", !!r.erro);
r = await como(B, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${bia}', '   ')`);
check("recado vazio é recusado", !!r.erro);
let m = await val(B, "mural", ana);
check("mural para a amiga: visível, pode escrever como Bia", m.visivel && m.recados.length === 1 && m.autores.length === 1 && m.autores[0].apelido === "bia", JSON.stringify(m));
check("…e pode apagar o próprio recado", m.recados[0].pode_apagar === true);
m = await val(null, "mural", ana);
check("mural 'amigos' fechado para visitante", m.visivel === false && m.recados.length === 0 && m.autores.length === 0, JSON.stringify(m));
m = await val(A, "mural", ana);
check("dona vê e pode apagar recados no próprio mural", m.visivel && m.recados[0].pode_apagar === true && m.autores.length === 0);
const recId = m.recados[0].id;
r = await como(C, `delete from public.recados where id = '${recId}' returning id`);
check("terceiro não apaga recado", (r.rows || []).length === 0);
await como(A, `update public.identidades set privacidade = privacidade || '{"recados":"privado"}' where id = '${ana}'`);
r = await como(B, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${bia}', 'oi de novo')`);
check("mural desligado não recebe recados", !!r.erro && /recado_desligado/.test(r.erro), r.erro);
check("…e some para a amiga", (await val(B, "mural", ana)).visivel === false);
await como(A, `update public.identidades set privacidade = privacidade || '{"recados":"amigos"}' where id = '${ana}'`);
r = await como(A, `delete from public.recados where id = '${recId}' returning id`);
check("dona do mural apaga recado da amiga", (r.rows || []).length === 1);
for (let k = 0; k < 20; k++) await como(B, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${bia}', 'r${k}')`);
r = await como(B, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${bia}', 'r21')`);
check("limite de 20 recados por hora", !!r.erro && /limite_recados/.test(r.erro), r.erro);

console.log("\nBloqueio por conta");
r = await como(C, `insert into public.amizades (de, para) values ('${caio}', '${mala}')`);
check("Caio pede amizade para a Mala (persona da Ana)", !r.erro, r.erro);
r = await fn(C, "bloquear", mala);
check("Caio bloqueia a Mala", !r.erro, r.erro);
check("…o pedido entre as contas some", (await db.query(`select count(*)::int n from public.amizades where '${caio}' in (de, para)`)).rows[0].n === 0);
check("Caio não vê mais nem o perfil principal da Ana (bloqueio é da conta)", (await como(C, "select public.perfil_publico('ana') p")).rows[0].p === null);
check("Ana não vê o Caio", (await como(A, "select public.perfil_publico('caio') p")).rows[0].p === null);
r = await como(A, `insert into public.amizades (de, para) values ('${ana}', '${caio}')`);
check("Ana não consegue pedir amizade ao Caio", !!r.erro && /amizade_bloqueada/.test(r.erro), r.erro);
check("Caio não vê os álbuns públicos da Ana", (await vistos(C)) === "");
await fn(A, "desbloquear", caio);
check("Ana não desfaz o bloqueio feito pelo Caio", (await como(A, "select public.perfil_publico('caio') p")).rows[0].p === null);
r = await como(A, "select * from public.bloqueios");
check("tabela de bloqueios não é lida direto", (r.rows || []).length === 0);
r = await como(C, "select public.meus_bloqueios() v");
check("meus_bloqueios mostra a Mala para o Caio", r.rows[0].v.length === 1 && r.rows[0].v[0].apelido === "mala", JSON.stringify(r));
r = await fn(C, "bloquear", caio);
check("não bloqueia a própria conta", !!r.erro);
await fn(C, "desbloquear", mala);
check("Caio desbloqueia e volta a ver a Ana", (await como(C, "select public.perfil_publico('ana') p")).rows[0].p?.nome === "Ana");
await fn(B, "bloquear", ana);
check("bloquear desfaz amizade existente (Bia × Ana)", (await como(A, "select public.minhas_amizades() v")).rows[0].v.length === 0);
r = await como(B, `insert into public.recados (alvo, autor, texto) values ('${ana}', '${bia}', 'oi')`);
check("bloqueado não deixa recado", !!r.erro);
await fn(B, "desbloquear", ana);

console.log("\nDenúncias");
r = await como(C, `insert into public.denuncias (alvo_tipo, alvo_id, motivo, detalhe, estado) values ('identidade', '${mala}', 'se_passa_por_alguem', 'teste', 'removida') returning estado`);
check("Caio denuncia (e não escolhe o estado)", !r.erro && r.rows[0].estado === "aberta", JSON.stringify(r));
r = await como(C, `insert into public.denuncias (alvo_tipo, alvo_id, motivo) values ('identidade', '${mala}', 'motivo_inventado')`);
check("motivo inválido é recusado", !!r.erro);
r = await como(null, `insert into public.denuncias (alvo_tipo, alvo_id, motivo) values ('identidade', '${mala}', 'spam')`);
check("sem login não denuncia", !!r.erro);
check("quem denunciou vê a própria denúncia", (await como(C, "select * from public.denuncias")).rows.length === 1);
check("a pessoa denunciada não vê", (await como(A, "select * from public.denuncias")).rows.length === 0);

console.log("\nExcluir álbum e conta");
await como(A, `delete from public.albuns where id = '${albAmi}'`);
check("apagar álbum mantém as fotos (voltam para 'Minhas fotos')", (await db.query(`select album_id from public.fotos where id = '11111111-0000-0000-0000-000000000002'`)).rows[0].album_id === null);
await como(A, "select public.excluir_minha_conta()");
check("excluir conta apaga álbuns e identidades da Ana", (await db.query(`select (select count(*) from public.albuns where owner_id = '${A}')::int + (select count(*) from public.identidades where owner_id = '${A}')::int n`)).rows[0].n === 0);
check("…e mantém a denúncia do Caio (alvo apagado não some do histórico)", (await db.query("select count(*)::int n from public.denuncias")).rows[0].n === 1);

console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
