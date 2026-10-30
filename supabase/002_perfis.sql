-- Traveler's Friend — migração 002: perfis, identidades, amizades e lugares visitados.
-- Rode no SQL Editor DEPOIS do schema.sql. Só acrescenta: nada existente é alterado ou apagado.
-- É seguro rodar de novo (usa "if not exists" / "create or replace" / "drop policy if exists").
--
-- Modelo
--   identidades        perfil principal (1 por conta) + personas (Etapa 3), cada uma com página própria
--   amizades           entre identidades: pendente · aceita · bloqueada (telas de amizade na Etapa 4)
--   lugares_visitados  lugares que a identidade já conheceu (com data e nota)
--   bucket "perfil"    avatar e capa (público: são feitos para serem vistos)
--
-- Privacidade
--   Cada seção do perfil tem um nível: publico · amigos · privado.
--   A tabela identidades só é lida pelo dono; quem visita lê pela função perfil_publico(apelido),
--   que já devolve só o que quem está vendo pode ver (RLS por linha não esconde colunas).
--   Bloqueio sempre vence. Perfil "publico" exige declarar 18 anos ou mais.

-- =========================================================
-- Identidades
-- =========================================================
create table if not exists public.identidades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'principal' check (tipo in ('principal', 'historica', 'animal', 'objeto', 'original')),
  apelido text not null check (apelido ~ '^[a-z0-9_]{3,24}$'),
  nome text not null check (char_length(nome) between 1 and 60),
  bio text check (char_length(bio) <= 500),
  mensagem text check (char_length(mensagem) <= 140),
  status text not null default 'disponivel' check (status in ('disponivel', 'ocupado', 'ausente', 'invisivel')),
  avatar text check (char_length(avatar) <= 300),          -- caminho no bucket "perfil"
  avatar_emoji text check (char_length(avatar_emoji) <= 16), -- avatar sem foto
  capa text check (char_length(capa) <= 300),
  tema jsonb not null default '{}'::jsonb check (pg_column_size(tema) < 2000),
  destinos_desejados text[] not null default '{}' check (coalesce(array_length(destinos_desejados, 1), 0) <= 30),
  privacidade jsonb not null default '{"perfil":"publico","bio":"publico","status":"publico","destinos":"publico","visitados":"amigos","amigos":"amigos"}'::jsonb,
  maior_de_idade boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists identidades_apelido_idx on public.identidades (lower(apelido));
create unique index if not exists identidades_um_principal on public.identidades (owner_id) where tipo = 'principal';
create index if not exists identidades_owner_idx on public.identidades (owner_id);

drop trigger if exists identidades_atualizado_em on public.identidades;
create trigger identidades_atualizado_em before update on public.identidades
  for each row execute function public.tocar_atualizado_em();

-- Regras que o banco garante (não dependem do site):
--  · níveis de privacidade válidos;
--  · sem declarar 18+, nada fica "publico" (vira "amigos");
--  · até 10 identidades por conta (1 principal + 9 personas).
create or replace function public.identidades_validar() returns trigger
language plpgsql set search_path = '' as $$
declare
  secao text;
  nivel text;
  qtd integer;
begin
  for secao, nivel in select key, value #>> '{}' from jsonb_each(new.privacidade) loop
    if secao not in ('perfil', 'bio', 'status', 'destinos', 'visitados', 'amigos') then
      raise exception 'privacidade: seção desconhecida %', secao;
    end if;
    if nivel not in ('publico', 'amigos', 'privado') then
      raise exception 'privacidade: nível inválido % em %', nivel, secao;
    end if;
    if nivel = 'publico' and not new.maior_de_idade then
      new.privacidade := jsonb_set(new.privacidade, array[secao], '"amigos"');
    end if;
  end loop;
  if tg_op = 'INSERT' then
    select count(*) into qtd from public.identidades where owner_id = new.owner_id;
    if qtd >= 10 then
      raise exception 'limite_identidades: máximo de 10 identidades por conta';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists identidades_validar on public.identidades;
create trigger identidades_validar before insert or update on public.identidades
  for each row execute function public.identidades_validar();

alter table public.identidades enable row level security;
drop policy if exists "identidades: dono lê" on public.identidades;
drop policy if exists "identidades: dono cria" on public.identidades;
drop policy if exists "identidades: dono altera" on public.identidades;
drop policy if exists "identidades: dono apaga" on public.identidades;
create policy "identidades: dono lê" on public.identidades for select to authenticated using (owner_id = auth.uid());
create policy "identidades: dono cria" on public.identidades for insert to authenticated with check (owner_id = auth.uid());
create policy "identidades: dono altera" on public.identidades for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "identidades: dono apaga" on public.identidades for delete to authenticated using (owner_id = auth.uid());

-- =========================================================
-- Amizades (entre identidades)
-- =========================================================
create table if not exists public.amizades (
  de uuid not null references public.identidades (id) on delete cascade,
  para uuid not null references public.identidades (id) on delete cascade,
  estado text not null default 'pendente' check (estado in ('pendente', 'aceita', 'bloqueada')),
  criado_em timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);
create index if not exists amizades_para_idx on public.amizades (para);

-- A conta "dona" de uma identidade.
create or replace function public.dono_da_identidade(ident uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select owner_id from public.identidades where id = ident;
$$;
revoke all on function public.dono_da_identidade(uuid) from public, anon;
grant execute on function public.dono_da_identidade(uuid) to authenticated;

alter table public.amizades enable row level security;
drop policy if exists "amizades: envolvidos leem" on public.amizades;
drop policy if exists "amizades: remetente cria" on public.amizades;
drop policy if exists "amizades: envolvidos alteram" on public.amizades;
drop policy if exists "amizades: envolvidos apagam" on public.amizades;
create policy "amizades: envolvidos leem" on public.amizades for select to authenticated
  using (public.dono_da_identidade(de) = auth.uid() or public.dono_da_identidade(para) = auth.uid());
-- Quem envia o pedido precisa ser dono da identidade "de" (e o pedido nasce pendente, ou já como bloqueio).
create policy "amizades: remetente cria" on public.amizades for insert to authenticated
  with check (public.dono_da_identidade(de) = auth.uid() and estado in ('pendente', 'bloqueada'));
-- Aceitar: só quem recebeu. Bloquear: qualquer um dos dois.
create policy "amizades: envolvidos alteram" on public.amizades for update to authenticated
  using (public.dono_da_identidade(de) = auth.uid() or public.dono_da_identidade(para) = auth.uid())
  with check (
    (estado = 'aceita' and public.dono_da_identidade(para) = auth.uid())
    or estado = 'bloqueada'
    or (estado = 'pendente' and public.dono_da_identidade(de) = auth.uid())
  );
create policy "amizades: envolvidos apagam" on public.amizades for delete to authenticated
  using (public.dono_da_identidade(de) = auth.uid() or public.dono_da_identidade(para) = auth.uid());

-- =========================================================
-- Lugares visitados
-- =========================================================
create table if not exists public.lugares_visitados (
  id uuid primary key default gen_random_uuid(),
  identidade_id uuid not null references public.identidades (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lugar_id text check (char_length(lugar_id) <= 60),   -- id do catálogo (ex.: "ibirapuera"), quando houver
  nome text not null check (char_length(nome) between 1 and 120),
  cidade text check (char_length(cidade) <= 80),
  lat double precision, lng double precision,
  data date,
  nota text check (char_length(nota) <= 300),
  criado_em timestamptz not null default now()
);
create index if not exists visitados_ident_idx on public.lugares_visitados (identidade_id);

create or replace function public.visitados_validar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.dono_da_identidade(new.identidade_id) is distinct from new.owner_id then
    raise exception 'a identidade não pertence a esta conta';
  end if;
  if (select count(*) from public.lugares_visitados where identidade_id = new.identidade_id) >= 300 then
    raise exception 'limite_visitados: máximo de 300 lugares por identidade';
  end if;
  return new;
end $$;
drop trigger if exists visitados_validar on public.lugares_visitados;
create trigger visitados_validar before insert on public.lugares_visitados
  for each row execute function public.visitados_validar();

alter table public.lugares_visitados enable row level security;
drop policy if exists "visitados: dono lê" on public.lugares_visitados;
drop policy if exists "visitados: dono cria" on public.lugares_visitados;
drop policy if exists "visitados: dono altera" on public.lugares_visitados;
drop policy if exists "visitados: dono apaga" on public.lugares_visitados;
create policy "visitados: dono lê" on public.lugares_visitados for select to authenticated using (owner_id = auth.uid());
create policy "visitados: dono cria" on public.lugares_visitados for insert to authenticated with check (owner_id = auth.uid());
create policy "visitados: dono altera" on public.lugares_visitados for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "visitados: dono apaga" on public.lugares_visitados for delete to authenticated using (owner_id = auth.uid());

-- =========================================================
-- Relação entre quem está vendo e um perfil
-- =========================================================
-- 'dono' · 'bloqueado' · 'amigo' · 'visitante'
create or replace function public.relacao_com(alvo uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is not null and exists (select 1 from public.identidades i where i.id = alvo and i.owner_id = auth.uid()) then 'dono'
    when auth.uid() is not null and exists (
      select 1 from public.amizades a join public.identidades minha on minha.owner_id = auth.uid()
      where a.estado = 'bloqueada' and ((a.de = minha.id and a.para = alvo) or (a.para = minha.id and a.de = alvo))) then 'bloqueado'
    when auth.uid() is not null and exists (
      select 1 from public.amizades a join public.identidades minha on minha.owner_id = auth.uid()
      where a.estado = 'aceita' and ((a.de = minha.id and a.para = alvo) or (a.para = minha.id and a.de = alvo))) then 'amigo'
    else 'visitante'
  end;
$$;

create or replace function public.pode_ver(nivel text, relacao text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when relacao = 'dono' then true
    when relacao = 'bloqueado' then false
    when nivel = 'publico' then true
    when nivel = 'amigos' then relacao = 'amigo'
    else false
  end;
$$;

-- =========================================================
-- Perfil para quem visita (só o que a pessoa pode ver)
-- =========================================================
create or replace function public.perfil_publico(p_apelido text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.identidades;
  rel text;
  pv jsonb;
  out jsonb;
begin
  select * into i from public.identidades where lower(apelido) = lower(p_apelido);
  if not found then return null; end if;
  rel := public.relacao_com(i.id);
  pv := i.privacidade;
  if not public.pode_ver(coalesce(pv ->> 'perfil', 'publico'), rel) then return null; end if;

  out := jsonb_build_object(
    'id', i.id, 'apelido', i.apelido, 'nome', i.nome, 'tipo', i.tipo,
    'avatar', i.avatar, 'avatar_emoji', i.avatar_emoji, 'capa', i.capa, 'tema', i.tema,
    'relacao', rel, 'criado_em', i.criado_em
  );
  if public.pode_ver(coalesce(pv ->> 'status', 'publico'), rel) then
    out := out || jsonb_build_object(
      -- "invisível" aparece como offline para os outros
      'status', case when i.status = 'invisivel' and rel <> 'dono' then null else i.status end,
      'mensagem', i.mensagem);
  end if;
  if public.pode_ver(coalesce(pv ->> 'bio', 'publico'), rel) then
    out := out || jsonb_build_object('bio', i.bio);
  end if;
  if public.pode_ver(coalesce(pv ->> 'destinos', 'publico'), rel) then
    out := out || jsonb_build_object('destinos_desejados', to_jsonb(i.destinos_desejados));
  end if;
  if public.pode_ver(coalesce(pv ->> 'visitados', 'amigos'), rel) then
    out := out || jsonb_build_object('visitados', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'lugar_id', v.lugar_id, 'nome', v.nome, 'cidade', v.cidade,
             'lat', v.lat, 'lng', v.lng, 'data', v.data, 'nota', v.nota) order by v.data desc nulls last, v.criado_em desc)
      from public.lugares_visitados v where v.identidade_id = i.id), '[]'::jsonb));
  end if;
  if public.pode_ver(coalesce(pv ->> 'amigos', 'amigos'), rel) then
    out := out || jsonb_build_object('amigos', coalesce((
      select jsonb_agg(jsonb_build_object('apelido', o.apelido, 'nome', o.nome, 'avatar', o.avatar, 'avatar_emoji', o.avatar_emoji,
             'status', case when o.status = 'invisivel' then null else o.status end) order by o.nome)
      from public.amizades a
      join public.identidades o on o.id = case when a.de = i.id then a.para else a.de end
      where a.estado = 'aceita' and (a.de = i.id or a.para = i.id)
        and coalesce(o.privacidade ->> 'perfil', 'publico') <> 'privado'), '[]'::jsonb));
  end if;
  return out;
end $$;
grant execute on function public.perfil_publico(text) to anon, authenticated;

-- Apelido livre? (para o formulário avisar antes de salvar)
create or replace function public.apelido_disponivel(p_apelido text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_apelido ~ '^[a-z0-9_]{3,24}$'
     and not exists (select 1 from public.identidades where lower(apelido) = lower(p_apelido) and owner_id is distinct from auth.uid());
$$;
revoke all on function public.apelido_disponivel(text) from public, anon; -- o Supabase libera funções novas para anon por padrão
grant execute on function public.apelido_disponivel(text) to authenticated;

-- =========================================================
-- Storage: bucket público "perfil" (avatar e capa), uma pasta por conta
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfil', 'perfil', true, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/webp'];

create or replace function public.qtd_arquivos_perfil(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from storage.objects o
  where o.bucket_id = 'perfil' and (storage.foldername(o.name))[1] = uid::text;
$$;
revoke all on function public.qtd_arquivos_perfil(uuid) from public, anon;
grant execute on function public.qtd_arquivos_perfil(uuid) to authenticated;

drop policy if exists "perfil storage: dono envia" on storage.objects;
drop policy if exists "perfil storage: dono altera" on storage.objects;
drop policy if exists "perfil storage: dono apaga" on storage.objects;
-- Leitura é pública pelo próprio bucket; escrever, só na própria pasta (até 40 arquivos: avatares e capas de até 10 identidades).
create policy "perfil storage: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'perfil' and (storage.foldername(name))[1] = auth.uid()::text and public.qtd_arquivos_perfil(auth.uid()) < 40);
create policy "perfil storage: dono altera" on storage.objects for update to authenticated
  using (bucket_id = 'perfil' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "perfil storage: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'perfil' and (storage.foldername(name))[1] = auth.uid()::text);
