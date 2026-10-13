-- =====================================================================
-- BALUARTE · 21 · Valor nos produtos da Esteira
-- =====================================================================
-- Depende de: 20_metas_check
--
-- Cada cartão da biblioteca ganha um "valor" em reais (opcional). A
-- Esteira de produtos usa esse campo: aparece no formulário e em destaque
-- no cartão. A linha "Valor:" que vinha escrita no texto sai, porque
-- agora o valor tem campo próprio.
-- =====================================================================

alter table public.socorro_itens
  add column if not exists valor numeric(12, 2);

update public.socorro_itens
   set conteudo = regexp_replace(conteudo, E'\\n*Valor:[ \\t]*(?=\\n|$)', '')
 where categoria_id in (select id from public.socorro_categorias where secao = 'gestao-esteira');
