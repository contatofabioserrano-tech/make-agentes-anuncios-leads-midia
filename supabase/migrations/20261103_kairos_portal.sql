-- =============================================================================
-- Portal Kairós — migração única (aplicar de uma vez).
-- 1) backup + limpeza (só Kairós)  2) segurança mk_ad_jobs  3) auditoria à prova
-- de forja  4) rascunhos de cadastro  5) opções do Odoo  6) leads da landing page
-- Idempotente: pode rodar de novo sem duplicar nada.
-- =============================================================================

-- 1) BACKUP + LIMPEZA ---------------------------------------------------------
create table if not exists public.mk_backup_brands_20261103   as select * from public.brands;
create table if not exists public.mk_backup_projects_20261103 as select * from public.projects;
create table if not exists public.mk_backup_messages_20261103 as select * from public.messages
  where project_id in (select id from public.projects);
create table if not exists public.mk_backup_render_jobs_20261103 as select * from public.render_jobs
  where project_id in (select id from public.projects);
create table if not exists public.mk_backup_edits_20261103 as select * from public.edits
  where project_id in (select id from public.projects);
alter table public.mk_backup_brands_20261103      enable row level security;
alter table public.mk_backup_projects_20261103    enable row level security;
alter table public.mk_backup_messages_20261103    enable row level security;
alter table public.mk_backup_render_jobs_20261103 enable row level security;
alter table public.mk_backup_edits_20261103       enable row level security;

-- projetos de teste e das marcas que saem (messages/render_jobs/edits caem em cascata)
delete from public.projects
 where name in ('Clover','Collegiate','FODASE','Teste','Daniel Tonelli')
    or brand_id in (select id from public.brands where name in ('Dr. Jund Pet','Pratique Boxe'))
    or name ilike 'Pratique Boxe%';
delete from public.brands where name in ('Dr. Jund Pet','Pratique Boxe');

insert into public.brands (owner, name, color_primary, color_accent, tagline)
select p.id, 'Grupo Kairós', '#111111', '#E11C24', 'Importação Brasil–China'
  from public.profiles p
 where p.email = 'admin@fortunacreative.com.br'
   and not exists (select 1 from public.brands where name = 'Grupo Kairós')
 limit 1;

-- 2) mk_ad_jobs: cliente não define status/result ------------------------------
create or replace function public.mk_ad_jobs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status       := 'queued';
    new.result       := '{}'::jsonb;
    new.credits_used := 0;
    new.created_by   := coalesce(auth.uid(), new.created_by);
    new.created_at   := now();
    new.updated_at   := now();
    if jsonb_typeof(new.steps) is distinct from 'array' then new.steps := '[]'::jsonb; end if;
    return new;
  end if;
  -- UPDATE: o worker (service role ou admin) atualiza tudo
  if coalesce(auth.role(), '') = 'service_role' or public.mk_is_admin() then
    new.updated_at := now();
    return new;
  end if;
  -- usuário comum: só pode cancelar; o resto da linha fica como estava
  if new.status is distinct from 'canceled' then
    raise exception 'só é permitido cancelar o job';
  end if;
  new.odoo_id := old.odoo_id; new.marketplaces := old.marketplaces; new.options := old.options;
  new.steps := old.steps; new.result := old.result; new.credits_used := old.credits_used;
  new.created_by := old.created_by; new.created_at := old.created_at; new.updated_at := now();
  return new;
end $$;
drop trigger if exists mk_ad_jobs_guard on public.mk_ad_jobs;
create trigger mk_ad_jobs_guard before insert or update on public.mk_ad_jobs
  for each row execute function public.mk_ad_jobs_guard();

drop policy if exists mk_jobs_insert on public.mk_ad_jobs;
create policy mk_jobs_insert on public.mk_ad_jobs for insert to authenticated
  with check (created_by = auth.uid() and status = 'queued' and result = '{}'::jsonb);

-- 3) Auditoria: actor e data preenchidos no servidor; append-only --------------
create or replace function public.mk_audit_stamp() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  new.at := now();
  if coalesce(auth.role(), '') <> 'service_role' then
    new.actor_id := auth.uid();
  end if;
  if new.actor_id is not null then
    select u.email into new.actor_email from auth.users u where u.id = new.actor_id;
  end if;
  return new;
end $$;
drop trigger if exists mk_audit_stamp on public.mk_audit_events;
create trigger mk_audit_stamp before insert on public.mk_audit_events
  for each row execute function public.mk_audit_stamp();

create or replace function public.mk_audit_readonly() returns trigger
language plpgsql as $$
begin
  raise exception 'a trilha de auditoria não pode ser alterada nem apagada';
end $$;
drop trigger if exists mk_audit_readonly on public.mk_audit_events;
create trigger mk_audit_readonly before update or delete on public.mk_audit_events
  for each row execute function public.mk_audit_readonly();
revoke update, delete, truncate on public.mk_audit_events from anon, authenticated;

-- 4) Rascunhos de cadastro de produto (mesmos campos do "cotar" do Odoo) -------
create table if not exists public.mk_product_drafts (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references auth.users(id),
  status      text not null default 'rascunho' check (status in ('rascunho','pronto','enviado_odoo')),
  source_odoo_id integer,
  sku         text,
  name_pt     text not null check (char_length(name_pt) between 2 and 300),
  data        jsonb not null default '{}'::jsonb,
  completeness integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.mk_product_drafts enable row level security;
drop policy if exists mk_drafts_read on public.mk_product_drafts;
create policy mk_drafts_read on public.mk_product_drafts for select to authenticated using (true);
drop policy if exists mk_drafts_insert on public.mk_product_drafts;
create policy mk_drafts_insert on public.mk_product_drafts for insert to authenticated
  with check (created_by = auth.uid() and status <> 'enviado_odoo');
drop policy if exists mk_drafts_update on public.mk_product_drafts;
create policy mk_drafts_update on public.mk_product_drafts for update to authenticated
  using (created_by = auth.uid() or public.mk_is_admin())
  with check ((created_by = auth.uid() or public.mk_is_admin()) and status <> 'enviado_odoo');
drop policy if exists mk_drafts_delete on public.mk_product_drafts;
create policy mk_drafts_delete on public.mk_product_drafts for delete to authenticated
  using (created_by = auth.uid() or public.mk_is_admin());

-- 5) Opções do Odoo (kairos.option, kairos.incoterm, kairos.ncm, kairos.hs ...) — cópia só leitura
create table if not exists public.mk_odoo_options (
  model     text not null,
  odoo_id   integer not null,
  name      text not null,
  code      text,
  extra     jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (model, odoo_id)
);
alter table public.mk_odoo_options enable row level security;
drop policy if exists mk_options_read on public.mk_odoo_options;
create policy mk_options_read on public.mk_odoo_options for select to authenticated using (true);
drop policy if exists mk_options_admin_write on public.mk_odoo_options;
create policy mk_options_admin_write on public.mk_odoo_options for all to authenticated
  using (public.mk_is_admin()) with check (public.mk_is_admin());

-- 6) Leads da landing page pública /loja/[slug] --------------------------------
create table if not exists public.mk_leads (
  id         bigint generated always as identity primary key,
  slug       text not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  name       text not null check (char_length(name) between 2 and 120),
  email      text check (email is null or (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone      text check (phone is null or char_length(phone) <= 30),
  company    text check (company is null or char_length(company) <= 160),
  quantity   text check (quantity is null or char_length(quantity) <= 60),
  message    text check (message is null or char_length(message) <= 1000),
  source     text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
alter table public.mk_leads enable row level security;
drop policy if exists mk_leads_insert on public.mk_leads;
create policy mk_leads_insert on public.mk_leads for insert to anon, authenticated with check (true);
drop policy if exists mk_leads_read on public.mk_leads;
create policy mk_leads_read on public.mk_leads for select to authenticated using (public.mk_is_admin());
grant insert on public.mk_leads to anon;
