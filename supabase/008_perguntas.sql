-- Traveler's Friend · 008: caixa de perguntas (página Ajuda, #/ajuda)
-- Rode DEPOIS do 007_compartilhar_e_erros.sql. Pode rodar mais de uma vez.
--
-- Qualquer visitante (com ou sem conta) manda uma pergunta, com e-mail opcional para receber resposta.
-- Ninguém lê pelo site: o responsável vê no painel do Supabase (Table Editor → perguntas) e, se configurado,
-- recebe as perguntas novas no resumo diário por e-mail (api/cron.js → server/avisos.js).
-- Proteções: 10 a 1000 caracteres, até 5 perguntas por conta por dia e 30 no total por hora.
-- Guarda: perguntas com mais de 12 meses são apagadas a cada envio; excluir a conta apaga as perguntas dela.

create table if not exists public.perguntas (
  id bigint generated always as identity primary key,
  texto text not null check (char_length(texto) between 10 and 1000),
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  autor uuid references auth.users (id) on delete cascade default auth.uid(),
  respondida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists perguntas_criado_idx on public.perguntas (criado_em);
create index if not exists perguntas_autor_idx on public.perguntas (autor, criado_em);
alter table public.perguntas enable row level security;
-- Sem políticas: ninguém lê nem escreve direto pelo site.

create or replace function public.enviar_pergunta(p_texto text, p_email text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t text := trim(coalesce(p_texto, ''));
        e text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if char_length(t) < 10 then raise exception 'pergunta_curta: escreva pelo menos 10 caracteres'; end if;
  if char_length(t) > 1000 then raise exception 'pergunta_longa: máximo de 1000 caracteres'; end if;
  if e is not null and (char_length(e) > 200 or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'email_invalido';
  end if;
  if auth.uid() is not null and (select count(*) from public.perguntas
      where autor = auth.uid() and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'limite_perguntas: máximo de 5 perguntas por dia';
  end if;
  -- Proteção contra enxurrada (inclusive de quem não tem conta).
  if (select count(*) from public.perguntas where criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'limite_perguntas: muitas perguntas agora, tente mais tarde';
  end if;
  delete from public.perguntas where criado_em < now() - interval '12 months';
  insert into public.perguntas (texto, email, autor) values (t, e, auth.uid());
end $$;
revoke all on function public.enviar_pergunta(text, text) from public;
grant execute on function public.enviar_pergunta(text, text) to anon, authenticated;
