-- =====================================================================
-- BALUARTE · Desfaz a migration 34 (etapas Aquecendo e Brecha)
-- =====================================================================
-- NÃO roda sozinho: só se for preciso voltar atrás.
-- Nenhum card é apagado: quem estiver em Aquecendo volta para Mapeado
-- (a_contatar) e quem estiver em Brecha volta para Em conversa.
-- Depois o tipo é recriado só com as 8 etapas originais.
-- =====================================================================

begin;

update public.prospects set etapa = 'a_contatar'  where etapa = 'aquecendo';
update public.prospects set etapa = 'em_conversa' where etapa = 'brecha';

alter type public.etapa_prospect rename to etapa_prospect_34;

create type public.etapa_prospect as enum
  ('a_contatar', 'primeiro_contato', 'em_conversa', 'reuniao', 'proposta', 'negociacao', 'fechado', 'perdido');

alter table public.prospects alter column etapa drop default;
alter table public.prospects
  alter column etapa type public.etapa_prospect using etapa::text::public.etapa_prospect;
alter table public.prospects alter column etapa set default 'a_contatar';

drop type public.etapa_prospect_34;

commit;
