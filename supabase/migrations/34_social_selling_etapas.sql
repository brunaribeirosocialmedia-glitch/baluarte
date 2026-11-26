-- =====================================================================
-- BALUARTE · 34 · Etapas do social selling
-- =====================================================================
-- Depende de: 22_prospeccao_jornada
--
-- O pipeline passa a seguir o calor da relação:
--   Mapeado → Aquecendo → Conversa aberta → Em conversa → Brecha →
--   Reunião → Proposta → Negociação → Fechado / Perdido
--
-- "Mapeado" e "Conversa aberta" são as etapas que já existiam
-- (a_contatar e primeiro_contato): só o nome na tela mudou, então
-- nenhum card muda de lugar.
--
-- Aqui só ACRESCENTAMOS duas etapas ao tipo. Nenhuma linha é alterada.
-- Para desfazer: supabase/desfazer/34_desfazer_social_selling.sql
-- =====================================================================

alter type public.etapa_prospect add value if not exists 'aquecendo' after 'a_contatar';
alter type public.etapa_prospect add value if not exists 'brecha'    after 'em_conversa';
