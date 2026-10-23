-- =====================================================================
-- 26 · Tarefas: "Concluído" vira "Agendado" + "Publicado"
-- =====================================================================
--  1) Clientes novos já nascem com as duas colunas no lugar de "Concluído".
--  2) Clientes existentes: "Concluído" é renomeada para "Publicado"
--     (as tarefas que já estavam lá continuam nela) e "Agendado" entra
--     logo antes. As duas contam como concluídas (dá para desmarcar
--     o "conclui" em Editar colunas).
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
    (new.id, 'A fazer',      1, false),
    (new.id, 'Em andamento', 2, false),
    (new.id, 'Em aprovação', 3, false),
    (new.id, 'Aprovado',     4, false),
    (new.id, 'Agendado',     5, true),
    (new.id, 'Publicado',    6, true);
  return new;
end;
$$;

do $$
declare
  c record;
begin
  for c in
    select tc.id, tc.cliente_id, tc.ordem
      from public.tarefa_colunas tc
      where lower(trim(tc.nome)) in ('concluído', 'concluido')
  loop
    update public.tarefa_colunas set nome = 'Publicado' where id = c.id;

    if not exists (
      select 1 from public.tarefa_colunas tc
      where tc.cliente_id = c.cliente_id and lower(trim(tc.nome)) = 'agendado'
    ) then
      -- empurra "Publicado" (e o que vier depois) +1 e põe "Agendado" no lugar
      update public.tarefa_colunas tc set ordem = tc.ordem + 1
        where tc.cliente_id = c.cliente_id and tc.ordem >= c.ordem;
      insert into public.tarefa_colunas (cliente_id, nome, ordem, marca_concluida)
        values (c.cliente_id, 'Agendado', c.ordem, true);
    end if;
  end loop;
end $$;
