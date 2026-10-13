-- =====================================================================
-- COMPASSO · 18 · Gestão › Esteira de produtos
-- =====================================================================
-- Depende de: 17_processos_gestao
--
-- A aba Precificação e entrega sai: custos e pró-labore já ficam no
-- Financeiro. No lugar entra a Esteira de produtos, com os produtos
-- fixos da B Mídia (o primeiro é a Análise de perfil). O texto antigo
-- de precificação continua no Obsidian (Trello — B Mídia).
-- =====================================================================

delete from public.socorro_itens
 where categoria_id in (select id from public.socorro_categorias where secao = 'gestao-precificacao');

update public.socorro_categorias
   set secao = 'gestao-esteira', nome = 'Produtos fixos'
 where secao = 'gestao-precificacao';

insert into public.socorro_itens (categoria_id, titulo, conteudo, ordem)
select id, 'Análise de perfil', $p$O que é:

O que entrega:

Prazo:

Valor:

Próximo passo na esteira:$p$, 1
from public.socorro_categorias
where secao = 'gestao-esteira';
