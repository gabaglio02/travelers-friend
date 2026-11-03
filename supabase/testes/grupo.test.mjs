// Testa supabase/009_grupo_conexoes.sql num Postgres real (PGlite), com auth/storage simulados.
// Uso: numa pasta com @electric-sql/pglite@0.2.17 instalado, `node grupo.test.mjs <pasta-do-projeto>`.
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
// O = organiza; X, Y, Z = outras contas
const O = "aaaaaaaa-0000-0000-0000-000000000001", X = "bbbbbbbb-0000-0000-0000-000000000002",
  Y = "cccccccc-0000-0000-0000-000000000003", Z = "dddddddd-0000-0000-0000-000000000004";
let ok = 0, falhas = 0;
const check = (nome, cond, extra = "") => { if (cond) { ok++; console.log("  ✓", nome); } else { falhas++; console.log("  ✗", nome, extra); } };

async function como(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { erro: e.message }; }
  finally { await db.exec("reset role;"); }
}
const um = async (uid, sql, params) => { const r = await como(uid, sql, params); return r.erro ? r : { v: Object.values(r.rows[0])[0] }; };
const sup = async (sql, params) => (await db.query(sql, params)).rows;

// Viagem do jeito que o site grava (state completo; o grupo com as vagas).
const vagas = (...ids) => ids.map((id) => ({ id, nome: id.replace(/^p/, "").replace(/^./, (c) => c.toUpperCase()), notas: {}, puladas: [], respondido: null }));
const dados = (participantes, extra = {}) => JSON.stringify({ city: "sp", start: "2026-11-13", end: "2026-11-15", people: 3, hotel: 400,
  stays: [{ id: "s1", nome: "Hotel secreto", endereco: "Rua Privada, 123" }], days: { "2026-11-13": { items: [{ uid: "u1", id: "masp" }] } },
  grupo: { participantes, indispensaveis: {}, ...extra } });
const criarViagem = async (uid, d, nome = "São Paulo · 13/11 → 15/11") => (await um(uid, "insert into public.viagens (nome, dados) values ($1, $2::jsonb) returning id", [nome, d])).v;
const salvar = (uid, id, d) => como(uid, "update public.viagens set dados = $2::jsonb where id = $1", [id, d]);
const convidar = (uid, viagem, vaga) => um(uid, "select public.criar_convite_grupo($1, $2)", [viagem, vaga]);
const ver = (uid, cod) => um(uid, "select public.ver_convite($1)", [cod]);
const N = (o) => JSON.stringify(o);
const aceitar = (uid, cod, notas = { museus: 5, noite: 0 }, puladas = ["compras"], origem = "pessoal") =>
  um(uid, "select public.aceitar_convite_grupo($1, $2::jsonb, $3::jsonb, $4)", [cod, N(notas), N(puladas), origem]);
const conexoes = async (uid, viagem) => { const r = await um(uid, "select public.conexoes_do_grupo($1)", [viagem]); return r.erro ? r : r.v; };
const linha = async (viagem, vaga) => (await sup("select * from public.grupo_conexoes where viagem_id = $1 and participante = $2", [viagem, vaga]))[0];

await db.exec(STUBS);
for (const f of ["schema.sql", "002_perfis.sql", "003_limite_identidades.sql", "004_mural.sql", "005_contas_18.sql", "006_perfil_so_amigos.sql", "007_compartilhar_e_erros.sql", "008_perguntas.sql"]) await db.exec(ler(f));
await db.exec(ler("009_grupo_conexoes.sql"));
console.log("✓ 009 rodou sem erro");
await db.exec(ler("009_grupo_conexoes.sql"));
console.log("✓ 009 rodou de novo (idempotente)");
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  insert into auth.users values ('${O}', 'organiza@segredo.com'), ('${X}', 'x@x'), ('${Y}', 'y@y'), ('${Z}', 'z@z');
  insert into public.identidades (owner_id, tipo, apelido, nome, maior_de_idade) values ('${O}', 'principal', 'bruno_viaja', 'Bruno', true);`);

console.log("\nAcesso direto e permissões");
const V1 = await criarViagem(O, dados(vagas("pana", "pcarla", "pdavi")));
let r = await convidar(O, V1, "pana");
const codAna = r.v && r.v.codigo;
check("organizador gera convite para uma vaga", !!codAna && /^[0-9a-f]{32}$/.test(codAna), r.erro);
check("validade de 7 dias", r.v && Math.abs(new Date(r.v.expira_em) - Date.now() - 7 * 864e5) < 60e3);
r = await como(X, "select * from public.grupo_conexoes");
check("outra conta não lê a tabela direto", !r.erro && r.rows.length === 0);
r = await como(O, "select * from public.grupo_conexoes");
check("nem o organizador lê a tabela direto", !r.erro && r.rows.length === 0);
r = await como(X, `insert into public.grupo_conexoes (viagem_id, dono, participante, vaga_nome) values ('${V1}', '${O}', 'pdavi', 'Davi')`);
check("ninguém grava na tabela direto", !!r.erro);
r = await como(X, `update public.grupo_conexoes set membro = '${X}'`);
check("ninguém altera a tabela direto", !r.erro && (await linha(V1, "pana")).membro === null);
for (const [f, args] of [["criar_convite_grupo", `'${V1}', 'pana'`], ["ver_convite", `'${codAna}'`], ["conexoes_do_grupo", `'${V1}'`], ["minhas_conexoes_grupo", ""],
  ["aceitar_convite_grupo", `'${codAna}', '{}'::jsonb, '[]'::jsonb, 'viagem'`], ["sair_do_grupo", `gen_random_uuid()`]]) {
  r = await como(null, `select public.${f}(${args})`);
  check(`sem login não chama ${f}`, !!r.erro && /permission denied|nao_autenticado/.test(r.erro), r.erro);
}
r = await como(X, "select public.grupo_codigo_hash('x')");
check("funções auxiliares não são chamáveis pelo site", !!r.erro && /permission denied/.test(r.erro), r.erro);
check("o código não fica salvo, só o hash", (await sup("select count(*)::int n from public.grupo_conexoes where codigo_hash = $1 or vaga_nome = $1", [codAna]))[0].n === 0
  && (await sup("select count(*)::int n from public.grupo_conexoes where codigo_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')", [codAna]))[0].n === 1);

console.log("\nCriar convite: só o dono, só vaga que existe");
r = await convidar(X, V1, "pana");
check("outra conta não cria convite na viagem", r.erro && /sem_permissao/.test(r.erro), r.erro);
r = await convidar(O, V1, "pninguem");
check("vaga inexistente é recusada", r.erro && /vaga_inexistente/.test(r.erro), r.erro);
const V6 = await criarViagem(O, dados(vagas("pa", "pb", "pc", "pd", "pe", "pf")));
r = await convidar(O, V6, "pa");
check("grupo com mais de 5 pessoas é recusado", r.erro && /grupo_invalido/.test(r.erro), r.erro);
const VR = await criarViagem(O, dados(vagas("pa"), { removidos: ["pzz"] }).replace('"pa"', '"pzz"'));
r = await convidar(O, VR, "pzz");
check("vaga listada como removida é recusada", r.erro && /vaga_inexistente/.test(r.erro), r.erro);

console.log("\nVer o convite: só o necessário");
r = await ver(X, codAna);
const conv = r.v || {};
check("convite mostra viagem, cidade, datas, organizador e vaga", conv.viagem === "São Paulo · 13/11 → 15/11" && conv.cidade === "sp" && conv.inicio === "2026-11-13"
  && conv.organizador === "Bruno" && conv.vaga === "Ana", r.erro || N(conv));
check("convite não traz mais nada (roteiro, hospedagem, participantes, e-mail, @)",
  N(Object.keys(conv).sort()) === N(["cidade", "expira_em", "fim", "inicio", "ja_no_grupo", "organizador", "vaga", "viagem"])
  && !/Hotel secreto|Rua Privada|masp|Carla|Davi|segredo\.com|bruno_viaja|pcarla/.test(N(conv)), N(conv));
r = await ver(X, "0".repeat(32));
const erroGenerico = r.erro;
check("código errado: erro genérico", /convite_invalido/.test(r.erro || ""), r.erro);
r = await ver(O, codAna);
check("o próprio organizador recebe o mesmo erro genérico", r.erro === erroGenerico, r.erro);
r = await ver(X, "x".repeat(5000));
check("código gigante é recusado sem processar", /convite_invalido/.test(r.erro || ""), r.erro);

console.log("\nAceitar");
r = await aceitar(O, codAna);
check("organizador não ocupa vaga da própria viagem", /convite_invalido/.test(r.erro || ""), r.erro);
for (const [nome, notas, puladas, origem] of [["nota 6", { museus: 6 }, [], "pessoal"], ["nota 2.5", { museus: 2.5 }, [], "pessoal"], ["nota em texto", { museus: "5" }, [], "pessoal"],
  ["categoria que não existe", { xyz: 3 }, [], "pessoal"], ["pulada e com nota", { museus: 3 }, ["museus"], "pessoal"], ["pulada repetida", {}, ["noite", "noite"], "pessoal"],
  ["origem inválida", { museus: 3 }, [], "hack"], ["notas não-objeto", [1, 2], [], "pessoal"]]) {
  r = await aceitar(X, codAna, notas, puladas, origem);
  check(`respostas inválidas recusadas (${nome})`, /respostas_invalidas/.test(r.erro || ""), r.erro);
}
check("depois das recusas o convite continua pendente", (await linha(V1, "pana")).estado === "pendente");
r = await aceitar(X, codAna, { museus: 5, noite: 0 }, ["compras"], "pessoal");
const conX = r.v;
check("convidado aceita com notas válidas (nota 0 e pulada separadas)", !!conX, r.erro);
let l = await linha(V1, "pana");
check("vaga conectada, código apagado (uso único)", l.estado === "conectado" && l.membro === X && l.codigo_hash === null && l.notas.noite === 0 && l.puladas[0] === "compras");
r = await aceitar(Y, codAna);
check("segunda pessoa com o mesmo código: recusada", /convite_invalido/.test(r.erro || ""), r.erro);
check("vaga continua com a primeira pessoa", (await linha(V1, "pana")).membro === X);
r = await ver(Y, codAna);
check("convite usado: erro genérico ao ver", r.erro === erroGenerico, r.erro);
r = await convidar(O, V1, "pana");
check("vaga conectada não recebe novo convite", /vaga_ocupada/.test(r.erro || ""), r.erro);
const codCarla = (await convidar(O, V1, "pcarla")).v.codigo;
r = await ver(X, codCarla);
check("convite mostra que a pessoa já está no grupo", r.v && r.v.ja_no_grupo === true);
r = await aceitar(X, codCarla);
check("mesma conta não ocupa duas vagas da viagem", /ja_no_grupo/.test(r.erro || ""), r.erro);
const codCarla2 = (await convidar(O, V1, "pcarla")).v.codigo;
r = await ver(Y, codCarla);
check("gerar novo convite invalida o anterior", r.erro === erroGenerico, r.erro);
await sup("update public.grupo_conexoes set expira_em = now() - interval '1 second' where viagem_id = $1 and participante = 'pcarla'", [V1]);
r = await aceitar(Y, codCarla2);
check("convite vencido é recusado", /convite_invalido/.test(r.erro || ""), r.erro);
let cx = await conexoes(O, V1);
check("organizador vê o convite como vencido", cx.find((c) => c.participante === "pcarla").estado === "vencido");
const codCarla3 = (await convidar(O, V1, "pcarla")).v.codigo;
check("vencido pode ser convidado de novo e aceito", !!(await aceitar(Y, codCarla3, { parques: 4 }, [], "viagem")).v);

console.log("\nO que o organizador vê");
cx = await conexoes(O, V1);
const ana = cx.find((c) => c.participante === "pana");
check("organizador vê estado e notas de cada vaga", ana.estado === "conectado" && ana.notas.museus === 5 && ana.origem === "pessoal" && ana.vaga_nome === "Ana");
check("e nada da conta da pessoa", !/bbbbbbbb|x@x|membro/.test(N(cx)), N(ana));
r = await conexoes(X, V1);
check("outra conta não vê as conexões da viagem", /sem_permissao/.test(r.erro || ""), r.erro);
r = await um(X, "select public.minhas_conexoes_grupo()");
check("participante vê o grupo em que entrou, com as notas dela", r.v && r.v.length === 1 && r.v[0].vaga === "Ana" && r.v[0].organizador === "Bruno" && r.v[0].notas.museus === 5);
check("…e nada das outras vagas", !/Carla|parques|pcarla|Hotel secreto/.test(N(r.v)), N(r.v));

console.log("\nAtualizar");
const antes = (await linha(V1, "pana")).atualizado_em;
r = await um(Y, "select public.atualizar_respostas_grupo($1, $2::jsonb, '[]'::jsonb, 'viagem')", [conX, N({ museus: 1 })]);
check("outra conta não atualiza as notas de alguém", /sem_permissao/.test(r.erro || ""), r.erro);
r = await um(O, "select public.atualizar_respostas_grupo($1, $2::jsonb, '[]'::jsonb, 'viagem')", [conX, N({ museus: 1 })]);
check("nem o organizador", /sem_permissao/.test(r.erro || ""), r.erro);
await new Promise((ok) => setTimeout(ok, 20));
r = await um(X, "select public.atualizar_respostas_grupo($1, $2::jsonb, $3::jsonb, 'viagem')", [conX, N({ museus: 2, aventura: 0 }), N(["noite"])]);
l = await linha(V1, "pana");
check("quem conectou atualiza: notas substituídas e data nova", !r.erro && l.notas.museus === 2 && l.notas.aventura === 0 && !("noite" in l.notas) && l.puladas[0] === "noite"
  && l.origem === "viagem" && new Date(l.atualizado_em) > new Date(antes), r.erro);

console.log("\nConcorrência: versão antiga da viagem aberta em outro aparelho");
await salvar(O, V1, dados(vagas("pana", "pcarla", "pdavi")).replace('"people":3', '"people":4'));
check("salvar outros campos da viagem não mexe nas conexões", (await linha(V1, "pana")).estado === "conectado" && (await linha(V1, "pcarla")).estado === "conectado");
await salvar(O, V1, dados(vagas("pdavi")));
check("versão antiga SEM as vagas (sem 'removidos') não apaga as conexões", (await linha(V1, "pana"))?.estado === "conectado" && (await linha(V1, "pcarla"))?.estado === "conectado");
cx = await conexoes(O, V1);
check("…e o organizador continua vendo as duas (o site devolve as vagas)", cx.filter((c) => c.estado === "conectado").length === 2);
await como(O, "update public.viagens set nome = 'Feriado em SP' where id = $1", [V1]);
check("renomear a viagem não mexe nas conexões", (await linha(V1, "pana"))?.estado === "conectado");

console.log("\nSaída voluntária e reutilização da vaga");
r = await um(Y, "select public.sair_do_grupo($1)", [conX]);
check("outra conta não tira alguém do grupo", /sem_permissao/.test(r.erro || ""), r.erro);
r = await um(X, "select public.sair_do_grupo($1)", [conX]);
l = await linha(V1, "pana");
check("quem conectou sai: notas apagadas, vaga 'saiu', sem dado da conta", !r.erro && l.estado === "saiu" && l.membro === null && l.notas === null && l.puladas === null && l.origem === null, r.erro);
r = await um(X, "select public.atualizar_respostas_grupo($1, $2::jsonb, '[]'::jsonb, 'viagem')", [conX, N({ museus: 3 })]);
check("depois de sair não atualiza mais", /sem_permissao/.test(r.erro || ""), r.erro);
r = await um(X, "select public.minhas_conexoes_grupo()");
check("o grupo some da lista de quem saiu", r.v && r.v.length === 0);
cx = await conexoes(O, V1);
check("organizador vê a vaga como 'saiu', sem notas", cx.find((c) => c.participante === "pana").estado === "saiu" && cx.find((c) => c.participante === "pana").notas === null);
await salvar(O, V1, dados(vagas("pana", "pcarla", "pdavi"))); // o aparelho atual do organizador salva de novo, com as vagas
const codAnaZ = (await convidar(O, V1, "pana")).v.codigo;
check("vaga que ficou livre recebe novo convite e outra conta conecta", !!(await aceitar(Z, codAnaZ)).v);
const codDavi = (await convidar(O, V1, "pdavi")).v.codigo;
check("quem saiu pode voltar por outra vaga", !!(await aceitar(X, codDavi)).v);

console.log("\nRemoção pelo organizador");
r = await um(X, "select public.cancelar_conexao_grupo($1, 'pcarla')", [V1]);
check("outra conta não remove vaga da viagem", /sem_permissao/.test(r.erro || ""), r.erro);
const conY = (await sup("select id from public.grupo_conexoes where viagem_id = $1 and participante = 'pcarla'", [V1]))[0].id;
r = await um(O, "select public.cancelar_conexao_grupo($1, 'pcarla')", [V1]);
check("organizador remove a conexão: linha e notas apagadas", r.v === true && !(await linha(V1, "pcarla")));
r = await um(Y, "select public.atualizar_respostas_grupo($1, $2::jsonb, '[]'::jsonb, 'viagem')", [conY, N({ museus: 3 })]);
check("pessoa removida não atualiza mais", /sem_permissao/.test(r.erro || ""), r.erro);
r = await um(Y, "select public.sair_do_grupo($1)", [conY]);
check("nem 'sai' de novo", /sem_permissao/.test(r.erro || ""), r.erro);
// Remoção pela lista 'removidos' (o site salva a viagem sem a vaga e com o id em removidos), mesmo sem chamar a função.
await salvar(O, V1, dados(vagas("pana"), { removidos: ["pcarla", "pdavi"] }));
check("salvar a viagem com a vaga em 'removidos' apaga a conexão (gatilho)", !(await linha(V1, "pdavi")) && (await linha(V1, "pana"))?.estado === "conectado");
await salvar(O, V1, dados(vagas("pana", "pdavi")));
check("versão antiga que ainda tinha a vaga não ressuscita a conexão", !(await linha(V1, "pdavi")));
r = await um(X, "select public.minhas_conexoes_grupo()");
check("a viagem some da lista de quem foi removido", r.v && r.v.length === 0);

console.log("\nApagar viagem ou conta");
const V2 = await criarViagem(O, dados(vagas("pana", "pbia")));
await aceitar(X, (await convidar(O, V2, "pana")).v.codigo);
await aceitar(Y, (await convidar(O, V2, "pbia")).v.codigo);
await sup("delete from auth.users where id = $1", [Y]);
check("conta excluída: conexão e notas dela apagadas", !(await linha(V2, "pbia")) && (await linha(V2, "pana"))?.estado === "conectado");
await como(O, "delete from public.viagens where id = $1", [V2]);
check("viagem apagada: todas as conexões dela apagadas", (await sup("select count(*)::int n from public.grupo_conexoes where viagem_id = $1", [V2]))[0].n === 0);

console.log("\nLimite de convites");
let ultimo;
for (let i = 0; i < 6; i++) {
  const v = await criarViagem(O, dados(vagas("pa", "pb", "pc", "pd", "pe")));
  for (const s of ["pa", "pb", "pc", "pd", "pe"]) ultimo = await convidar(O, v, s);
}
check("no máximo 20 convites por dia", /limite_convites/.test(ultimo.erro || ""), ultimo.erro);

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
