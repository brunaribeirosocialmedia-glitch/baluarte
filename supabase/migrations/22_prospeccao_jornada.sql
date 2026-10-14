-- =====================================================================
-- BALUARTE · 22 · Jornada do prospect
-- =====================================================================
-- Depende de: 03_prospeccao, 07_metas
--
-- Além da temperatura (frio / morno / quente, que continua), cada
-- prospect passa a ter:
-- • etapa: em que pé está a conversa (a contatar → … → fechado/perdido);
-- • último contato: atualizado sozinho a cada contato registrado;
-- • próximo contato: data para retomar e o que fazer nesse dia.
--
-- Um "contato registrado" é uma anotação com canal (WhatsApp, e-mail…).
-- Ao registrar, o último contato é atualizado, o primeiro contato é
-- preenchido se ainda estava vazio e quem estava "a contatar" passa
-- para "primeiro contato feito".
--
-- O primeiro contato agora pode ficar vazio: quem está "a contatar"
-- ainda não foi abordado.
-- =====================================================================

create type public.etapa_prospect as enum
  ('a_contatar', 'primeiro_contato', 'em_conversa', 'reuniao', 'proposta', 'negociacao', 'fechado', 'perdido');

create type public.canal_contato as enum
  ('whatsapp', 'email', 'ligacao', 'instagram', 'presencial', 'outro');

alter table public.prospects
  add column etapa           public.etapa_prospect not null default 'a_contatar',
  add column ultimo_contato  date,
  add column proximo_contato date,
  add column proximo_passo   text;

alter table public.prospects
  alter column data_primeiro_contato drop not null,
  alter column data_primeiro_contato drop default;

-- Os que já existiam já tiveram o primeiro contato
update public.prospects
   set etapa = case when valor_fechado is not null then 'fechado'::public.etapa_prospect
                    else 'primeiro_contato'::public.etapa_prospect end,
       ultimo_contato = data_primeiro_contato;

create index prospects_proximo_contato_idx
  on public.prospects (proximo_contato) where proximo_contato is not null;

-- Preencher o valor fechado leva o prospect para a etapa "fechado"
create or replace function public.prospect_etapa_fechado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valor_fechado is not null and (tg_op = 'INSERT' or old.valor_fechado is null) then
    new.etapa := 'fechado';
  end if;
  return new;
end;
$$;

create trigger prospects_etapa_fechado
  before insert or update of valor_fechado on public.prospects
  for each row execute function public.prospect_etapa_fechado();

-- Contatos registrados
alter table public.prospect_anotacoes
  add column canal      public.canal_contato,
  add column contato_em date;

create or replace function public.registrar_contato_prospect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.canal is not null then
    new.contato_em := coalesce(new.contato_em, (now() at time zone 'America/Sao_Paulo')::date);
    update public.prospects
       set ultimo_contato        = greatest(coalesce(ultimo_contato, new.contato_em), new.contato_em),
           data_primeiro_contato = least(coalesce(data_primeiro_contato, new.contato_em), new.contato_em),
           etapa = case when etapa = 'a_contatar' then 'primeiro_contato'::public.etapa_prospect else etapa end
     where id = new.prospect_id;
  end if;
  return new;
end;
$$;

create trigger prospect_anotacoes_contato
  before insert on public.prospect_anotacoes
  for each row execute function public.registrar_contato_prospect();
