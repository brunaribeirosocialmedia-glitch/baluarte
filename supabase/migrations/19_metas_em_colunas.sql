-- =====================================================================
-- COMPASSO · 19 · Metas da Gestão em colunas
-- =====================================================================
-- Depende de: 17_processos_gestao
--
-- Esteira de produtos e Metas viram quadros (colunas lado a lado, como as
-- Tarefas): cada categoria é uma coluna. Em Metas, a categoria única
-- "Objetivos" vira cinco colunas: Semanal, Mensal, Trimestral, Semestral,
-- Anual. Cada coluna começa com o cartão da meta em reais; o checklist
-- do Trello vira cartões próprios embaixo dele.
-- =====================================================================

delete from public.socorro_itens
 where categoria_id in (select id from public.socorro_categorias where secao = 'gestao-metas');
delete from public.socorro_categorias where secao = 'gestao-metas';

insert into public.socorro_categorias (nome, ordem, secao) values
  ('Semanal',    1, 'gestao-metas'),
  ('Mensal',     2, 'gestao-metas'),
  ('Trimestral', 3, 'gestao-metas'),
  ('Semestral',  4, 'gestao-metas'),
  ('Anual',      5, 'gestao-metas');

insert into public.socorro_itens (categoria_id, titulo, conteudo, ordem)
select c.id, v.titulo, '', v.ordem
from (values
  ('Semanal',    'Meta: R$ 1.125,00',  1),
  ('Semanal',    '☐ consultoria',      2),
  ('Semanal',    '☐ consultoria',      3),
  ('Semanal',    '☐ gerenciamento',    4),
  ('Mensal',     'Meta: R$ 4.500,00',  1),
  ('Mensal',     '☐ campanha de vendas', 2),
  ('Trimestral', 'Meta: R$ 13.500,00', 1),
  ('Semestral',  'Meta: R$ 27.000,00', 1),
  ('Anual',      'Meta: R$ 50.000,00', 1)
) as v (coluna, titulo, ordem)
join public.socorro_categorias c on c.nome = v.coluna and c.secao = 'gestao-metas';
