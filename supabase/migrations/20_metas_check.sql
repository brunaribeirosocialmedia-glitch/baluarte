-- =====================================================================
-- COMPASSO · 20 · Check nos cartões das Metas
-- =====================================================================
-- Depende de: 19_metas_em_colunas
--
-- Cada cartão da biblioteca ganha "feito". A tela de Metas mostra uma
-- caixinha na frente de cada cartão para ir marcando o que já foi
-- batido. O "☐" que vinha escrito no título (do Trello) sai.
-- =====================================================================

alter table public.socorro_itens
  add column if not exists feito boolean not null default false;

update public.socorro_itens
   set titulo = btrim(substr(titulo, 2))
 where titulo like '☐%'
   and categoria_id in (select id from public.socorro_categorias where secao = 'gestao-metas');
