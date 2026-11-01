-- Traveler's Friend · 007: roteiros compartilhados por link e registro de erros do site
-- Rode DEPOIS do 006_perfil_so_amigos.sql. Pode rodar mais de uma vez.
--
-- Roteiros: quem está logado gera um link (#/r/<código>); qualquer pessoa com o link vê o roteiro e pode copiá-lo.
--   Só o essencial vai junto (cidade, datas, pessoas, lugares e horários) — hospedagens e orçamento ficam de fora.
--   Não dá para listar os roteiros de ninguém: só abre quem tem o código.
-- Erros: o navegador de qualquer visitante registra erros de JavaScript (mensagem, página e navegador, sem dados
--   pessoais). Ninguém lê pelo site; o responsável vê no painel do Supabase (Table Editor → erros_site) e,
--   se configurado, recebe um resumo diário por e-mail (api/cron.js).

-- =========================================================
-- Roteiros compartilhados
-- =========================================================
create table if not exists public.roteiros_compartilhados (
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  autor uuid references auth.users (id) on delete cascade default auth.uid(), -- excluir a conta apaga os links
  autor_nome text check (char_length(autor_nome) <= 60),
  nome text not null check (char_length(nome) between 1 and 80),
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) < 200000),
  criado_em timestamptz not null default now()
);
create index if not exists roteiros_compartilhados_autor_idx on public.roteiros_compartilhados (autor, criado_em);
alter table public.roteiros_compartilhados enable row level security;
-- Sem políticas de leitura/escrita direta: tudo passa pelas funções abaixo.

create or replace function public.compartilhar_roteiro(p_nome text, p_dados jsonb, p_autor_nome text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare novo text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if (select count(*) from public.roteiros_compartilhados where autor = auth.uid() and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'limite_compartilhar: máximo de 30 links por dia';
  end if;
  insert into public.roteiros_compartilhados (nome, dados, autor_nome)
    values (left(coalesce(nullif(trim(p_nome), ''), 'Roteiro'), 80), p_dados, left(nullif(trim(p_autor_nome), ''), 60))
    returning id into novo;
  return novo;
end $$;
revoke all on function public.compartilhar_roteiro(text, jsonb, text) from public, anon;
grant execute on function public.compartilhar_roteiro(text, jsonb, text) to authenticated;

create or replace function public.roteiro_compartilhado(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'nome', r.nome, 'autor_nome', r.autor_nome, 'dados', r.dados, 'criado_em', r.criado_em)
  from public.roteiros_compartilhados r where r.id = p_id;
$$;
grant execute on function public.roteiro_compartilhado(text) to anon, authenticated;

-- =========================================================
-- Erros do site
-- =========================================================
create table if not exists public.erros_site (
  id bigint generated always as identity primary key,
  mensagem text not null,
  onde text,          -- arquivo:linha
  pilha text,
  pagina text,        -- rota (#/...) — sem parâmetros
  navegador text,
  vezes int not null default 1,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now()
);
create index if not exists erros_site_ultimo_idx on public.erros_site (ultimo_em);
alter table public.erros_site enable row level security;
-- Sem políticas: ninguém lê nem escreve direto pelo site.

-- Registra (ou soma) um erro. Erro igual nas últimas 24 h só aumenta "vezes".
create or replace function public.registrar_erro(p_mensagem text, p_onde text default null, p_pilha text default null,
  p_pagina text default null, p_navegador text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare msg text := left(coalesce(nullif(trim(p_mensagem), ''), '(sem mensagem)'), 500);
        lugar text := left(p_onde, 300);
begin
  update public.erros_site set vezes = vezes + 1, ultimo_em = now()
    where mensagem = msg and onde is not distinct from lugar and ultimo_em > now() - interval '1 day';
  if found then return; end if;
  -- Proteção contra enxurrada: no máximo 200 erros novos por hora no total.
  if (select count(*) from public.erros_site where primeiro_em > now() - interval '1 hour') >= 200 then return; end if;
  insert into public.erros_site (mensagem, onde, pilha, pagina, navegador)
    values (msg, lugar, left(p_pilha, 3000), left(p_pagina, 200), left(p_navegador, 300));
end $$;
grant execute on function public.registrar_erro(text, text, text, text, text) to anon, authenticated;
