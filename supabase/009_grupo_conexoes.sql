-- Traveler's Friend · 009: contas conectadas ao grupo de uma viagem (Fase 3)
-- Rode DEPOIS do 008_perguntas.sql. Pode rodar mais de uma vez.
--
-- O organizador convida uma vaga do grupo ("Ana") por um link de uso único, que vale 7 dias. A pessoa abre o link
-- logada na conta dela e copia para a viagem as notas do questionário (as pessoais ou respondidas só para a viagem).
--   * As notas ficam SÓ nesta tabela, nunca dentro de viagens.dados: sair, ser removida, apagar a viagem ou excluir
--     a conta apaga as notas daqui, e nenhum aparelho do organizador consegue regravá-las.
--   * Ninguém lê ou grava a tabela direto: tudo passa pelas funções abaixo, que conferem quem está pedindo.
--   * O código do convite não fica salvo, só o hash SHA-256 dele; depois de usado, nem o hash fica.
--   * O organizador vê só a vaga, o estado e as notas; nada da conta da pessoa (e-mail, @, perfil).
--   * Quem abre o convite vê só o nome da viagem, cidade, datas, o nome de quem organiza e o nome da vaga.
--
-- Vagas removidas: o site guarda os ids em viagens.dados.grupo.removidos; o gatilho no fim deste arquivo apaga as
-- conexões dessas vagas quando a viagem é salva. Uma vaga que só "sumiu" (versão antiga da viagem aberta em outro
-- aparelho) NÃO apaga nada: a conexão continua aqui e o site devolve a vaga ao grupo.

-- =========================================================
-- Tabela
-- =========================================================
create table if not exists public.grupo_conexoes (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid not null references public.viagens (id) on delete cascade,
  dono uuid not null references auth.users (id) on delete cascade,
  participante text not null check (participante ~ '^[a-z0-9]{2,40}$'),       -- id da vaga em viagens.dados.grupo
  vaga_nome text not null check (char_length(vaga_nome) between 1 and 30),
  estado text not null default 'pendente' check (estado in ('pendente', 'conectado', 'saiu')),
  codigo_hash text unique,                     -- só enquanto o convite está pendente
  expira_em timestamptz,
  convidado_em timestamptz,
  membro uuid references auth.users (id) on delete cascade,   -- excluir a conta apaga a conexão e as notas
  notas jsonb,
  puladas jsonb,
  origem text check (origem in ('pessoal', 'viagem')),
  conectado_em timestamptz,
  atualizado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (viagem_id, participante),            -- uma linha por vaga: duas pessoas nunca ocupam a mesma
  check ((estado = 'conectado') = (membro is not null)),
  check ((estado = 'conectado') = (notas is not null and puladas is not null and origem is not null)),
  check (estado = 'pendente' or (codigo_hash is null and expira_em is null)),
  check (estado <> 'pendente' or (codigo_hash is not null and expira_em is not null))
);
-- A mesma conta não ocupa duas vagas da mesma viagem.
create unique index if not exists grupo_conexoes_membro_idx on public.grupo_conexoes (viagem_id, membro) where membro is not null;
create index if not exists grupo_conexoes_dono_idx on public.grupo_conexoes (dono, convidado_em);
alter table public.grupo_conexoes enable row level security;
-- Sem políticas: leitura e escrita só pelas funções abaixo.

-- =========================================================
-- Auxiliares
-- =========================================================
-- Respostas no formato do questionário (js/gosto.js): notas { categoria: 0..5 } e puladas [categoria];
-- nota 0 ≠ pulada ≠ sem resposta, então uma categoria não pode estar nas duas.
create or replace function public.grupo_respostas_validas(p_notas jsonb, p_puladas jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(p_notas) = 'object' and jsonb_typeof(p_puladas) = 'array'
    and pg_column_size(p_notas) < 1000 and pg_column_size(p_puladas) < 1000
    and not exists (
      select 1 from jsonb_each(p_notas) e
      where e.key not in ('museus', 'pontos', 'parques', 'aventura', 'palco', 'comer', 'compras', 'noite')
         or jsonb_typeof(e.value) <> 'number' or e.value::text !~ '^[0-5]$')
    and not exists (
      select 1 from jsonb_array_elements(p_puladas) x
      where jsonb_typeof(x.value) <> 'string'
         or x.value #>> '{}' not in ('museus', 'pontos', 'parques', 'aventura', 'palco', 'comer', 'compras', 'noite')
         or p_notas ? (x.value #>> '{}'))
    and (select count(*) from jsonb_array_elements(p_puladas)) = (select count(distinct x.value) from jsonb_array_elements(p_puladas) x),
  false);
$$;

create or replace function public.grupo_codigo_hash(p_codigo text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_codigo, ''), 'UTF8')), 'hex');
$$;

-- Nome de quem organiza, para o convite: só o nome do perfil principal (nada de e-mail, @ ou dados da conta).
create or replace function public.grupo_nome_organizador(p_dono uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select i.nome from public.identidades i where i.owner_id = p_dono and i.tipo = 'principal'), 'Quem organiza a viagem');
$$;

-- =========================================================
-- Organizador
-- =========================================================
-- Gera o link de uma vaga. Devolve o código uma vez só (o banco guarda só o hash).
-- Convite pendente anterior da mesma vaga deixa de valer; vaga conectada é recusada (remova antes).
create or replace function public.criar_convite_grupo(p_viagem uuid, p_participante text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens;
  parts jsonb;
  vaga jsonb;
  atual public.grupo_conexoes;
  codigo text;
  validade timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  select * into v from public.viagens where id = p_viagem and user_id = auth.uid();
  if not found then raise exception 'sem_permissao'; end if;
  parts := v.dados -> 'grupo' -> 'participantes';
  if parts is null or jsonb_typeof(parts) <> 'array' or jsonb_array_length(parts) > 5 then raise exception 'grupo_invalido'; end if;
  select x.value into vaga from jsonb_array_elements(parts) x where x.value ->> 'id' = p_participante;
  if vaga is null then raise exception 'vaga_inexistente'; end if;
  if jsonb_typeof(v.dados -> 'grupo' -> 'removidos') = 'array' and (v.dados -> 'grupo' -> 'removidos') ? p_participante then
    raise exception 'vaga_inexistente';
  end if;
  if (select count(*) from public.grupo_conexoes where dono = auth.uid() and convidado_em > now() - interval '1 day') >= 20 then
    raise exception 'limite_convites: máximo de 20 convites por dia';
  end if;
  select * into atual from public.grupo_conexoes where viagem_id = p_viagem and participante = p_participante for update;
  if found and atual.estado = 'conectado' then raise exception 'vaga_ocupada'; end if;
  codigo := replace(gen_random_uuid()::text, '-', '');   -- 122 bits aleatórios (gerador forte do Postgres)
  insert into public.grupo_conexoes (viagem_id, dono, participante, vaga_nome, estado, codigo_hash, expira_em, convidado_em)
    values (p_viagem, auth.uid(), p_participante, left(coalesce(nullif(trim(vaga ->> 'nome'), ''), 'Participante'), 30),
            'pendente', public.grupo_codigo_hash(codigo), validade, now())
    on conflict (viagem_id, participante) do update
      set vaga_nome = excluded.vaga_nome, estado = 'pendente', codigo_hash = excluded.codigo_hash,
          expira_em = excluded.expira_em, convidado_em = now(),
          membro = null, notas = null, puladas = null, origem = null, conectado_em = null, atualizado_em = null;
  return jsonb_build_object('codigo', codigo, 'expira_em', validade);
end $$;

-- Estado de cada vaga convidada da viagem, com as notas de quem conectou. Nada da conta da pessoa.
create or replace function public.conexoes_do_grupo(p_viagem uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if not exists (select 1 from public.viagens where id = p_viagem and user_id = auth.uid()) then raise exception 'sem_permissao'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'participante', c.participante, 'vaga_nome', c.vaga_nome,
      'estado', case when c.estado = 'pendente' and c.expira_em <= now() then 'vencido' else c.estado end,
      'expira_em', c.expira_em, 'notas', c.notas, 'puladas', c.puladas, 'origem', c.origem,
      'conectado_em', c.conectado_em, 'atualizado_em', c.atualizado_em) order by c.criado_em)
    from public.grupo_conexoes c where c.viagem_id = p_viagem), '[]'::jsonb);
end $$;

-- Cancela o convite ou desconecta a pessoa da vaga: a linha e as notas são apagadas.
create or replace function public.cancelar_conexao_grupo(p_viagem uuid, p_participante text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if not exists (select 1 from public.viagens where id = p_viagem and user_id = auth.uid()) then raise exception 'sem_permissao'; end if;
  delete from public.grupo_conexoes where viagem_id = p_viagem and participante = p_participante and dono = auth.uid();
  return found;
end $$;

-- =========================================================
-- Participante
-- =========================================================
-- O que o convite mostra antes de aceitar. Código errado, vencido, já usado ou da própria viagem dão o mesmo erro.
create or replace function public.ver_convite(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.grupo_conexoes; v public.viagens;
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if p_codigo is null or char_length(p_codigo) > 64 then raise exception 'convite_invalido'; end if;
  select * into c from public.grupo_conexoes
    where codigo_hash = public.grupo_codigo_hash(p_codigo) and estado = 'pendente' and expira_em > now();
  if not found or c.dono = auth.uid() then raise exception 'convite_invalido'; end if;
  select * into v from public.viagens where id = c.viagem_id;
  return jsonb_build_object(
    'viagem', v.nome, 'cidade', v.dados ->> 'city', 'inicio', v.dados ->> 'start', 'fim', v.dados ->> 'end',
    'organizador', public.grupo_nome_organizador(c.dono), 'vaga', c.vaga_nome, 'expira_em', c.expira_em,
    'ja_no_grupo', exists (select 1 from public.grupo_conexoes x where x.viagem_id = c.viagem_id and x.membro = auth.uid()));
end $$;

-- Aceita o convite: confere tudo de novo com a linha travada, grava as notas e apaga o código (uso único).
create or replace function public.aceitar_convite_grupo(p_codigo text, p_notas jsonb, p_puladas jsonb, p_origem text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.grupo_conexoes;
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if p_codigo is null or char_length(p_codigo) > 64 then raise exception 'convite_invalido'; end if;
  select * into c from public.grupo_conexoes where codigo_hash = public.grupo_codigo_hash(p_codigo) for update;
  if not found or c.estado <> 'pendente' or c.expira_em <= now() or c.dono = auth.uid() then raise exception 'convite_invalido'; end if;
  if exists (select 1 from public.grupo_conexoes where viagem_id = c.viagem_id and membro = auth.uid()) then raise exception 'ja_no_grupo'; end if;
  if not public.grupo_respostas_validas(p_notas, p_puladas) or p_origem is null or p_origem not in ('pessoal', 'viagem') then
    raise exception 'respostas_invalidas';
  end if;
  update public.grupo_conexoes
    set estado = 'conectado', membro = auth.uid(), codigo_hash = null, expira_em = null,
        notas = p_notas, puladas = p_puladas, origem = p_origem, conectado_em = now(), atualizado_em = now()
    where id = c.id;
  return c.id;
end $$;

-- Troca as notas compartilhadas (só quem conectou).
create or replace function public.atualizar_respostas_grupo(p_conexao uuid, p_notas jsonb, p_puladas jsonb, p_origem text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare quando timestamptz := now();
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if not public.grupo_respostas_validas(p_notas, p_puladas) or p_origem is null or p_origem not in ('pessoal', 'viagem') then
    raise exception 'respostas_invalidas';
  end if;
  update public.grupo_conexoes set notas = p_notas, puladas = p_puladas, origem = p_origem, atualizado_em = quando
    where id = p_conexao and membro = auth.uid() and estado = 'conectado';
  if not found then raise exception 'sem_permissao'; end if;
  return quando;
end $$;

-- Sai do grupo: as notas são apagadas e a vaga fica livre ("saiu") para outro convite ou para responder no aparelho.
create or replace function public.sair_do_grupo(p_conexao uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  update public.grupo_conexoes
    set estado = 'saiu', membro = null, notas = null, puladas = null, origem = null, conectado_em = null, atualizado_em = now()
    where id = p_conexao and membro = auth.uid() and estado = 'conectado';
  if not found then raise exception 'sem_permissao'; end if;
  return true;
end $$;

-- Os grupos em que a própria pessoa entrou (para atualizar ou sair). Do organizador, só o nome do perfil.
create or replace function public.minhas_conexoes_grupo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'viagem', v.nome, 'cidade', v.dados ->> 'city', 'inicio', v.dados ->> 'start', 'fim', v.dados ->> 'end',
      'organizador', public.grupo_nome_organizador(c.dono), 'vaga', c.vaga_nome,
      'notas', c.notas, 'puladas', c.puladas, 'origem', c.origem, 'conectado_em', c.conectado_em, 'atualizado_em', c.atualizado_em)
      order by c.conectado_em desc)
    from public.grupo_conexoes c join public.viagens v on v.id = c.viagem_id
    where c.membro = auth.uid() and c.estado = 'conectado'), '[]'::jsonb);
end $$;

-- =========================================================
-- Vaga removida pelo organizador → conexão apagada, mesmo se o site não conseguir chamar cancelar_conexao_grupo.
-- Só vale para ids listados em dados.grupo.removidos (remoção de verdade); uma versão antiga da viagem sem a vaga
-- não apaga nada.
-- =========================================================
create or replace function public.grupo_limpar_removidos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(new.dados -> 'grupo' -> 'removidos') = 'array' then
    delete from public.grupo_conexoes c
      where c.viagem_id = new.id
        and c.participante in (select jsonb_array_elements_text(new.dados -> 'grupo' -> 'removidos'));
  end if;
  return null;
end $$;
drop trigger if exists viagens_grupo_removidos on public.viagens;
create trigger viagens_grupo_removidos after insert or update of dados on public.viagens
  for each row execute function public.grupo_limpar_removidos();

-- =========================================================
-- Permissões: só quem está logado chama as funções públicas; as auxiliares e o gatilho não são chamáveis.
-- =========================================================
revoke all on function public.grupo_respostas_validas(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.grupo_codigo_hash(text) from public, anon, authenticated;
revoke all on function public.grupo_nome_organizador(uuid) from public, anon, authenticated;
revoke all on function public.grupo_limpar_removidos() from public, anon, authenticated;
revoke all on function public.criar_convite_grupo(uuid, text) from public, anon;
revoke all on function public.conexoes_do_grupo(uuid) from public, anon;
revoke all on function public.cancelar_conexao_grupo(uuid, text) from public, anon;
revoke all on function public.ver_convite(text) from public, anon;
revoke all on function public.aceitar_convite_grupo(text, jsonb, jsonb, text) from public, anon;
revoke all on function public.atualizar_respostas_grupo(uuid, jsonb, jsonb, text) from public, anon;
revoke all on function public.sair_do_grupo(uuid) from public, anon;
revoke all on function public.minhas_conexoes_grupo() from public, anon;
grant execute on function public.criar_convite_grupo(uuid, text) to authenticated;
grant execute on function public.conexoes_do_grupo(uuid) to authenticated;
grant execute on function public.cancelar_conexao_grupo(uuid, text) to authenticated;
grant execute on function public.ver_convite(text) to authenticated;
grant execute on function public.aceitar_convite_grupo(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.atualizar_respostas_grupo(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.sair_do_grupo(uuid) to authenticated;
grant execute on function public.minhas_conexoes_grupo() to authenticated;
