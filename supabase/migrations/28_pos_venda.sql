-- =====================================================================
-- BALUARTE · 28 · Pós-venda no Comercial
-- =====================================================================
-- Depende de: 03_prospeccao, 22_prospeccao_jornada
--
-- Quem comprou só um produto ou encerrou o contrato vai para a aba
-- Pós-venda, para retomar o contato depois de um tempo. Usa a mesma
-- tabela dos prospects (histórico, "Registrei um contato" e próximo
-- contato continuam valendo); sai do Pipeline enquanto estiver lá.
-- • pos_venda_motivo: preenchido = está no pós-venda;
-- • pos_venda_desde: quando comprou / encerrou;
-- • pos_venda_comprou: o que comprou.
-- =====================================================================

alter table public.prospects
  add column pos_venda_motivo  text check (pos_venda_motivo in ('um_produto', 'contrato_encerrado')),
  add column pos_venda_desde   date,
  add column pos_venda_comprou text;
