// Testa supabase/008_perguntas.sql num Postgres real (PGlite), com auth simulado.
// Uso: numa pasta com @electric-sql/pglite@0.2.17 instalado, `node perguntas.test.mjs <pasta-do-projeto>`.
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
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;
const A = "aaaaaaaa-0000-0000-0000-000000000001";
let ok = 0, falhas = 0;
const check = (nome, cond, extra = "") => { if (cond) { ok++; console.log("  ✓", nome); } else { falhas++; console.log("  ✗", nome, extra); } };

async function como(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { erro: e.message }; }
  finally { await db.exec("reset role;"); }
}
const enviar = (uid, texto, email = null) => como(uid, "select public.enviar_pergunta($1, $2)", [texto, email]);

await db.exec(STUBS);
await db.exec(ler("008_perguntas.sql"));
console.log("✓ 008 rodou sem erro");
await db.exec(ler("008_perguntas.sql"));
console.log("✓ 008 rodou de novo (idempotente)");
// Como no Supabase: as tabelas têm permissão para todos e quem bloqueia é o RLS (sem políticas).
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  insert into auth.users values ('${A}', 'a@x')`);

console.log("\nEnvio");
let r = await enviar(null, "Como faço para mudar a cidade da viagem?", "Pessoa@Exemplo.com ");
check("visitante sem conta envia pergunta com e-mail", !r.erro, r.erro);
r = await enviar(A, "O site funciona sem internet no celular?");
check("pessoa com conta envia sem e-mail", !r.erro, r.erro);
const linhas = (await db.query("select texto, email, autor from public.perguntas order by id")).rows;
check("e-mail guardado em minúsculas e sem espaços", linhas[0].email === "pessoa@exemplo.com", JSON.stringify(linhas[0]));
check("pergunta de visitante fica sem autor", linhas[0].autor === null);
check("pergunta com conta guarda o autor", linhas[1].autor === A);

console.log("\nValidação");
check("pergunta curta é recusada", /pergunta_curta/.test((await enviar(null, "  oi   ")).erro || ""));
check("pergunta longa é recusada", /pergunta_longa/.test((await enviar(null, "x".repeat(1001))).erro || ""));
check("e-mail inválido é recusado", /email_invalido/.test((await enviar(null, "Pergunta válida aqui?", "sem-arroba")).erro || ""));

console.log("\nLeitura e escrita direta");
r = await como(null, "select * from public.perguntas");
check("visitante não lê as perguntas", !!r.erro || r.rows.length === 0, JSON.stringify(r));
r = await como(A, "select * from public.perguntas");
check("pessoa com conta não lê nem as próprias", !!r.erro || r.rows.length === 0, JSON.stringify(r));
r = await como(null, "insert into public.perguntas (texto) values ('inserindo direto na tabela')");
check("não dá para inserir direto na tabela", !!r.erro, JSON.stringify(r));

console.log("\nLimites");
for (let i = 0; i < 4; i++) await enviar(A, "Pergunta número " + i + " da mesma conta");
r = await enviar(A, "Sexta pergunta da mesma conta no dia");
check("6ª pergunta da mesma conta no dia é recusada", /limite_perguntas/.test(r.erro || ""), r.erro);
for (let i = 0; i < 30; i++) await enviar(null, "Pergunta em massa número " + i);
const total = (await db.query("select count(*)::int n from public.perguntas")).rows[0].n;
check("no máximo 30 perguntas por hora no total", total === 30, "total = " + total);

console.log("\nGuarda de 12 meses");
await db.exec(`delete from public.perguntas; insert into public.perguntas (texto, criado_em) values ('pergunta muito antiga', now() - interval '13 months');`);
await enviar(null, "Pergunta nova que limpa as antigas");
const restantes = (await db.query("select texto from public.perguntas")).rows.map((x) => x.texto);
check("enviar apaga perguntas com mais de 12 meses", restantes.length === 1 && restantes[0].startsWith("Pergunta nova"), JSON.stringify(restantes));

console.log("\nExcluir a conta");
await enviar(A, "Pergunta de quem vai excluir a conta");
await db.exec(`delete from auth.users where id = '${A}'`);
const daConta = (await db.query(`select count(*)::int n from public.perguntas where autor = '${A}'`)).rows[0].n;
check("excluir a conta apaga as perguntas dela", daConta === 0);

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
