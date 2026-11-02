-- =====================================================================
-- BALUARTE · 30 · Espaço do app Ciclo + equipe só por convite
-- =====================================================================
-- O app Ciclo (treino pessoal) usa o login deste projeto. Para isso o
-- cadastro público precisa estar ligado, então:
--
-- 1. Só vira membro da equipe (public.perfis) quem chega por CONVITE
--    da admin. Quem se cadastra sozinho pelo Ciclo não ganha perfil e,
--    sem perfil, não passa em nenhuma policy do Baluarte.
--    O GoTrue grava invited_at num UPDATE logo depois do INSERT, por
--    isso o perfil do convidado é criado no update.
-- 2. Tabela ciclo_dados: uma linha por pessoa, cada uma só vê a sua.
-- =====================================================================

create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primeiro boolean;
begin
  select not exists (select 1 from public.perfis) into v_primeiro;

  -- Cadastro sem convite (ex.: app Ciclo) não entra na equipe
  if not v_primeiro and new.invited_at is null then
    return new;
  end if;

  insert into public.perfis (id, email, nome, papel, pode_prospeccao, pode_financeiro)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(coalesce(new.email, ''), '@', 1)),
    case when v_primeiro then 'admin'::public.papel_usuario else 'membro'::public.papel_usuario end,
    v_primeiro,
    v_primeiro
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Convite: invited_at passa de vazio para preenchido
drop trigger if exists ao_convidar_usuario on auth.users;
create trigger ao_convidar_usuario
  after update of invited_at on auth.users
  for each row
  when (old.invited_at is null and new.invited_at is not null)
  execute function public.criar_perfil_novo_usuario();

-- ---------------------------------------------------------------------
-- App Ciclo
-- ---------------------------------------------------------------------
create table public.ciclo_dados (
  usuario_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);
comment on table public.ciclo_dados is 'App Ciclo (pessoal, fora da B Mídia): perfis e treinos de cada pessoa. Cada uma só acessa a própria linha.';

create trigger ciclo_dados_atualizado_em
  before update on public.ciclo_dados
  for each row execute function public.definir_atualizado_em();

alter table public.ciclo_dados enable row level security;

create policy "Ciclo: cada pessoa lê os próprios dados"
  on public.ciclo_dados for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "Ciclo: cada pessoa cria os próprios dados"
  on public.ciclo_dados for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "Ciclo: cada pessoa altera os próprios dados"
  on public.ciclo_dados for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "Ciclo: cada pessoa apaga os próprios dados"
  on public.ciclo_dados for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.ciclo_dados from anon;
grant select, insert, update, delete on public.ciclo_dados to authenticated;
