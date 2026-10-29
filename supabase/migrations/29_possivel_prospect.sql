-- =====================================================================
-- BALUARTE · 29 · Temperatura "Possível prospect"
-- =====================================================================
-- Antes do "frio": candidatos de listas (diretórios, Instagram) que
-- ainda não passaram pelo filtro de confirmação.
-- =====================================================================

alter type public.status_prospect add value if not exists 'possivel' before 'frio';
