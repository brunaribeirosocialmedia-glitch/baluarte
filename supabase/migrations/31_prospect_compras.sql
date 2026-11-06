-- =====================================================================
-- BALUARTE · 31 · Mais de um produto comprado pelo mesmo cliente
-- =====================================================================
-- Depende de: 03_prospeccao, 07_metas, 11_contratos, 22_prospeccao_jornada, 28_pos_venda
--
-- Cada prospect passa a ter uma lista de compras (ex.: uma landing page e,
-- depois, uma consultoria), cada uma com produto, valor, data e pagamento.
-- • prospects.valor_fechado vira a soma das compras e fechado_em a data da
--   primeira: quem já lê esses campos continua funcionando;
-- • a meta do mês soma as compras pela data de cada uma;
-- • registrar uma compra leva o prospect para a etapa "fechado";
-- • prospects.data_pagamento e forma_pagamento deixam de ser usados pela tela.
-- =====================================================================

create table public.prospect_compras (
  id               uuid primary key default gen_random_uuid(),
  prospect_id      uuid not null references public.prospects (id) on delete cascade,
  produto          text not null check (btrim(produto) <> ''),
  valor            numeric(12, 2) check (valor >= 0),   -- vazio = sem cobrança (cliente cobaia)
  comprado_em      date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  forma_pagamento  public.forma_pagamento,
  data_pagamento   date,
  criado_por       uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em        timestamptz not null default now()
);

create index prospect_compras_prospect_idx on public.prospect_compras (prospect_id, comprado_em);
create index prospect_compras_data_idx on public.prospect_compras (comprado_em);

alter table public.prospect_compras enable row level security;

create policy "Prospecção liberada: compras"
  on public.prospect_compras for all to authenticated
  using ((select public.tem_acesso_area('prospeccao')))
  with check ((select public.tem_acesso_area('prospeccao')));

-- O que já foi fechado vira uma compra (antes dos gatilhos: nada muda nos prospects)
insert into public.prospect_compras (prospect_id, produto, valor, comprado_em, forma_pagamento, data_pagamento, criado_por)
select p.id,
       coalesce(nullif(btrim(p.pos_venda_comprou), ''), nullif(btrim(p.servico_pretendido), ''), 'Produto não informado'),
       p.valor_fechado,
       coalesce(p.fechado_em, p.pos_venda_desde, p.data_primeiro_contato, (p.criado_em at time zone 'America/Sao_Paulo')::date),
       p.forma_pagamento,
       p.data_pagamento,
       p.criado_por
  from public.prospects p
 where p.valor_fechado is not null
    or (p.etapa = 'fechado' and coalesce(nullif(btrim(p.pos_venda_comprou), ''), nullif(btrim(p.servico_pretendido), '')) is not null);

-- Mantém o resumo do prospect igual à lista de compras
create or replace function public.sincronizar_compras_prospect()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prospect uuid;
begin
  if tg_op = 'DELETE' then
    v_prospect := old.prospect_id;
  else
    v_prospect := new.prospect_id;
  end if;

  update public.prospects p
     set valor_fechado = c.total,
         fechado_em    = c.primeira,
         etapa         = case when tg_op = 'INSERT' then 'fechado'::public.etapa_prospect else p.etapa end
    from (select sum(valor) as total, min(comprado_em) as primeira
            from public.prospect_compras
           where prospect_id = v_prospect) c
   where p.id = v_prospect;

  return null;
end;
$$;

create trigger prospect_compras_sincronizar
  after insert or update or delete on public.prospect_compras
  for each row execute function public.sincronizar_compras_prospect();

-- O contrato criado ao virar cliente passa a listar os produtos comprados
create or replace function public.criar_contrato_do_prospect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produtos text;
  v_forma    public.forma_pagamento;
begin
  if new.cliente_id is not null and old.cliente_id is null then
    select string_agg(produto, ' + ' order by comprado_em, criado_em),
           (array_agg(forma_pagamento order by comprado_em, criado_em) filter (where forma_pagamento is not null))[1]
      into v_produtos, v_forma
      from public.prospect_compras
     where prospect_id = new.id;

    insert into public.contratos (cliente_id, prospect_id, nome_cliente, servicos, valor_mensal, forma_pagamento, inicio, criado_por)
    values (new.cliente_id, new.id, new.empresa, coalesce(v_produtos, new.servico_pretendido), new.valor_fechado,
            coalesce(v_forma, new.forma_pagamento), coalesce(new.fechado_em::date, current_date), auth.uid())
    on conflict (prospect_id) where prospect_id is not null do nothing;
  end if;
  return new;
end;
$$;
