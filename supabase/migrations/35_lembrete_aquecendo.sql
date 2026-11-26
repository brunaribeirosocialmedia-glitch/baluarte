-- =====================================================================
-- BALUARTE · 35 · Lembrete no celular: prospects em Aquecendo
-- =====================================================================
-- Depende de: 32_ciclo_avisos (pg_cron, pg_net e a senha no Vault),
--             34_social_selling_etapas
--
-- De segunda a sexta, às 9h de Brasília, o agendador chama a função
-- baluarte-lembretes. Se houver prospect em "Aquecendo", ela manda uma
-- notificação para os celulares que ligaram o lembrete, com os nomes,
-- para lembrar de passar no Instagram e dar atenção a eles.
--
-- • baluarte_push_aparelhos: cada celular que ligou o lembrete (cada
--   pessoa só vê os próprios). A função só manda para quem é admin ou
--   tem permissão no Comercial: os nomes dos prospects são do Comercial.
--
-- Usa a mesma senha do agendamento do Ciclo (Vault: ciclo_cron_segredo)
-- e as mesmas chaves de notificação, que já estão nos segredos das
-- funções. Nada de senha neste arquivo: o repositório é público.
--
-- Para desfazer: supabase/desfazer/35_desfazer_lembrete_aquecendo.sql
-- =====================================================================

create table public.baluarte_push_aparelhos (
  endpoint    text primary key,
  usuario_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  criado_em   timestamptz not null default now()
);
comment on table public.baluarte_push_aparelhos is 'Baluarte: celulares que recebem o lembrete dos prospects em Aquecendo. Cada pessoa só acessa os próprios.';

create index baluarte_push_aparelhos_usuario_idx on public.baluarte_push_aparelhos (usuario_id);

alter table public.baluarte_push_aparelhos enable row level security;

create policy "Baluarte: cada pessoa cuida dos próprios aparelhos"
  on public.baluarte_push_aparelhos for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create or replace function public.baluarte_disparar_lembretes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_segredo text;
begin
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'ciclo_cron_segredo';
  if v_segredo is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://kfcmcwxnqfofmworbojt.supabase.co/functions/v1/baluarte-lembretes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ciclo-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.baluarte_disparar_lembretes() from public, anon, authenticated;

-- 12h em UTC = 9h em Brasília, de segunda (1) a sexta (5)
select cron.schedule('baluarte-lembrete-aquecendo', '0 12 * * 1-5', 'select public.baluarte_disparar_lembretes()');
