-- Traveler's Friend — migração 004: mural de lembranças, recados, amizades, bloqueio por conta e denúncias.
-- Rode no SQL Editor DEPOIS do 002_perfis.sql e do 003_limite_identidades.sql.
-- Só acrescenta tabelas/colunas e troca regras (funções e políticas): nenhum dado é apagado.
-- É seguro rodar de novo.
--
-- Modelo
--   albuns      lembranças de uma identidade: título, local, datas, descrição, lugares, visibilidade própria
--   fotos       (já existia) ganha album_id, tirada_em e local — as fotos continuam no bucket privado "fotos"
--   recados     mural de recados: só amigos escrevem; o dono do mural decide quem lê (seção "recados")
--   bloqueios   bloqueio vale para a CONTA inteira (todas as identidades dos dois lados)
--   denuncias   quem denuncia, o quê e por quê — revisadas pelo dono do site no painel do Supabase
--
-- Leitura por visitantes sempre por funções (albuns_de, album_detalhe, mural), que devolvem só campos
-- seguros; as tabelas em si só são lidas pelo dono.

-- =========================================================
-- Privacidade: nova seção "recados" (quem lê o mural). Limite de 3 identidades continua.
-- =========================================================
create or replace function public.identidades_validar() returns trigger
language plpgsql set search_path = '' as $$
declare
  secao text;
  nivel text;
  qtd integer;
begin
  for secao, nivel in select key, value #>> '{}' from jsonb_each(new.privacidade) loop
    if secao not in ('perfil', 'bio', 'status', 'destinos', 'visitados', 'amigos', 'recados') then
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
    if qtd >= 3 then
      raise exception 'limite_identidades: máximo de 3 identidades por conta';
    end if;
  end if;
  return new;
end $$;

-- =========================================================
-- Bloqueio por conta
-- =========================================================
-- O site só manipula pelas funções bloquear/desbloquear/meus_bloqueios (sem acesso direto à tabela).
create table if not exists public.bloqueios (
  quem uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alvo_conta uuid not null references auth.users (id) on delete cascade,
  alvo_identidade uuid references public.identidades (id) on delete set null, -- só para mostrar quem foi
  criado_em timestamptz not null default now(),
  primary key (quem, alvo_conta),
  check (quem <> alvo_conta)
);
alter table public.bloqueios enable row level security;

create or replace function public.bloqueado_entre(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bloqueios where (quem = a and alvo_conta = b) or (quem = b and alvo_conta = a));
$$;
revoke all on function public.bloqueado_entre(uuid, uuid) from public, anon;
grant execute on function public.bloqueado_entre(uuid, uuid) to authenticated;

-- Relação com um perfil: agora o bloqueio é por conta (e o "bloqueada" antigo de amizades continua valendo).
create or replace function public.relacao_com(alvo uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is not null and exists (select 1 from public.identidades i where i.id = alvo and i.owner_id = auth.uid()) then 'dono'
    when auth.uid() is not null and public.bloqueado_entre(auth.uid(), public.dono_da_identidade(alvo)) then 'bloqueado'
    when auth.uid() is not null and exists (
      select 1 from public.amizades a join public.identidades minha on minha.owner_id = auth.uid()
      where a.estado = 'bloqueada' and ((a.de = minha.id and a.para = alvo) or (a.para = minha.id and a.de = alvo))) then 'bloqueado'
    when auth.uid() is not null and exists (
      select 1 from public.amizades a join public.identidades minha on minha.owner_id = auth.uid()
      where a.estado = 'aceita' and ((a.de = minha.id and a.para = alvo) or (a.para = minha.id and a.de = alvo))) then 'amigo'
    else 'visitante'
  end;
$$;

create or replace function public.bloquear(p_identidade uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  conta uuid := public.dono_da_identidade(p_identidade);
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if conta is null then raise exception 'perfil não encontrado'; end if;
  if conta = auth.uid() then raise exception 'não dá para bloquear a própria conta'; end if;
  insert into public.bloqueios (quem, alvo_conta, alvo_identidade) values (auth.uid(), conta, p_identidade)
    on conflict (quem, alvo_conta) do nothing;
  -- Desfaz amizades e pedidos entre as duas contas, em qualquer identidade.
  delete from public.amizades a
  where (public.dono_da_identidade(a.de) = auth.uid() and public.dono_da_identidade(a.para) = conta)
     or (public.dono_da_identidade(a.de) = conta and public.dono_da_identidade(a.para) = auth.uid());
end $$;
revoke all on function public.bloquear(uuid) from public, anon;
grant execute on function public.bloquear(uuid) to authenticated;

create or replace function public.desbloquear(p_identidade uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.bloqueios b
  where b.quem = auth.uid() and (b.alvo_identidade = p_identidade or b.alvo_conta = public.dono_da_identidade(p_identidade));
$$;
revoke all on function public.desbloquear(uuid) from public, anon;
grant execute on function public.desbloquear(uuid) to authenticated;

create or replace function public.meus_bloqueios() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('identidade', b.alvo_identidade, 'apelido', i.apelido, 'nome', i.nome,
         'criado_em', b.criado_em) order by b.criado_em desc), '[]'::jsonb)
  from public.bloqueios b left join public.identidades i on i.id = b.alvo_identidade
  where b.quem = auth.uid();
$$;
revoke all on function public.meus_bloqueios() from public, anon;
grant execute on function public.meus_bloqueios() to authenticated;

-- =========================================================
-- Amizades: regras mais firmes
-- =========================================================
-- · ninguém troca as pessoas de um pedido (antes, quem aceitava podia trocar o "de");
-- · bloqueio agora é pela tabela bloqueios (o estado "bloqueada" não é mais criado);
-- · sem pedido entre contas bloqueadas, para si mesmo, em duplicidade, ou mais de 30 por dia.
create or replace function public.amizades_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  conta_de uuid := public.dono_da_identidade(new.de);
  conta_para uuid := public.dono_da_identidade(new.para);
begin
  if tg_op = 'UPDATE' then
    if new.de <> old.de or new.para <> old.para then
      raise exception 'amizade: não é possível trocar as pessoas de um pedido';
    end if;
    return new;
  end if;
  if conta_de = conta_para then raise exception 'amizade: as duas identidades são da mesma conta'; end if;
  if public.bloqueado_entre(conta_de, conta_para) then raise exception 'amizade_bloqueada'; end if;
  if exists (select 1 from public.amizades where de = new.para and para = new.de) then
    raise exception 'amizade_existente: essa pessoa já te mandou um pedido';
  end if;
  if (select count(*) from public.amizades a join public.identidades i on i.id = a.de
      where i.owner_id = conta_de and a.criado_em > now() - interval '1 day') >= 30 then
    raise exception 'limite_amizades: máximo de 30 pedidos por dia';
  end if;
  return new;
end $$;
drop trigger if exists amizades_validar on public.amizades;
create trigger amizades_validar before insert or update on public.amizades
  for each row execute function public.amizades_validar();

drop policy if exists "amizades: remetente cria" on public.amizades;
drop policy if exists "amizades: envolvidos alteram" on public.amizades;
create policy "amizades: remetente cria" on public.amizades for insert to authenticated
  with check (public.dono_da_identidade(de) = auth.uid() and estado = 'pendente');
-- Aceitar: só quem recebeu.
create policy "amizades: envolvidos alteram" on public.amizades for update to authenticated
  using (public.dono_da_identidade(para) = auth.uid())
  with check (estado = 'aceita' and public.dono_da_identidade(para) = auth.uid());

-- Pedidos e amigos de todas as minhas identidades, com os dados públicos da outra pessoa.
create or replace function public.minhas_amizades() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'de', a.de, 'para', a.para, 'estado', a.estado, 'enviado', minha.id = a.de, 'criado_em', a.criado_em,
      'minha', jsonb_build_object('id', minha.id, 'apelido', minha.apelido, 'nome', minha.nome),
      'outra', jsonb_build_object('id', o.id, 'apelido', o.apelido, 'nome', o.nome, 'tipo', o.tipo,
        'avatar', o.avatar, 'avatar_emoji', o.avatar_emoji, 'tema', o.tema,
        'status', case when o.status = 'invisivel' or not public.pode_ver(coalesce(o.privacidade ->> 'status', 'publico'),
                         case when a.estado = 'aceita' then 'amigo' else 'visitante' end) then null else o.status end)
    ) order by a.estado, o.nome), '[]'::jsonb)
  from public.amizades a
  join public.identidades minha on minha.owner_id = auth.uid() and minha.id in (a.de, a.para)
  join public.identidades o on o.id = case when a.de = minha.id then a.para else a.de end
  where a.estado in ('pendente', 'aceita');
$$;
revoke all on function public.minhas_amizades() from public, anon;
grant execute on function public.minhas_amizades() to authenticated;

-- Situação entre as minhas identidades e um perfil (para o botão "Adicionar amigo").
create or replace function public.amizade_com(p_identidade uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('estado', a.estado, 'enviado', minha.id = a.de, 'minha', minha.id, 'minha_apelido', minha.apelido)
  from public.amizades a
  join public.identidades minha on minha.owner_id = auth.uid() and minha.id in (a.de, a.para)
  where p_identidade in (a.de, a.para) and minha.id <> p_identidade and a.estado in ('pendente', 'aceita')
  order by a.estado = 'aceita' desc
  limit 1;
$$;
revoke all on function public.amizade_com(uuid) from public, anon;
grant execute on function public.amizade_com(uuid) to authenticated;

-- =========================================================
-- Álbuns (lembranças)
-- =========================================================
create table if not exists public.albuns (
  id uuid primary key default gen_random_uuid(),
  identidade_id uuid not null references public.identidades (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 80),
  descricao text check (char_length(descricao) <= 1000),
  local text check (char_length(local) <= 120),
  lugares jsonb not null default '[]'::jsonb check (jsonb_typeof(lugares) = 'array' and pg_column_size(lugares) < 8000),
  data_inicio date,
  data_fim date,
  viagem_id uuid references public.viagens (id) on delete set null,
  visibilidade text not null default 'amigos' check (visibilidade in ('publico', 'amigos', 'privado')),
  capa_foto uuid references public.fotos (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);
create index if not exists albuns_ident_idx on public.albuns (identidade_id);
create index if not exists albuns_owner_idx on public.albuns (owner_id);

drop trigger if exists albuns_atualizado_em on public.albuns;
create trigger albuns_atualizado_em before update on public.albuns
  for each row execute function public.tocar_atualizado_em();

-- A identidade é da conta; sem 18+ nada é público; até 30 álbuns por conta; capa precisa ser foto do álbum.
create or replace function public.albuns_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.dono_da_identidade(new.identidade_id) is distinct from new.owner_id then
    raise exception 'a identidade não pertence a esta conta';
  end if;
  if new.visibilidade = 'publico' and not coalesce((select maior_de_idade from public.identidades where id = new.identidade_id), false) then
    new.visibilidade := 'amigos';
  end if;
  if new.capa_foto is not null and not exists (select 1 from public.fotos where id = new.capa_foto and album_id = new.id) then
    new.capa_foto := null;
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.albuns where owner_id = new.owner_id) >= 30 then
    raise exception 'limite_albuns: máximo de 30 álbuns por conta';
  end if;
  return new;
end $$;

-- Fotos ganham álbum, data e local (colunas opcionais: fotos antigas continuam iguais).
alter table public.fotos add column if not exists album_id uuid references public.albuns (id) on delete set null;
alter table public.fotos add column if not exists tirada_em date;
alter table public.fotos add column if not exists local text check (char_length(local) <= 120);
create index if not exists fotos_album_idx on public.fotos (album_id);

drop trigger if exists albuns_validar on public.albuns;
create trigger albuns_validar before insert or update on public.albuns
  for each row execute function public.albuns_validar();

alter table public.albuns enable row level security;
drop policy if exists "albuns: dono lê" on public.albuns;
drop policy if exists "albuns: dono cria" on public.albuns;
drop policy if exists "albuns: dono altera" on public.albuns;
drop policy if exists "albuns: dono apaga" on public.albuns;
create policy "albuns: dono lê" on public.albuns for select to authenticated using (owner_id = auth.uid());
create policy "albuns: dono cria" on public.albuns for insert to authenticated with check (owner_id = auth.uid());
create policy "albuns: dono altera" on public.albuns for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "albuns: dono apaga" on public.albuns for delete to authenticated using (owner_id = auth.uid());

-- Foto só entra em álbum da mesma conta.
create or replace function public.fotos_album_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.album_id is not null and not exists (select 1 from public.albuns where id = new.album_id and owner_id = new.user_id) then
    raise exception 'o álbum não pertence a esta conta';
  end if;
  return new;
end $$;
drop trigger if exists fotos_album_validar on public.fotos;
create trigger fotos_album_validar before insert or update on public.fotos
  for each row execute function public.fotos_album_validar();

-- Quem está vendo pode ver este álbum? (visibilidade do álbum E do perfil; bloqueio vence)
create or replace function public.album_visivel(p_album uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.pode_ver(a.visibilidade, r.rel) and public.pode_ver(coalesce(i.privacidade ->> 'perfil', 'publico'), r.rel)
    from public.albuns a
    join public.identidades i on i.id = a.identidade_id
    cross join lateral (select public.relacao_com(a.identidade_id) as rel) r
    where a.id = p_album), false);
$$;

-- Arquivo do bucket "fotos" que pertence a uma foto de álbum visível (para gerar links temporários).
create or replace function public.foto_arquivo_visivel(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fotos f
                 where (f.caminho = p_nome or f.miniatura = p_nome) and f.album_id is not null and public.album_visivel(f.album_id));
$$;

drop policy if exists "fotos storage: álbum visível" on storage.objects;
create policy "fotos storage: álbum visível" on storage.objects for select to anon, authenticated
  using (bucket_id = 'fotos' and public.foto_arquivo_visivel(name));

-- Álbuns de uma identidade que quem está vendo pode ver (mais recentes primeiro).
create or replace function public.albuns_de(p_identidade uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'local', a.local, 'data_inicio', a.data_inicio, 'data_fim', a.data_fim,
      'visibilidade', a.visibilidade,
      'fotos', (select count(*) from public.fotos f where f.album_id = a.id),
      'capa', coalesce((select f.miniatura from public.fotos f where f.id = a.capa_foto),
                       (select f.miniatura from public.fotos f where f.album_id = a.id order by f.tirada_em nulls last, f.criado_em limit 1))
    ) order by coalesce(a.data_inicio, a.criado_em::date) desc, a.criado_em desc), '[]'::jsonb)
  from public.albuns a
  where a.identidade_id = p_identidade and public.album_visivel(a.id);
$$;

-- Um álbum com as fotos (null se não existe ou quem está vendo não pode ver).
create or replace function public.album_detalhe(p_album uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'descricao', a.descricao, 'local', a.local, 'lugares', a.lugares,
      'data_inicio', a.data_inicio, 'data_fim', a.data_fim, 'visibilidade', a.visibilidade, 'capa_foto', a.capa_foto,
      'criado_em', a.criado_em, 'dono', coalesce(a.owner_id = auth.uid(), false),
      'identidade', jsonb_build_object('id', i.id, 'apelido', i.apelido, 'nome', i.nome, 'tipo', i.tipo,
                                       'avatar', i.avatar, 'avatar_emoji', i.avatar_emoji, 'tema', i.tema),
      'fotos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'caminho', f.caminho, 'miniatura', f.miniatura,
                 'legenda', f.legenda, 'tirada_em', f.tirada_em, 'local', f.local) order by f.tirada_em nulls last, f.criado_em)
               from public.fotos f where f.album_id = a.id), '[]'::jsonb))
  from public.albuns a join public.identidades i on i.id = a.identidade_id
  where a.id = p_album and public.album_visivel(a.id);
$$;

-- =========================================================
-- Recados (mural)
-- =========================================================
create table if not exists public.recados (
  id uuid primary key default gen_random_uuid(),
  alvo uuid not null references public.identidades (id) on delete cascade,
  autor uuid not null references public.identidades (id) on delete cascade,
  autor_conta uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  criado_em timestamptz not null default now()
);
create index if not exists recados_alvo_idx on public.recados (alvo, criado_em desc);

-- Pode escrever: autor é seu, é amigo (aceito) do mural, ninguém bloqueou ninguém, o mural não está desligado.
create or replace function public.recados_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nivel text;
begin
  if public.dono_da_identidade(new.autor) is distinct from new.autor_conta then
    raise exception 'a identidade não pertence a esta conta';
  end if;
  if new.autor = new.alvo then raise exception 'recado: escolha o mural de outra pessoa'; end if;
  if public.bloqueado_entre(new.autor_conta, public.dono_da_identidade(new.alvo)) then raise exception 'recado_bloqueado'; end if;
  if not exists (select 1 from public.amizades a where a.estado = 'aceita'
                 and ((a.de = new.autor and a.para = new.alvo) or (a.de = new.alvo and a.para = new.autor))) then
    raise exception 'recado_so_amigos: só amigos podem deixar recados';
  end if;
  select coalesce(privacidade ->> 'recados', 'amigos') into nivel from public.identidades where id = new.alvo;
  if nivel = 'privado' then raise exception 'recado_desligado: este mural não recebe recados'; end if;
  if (select count(*) from public.recados where autor_conta = new.autor_conta and criado_em > now() - interval '1 hour') >= 20 then
    raise exception 'limite_recados: máximo de 20 recados por hora';
  end if;
  new.texto := btrim(new.texto);
  new.criado_em := now();
  return new;
end $$;
drop trigger if exists recados_validar on public.recados;
create trigger recados_validar before insert on public.recados
  for each row execute function public.recados_validar();

alter table public.recados enable row level security;
drop policy if exists "recados: autor ou dono do mural lê" on public.recados;
drop policy if exists "recados: autor escreve" on public.recados;
drop policy if exists "recados: autor ou dono do mural apaga" on public.recados;
-- Leitura direta só para os envolvidos (visitantes leem pela função mural).
create policy "recados: autor ou dono do mural lê" on public.recados for select to authenticated
  using (autor_conta = auth.uid() or public.dono_da_identidade(alvo) = auth.uid());
create policy "recados: autor escreve" on public.recados for insert to authenticated with check (autor_conta = auth.uid());
create policy "recados: autor ou dono do mural apaga" on public.recados for delete to authenticated
  using (autor_conta = auth.uid() or public.dono_da_identidade(alvo) = auth.uid());

-- Mural de uma identidade: se dá para ler, se dá para escrever (e com quais identidades) e os últimos 50 recados.
create or replace function public.mural(p_identidade uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.identidades;
  rel text;
  nivel text;
  autores jsonb;
begin
  select * into i from public.identidades where id = p_identidade;
  if not found then return null; end if;
  rel := public.relacao_com(i.id);
  nivel := coalesce(i.privacidade ->> 'recados', 'amigos');
  if not public.pode_ver(coalesce(i.privacidade ->> 'perfil', 'publico'), rel) then return null; end if;
  -- Minhas identidades que são amigas deste mural (podem assinar o recado).
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'apelido', m.apelido, 'nome', m.nome)), '[]'::jsonb) into autores
  from public.identidades m
  where auth.uid() is not null and m.owner_id = auth.uid() and m.id <> i.id and rel <> 'bloqueado' and nivel <> 'privado'
    and exists (select 1 from public.amizades a where a.estado = 'aceita'
                and ((a.de = m.id and a.para = i.id) or (a.de = i.id and a.para = m.id)));
  return jsonb_build_object(
    'nivel', nivel,
    'visivel', public.pode_ver(nivel, rel),
    'autores', autores,
    'recados', case when not public.pode_ver(nivel, rel) then '[]'::jsonb else coalesce((
      select jsonb_agg(x.r order by x.criado_em desc) from (
        select r.criado_em, jsonb_build_object('id', r.id, 'texto', r.texto, 'criado_em', r.criado_em,
          'pode_apagar', auth.uid() is not null and (r.autor_conta = auth.uid() or rel = 'dono'),
          'autor', jsonb_build_object('apelido', a.apelido, 'nome', a.nome, 'avatar', a.avatar, 'avatar_emoji', a.avatar_emoji, 'tema', a.tema)) as r
        from public.recados r join public.identidades a on a.id = r.autor
        where r.alvo = i.id
          and not (auth.uid() is not null and public.bloqueado_entre(auth.uid(), r.autor_conta))
        order by r.criado_em desc limit 50) x), '[]'::jsonb) end
  );
end $$;

-- =========================================================
-- Denúncias (revisadas pelo dono do site em Table Editor → denuncias)
-- =========================================================
create table if not exists public.denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante uuid default auth.uid() references auth.users (id) on delete set null,
  alvo_tipo text not null check (alvo_tipo in ('identidade', 'album', 'foto', 'recado')),
  alvo_id uuid not null,
  motivo text not null check (motivo in ('se_passa_por_alguem', 'assedio', 'conteudo_improprio', 'spam', 'menor_de_idade', 'outro')),
  detalhe text check (char_length(detalhe) <= 500),
  estado text not null default 'aberta' check (estado in ('aberta', 'analisada', 'removida')),
  criado_em timestamptz not null default now()
);
create index if not exists denuncias_estado_idx on public.denuncias (estado, criado_em);

create or replace function public.denuncias_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.denuncias where denunciante = new.denunciante and criado_em > now() - interval '1 day') >= 20 then
    raise exception 'limite_denuncias: máximo de 20 denúncias por dia';
  end if;
  new.estado := 'aberta';
  new.criado_em := now();
  return new;
end $$;
drop trigger if exists denuncias_validar on public.denuncias;
create trigger denuncias_validar before insert on public.denuncias
  for each row execute function public.denuncias_validar();

alter table public.denuncias enable row level security;
drop policy if exists "denuncias: quem denuncia cria" on public.denuncias;
drop policy if exists "denuncias: quem denuncia lê" on public.denuncias;
create policy "denuncias: quem denuncia cria" on public.denuncias for insert to authenticated
  with check (denunciante = auth.uid());
create policy "denuncias: quem denuncia lê" on public.denuncias for select to authenticated
  using (denunciante = auth.uid());

-- =========================================================
-- Permissões das funções novas (o Supabase libera funções novas para anon por padrão)
-- =========================================================
-- Leitura de perfil, álbuns e mural: qualquer um (as funções já filtram pelo que a pessoa pode ver).
grant execute on function public.albuns_de(uuid) to anon, authenticated;
grant execute on function public.album_detalhe(uuid) to anon, authenticated;
grant execute on function public.mural(uuid) to anon, authenticated;
-- Usadas pelas políticas do Storage (precisam valer para visitantes sem login também).
grant execute on function public.album_visivel(uuid) to anon, authenticated;
grant execute on function public.foto_arquivo_visivel(text) to anon, authenticated;
