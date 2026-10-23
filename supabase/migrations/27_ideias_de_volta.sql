-- =====================================================================
-- 27 · Clientes novos voltam a nascer com a coluna "Ideias"
-- =====================================================================
-- A 14 recriou criar_colunas_padrao sem a coluna "Ideias" da 08.
-- Só muda o padrão de clientes novos; os existentes ficam como estão.
-- =====================================================================

-- Mesmos atributos da função original (02_area_do_cliente): security definer.
create or replace function public.criar_colunas_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida) values
    (new.id, 'Ideias',       1, false),
    (new.id, 'A fazer',      2, false),
    (new.id, 'Em andamento', 3, false),
    (new.id, 'Em aprovação', 4, false),
    (new.id, 'Aprovado',     5, false),
    (new.id, 'Agendado',     6, true),
    (new.id, 'Publicado',    7, true);
  return new;
end;
$$;
