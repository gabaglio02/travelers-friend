-- Traveler's Friend — banco no Supabase.
-- Rode este arquivo uma vez no SQL Editor do projeto (é seguro rodar de novo).
--
-- O que cria:
--   viagens       roteiro completo de cada pessoa (o estado do site em JSON)
--   fotos         fotos de viagens (o arquivo fica no Storage, bucket "fotos")
--   agenda_cache  agenda de eventos coletada pelo servidor (só o servidor acessa)
--   excluir_minha_conta()  a pessoa apaga a própria conta (LGPD)
--
-- Segurança: Row Level Security em tudo; cada pessoa só lê e altera o que é dela.

-- =========================================================
-- Limites (ajuste aqui se mudar o plano)
-- =========================================================
-- 50 fotos ou 20 MB por pessoa; cada arquivo até 2 MB (o site já envia ~300 KB).

-- =========================================================
-- Viagens
-- =========================================================
create table if not exists public.viagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default 'Minha viagem' check (char_length(nome) between 1 and 80),
  dados jsonb not null check (pg_column_size(dados) < 500000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists viagens_user_idx on public.viagens (user_id);

create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists viagens_atualizado_em on public.viagens;
create trigger viagens_atualizado_em before update on public.viagens
  for each row execute function public.tocar_atualizado_em();

alter table public.viagens enable row level security;
drop policy if exists "viagens: dono lê" on public.viagens;
drop policy if exists "viagens: dono cria" on public.viagens;
drop policy if exists "viagens: dono altera" on public.viagens;
drop policy if exists "viagens: dono apaga" on public.viagens;
create policy "viagens: dono lê" on public.viagens for select to authenticated using (user_id = auth.uid());
create policy "viagens: dono cria" on public.viagens for insert to authenticated with check (user_id = auth.uid());
create policy "viagens: dono altera" on public.viagens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "viagens: dono apaga" on public.viagens for delete to authenticated using (user_id = auth.uid());

-- =========================================================
-- Fotos
-- =========================================================
create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  viagem_id uuid references public.viagens (id) on delete set null,
  caminho text not null,
  miniatura text not null,
  bytes integer not null check (bytes > 0 and bytes <= 2097152),
  legenda text check (char_length(legenda) <= 200),
  criado_em timestamptz not null default now()
);
create index if not exists fotos_user_idx on public.fotos (user_id);

alter table public.fotos enable row level security;
drop policy if exists "fotos: dono lê" on public.fotos;
drop policy if exists "fotos: dono cria" on public.fotos;
drop policy if exists "fotos: dono altera" on public.fotos;
drop policy if exists "fotos: dono apaga" on public.fotos;
create policy "fotos: dono lê" on public.fotos for select to authenticated using (user_id = auth.uid());
create policy "fotos: dono cria" on public.fotos for insert to authenticated with check (user_id = auth.uid());
create policy "fotos: dono altera" on public.fotos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fotos: dono apaga" on public.fotos for delete to authenticated using (user_id = auth.uid());

-- Limite por pessoa: 50 fotos ou 20 MB.
create or replace function public.fotos_checar_limite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  qtd integer;
  total bigint;
begin
  select count(*), coalesce(sum(bytes), 0) into qtd, total from public.fotos where user_id = new.user_id;
  if qtd >= 50 then
    raise exception 'limite_fotos: máximo de 50 fotos por conta';
  end if;
  if total + new.bytes > 20 * 1024 * 1024 then
    raise exception 'limite_fotos: máximo de 20 MB por conta';
  end if;
  return new;
end $$;

drop trigger if exists fotos_limite on public.fotos;
create trigger fotos_limite before insert on public.fotos
  for each row execute function public.fotos_checar_limite();

-- Uso atual da pessoa (para o site mostrar "12 de 50 fotos · 3,4 de 20 MB").
create or replace function public.meu_uso_de_fotos() returns table (fotos integer, bytes bigint)
language sql stable security definer set search_path = '' as $$
  select count(*)::integer, coalesce(sum(f.bytes), 0)::bigint from public.fotos f where f.user_id = auth.uid();
$$;
revoke all on function public.meu_uso_de_fotos() from public, anon;
grant execute on function public.meu_uso_de_fotos() to authenticated;

-- =========================================================
-- Storage: bucket privado "fotos", uma pasta por pessoa (<user_id>/...)
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/webp'];

-- Conta os arquivos da pasta da pessoa (função à parte para a política não consultar a própria tabela).
create or replace function public.qtd_arquivos_fotos(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from storage.objects o
  where o.bucket_id = 'fotos' and (storage.foldername(o.name))[1] = uid::text;
$$;
revoke all on function public.qtd_arquivos_fotos(uuid) from public, anon;
grant execute on function public.qtd_arquivos_fotos(uuid) to authenticated;

drop policy if exists "fotos storage: dono lê" on storage.objects;
drop policy if exists "fotos storage: dono envia" on storage.objects;
drop policy if exists "fotos storage: dono apaga" on storage.objects;
create policy "fotos storage: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Cada foto ocupa 2 arquivos (foto + miniatura): até 100 arquivos por pessoa.
create policy "fotos storage: dono envia" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.qtd_arquivos_fotos(auth.uid()) < 100
  );
create policy "fotos storage: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- Agenda (só o servidor, com a chave service_role, acessa — sem políticas para o público)
-- =========================================================
create table if not exists public.agenda_cache (
  cidade text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.agenda_cache enable row level security;

-- =========================================================
-- Excluir a própria conta
-- O site apaga antes os arquivos de fotos pelo Storage; aqui some o usuário,
-- e viagens/fotos vão junto (on delete cascade).
-- =========================================================
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
