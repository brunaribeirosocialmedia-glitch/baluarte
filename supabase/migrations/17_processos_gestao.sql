-- =====================================================================
-- COMPASSO · 17 · Processos e textos da Gestão
-- =====================================================================
-- Depende de: 16_socorro_biblioteca, 01 (tem_acesso_area, eh_admin)
--
-- A biblioteca da Caixa de Pandora passa a servir outras telas.
-- Cada categoria pertence a uma "seção":
--   pandora               → Caixa de Pandora
--   processos             → Processos (cliente novo, briefing)
--   gestao-precificacao  → Gestão › Precificação e entrega
--   gestao-metas         → Gestão › Metas
--
-- Acesso: as seções da Gestão têm custos e pró-labore, então pedem a
-- mesma liberação da Gestão (pode_financeiro + código). As demais
-- seguem como antes: equipe ativa lê, admin edita.
-- =====================================================================

alter table public.socorro_categorias
  add column if not exists secao text not null default 'pandora';

create index if not exists socorro_categorias_secao_idx on public.socorro_categorias (secao, ordem);

-- quem pode ver uma seção
create or replace function public.pode_ver_secao(p_secao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_membro_ativo()
     and (p_secao not like 'gestao%' or public.tem_acesso_area('financeiro'));
$$;

revoke execute on function public.pode_ver_secao(text) from public, anon;
grant  execute on function public.pode_ver_secao(text) to authenticated;

drop policy if exists "Equipe lê categorias" on public.socorro_categorias;
create policy "Equipe lê categorias"
  on public.socorro_categorias for select to authenticated
  using ((select public.pode_ver_secao(secao)));

drop policy if exists "Equipe lê itens" on public.socorro_itens;
create policy "Equipe lê itens"
  on public.socorro_itens for select to authenticated
  using (exists (
    select 1 from public.socorro_categorias c
    where c.id = categoria_id and (select public.pode_ver_secao(c.secao))
  ));

-- ---------------------------------------------------------------------
-- Conteúdo vindo do quadro "B MÍDIA" do Trello
-- ---------------------------------------------------------------------

-- Caixa de Pandora: Calendário e Anotações
insert into public.socorro_categorias (nome, ordem, secao) values
  ('Calendário', 20, 'pandora'),
  ('Anotações',  21, 'pandora');

insert into public.socorro_itens (categoria_id, titulo, conteudo, ordem)
select (select id from public.socorro_categorias where nome = 'Calendário' and secao = 'pandora'),
       'Cronograma semanal de conteúdos', n.conteudo, 1
from public.notas n
where n.id = 'b4bd266c-6ea3-42d3-9dc7-aca74559036d';

-- Processos: os cartões Processo cliente novo e Briefing saem da Caixa de Pandora
insert into public.socorro_categorias (nome, ordem, secao) values
  ('Processo cliente novo', 1, 'processos'),
  ('Briefing',              2, 'processos');

update public.socorro_itens
   set categoria_id = (select id from public.socorro_categorias where nome = 'Processo cliente novo' and secao = 'processos'),
       titulo = 'Processo cliente novo'
 where id = 'eb84b55b-7ec8-40c1-911e-54e1b3161387';

update public.socorro_itens
   set categoria_id = (select id from public.socorro_categorias where nome = 'Briefing' and secao = 'processos'),
       titulo = 'Briefing do cliente (perguntas)'
 where id = 'a4ac9fe7-18e9-4a68-a37f-d41b187e07f9';

-- Gestão › Precificação e entrega
insert into public.socorro_categorias (nome, ordem, secao) values
  ('Precificação e entrega', 1, 'gestao-precificacao');

insert into public.socorro_itens (categoria_id, titulo, conteudo, ordem)
select (select id from public.socorro_categorias where secao = 'gestao-precificacao'),
       'Precificação e entrega', n.conteudo, 1
from public.notas n
where n.id = 'f5df88eb-2e2c-4d8d-aa0a-3d0eccfa5996';

-- Gestão › Metas (lista OBJETIVOS)
insert into public.socorro_categorias (nome, ordem, secao) values
  ('Objetivos', 1, 'gestao-metas');

insert into public.socorro_itens (categoria_id, titulo, conteudo, ordem)
select c.id, v.titulo, v.conteudo, v.ordem
from public.socorro_categorias c,
     (values
       ('Semanal',    $m$Meta: R$ 1.125,00

☐ consultoria
☐ consultoria
☐ gerenciamento$m$, 1),
       ('Mensal',     $m$Meta: R$ 4.500,00

☐ campanha de vendas$m$, 2),
       ('Trimestral', 'Meta: R$ 13.500,00', 3),
       ('Semestral',  'Meta: R$ 27.000,00', 4),
       ('Anual',      'Meta: R$ 50.000,00', 5)
     ) as v (titulo, conteudo, ordem)
where c.secao = 'gestao-metas';

-- As notas antigas da @agenciabmidia_ saem (o conteúdo agora mora nas abas novas)
delete from public.notas where id in (
  'b4bd266c-6ea3-42d3-9dc7-aca74559036d',  -- Cronograma semanal
  'f5df88eb-2e2c-4d8d-aa0a-3d0eccfa5996',  -- Precificação e custos
  '3a3787aa-8c12-4af8-87b6-3e2343dbe4b0'   -- Metas
);
