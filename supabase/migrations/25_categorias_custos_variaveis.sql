-- =====================================================================
-- BALUARTE · 25 · Categorias dos custos variáveis (lista da Bruna)
-- =====================================================================
-- Depende de: 04_financeiro.sql, 24_categorias_custos_fixos.sql
-- Antes a categoria do custo variável era um tipo fixo no banco (IA,
-- Freelancer, Impulsionamento...). Agora é uma lista como a dos custos
-- fixos: criar, renomear e excluir pela tela.
--   · O custo variável passa a guardar o NOME da categoria (texto).
--   · Renomear atualiza os custos variáveis com aquele nome; excluir tira
--     da lista e mantém o nome nos lançamentos antigos.
--   · "Conta como gasto com IA": o que soma em "gastos com IA" na Visão
--     geral e no custo de cada entrega. Começa marcado só em "IA".
-- Acesso: igual ao Financeiro (permissão + código da Gestão).
-- =====================================================================

create table public.fin_categorias_custo_variavel (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) between 1 and 40),
  conta_como_ia  boolean not null default false,
  criado_por     uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now()
);

create unique index fin_categorias_custo_variavel_nome_idx on public.fin_categorias_custo_variavel (lower(trim(nome)));

alter table public.fin_categorias_custo_variavel enable row level security;

create policy "Financeiro liberado" on public.fin_categorias_custo_variavel for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));

insert into public.fin_categorias_custo_variavel (nome, conta_como_ia) values
  ('IA', true), ('Freelancer', false), ('Impulsionamento', false), ('Produção', false),
  ('Software', false), ('Deslocamento', false), ('Outro', false);

-- As views do resumo usam a coluna: saem e voltam iguais, só com o filtro de IA novo
drop view public.fin_custo_entregas;
drop view public.fin_resumo_mensal;

-- A coluna vira texto com o nome da categoria (os lançamentos que existirem são convertidos)
alter table public.fin_custos_variaveis alter column categoria drop default;
alter table public.fin_custos_variaveis alter column categoria type text using (case categoria::text
  when 'ia' then 'IA' when 'freelancer' then 'Freelancer' when 'impulsionamento' then 'Impulsionamento'
  when 'producao' then 'Produção' when 'software' then 'Software' when 'deslocamento' then 'Deslocamento'
  else 'Outro' end);
alter table public.fin_custos_variaveis alter column categoria set default 'IA';
alter table public.fin_custos_variaveis add constraint fin_custos_variaveis_categoria_check
  check (length(trim(categoria)) between 1 and 40);
drop type public.categoria_custo_variavel;

create view public.fin_resumo_mensal with (security_invoker = true) as  WITH meses AS (
         SELECT fin_faturamento.competencia
           FROM fin_faturamento
        UNION
         SELECT fin_custos_fixos.competencia
           FROM fin_custos_fixos
        UNION
         SELECT fin_custos_variaveis.competencia
           FROM fin_custos_variaveis
        UNION
         SELECT fin_pagamentos_colaboradores.competencia
           FROM fin_pagamentos_colaboradores
        UNION
         SELECT fin_pro_labore.competencia
           FROM fin_pro_labore
        UNION
         SELECT fin_entregas.competencia
           FROM fin_entregas
        ), fat AS (
         SELECT fin_faturamento.competencia,
            sum(fin_faturamento.valor) AS total,
            sum(fin_faturamento.valor) FILTER (WHERE fin_faturamento.status = 'pago'::status_lancamento) AS recebido
           FROM fin_faturamento
          WHERE fin_faturamento.status <> 'cancelado'::status_lancamento
          GROUP BY fin_faturamento.competencia
        ), fixos AS (
         SELECT fin_custos_fixos.competencia,
            sum(fin_custos_fixos.valor) AS total
           FROM fin_custos_fixos
          WHERE fin_custos_fixos.status <> 'cancelado'::status_lancamento
          GROUP BY fin_custos_fixos.competencia
        ), variaveis AS (
         SELECT fin_custos_variaveis.competencia,
            sum(fin_custos_variaveis.valor) AS total,
            sum(fin_custos_variaveis.valor) FILTER (WHERE (lower(trim(fin_custos_variaveis.categoria)) in (select lower(trim(c.nome)) from public.fin_categorias_custo_variavel c where c.conta_como_ia))) AS ia
           FROM fin_custos_variaveis
          WHERE fin_custos_variaveis.status <> 'cancelado'::status_lancamento
          GROUP BY fin_custos_variaveis.competencia
        ), colab AS (
         SELECT fin_pagamentos_colaboradores.competencia,
            sum(fin_pagamentos_colaboradores.valor) FILTER (WHERE fin_pagamentos_colaboradores.tipo = 'fixo'::tipo_pagamento_colaborador) AS fixo,
            sum(fin_pagamentos_colaboradores.valor) FILTER (WHERE fin_pagamentos_colaboradores.tipo = 'por_entrega'::tipo_pagamento_colaborador) AS por_entrega
           FROM fin_pagamentos_colaboradores
          WHERE fin_pagamentos_colaboradores.status <> 'cancelado'::status_lancamento
          GROUP BY fin_pagamentos_colaboradores.competencia
        ), pl AS (
         SELECT fin_pro_labore.competencia,
            sum(fin_pro_labore.valor) AS total
           FROM fin_pro_labore
          WHERE fin_pro_labore.status <> 'cancelado'::status_lancamento
          GROUP BY fin_pro_labore.competencia
        ), ent AS (
         SELECT fin_entregas.competencia,
            count(*) AS qtd,
            sum(fin_entregas.valor_cobrado) AS cobrado
           FROM fin_entregas
          GROUP BY fin_entregas.competencia
        ), base AS (
         SELECT m.competencia,
            COALESCE(fat.total, 0::numeric) AS faturamento,
            COALESCE(fat.recebido, 0::numeric) AS faturamento_recebido,
            COALESCE(fixos.total, 0::numeric) AS custos_fixos,
            COALESCE(colab.fixo, 0::numeric) AS colaboradores_fixos,
            COALESCE(pl.total, 0::numeric) AS pro_labore,
            COALESCE(variaveis.total, 0::numeric) AS custos_variaveis,
            COALESCE(variaveis.ia, 0::numeric) AS gastos_ia,
            COALESCE(colab.por_entrega, 0::numeric) AS colaboradores_por_entrega,
            COALESCE(ent.qtd, 0::bigint)::integer AS total_entregas,
            COALESCE(ent.cobrado, 0::numeric) AS total_cobrado_entregas
           FROM meses m
             LEFT JOIN fat USING (competencia)
             LEFT JOIN fixos USING (competencia)
             LEFT JOIN variaveis USING (competencia)
             LEFT JOIN colab USING (competencia)
             LEFT JOIN pl USING (competencia)
             LEFT JOIN ent USING (competencia)
        )
 SELECT competencia,
    faturamento,
    faturamento_recebido,
    custos_fixos,
    colaboradores_fixos,
    pro_labore,
    custos_variaveis,
    gastos_ia,
    colaboradores_por_entrega,
    total_entregas,
    total_cobrado_entregas,
    custos_fixos + colaboradores_fixos + pro_labore AS base_fixa,
    round((custos_fixos + colaboradores_fixos + pro_labore) / NULLIF(total_entregas, 0)::numeric, 2) AS custo_fixo_por_entrega,
    custos_fixos + colaboradores_fixos + pro_labore + custos_variaveis + colaboradores_por_entrega AS custo_total,
    faturamento - (custos_fixos + colaboradores_fixos + pro_labore + custos_variaveis + colaboradores_por_entrega) AS resultado
   FROM base;

create view public.fin_custo_entregas with (security_invoker = true) as  WITH var AS (
         SELECT fin_custos_variaveis.entrega_id,
            sum(fin_custos_variaveis.valor) AS total,
            sum(fin_custos_variaveis.valor) FILTER (WHERE (lower(trim(fin_custos_variaveis.categoria)) in (select lower(trim(c.nome)) from public.fin_categorias_custo_variavel c where c.conta_como_ia))) AS ia
           FROM fin_custos_variaveis
          WHERE fin_custos_variaveis.entrega_id IS NOT NULL AND fin_custos_variaveis.status <> 'cancelado'::status_lancamento
          GROUP BY fin_custos_variaveis.entrega_id
        ), colab AS (
         SELECT fin_pagamentos_colaboradores.entrega_id,
            sum(fin_pagamentos_colaboradores.valor) AS total
           FROM fin_pagamentos_colaboradores
          WHERE fin_pagamentos_colaboradores.entrega_id IS NOT NULL AND fin_pagamentos_colaboradores.tipo = 'por_entrega'::tipo_pagamento_colaborador AND fin_pagamentos_colaboradores.status <> 'cancelado'::status_lancamento
          GROUP BY fin_pagamentos_colaboradores.entrega_id
        ), calc AS (
         SELECT e.id AS entrega_id,
            e.descricao,
            e.cliente_id,
            e.tipo_servico,
            e.competencia,
            e.data_entrega,
            e.valor_cobrado,
            COALESCE(r.custo_fixo_por_entrega, 0::numeric) AS custo_fixo_rateado,
            COALESCE(var.total, 0::numeric) + COALESCE(colab.total, 0::numeric) AS custos_variaveis,
            COALESCE(var.ia, 0::numeric) AS custo_ia
           FROM fin_entregas e
             LEFT JOIN fin_resumo_mensal r ON r.competencia = e.competencia
             LEFT JOIN var ON var.entrega_id = e.id
             LEFT JOIN colab ON colab.entrega_id = e.id
        )
 SELECT entrega_id,
    descricao,
    cliente_id,
    tipo_servico,
    competencia,
    data_entrega,
    valor_cobrado,
    custo_fixo_rateado,
    custos_variaveis,
    custo_ia,
    custo_fixo_rateado + custos_variaveis AS custo_real,
    valor_cobrado - (custo_fixo_rateado + custos_variaveis) AS margem_valor,
    round(100::numeric * (valor_cobrado - (custo_fixo_rateado + custos_variaveis)) / NULLIF(valor_cobrado, 0::numeric), 1) AS margem_percentual
   FROM calc;

-- Renomear reflete em todos os custos variáveis com o nome antigo
create or replace function public.propagar_categoria_custo_variavel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nome is distinct from old.nome then
    update public.fin_custos_variaveis set categoria = trim(new.nome)
     where lower(trim(categoria)) = lower(trim(old.nome));
  end if;
  return new;
end;
$$;

revoke execute on function public.propagar_categoria_custo_variavel() from public, anon, authenticated;

create trigger fin_categorias_custo_variavel_propagar
  after update on public.fin_categorias_custo_variavel
  for each row execute function public.propagar_categoria_custo_variavel();
