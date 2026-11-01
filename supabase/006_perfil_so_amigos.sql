-- Traveler's Friend · 006: perfil "Só amigos" como conta privada
-- Rode DEPOIS do 005_contas_18.sql. Pode rodar mais de uma vez.
--
-- Antes, um perfil inteiro "Só amigos" ficava invisível para quem ainda não era amigo — e, sem abrir o perfil,
-- ninguém conseguia pedir amizade. Agora quem não é amigo vê um cartão mínimo (nome, @, foto, capa e cores)
-- com o botão de pedir amizade; o resto continua escondido. "Só eu" segue invisível e não recebe pedidos.

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
  if not public.pode_ver(coalesce(pv ->> 'perfil', 'publico'), rel) then
    -- "Só amigos" para quem não é amigo (nem bloqueado): só o cartão para pedir amizade.
    if coalesce(pv ->> 'perfil', 'publico') = 'amigos' and rel = 'visitante' then
      return jsonb_build_object(
        'id', i.id, 'apelido', i.apelido, 'nome', i.nome, 'tipo', i.tipo,
        'avatar', i.avatar, 'avatar_emoji', i.avatar_emoji, 'capa', i.capa, 'tema', i.tema,
        'relacao', rel, 'restrito', true);
    end if;
    return null;
  end if;

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

-- Pedido de amizade: igual ao 004, mais a regra de que perfil "Só eu" não recebe pedidos.
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
  if (select coalesce(privacidade ->> 'perfil', 'publico') from public.identidades where id = new.para) = 'privado' then
    raise exception 'perfil_fechado: este perfil não recebe pedidos de amizade';
  end if;
  if exists (select 1 from public.amizades where de = new.para and para = new.de) then
    raise exception 'amizade_existente: essa pessoa já te mandou um pedido';
  end if;
  if (select count(*) from public.amizades a join public.identidades i on i.id = a.de
      where i.owner_id = conta_de and a.criado_em > now() - interval '1 day') >= 30 then
    raise exception 'limite_amizades: máximo de 30 pedidos por dia';
  end if;
  return new;
end $$;
