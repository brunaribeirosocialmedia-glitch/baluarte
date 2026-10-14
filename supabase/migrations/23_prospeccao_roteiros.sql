-- =====================================================================
-- BALUARTE · 23 · Roteiros da Prospecção
-- =====================================================================
-- Depende de: 17_processos_gestao (pode_ver_secao), 01 (tem_acesso_area)
--
-- A Prospecção ganha a aba "Roteiros": exemplos de mensagens e estilos
-- de abordagem, no formato da Caixa de Pandora (seção
-- "prospeccao-roteiros"). Como é estratégia de venda, só vê quem tem a
-- Prospecção liberada (permissão + código), igual às seções da Gestão.
-- =====================================================================

create or replace function public.pode_ver_secao(p_secao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_membro_ativo()
     and (p_secao not like 'gestao%' or public.tem_acesso_area('financeiro'))
     and (p_secao not like 'prospeccao%' or public.tem_acesso_area('prospeccao'));
$$;

insert into public.socorro_categorias (nome, ordem, secao) values
  ('Primeira abordagem', 1, 'prospeccao-roteiros'),
  ('Follow-up',          2, 'prospeccao-roteiros'),
  ('Objeções',           3, 'prospeccao-roteiros'),
  ('Proposta e fechamento', 4, 'prospeccao-roteiros');
