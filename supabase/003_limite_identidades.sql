-- Traveler's Friend · 003: limite de identidades por conta cai de 10 para 3 (1 principal + 2 personas).
-- Rodar no SQL Editor do Supabase DEPOIS do 002_perfis.sql. Pode rodar mais de uma vez.
-- Não apaga nada: quem já tiver mais de 3 identidades continua com elas; só não cria novas.
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
