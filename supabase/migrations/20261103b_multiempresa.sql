-- =============================================================================
-- Multiempresa (SaaS): cada empresa só vê os dados dela.
--  - mk_companies / mk_company_members / mk_company_invites
--  - company_id em todas as tabelas mk_*; Kairós = empresa "odoo" (dados atuais)
--  - mk_company_sources + bucket privado "mk-fontes" (links, fotos, PDFs)
--  - mk_ad_jobs ganha kind ('anuncio' | 'ingestao'), draft_id e source_ids
-- Plataforma (profiles.role = 'admin', equipe Fortuna) vê e administra todas.
-- Idempotente.
-- =============================================================================

create table if not exists public.mk_companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name          text not null check (char_length(name) between 2 and 120),
  kind          text not null default 'padrao' check (kind in ('odoo','padrao')),
  color_primary text default '#111111',
  color_accent  text default '#E11C24',
  logo_url      text,
  site_url      text,
  created_by    uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);

-- ficha da empresa no padrão do cadastro de parceiro do Odoo (res.partner) do Importe Fácil
alter table public.mk_companies add column if not exists legal_name text check (legal_name is null or char_length(legal_name) <= 160);
alter table public.mk_companies add column if not exists cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$');
alter table public.mk_companies add column if not exists state_registration text check (state_registration is null or char_length(state_registration) <= 30);
alter table public.mk_companies add column if not exists email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.mk_companies add column if not exists phone text check (phone is null or char_length(phone) <= 30);
alter table public.mk_companies add column if not exists whatsapp text check (whatsapp is null or char_length(whatsapp) <= 30);
alter table public.mk_companies add column if not exists segment text check (segment is null or char_length(segment) <= 120);
alter table public.mk_companies add column if not exists address jsonb not null default '{}'::jsonb;
alter table public.mk_companies add column if not exists extra jsonb not null default '{}'::jsonb;

create table if not exists public.mk_company_members (
  company_id uuid not null references public.mk_companies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('dono','editor','leitor')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists public.mk_company_invites (
  company_id uuid not null references public.mk_companies(id) on delete cascade,
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role       text not null default 'editor' check (role in ('dono','editor','leitor')),
  created_at timestamptz not null default now(),
  primary key (company_id, email)
);

-- helpers (security definer: não sofrem RLS e não entram em recursão)
create or replace function public.mk_is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mk_is_admin() or exists (
    select 1 from public.mk_company_members m where m.company_id = c and m.user_id = auth.uid());
$$;
create or replace function public.mk_can_edit(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mk_is_admin() or exists (
    select 1 from public.mk_company_members m where m.company_id = c and m.user_id = auth.uid() and m.role in ('dono','editor'));
$$;
create or replace function public.mk_is_owner(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mk_is_admin() or exists (
    select 1 from public.mk_company_members m where m.company_id = c and m.user_id = auth.uid() and m.role = 'dono');
$$;

-- convite vira membro quando a pessoa entra (perfil criado) ou já existe
create or replace function public.mk_apply_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.mk_company_members (company_id, user_id, role)
  select i.company_id, new.id, i.role from public.mk_company_invites i where lower(i.email) = lower(new.email)
  on conflict do nothing;
  delete from public.mk_company_invites where lower(email) = lower(new.email);
  return new;
end $$;
drop trigger if exists mk_apply_invites on public.profiles;
create trigger mk_apply_invites after insert or update of email on public.profiles
  for each row execute function public.mk_apply_invites();

alter table public.mk_companies       enable row level security;
alter table public.mk_company_members enable row level security;
alter table public.mk_company_invites enable row level security;

drop policy if exists mk_companies_read on public.mk_companies;
create policy mk_companies_read on public.mk_companies for select to authenticated using (public.mk_is_member(id));
drop policy if exists mk_companies_admin on public.mk_companies;
create policy mk_companies_admin on public.mk_companies for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
drop policy if exists mk_companies_owner_update on public.mk_companies;
create policy mk_companies_owner_update on public.mk_companies for update to authenticated using (public.mk_is_owner(id)) with check (public.mk_is_owner(id));
-- landing pública precisa só de nome, logo e cores: view sem CNPJ, e-mail etc.
drop policy if exists mk_companies_public on public.mk_companies;
create or replace view public.mk_companies_public as
  select id, slug, name, logo_url, color_primary, color_accent, site_url, whatsapp from public.mk_companies;
grant select on public.mk_companies_public to anon, authenticated;

drop policy if exists mk_members_read on public.mk_company_members;
create policy mk_members_read on public.mk_company_members for select to authenticated using (public.mk_is_member(company_id));
drop policy if exists mk_members_owner on public.mk_company_members;
create policy mk_members_owner on public.mk_company_members for all to authenticated using (public.mk_is_owner(company_id)) with check (public.mk_is_owner(company_id));

drop policy if exists mk_invites_owner on public.mk_company_invites;
create policy mk_invites_owner on public.mk_company_invites for all to authenticated using (public.mk_is_owner(company_id)) with check (public.mk_is_owner(company_id));

-- Kairós = empresa ligada ao Odoo
insert into public.mk_companies (slug, name, kind, color_primary, color_accent, site_url)
values ('kairos', 'Grupo Kairós', 'odoo', '#111111', '#E11C24', 'https://kairos.importefacil.com')
on conflict (slug) do nothing;

create or replace function public.mk_kairos_id() returns uuid
language sql stable security definer set search_path = public as $$ select id from public.mk_companies where slug = 'kairos' $$;

-- equipe atual do portal entra na Kairós (admins da plataforma já veem tudo)
insert into public.mk_company_members (company_id, user_id, role)
select public.mk_kairos_id(), p.id, case when p.role = 'admin' then 'dono' else 'editor' end
  from public.profiles p
on conflict do nothing;

-- company_id em todas as tabelas do módulo -------------------------------------
alter table public.mk_catalog_products add column if not exists company_id uuid references public.mk_companies(id);
alter table public.mk_ad_jobs          add column if not exists company_id uuid references public.mk_companies(id);
alter table public.mk_audit_events     add column if not exists company_id uuid references public.mk_companies(id);
alter table public.mk_product_drafts   add column if not exists company_id uuid references public.mk_companies(id);
alter table public.mk_leads            add column if not exists company_id uuid references public.mk_companies(id);
alter table public.mk_odoo_options     add column if not exists company_id uuid references public.mk_companies(id);

update public.mk_catalog_products set company_id = public.mk_kairos_id() where company_id is null;
alter table public.mk_ad_jobs disable trigger mk_ad_jobs_guard;
update public.mk_ad_jobs          set company_id = public.mk_kairos_id() where company_id is null;
alter table public.mk_ad_jobs enable trigger mk_ad_jobs_guard;
update public.mk_product_drafts   set company_id = public.mk_kairos_id() where company_id is null;
update public.mk_leads            set company_id = public.mk_kairos_id() where company_id is null;
update public.mk_odoo_options     set company_id = public.mk_kairos_id() where company_id is null;
-- auditoria é append-only: o backfill passa por fora do trigger de bloqueio
alter table public.mk_audit_events disable trigger mk_audit_readonly;
update public.mk_audit_events set company_id = public.mk_kairos_id() where company_id is null;
alter table public.mk_audit_events enable trigger mk_audit_readonly;

-- o sync do Odoo e as opções são da Kairós por padrão (scripts antigos continuam funcionando)
alter table public.mk_catalog_products alter column company_id set default public.mk_kairos_id();
alter table public.mk_odoo_options     alter column company_id set default public.mk_kairos_id();
alter table public.mk_catalog_products alter column company_id set not null;
alter table public.mk_ad_jobs          alter column company_id set not null;
alter table public.mk_product_drafts   alter column company_id set not null;
alter table public.mk_leads            alter column company_id set not null;
alter table public.mk_odoo_options     alter column company_id set not null;
create index if not exists mk_catalog_company on public.mk_catalog_products(company_id);
create index if not exists mk_jobs_company on public.mk_ad_jobs(company_id, created_at desc);
create index if not exists mk_audit_company on public.mk_audit_events(company_id, at desc);
create index if not exists mk_drafts_company on public.mk_product_drafts(company_id, updated_at desc);
create index if not exists mk_leads_company on public.mk_leads(company_id, created_at desc);

-- jobs: ingestão de fontes e anúncio a partir de rascunho ------------------------
alter table public.mk_ad_jobs add column if not exists kind text not null default 'anuncio' check (kind in ('anuncio','ingestao'));
alter table public.mk_ad_jobs add column if not exists draft_id uuid references public.mk_product_drafts(id) on delete set null;
alter table public.mk_ad_jobs add column if not exists source_ids uuid[] not null default '{}';
alter table public.mk_ad_jobs alter column odoo_id drop not null;

-- fontes enviadas pela empresa (links, fotos, PDFs) -------------------------------
create table if not exists public.mk_company_sources (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.mk_companies(id) on delete cascade,
  kind         text not null check (kind in ('link','foto','pdf','arquivo')),
  url          text check (url is null or (url ~* '^https://' and char_length(url) <= 1000)),
  storage_path text check (storage_path is null or char_length(storage_path) <= 400),
  file_name    text check (file_name is null or char_length(file_name) <= 200),
  mime         text,
  bytes        bigint,
  note         text check (note is null or char_length(note) <= 1000),
  status       text not null default 'novo' check (status in ('novo','processando','processado','erro')),
  result       jsonb not null default '{}'::jsonb,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);
create index if not exists mk_sources_company on public.mk_company_sources(company_id, created_at desc);
alter table public.mk_company_sources enable row level security;
drop policy if exists mk_sources_read on public.mk_company_sources;
create policy mk_sources_read on public.mk_company_sources for select to authenticated using (public.mk_is_member(company_id));
drop policy if exists mk_sources_insert on public.mk_company_sources;
create policy mk_sources_insert on public.mk_company_sources for insert to authenticated
  with check (public.mk_can_edit(company_id) and created_by = auth.uid() and status = 'novo'
              and (storage_path is null or storage_path like company_id::text || '/%'));
drop policy if exists mk_sources_delete on public.mk_company_sources;
create policy mk_sources_delete on public.mk_company_sources for delete to authenticated using (public.mk_can_edit(company_id));
drop policy if exists mk_sources_admin_update on public.mk_company_sources;
create policy mk_sources_admin_update on public.mk_company_sources for update to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());

-- bucket privado: <company_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit)
values ('mk-fontes', 'mk-fontes', false, 52428800)
on conflict (id) do nothing;
drop policy if exists mk_fontes_read on storage.objects;
create policy mk_fontes_read on storage.objects for select to authenticated
  using (bucket_id = 'mk-fontes' and public.mk_is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists mk_fontes_insert on storage.objects;
create policy mk_fontes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mk-fontes' and public.mk_can_edit(((storage.foldername(name))[1])::uuid));
drop policy if exists mk_fontes_delete on storage.objects;
create policy mk_fontes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mk-fontes' and public.mk_can_edit(((storage.foldername(name))[1])::uuid));

-- RLS por empresa nas tabelas existentes ----------------------------------------
drop policy if exists mk_catalog_read on public.mk_catalog_products;
create policy mk_catalog_read on public.mk_catalog_products for select to authenticated using (public.mk_is_member(company_id));

drop policy if exists mk_jobs_read on public.mk_ad_jobs;
create policy mk_jobs_read on public.mk_ad_jobs for select to authenticated using (public.mk_is_member(company_id));
drop policy if exists mk_jobs_insert on public.mk_ad_jobs;
create policy mk_jobs_insert on public.mk_ad_jobs for insert to authenticated
  with check (created_by = auth.uid() and status = 'queued' and result = '{}'::jsonb and public.mk_can_edit(company_id));
drop policy if exists mk_jobs_cancel on public.mk_ad_jobs;
create policy mk_jobs_cancel on public.mk_ad_jobs for update to authenticated
  using (public.mk_can_edit(company_id) and status in ('queued','running'))
  with check (status = 'canceled');

drop policy if exists mk_audit_read on public.mk_audit_events;
create policy mk_audit_read on public.mk_audit_events for select to authenticated
  using (case when company_id is null then public.mk_is_admin() else public.mk_is_member(company_id) end);
drop policy if exists mk_audit_insert on public.mk_audit_events;
create policy mk_audit_insert on public.mk_audit_events for insert to authenticated
  with check (actor_id = auth.uid() and (company_id is null or public.mk_is_member(company_id)));

drop policy if exists mk_drafts_read on public.mk_product_drafts;
create policy mk_drafts_read on public.mk_product_drafts for select to authenticated using (public.mk_is_member(company_id));
drop policy if exists mk_drafts_insert on public.mk_product_drafts;
create policy mk_drafts_insert on public.mk_product_drafts for insert to authenticated
  with check (created_by = auth.uid() and status <> 'enviado_odoo' and public.mk_can_edit(company_id));
drop policy if exists mk_drafts_update on public.mk_product_drafts;
create policy mk_drafts_update on public.mk_product_drafts for update to authenticated
  using (public.mk_can_edit(company_id)) with check (public.mk_can_edit(company_id) and status <> 'enviado_odoo');
drop policy if exists mk_drafts_delete on public.mk_product_drafts;
create policy mk_drafts_delete on public.mk_product_drafts for delete to authenticated using (public.mk_can_edit(company_id));

drop policy if exists mk_leads_read on public.mk_leads;
create policy mk_leads_read on public.mk_leads for select to authenticated using (public.mk_is_member(company_id));

drop policy if exists mk_options_read on public.mk_odoo_options;
create policy mk_options_read on public.mk_odoo_options for select to authenticated using (public.mk_is_member(company_id));

-- guard do job: a empresa do job tem que bater com a do rascunho / fontes
create or replace function public.mk_ad_jobs_company_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.draft_id is not null and not exists (select 1 from public.mk_product_drafts d where d.id = new.draft_id and d.company_id = new.company_id) then
    raise exception 'rascunho de outra empresa';
  end if;
  if cardinality(new.source_ids) > 0 and exists (
      select 1 from unnest(new.source_ids) s where not exists (select 1 from public.mk_company_sources c where c.id = s and c.company_id = new.company_id)) then
    raise exception 'fonte de outra empresa';
  end if;
  if new.odoo_id is not null and not exists (select 1 from public.mk_catalog_products p where p.odoo_id = new.odoo_id and p.company_id = new.company_id) then
    raise exception 'produto de outra empresa';
  end if;
  return new;
end $$;
drop trigger if exists mk_ad_jobs_company_check on public.mk_ad_jobs;
create trigger mk_ad_jobs_company_check before insert on public.mk_ad_jobs
  for each row execute function public.mk_ad_jobs_company_check();

-- convite por e-mail (dono/admin): vira membro na hora se a conta existe; senão fica pendente
create or replace function public.mk_invite(p_company uuid, p_email text, p_role text default 'editor') returns text
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.mk_is_owner(p_company) then raise exception 'sem permissão'; end if;
  if p_role not in ('dono','editor','leitor') then raise exception 'papel inválido'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is not null then
    insert into public.mk_company_members (company_id, user_id, role) values (p_company, uid, p_role)
    on conflict (company_id, user_id) do update set role = excluded.role;
    return 'membro';
  end if;
  insert into public.mk_company_invites (company_id, email, role) values (p_company, lower(p_email), p_role)
  on conflict (company_id, email) do update set role = excluded.role;
  return 'convite';
end $$;
revoke all on function public.mk_invite(uuid, text, text) from public, anon;
grant execute on function public.mk_invite(uuid, text, text) to authenticated;
