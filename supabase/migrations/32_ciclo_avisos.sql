-- =====================================================================
-- BALUARTE · 32 · Avisos da Lua (app pessoal Ciclo, fora da B Mídia)
-- =====================================================================
-- Depende de: 30_ciclo_app
--
-- A mascote do Ciclo manda notificação com o app fechado:
-- • ciclo_push_aparelhos: cada celular que ligou os avisos (cada pessoa só
--   vê os próprios);
-- • ciclo_push_envios: o que já foi enviado hoje, para não repetir (só a
--   função da nuvem acessa);
-- • de 15 em 15 minutos, das 10h às 23h45 de Brasília, o agendador chama a
--   função ciclo-lua-avisos, que decide se há algo para avisar.
--
-- A senha que a chamada usa fica no Vault (nome: ciclo_cron_segredo), nunca
-- neste arquivo: o repositório é público. Sem ela, nada é chamado.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.ciclo_push_aparelhos (
  endpoint    text primary key,
  usuario_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  criado_em   timestamptz not null default now()
);
comment on table public.ciclo_push_aparelhos is 'App Ciclo: aparelhos que recebem os avisos da mascote. Cada pessoa só acessa os próprios.';

create index ciclo_push_aparelhos_usuario_idx on public.ciclo_push_aparelhos (usuario_id);

alter table public.ciclo_push_aparelhos enable row level security;

create policy "Ciclo: cada pessoa cuida dos próprios aparelhos"
  on public.ciclo_push_aparelhos for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create table public.ciclo_push_envios (
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  dia         date not null,
  avisos      text[] not null default '{}',
  primary key (usuario_id, dia)
);
comment on table public.ciclo_push_envios is 'App Ciclo: avisos já enviados no dia. Sem política de acesso: só a função da nuvem usa.';

alter table public.ciclo_push_envios enable row level security;

create or replace function public.ciclo_disparar_avisos()
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
    url := 'https://kfcmcwxnqfofmworbojt.supabase.co/functions/v1/ciclo-lua-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ciclo-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.ciclo_disparar_avisos() from public, anon, authenticated;

-- 13h às 2h45 em UTC = 10h às 23h45 em Brasília
select cron.schedule('ciclo-lua-avisos', '*/15 0-2,13-23 * * *', 'select public.ciclo_disparar_avisos()');
