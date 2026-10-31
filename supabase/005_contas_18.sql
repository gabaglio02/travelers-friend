-- Traveler's Friend · 005: contas só para maiores de 18
-- Rode DEPOIS do 004_mural.sql. Pode rodar mais de uma vez.
--
-- Desde 31/10/2026 o cadastro exige declarar 18 anos ou mais (ECA Digital: contas de menores
-- de 16 em serviços com rede social precisariam ser ligadas a um responsável). Por isso o
-- "Tenho 18 anos ou mais" saiu do perfil e toda identidade passa a ser de maior de idade.
-- As regras "sem 18+, nada público" de 002–004 continuam no banco como proteção extra.

alter table public.identidades alter column maior_de_idade set default true;
update public.identidades set maior_de_idade = true where not maior_de_idade;
