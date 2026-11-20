-- =====================================================================
-- BALUARTE · 33 · Cada pessoa só enxerga a equipe dos próprios clientes
-- =====================================================================
-- Antes: qualquer membro ativo lia todos os perfis (nome e e-mail).
-- Agora, quem é da equipe vê só:
--   * o próprio perfil;
--   * as administradoras (estão em todos os clientes);
--   * quem divide pelo menos um cliente com ela.
-- Administradoras e quem está com o Comercial ou a Gestão desbloqueados
-- continuam vendo todos (as anotações e os pagamentos citam a equipe).
-- =====================================================================

create or replace function public.pode_ver_perfil(p_perfil_id uuid, p_papel public.papel_usuario)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_perfil_id = auth.uid()
      or public.eh_admin()
      or (
           public.eh_membro_ativo()
           and (
                p_papel = 'admin'
             or public.tem_acesso_area('prospeccao')
             or public.tem_acesso_area('financeiro')
             or exists (
                  select 1
                  from public.cliente_membros eu
                  join public.cliente_membros outro on outro.cliente_id = eu.cliente_id
                  where eu.usuario_id = auth.uid()
                    and outro.usuario_id = p_perfil_id
                )
           )
         );
$$;

revoke execute on function public.pode_ver_perfil(uuid, public.papel_usuario) from public, anon;
grant  execute on function public.pode_ver_perfil(uuid, public.papel_usuario) to authenticated;

drop policy if exists "Equipe ativa vê os perfis" on public.perfis;

create policy "Cada pessoa vê a equipe dos próprios clientes"
  on public.perfis for select to authenticated
  using (public.pode_ver_perfil(id, papel));
