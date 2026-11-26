-- =====================================================================
-- BALUARTE · Desfaz a migration 35 (lembrete dos prospects em Aquecendo)
-- =====================================================================
-- NÃO roda sozinho. Para o agendamento e apaga só os aparelhos que
-- ligaram o lembrete. Nenhum prospect é tocado.
-- Depois, apagar a função da nuvem:
--   npx supabase@2.117.0 functions delete baluarte-lembretes --project-ref kfcmcwxnqfofmworbojt
-- =====================================================================

select cron.unschedule('baluarte-lembrete-aquecendo');
drop function if exists public.baluarte_disparar_lembretes();
drop table if exists public.baluarte_push_aparelhos;
