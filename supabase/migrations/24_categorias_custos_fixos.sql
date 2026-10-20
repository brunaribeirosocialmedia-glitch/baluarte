-- =====================================================================
-- BALUARTE · 24 · Categorias dos custos fixos (lista da Bruna)
-- =====================================================================
-- Depende de: 04_financeiro.sql, 12_obrigacoes.sql
-- Antes as categorias eram sugestões fixas no código. Agora ficam numa
-- lista no banco: criar, renomear e excluir pela própria tela.
--   · O custo fixo continua guardando o NOME da categoria (texto).
--   · Renomear atualiza todos os custos fixos com aquele nome.
--   · Excluir tira a categoria da lista de opções; os lançamentos antigos
--     continuam com o nome que tinham (o histórico não muda).
-- Acesso: igual ao Financeiro (permissão + código da Gestão).
-- =====================================================================

create table public.fin_categorias_custo_fixo (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) between 1 and 40),
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em  timestamptz not null default now()
);

create unique index fin_categorias_custo_fixo_nome_idx on public.fin_categorias_custo_fixo (lower(trim(nome)));

alter table public.fin_categorias_custo_fixo enable row level security;

create policy "Financeiro liberado" on public.fin_categorias_custo_fixo for all to authenticated
  using ((select public.tem_acesso_area('financeiro'))) with check ((select public.tem_acesso_area('financeiro')));

-- As sugestões de antes, as categorias que as Obrigações usam e as que já estão nos lançamentos
insert into public.fin_categorias_custo_fixo (nome)
select distinct on (lower(trim(nome))) trim(nome)
from (
  select unnest(array['Software', 'Contabilidade', 'Internet e telefone', 'Aluguel', 'Equipamentos', 'Impostos',
                      'Renovações', 'Taxas', 'Outros']) as nome
  union all
  select categoria from public.fin_custos_fixos where categoria is not null and length(trim(categoria)) > 0
) x
on conflict do nothing;

-- Renomear reflete em todos os custos fixos com o nome antigo
create or replace function public.propagar_categoria_custo_fixo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nome is distinct from old.nome then
    update public.fin_custos_fixos set categoria = trim(new.nome)
     where lower(trim(categoria)) = lower(trim(old.nome));
  end if;
  return new;
end;
$$;

revoke execute on function public.propagar_categoria_custo_fixo() from public, anon, authenticated;

create trigger fin_categorias_custo_fixo_propagar
  after update on public.fin_categorias_custo_fixo
  for each row execute function public.propagar_categoria_custo_fixo();
