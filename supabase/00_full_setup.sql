-- ============================================================================
--  FULL SETUP — paste this whole file into Supabase → SQL Editor → Run.
--  It is 01_schema + 02_logic + 03_security + 04_geography in order.
--  Safe to re-run.
-- ============================================================================

-- ============================================================================
--  01_schema.sql — tables, relations, indexes, sequences
-- ----------------------------------------------------------------------------
--  Online marketplace (clothes + general products): back office, storefront,
--  online order lifecycle, staff accounts and permissions.
--
--  Run order:  01_schema → 02_logic → 03_security → 04_geography
--  Every file is idempotent: re-running it is safe.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
--  Reference sequences (human-readable document numbers)
-- ----------------------------------------------------------------------------
create sequence if not exists public.purchase_ref_seq;
create sequence if not exists public.sale_ref_seq;
create sequence if not exists public.web_order_ref_seq;

-- ============================================================================
--  ACCOUNTS
-- ============================================================================

-- One row per account in auth.users. Written by the `handle_new_user` trigger
-- (02_logic.sql) — never inserted by the app.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  username     text,
  email        text not null default '',
  role         text not null default 'worker',
  is_admin     boolean not null default false,
  -- Same JSON the app's permission dialog writes:
  --   { "stock": { "enabled": true, "actions": ["view","create"] }, ... }
  permissions  jsonb not null default '{}'::jsonb,
  active       boolean not null default true,
  worker_id    uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================================
--  REFERENCE LISTS
-- ============================================================================

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.worker_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.size_scales (
  id        uuid primary key default gen_random_uuid(),
  category  text not null check (category in ('alpha','numeric','shoes','kids','oneSize','custom')),
  label     text not null,
  position  integer not null default 0,
  unique (category, label)
);

-- ============================================================================
--  STORE IDENTITY (single-row tables: id is always TRUE)
-- ============================================================================

create table if not exists public.store_settings (
  id          boolean primary key default true check (id),
  logo_url    text not null default '',
  name        text not null default 'Nourdine Store',
  description text not null default '',
  email       text not null default '',
  phone       text not null default '',
  address     text not null default '',
  nif         text not null default '',
  nis         text not null default '',
  article     text not null default '',
  rc          text not null default '',
  currency    text not null default 'DA',
  updated_at  timestamptz not null default now()
);

create table if not exists public.website_settings (
  id                 boolean primary key default true check (id),
  favicon_url        text not null default '',
  hero_image_url     text not null default '',
  description        text not null default '',
  tagline            text not null default '',
  free_shipping_from numeric(12,2) not null default 0,
  updated_at         timestamptz not null default now()
);

create table if not exists public.contact_links (
  id         boolean primary key default true check (id),
  facebook   text not null default '',
  instagram  text not null default '',
  tiktok     text not null default '',
  snapchat   text not null default '',
  whatsapp   text not null default '',
  phone      text not null default '',
  phone2     text not null default '',
  email      text not null default '',
  maps_url   text not null default '',
  updated_at timestamptz not null default now()
);

-- ============================================================================
--  PRODUCTS / STOCK
-- ============================================================================

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  -- 'clothing' carries sizes/colour/material/gender/season;
  -- 'general' is name + description + one stock figure.
  product_type   text not null default 'clothing' check (product_type in ('clothing','general')),
  name           text not null,
  description    text not null default '',
  barcode        text unique,
  brand          text not null default '',
  category       text not null default '',
  purchase_price numeric(12,2) not null default 0,
  sale_price     numeric(12,2) not null default 0,
  -- Sum of product_sizes when the article has sizes (trigger), else set directly.
  quantity       integer not null default 0,
  min_quantity   integer not null default 0,
  size_category  text not null default 'alpha'
                 check (size_category in ('alpha','numeric','shoes','kids','oneSize','custom')),
  color          text not null default '',
  material       text not null default '',
  gender         text not null default 'unisex' check (gender in ('women','men','kids','unisex')),
  season         text not null default 'allSeason' check (season in ('springSummer','fallWinter','allSeason')),
  collection     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Upgrade path for a database created before product types existed.
alter table public.products add column if not exists product_type text not null default 'clothing';

create index if not exists products_type_idx     on public.products (product_type);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_created_idx  on public.products (created_at desc);

create table if not exists public.product_sizes (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size       text not null,
  quantity   integer not null default 0 check (quantity >= 0),
  position   integer not null default 0,
  unique (product_id, size)
);

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Public bucket URL or object path inside `product-images`.
  path       text not null,
  position   integer not null default 0
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- ============================================================================
--  CLIENTS & SUPPLIERS
-- ============================================================================

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null default '',
  address    text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================================
--  PURCHASES (stock in)
-- ============================================================================

create table if not exists public.purchases (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique
                default ('ACH-' || lpad(nextval('public.purchase_ref_seq')::text, 6, '0')),
  supplier_id   uuid references public.suppliers (id) on delete set null,
  supplier_name text not null default '',
  total         numeric(12,2) not null default 0,   -- derived
  paid          numeric(12,2) not null default 0,   -- derived
  status        text not null default 'unpaid' check (status in ('paid','partial','unpaid')),
  date          timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists purchases_date_idx on public.purchases (date desc);

create table if not exists public.purchase_lines (
  id             uuid primary key default gen_random_uuid(),
  purchase_id    uuid not null references public.purchases (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  product_name   text not null,
  barcode        text not null default '',
  size           text not null default '',   -- '' for general products
  quantity       integer not null check (quantity > 0),
  purchase_price numeric(12,2) not null default 0,
  sale_price     numeric(12,2) not null default 0,
  min_quantity   integer not null default 0
);
create index if not exists purchase_lines_purchase_idx on public.purchase_lines (purchase_id);
create index if not exists purchase_lines_product_idx  on public.purchase_lines (product_id);

create table if not exists public.purchase_payments (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  date        timestamptz not null default now(),
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists purchase_payments_purchase_idx on public.purchase_payments (purchase_id);

-- ============================================================================
--  SALES (counter / POS — stock out)
-- ============================================================================

create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique
              default ('VNT-' || lpad(nextval('public.sale_ref_seq')::text, 6, '0')),
  client_id   uuid references public.clients (id) on delete set null,
  client_name text not null default '',
  subtotal    numeric(12,2) not null default 0,   -- derived
  discount    numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,   -- derived
  paid        numeric(12,2) not null default 0,   -- derived
  status      text not null default 'unpaid' check (status in ('paid','partial','unpaid')),
  date        timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists sales_date_idx   on public.sales (date desc);
create index if not exists sales_client_idx on public.sales (client_id);

create table if not exists public.sale_lines (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  barcode      text not null default '',
  size         text not null default '',
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(12,2) not null default 0
);
create index if not exists sale_lines_sale_idx    on public.sale_lines (sale_id);
create index if not exists sale_lines_product_idx on public.sale_lines (product_id);

create table if not exists public.sale_payments (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales (id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  date       timestamptz not null default now(),
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists sale_payments_sale_idx on public.sale_payments (sale_id);

-- ============================================================================
--  WORKERS
-- ============================================================================

create table if not exists public.workers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  birth_date    date,
  id_card       text not null default '',
  phone         text not null default '',
  role          text not null default '',
  has_salary    boolean not null default true,
  salary_type   text not null default 'monthly' check (salary_type in ('monthly','daily')),
  salary_amount numeric(12,2) not null default 0,
  has_account   boolean not null default false,
  email         text not null default '',
  username      text not null default '',
  -- The owner's permission matrix for this worker; copied onto profiles.
  permissions   jsonb not null default '{}'::jsonb,
  start_date    date,
  active        boolean not null default true,
  profile_id    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists workers_email_idx on public.workers (lower(email));

do $$ begin
  alter table public.profiles
    add constraint profiles_worker_fk foreign key (worker_id)
    references public.workers (id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.worker_advances (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.workers (id) on delete cascade,
  date        timestamptz not null default now(),
  description text not null default '',
  amount      numeric(12,2) not null check (amount > 0),
  deducted    boolean not null default false
);
create table if not exists public.worker_absences (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.workers (id) on delete cascade,
  date        timestamptz not null default now(),
  description text not null default '',
  cost        numeric(12,2) not null default 0
);
create table if not exists public.worker_payments (
  id                uuid primary key default gen_random_uuid(),
  worker_id         uuid not null references public.workers (id) on delete cascade,
  period            text not null,                       -- e.g. '2026-06'
  base_salary       numeric(12,2) not null default 0,
  absences_deducted numeric(12,2) not null default 0,
  advances_deducted numeric(12,2) not null default 0,
  amount            numeric(12,2) not null default 0,
  note              text not null default '',
  date              timestamptz not null default now()
);
create index if not exists worker_advances_worker_idx on public.worker_advances (worker_id);
create index if not exists worker_absences_worker_idx on public.worker_absences (worker_id);
create index if not exists worker_payments_worker_idx on public.worker_payments (worker_id);

-- ============================================================================
--  EXPENSES & CAISSE
-- ============================================================================

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  amount      numeric(12,2) not null check (amount >= 0),
  date        timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (date desc);

-- ============================================================================
--  WEBSITE — catalogue exposure, offers
-- ============================================================================

create table if not exists public.web_product_settings (
  product_id uuid primary key references public.products (id) on delete cascade,
  hidden     boolean not null default false,
  web_price  numeric(12,2),        -- null → falls back to products.sale_price
  featured   boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.special_offers (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null default '',
  image_path       text not null default '',
  active           boolean not null default true,
  start_date       timestamptz,
  end_date         timestamptz,
  original_total   numeric(12,2) not null default 0,   -- derived
  offer_total      numeric(12,2) not null default 0,   -- derived
  discount_amount  numeric(12,2) not null default 0,   -- derived
  discount_percent numeric(6,2)  not null default 0,   -- derived
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.offer_lines (
  id             uuid primary key default gen_random_uuid(),
  offer_id       uuid not null references public.special_offers (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  product_name   text not null,
  quantity       integer not null default 1 check (quantity > 0),
  original_price numeric(12,2) not null default 0,
  offer_price    numeric(12,2) not null default 0
);
create index if not exists offer_lines_offer_idx on public.offer_lines (offer_id);

-- ============================================================================
--  GEOGRAPHY & DELIVERY
-- ============================================================================

create table if not exists public.wilayas (
  code    text primary key,          -- '01' … '58'
  name    text not null,
  name_ar text not null default ''
);

create table if not exists public.communes (
  id          uuid primary key default gen_random_uuid(),
  wilaya_code text not null references public.wilayas (code) on delete cascade,
  name        text not null,
  name_ar     text not null default '',
  daira       text not null default '',
  unique (wilaya_code, name)
);

create table if not exists public.delivery_companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null default '',
  logo_path  text not null default '',
  notes      text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_prices (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.delivery_companies (id) on delete cascade,
  commune_id uuid not null references public.communes (id) on delete cascade,
  home_price numeric(12,2) not null default 0,   -- à domicile
  desk_price numeric(12,2) not null default 0,   -- bureau / stopdesk
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (company_id, commune_id)
);

-- ============================================================================
--  WEB ORDERS
-- ============================================================================

create table if not exists public.web_orders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique
                        default ('WEB-' || lpad(nextval('public.web_order_ref_seq')::text, 6, '0')),
  customer_name         text not null,
  phone                 text not null,
  wilaya_code           text references public.wilayas (code) on delete set null,
  wilaya                text not null default '',
  commune               text not null default '',
  address               text not null default '',
  delivery_mode         text not null default 'home' check (delivery_mode in ('home','desk')),
  delivery_company_id   uuid references public.delivery_companies (id) on delete set null,
  delivery_company_name text not null default '',
  delivery_price        numeric(12,2) not null default 0,
  subtotal              numeric(12,2) not null default 0,   -- derived
  total                 numeric(12,2) not null default 0,   -- derived
  status                text not null default 'pending'
                        check (status in ('pending','accepted','delivered','completed','canceled','returned')),
  note                  text not null default '',
  cashed_at             timestamptz,   -- guard: money booked into the caisse once
  stock_applied_at      timestamptz,   -- guard: stock taken out once
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists web_orders_status_idx  on public.web_orders (status);
create index if not exists web_orders_created_idx on public.web_orders (created_at desc);
create index if not exists web_orders_phone_idx   on public.web_orders (phone);

create table if not exists public.web_order_lines (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.web_orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  size         text not null default '',
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(12,2) not null default 0,
  offer_id     uuid references public.special_offers (id) on delete set null,
  offer_title  text not null default '',
  image_path   text not null default ''
);
create index if not exists web_order_lines_order_idx on public.web_order_lines (order_id);

create table if not exists public.web_order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.web_orders (id) on delete cascade,
  status     text not null,
  note       text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists web_order_events_order_idx on public.web_order_events (order_id);

-- Caisse after web_orders, because a cashed order points back at its order.
create table if not exists public.caisse_transactions (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('deposit','withdrawal')),
  amount       numeric(12,2) not null check (amount >= 0),
  description  text not null default '',
  date         timestamptz not null default now(),
  -- 'manual' from the Caisse screen, 'web_order' from web_order_cash().
  source       text not null default 'manual',
  web_order_id uuid references public.web_orders (id) on delete set null,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists caisse_date_idx on public.caisse_transactions (date desc);


-- ============================================================================
--  02_logic.sql — permissions, accounts, derived totals, stock movements,
--                 web order lifecycle, storefront views, reporting views
-- ============================================================================

-- ============================================================================
--  0. updated_at housekeeping
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','products','workers','special_offers','delivery_companies','web_orders'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
--  1. PERMISSIONS
--  `has_permission(module, action)` is the single gate used by every RLS
--  policy. The owner (is_admin) passes everything; a worker passes when the
--  module is enabled and the action is ticked in their matrix.
--  Modules: dashboard stock purchase pos sales clients suppliers workers
--           expenses caisse reports settings website weborders
--  Actions: view create edit delete print pay
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_admin and p.active from public.profiles p where p.id = auth.uid()),
    false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.active from public.profiles p where p.id = auth.uid()),
    false)
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.active and (
      p.is_admin
      or (
        coalesce((p.permissions -> p_module ->> 'enabled')::boolean, false)
        and coalesce(p.permissions -> p_module -> 'actions', '[]'::jsonb) ? p_action
      )
    )
    from public.profiles p
    where p.id = auth.uid()
  ), false)
$$;

-- True when the caller holds the action in ANY of the listed modules.
create or replace function public.has_any_permission(p_modules text[], p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from unnest(p_modules) m where public.has_permission(m, p_action)
  )
$$;

-- Asked by the login page before anyone is signed in: does an owner exist?
-- Returns a bare boolean — it is what hides the "create admin" button.
create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where is_admin)
$$;

-- ============================================================================
--  2. ACCOUNTS — auth.users → public.profiles
-- ============================================================================

-- Accounts created by this app sign in straight away: the e-mail is marked
-- confirmed on insert. (Also switch off "Confirm email" in
-- Authentication → Providers → Email, so Supabase does not try to send one.)
create or replace function public.auto_confirm_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirm on auth.users;
create trigger on_auth_user_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_email();

-- Writes the profile of every new account.
--   • The very first account is the OWNER (admin), whatever the metadata says.
--   • An account whose metadata carries a `worker_id` becomes that worker's
--     login — but only when the worker row has the same e-mail and no account
--     yet, so nobody can sign up and borrow another worker's permissions.
--   • Anything else (a stray signup with the public key) is created INACTIVE
--     with no permissions: it cannot open the back office.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_worker  public.workers%rowtype;
  v_wid     uuid;
begin
  if not exists (select 1 from public.profiles where is_admin) then
    insert into public.profiles (id, full_name, username, email, role, is_admin, permissions, active)
    values (new.id,
            coalesce(meta ->> 'full_name', ''),
            nullif(meta ->> 'username', ''),
            coalesce(new.email, ''),
            'admin', true, '{}'::jsonb, true)
    on conflict (id) do nothing;
    return new;
  end if;

  begin
    v_wid := nullif(meta ->> 'worker_id', '')::uuid;
  exception when others then
    v_wid := null;
  end;

  if v_wid is not null then
    select * into v_worker from public.workers
     where id = v_wid
       and profile_id is null
       and lower(email) = lower(coalesce(new.email, ''));
  end if;

  if v_worker.id is not null then
    insert into public.profiles (id, full_name, username, email, role, is_admin, permissions, active, worker_id)
    values (new.id,
            v_worker.full_name,
            coalesce(nullif(meta ->> 'username', ''), nullif(v_worker.username, ''), new.email),
            coalesce(new.email, ''),
            coalesce(nullif(v_worker.role, ''), 'worker'),
            false,
            coalesce(v_worker.permissions, '{}'::jsonb),
            v_worker.active,
            v_worker.id)
    on conflict (id) do nothing;

    update public.workers
       set has_account = true, profile_id = new.id, email = coalesce(new.email, email)
     where id = v_worker.id;
  else
    insert into public.profiles (id, full_name, username, email, role, is_admin, permissions, active)
    values (new.id,
            coalesce(meta ->> 'full_name', ''),
            nullif(meta ->> 'username', ''),
            coalesce(new.email, ''),
            'pending', false, '{}'::jsonb, false)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the login in step with the worker card: changing permissions, role,
-- name or the active flag in the Workers screen applies on the next request.
create or replace function public.sync_worker_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    update public.profiles
       set permissions = coalesce(new.permissions, '{}'::jsonb),
           role        = coalesce(nullif(new.role, ''), 'worker'),
           full_name   = new.full_name,
           active      = new.active,
           worker_id   = new.id
     where id = new.profile_id and not is_admin;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_worker_profile on public.workers;
create trigger trg_sync_worker_profile
  after insert or update of permissions, role, full_name, active, profile_id on public.workers
  for each row execute function public.sync_worker_profile();

-- Deleting a worker also deletes their login.
create or replace function public.delete_worker_account()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if old.profile_id is not null
     and not exists (select 1 from public.profiles where id = old.profile_id and is_admin) then
    delete from auth.users where id = old.profile_id;
  end if;
  return old;
end $$;

drop trigger if exists trg_delete_worker_account on public.workers;
create trigger trg_delete_worker_account
  after delete on public.workers
  for each row execute function public.delete_worker_account();

-- A worker may edit their own name/username/e-mail, never their own rights.
-- (Changes made for them by the owner, or synced from the Workers screen by a
-- worker who holds workers:edit, go through: only one's OWN row is frozen.)
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and not public.is_admin() then
    new.is_admin    := old.is_admin;
    new.permissions := old.permissions;
    new.active      := old.active;
    new.role        := old.role;
    new.worker_id   := old.worker_id;
  end if;
  -- The owner flag can never be removed from the last owner.
  if old.is_admin and not new.is_admin
     and not exists (select 1 from public.profiles where is_admin and id <> old.id) then
    new.is_admin := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Owner-only helper: reset a worker's password from the SQL editor or an RPC.
--   select public.admin_set_password('<profile uuid>', 'NewPassword123');
create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'password_too_short';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;
end $$;

-- ============================================================================
--  3. STOCK
-- ============================================================================

-- Internal stock movement, used by every trigger. A '' size (or an article
-- without size rows, i.e. a general product) moves products.quantity; a named
-- size moves that size row, creating it on first receipt.
create or replace function public._apply_stock(p_product uuid, p_size text, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_product is null or coalesce(p_delta, 0) = 0 then
    return;
  end if;

  if coalesce(p_size, '') = ''
     or exists (select 1 from public.products where id = p_product and product_type = 'general') then
    update public.products
       set quantity = greatest(0, quantity + p_delta)
     where id = p_product;
  else
    insert into public.product_sizes (product_id, size, quantity, position)
    values (p_product, p_size, greatest(0, p_delta),
            coalesce((select max(position) + 1 from public.product_sizes where product_id = p_product), 0))
    on conflict (product_id, size)
    do update set quantity = greatest(0, public.product_sizes.quantity + p_delta);
  end if;
end $$;

-- Manual correction from the app (stock:edit).
create or replace function public.adjust_stock(p_product uuid, p_size text, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('stock', 'edit') then
    raise exception 'permission denied: stock.edit';
  end if;
  perform public._apply_stock(p_product, p_size, p_delta);
end $$;

-- A sized article's total is the sum of its sizes.
create or replace function public.sync_product_quantity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products
     set quantity = (select coalesce(sum(quantity), 0) from public.product_sizes where product_id = v_id)
   where id = v_id;
  return null;
end $$;

drop trigger if exists trg_sync_product_quantity on public.product_sizes;
create trigger trg_sync_product_quantity
  after insert or update or delete on public.product_sizes
  for each row execute function public.sync_product_quantity();

-- ============================================================================
--  4. PURCHASES — stock in, prices written back, totals derived
-- ============================================================================

create or replace function public.recalc_purchase_totals(p_purchase uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.purchases p
     set total = coalesce((select sum(quantity * purchase_price) from public.purchase_lines where purchase_id = p.id), 0),
         paid  = coalesce((select sum(amount) from public.purchase_payments where purchase_id = p.id), 0)
   where p.id = p_purchase;
end $$;

create or replace function public.purchase_status()
returns trigger language plpgsql as $$
begin
  new.status := case
    when new.paid >= new.total - 0.001 then 'paid'
    when new.paid <= 0.001 then 'unpaid'
    else 'partial' end;
  return new;
end $$;

drop trigger if exists trg_purchase_status on public.purchases;
create trigger trg_purchase_status
  before insert or update on public.purchases
  for each row execute function public.purchase_status();

create or replace function public.on_purchase_line()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform public._apply_stock(old.product_id, old.size, -old.quantity);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public._apply_stock(new.product_id, new.size, new.quantity);
    -- The receiving document sets the article's prices and alert threshold.
    update public.products
       set purchase_price = case when new.purchase_price > 0 then new.purchase_price else purchase_price end,
           sale_price     = case when new.sale_price > 0 then new.sale_price else sale_price end,
           min_quantity   = case when new.min_quantity > 0 then new.min_quantity else min_quantity end
     where id = new.product_id;
  end if;
  perform public.recalc_purchase_totals(coalesce(new.purchase_id, old.purchase_id));
  return null;
end $$;

drop trigger if exists trg_purchase_line on public.purchase_lines;
create trigger trg_purchase_line
  after insert or delete or update of quantity, size, product_id, purchase_price on public.purchase_lines
  for each row execute function public.on_purchase_line();

create or replace function public.on_purchase_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_purchase_totals(coalesce(new.purchase_id, old.purchase_id));
  return null;
end $$;

drop trigger if exists trg_purchase_payment on public.purchase_payments;
create trigger trg_purchase_payment
  after insert or update or delete on public.purchase_payments
  for each row execute function public.on_purchase_payment();

-- ============================================================================
--  5. SALES — stock out, totals derived
-- ============================================================================

create or replace function public.recalc_sale_totals(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sales s
     set subtotal = coalesce((select sum(quantity * unit_price) from public.sale_lines where sale_id = s.id), 0),
         paid     = coalesce((select sum(amount) from public.sale_payments where sale_id = s.id), 0)
   where s.id = p_sale;
end $$;

create or replace function public.sale_totals()
returns trigger language plpgsql as $$
begin
  new.total := greatest(0, new.subtotal - coalesce(new.discount, 0));
  new.status := case
    when new.paid >= new.total - 0.001 then 'paid'
    when new.paid <= 0.001 then 'unpaid'
    else 'partial' end;
  return new;
end $$;

drop trigger if exists trg_sale_totals on public.sales;
create trigger trg_sale_totals
  before insert or update on public.sales
  for each row execute function public.sale_totals();

create or replace function public.on_sale_line()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform public._apply_stock(old.product_id, old.size, old.quantity);     -- back in
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public._apply_stock(new.product_id, new.size, -new.quantity);    -- out
  end if;
  perform public.recalc_sale_totals(coalesce(new.sale_id, old.sale_id));
  return null;
end $$;

drop trigger if exists trg_sale_line on public.sale_lines;
create trigger trg_sale_line
  after insert or delete or update of quantity, size, product_id, unit_price on public.sale_lines
  for each row execute function public.on_sale_line();

create or replace function public.on_sale_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_sale_totals(coalesce(new.sale_id, old.sale_id));
  return null;
end $$;

drop trigger if exists trg_sale_payment on public.sale_payments;
create trigger trg_sale_payment
  after insert or update or delete on public.sale_payments
  for each row execute function public.on_sale_payment();

-- ============================================================================
--  6. SPECIAL OFFERS — discount figures derived from the lines
-- ============================================================================

create or replace function public.recalc_offer_totals(p_offer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_orig numeric; v_offer numeric;
begin
  select coalesce(sum(quantity * original_price), 0), coalesce(sum(quantity * offer_price), 0)
    into v_orig, v_offer
    from public.offer_lines where offer_id = p_offer;

  update public.special_offers
     set original_total   = v_orig,
         offer_total      = v_offer,
         discount_amount  = greatest(0, v_orig - v_offer),
         discount_percent = case when v_orig > 0
                                 then round(greatest(0, v_orig - v_offer) / v_orig * 100, 2)
                                 else 0 end
   where id = p_offer;
end $$;

create or replace function public.on_offer_line()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_offer_totals(coalesce(new.offer_id, old.offer_id));
  return null;
end $$;

drop trigger if exists trg_offer_line on public.offer_lines;
create trigger trg_offer_line
  after insert or update or delete on public.offer_lines
  for each row execute function public.on_offer_line();

-- ============================================================================
--  7. WEB ORDERS
-- ============================================================================

create or replace function public.recalc_web_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.web_orders o
     set subtotal = coalesce((select sum(quantity * unit_price) from public.web_order_lines where order_id = o.id), 0)
   where o.id = p_order;
end $$;

create or replace function public.web_order_totals()
returns trigger language plpgsql as $$
begin
  new.total := new.subtotal + coalesce(new.delivery_price, 0);
  return new;
end $$;

drop trigger if exists trg_web_order_totals on public.web_orders;
create trigger trg_web_order_totals
  before insert or update on public.web_orders
  for each row execute function public.web_order_totals();

create or replace function public.on_web_order_line()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_applied timestamptz;
begin
  -- Once the parcel has left, its basket is frozen: the stock already moved.
  select stock_applied_at into v_applied
    from public.web_orders where id = coalesce(new.order_id, old.order_id);
  if v_applied is not null then
    raise exception 'order_already_delivered: return or cancel it before editing the products';
  end if;
  perform public.recalc_web_order(coalesce(new.order_id, old.order_id));
  return null;
end $$;

drop trigger if exists trg_web_order_line on public.web_order_lines;
create trigger trg_web_order_line
  after insert or update or delete on public.web_order_lines
  for each row execute function public.on_web_order_line();

-- Deleting an order whose parcel is out puts its units back first.
create or replace function public.on_web_order_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if old.stock_applied_at is not null then
    for l in select * from public.web_order_lines where order_id = old.id loop
      perform public._apply_stock(l.product_id, l.size, l.quantity);
    end loop;
  end if;
  return old;
end $$;

drop trigger if exists trg_web_order_delete on public.web_orders;
create trigger trg_web_order_delete
  before delete on public.web_orders
  for each row execute function public.on_web_order_delete();

-- Carrier fee for a commune, or NULL when the carrier does not serve it.
create or replace function public.delivery_fee(p_company uuid, p_wilaya text, p_commune text, p_mode text)
returns numeric language sql stable security definer set search_path = public as $$
  select case when p_mode = 'desk' then dp.desk_price else dp.home_price end
    from public.delivery_prices dp
    join public.communes c on c.id = dp.commune_id
   where dp.company_id = p_company
     and dp.enabled
     and c.wilaya_code = p_wilaya
     and c.name = p_commune
   limit 1
$$;

-- Storefront entry point (callable by anonymous shoppers).
-- Never trusts a browser price: every line is re-priced from the catalogue or
-- the live offer, and the delivery fee from the carrier's tariff grid.
create or replace function public.place_web_order(
  p_customer_name text,
  p_phone         text,
  p_wilaya_code   text,
  p_commune       text,
  p_address       text,
  p_mode          text,
  p_company_id    uuid,
  p_lines         jsonb,
  p_note          text default ''
) returns setof public.web_orders
language plpgsql security definer set search_path = public as $$
declare
  v_order    public.web_orders%rowtype;
  v_line     jsonb;
  v_product  public.products%rowtype;
  v_qty      integer;
  v_price    numeric;
  v_offer    public.special_offers%rowtype;
  v_offer_id uuid;
  v_company  public.delivery_companies%rowtype;
  v_fee      numeric := 0;
  v_free     numeric := 0;
  v_subtotal numeric := 0;
  v_mode     text := case when p_mode = 'desk' then 'desk' else 'home' end;
begin
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'customer_name_and_phone_required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_lines) > 50 then
    raise exception 'too_many_lines';
  end if;

  if p_company_id is not null then
    select * into v_company from public.delivery_companies where id = p_company_id and active;
  end if;

  insert into public.web_orders (
    customer_name, phone, wilaya_code, wilaya, commune, address,
    delivery_mode, delivery_company_id, delivery_company_name, note, status
  ) values (
    left(trim(p_customer_name), 120),
    left(trim(p_phone), 30),
    (select code from public.wilayas where code = p_wilaya_code),
    coalesce((select name from public.wilayas where code = p_wilaya_code), ''),
    left(coalesce(p_commune, ''), 120),
    left(coalesce(p_address, ''), 300),
    v_mode,
    v_company.id,
    coalesce(v_company.name, ''),
    left(coalesce(p_note, ''), 1000),
    'pending'
  ) returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := least(greatest(coalesce((v_line ->> 'quantity')::integer, 1), 1), 100);
    select * into v_product from public.products where id = (v_line ->> 'product_id')::uuid;
    if v_product.id is null then
      raise exception 'product_not_found';
    end if;

    v_offer_id := nullif(v_line ->> 'offer_id', '')::uuid;
    select * into v_offer from public.special_offers where false;   -- reset
    v_price := null;

    if v_offer_id is not null then
      select * into v_offer from public.special_offers o
       where o.id = v_offer_id and o.active
         and (o.start_date is null or o.start_date <= now())
         and (o.end_date is null or o.end_date >= now());
      if v_offer.id is not null then
        select ol.offer_price into v_price
          from public.offer_lines ol
         where ol.offer_id = v_offer.id and ol.product_id = v_product.id
         limit 1;
      end if;
    end if;

    if v_price is null then
      -- Not from a live offer: the article must be published.
      if exists (select 1 from public.web_product_settings w where w.product_id = v_product.id and w.hidden) then
        raise exception 'product_not_available';
      end if;
      select coalesce(w.web_price, v_product.sale_price) into v_price
        from (select 1) x
        left join public.web_product_settings w on w.product_id = v_product.id;
      select * into v_offer from public.special_offers where false;   -- not an offer line
    end if;

    insert into public.web_order_lines (
      order_id, product_id, product_name, size, quantity, unit_price, offer_id, offer_title, image_path
    ) values (
      v_order.id, v_product.id, v_product.name,
      case when v_product.product_type = 'general' then '' else coalesce(v_line ->> 'size', '') end,
      v_qty, coalesce(v_price, 0),
      v_offer.id, coalesce(v_offer.title, ''),
      coalesce((select path from public.product_images where product_id = v_product.id order by position limit 1), '')
    );
  end loop;

  -- Delivery fee from the grid, then the free-shipping rule.
  if v_company.id is not null then
    v_fee := coalesce(public.delivery_fee(v_company.id, p_wilaya_code, p_commune, v_mode), 0);
  end if;
  select coalesce(free_shipping_from, 0) into v_free from public.website_settings limit 1;
  select subtotal into v_subtotal from public.web_orders where id = v_order.id;
  if coalesce(v_free, 0) > 0 and v_subtotal >= v_free then
    v_fee := 0;
  end if;

  update public.web_orders set delivery_price = v_fee where id = v_order.id;
  insert into public.web_order_events (order_id, status, note) values (v_order.id, 'pending', '');

  return query select * from public.web_orders where id = v_order.id;
end $$;

-- The confirmation page reads its order through this (orders are staff-only).
create or replace function public.web_order_receipt(o_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(o)
         || jsonb_build_object(
              'web_order_lines',
              coalesce((select jsonb_agg(to_jsonb(l)) from public.web_order_lines l where l.order_id = o.id), '[]'::jsonb),
              'web_order_events',
              coalesce((select jsonb_agg(to_jsonb(e)) from public.web_order_events e where e.order_id = o.id), '[]'::jsonb))
    from public.web_orders o
   where o.id = o_id
$$;

-- ── Lifecycle transitions ──────────────────────────────────────────────────
--  pending ──accept──▶ accepted ──deliver──▶ delivered ──cash──▶ completed
--     │                    │                     │
--     └──────cancel────────┘                     └──return──▶ returned
--  canceled / returned ──accept──▶ accepted   (re-accept)

create or replace function public._order_for_update(o_id uuid)
returns public.web_orders language plpgsql security definer set search_path = public as $$
declare v public.web_orders%rowtype;
begin
  select * into v from public.web_orders where id = o_id for update;
  if v.id is null then raise exception 'order_not_found'; end if;
  return v;
end $$;

create or replace function public._order_stock(o_id uuid, p_sign integer)
returns void language plpgsql security definer set search_path = public as $$
declare l record;
begin
  for l in select * from public.web_order_lines where order_id = o_id loop
    perform public._apply_stock(l.product_id, l.size, p_sign * l.quantity);
  end loop;
end $$;

create or replace function public.web_order_accept(o_id uuid)
returns setof public.web_orders language plpgsql security definer set search_path = public as $$
declare v public.web_orders%rowtype;
begin
  if not public.has_permission('weborders', 'edit') then raise exception 'permission denied: weborders.edit'; end if;
  v := public._order_for_update(o_id);
  if v.status not in ('pending', 'canceled', 'returned') then
    raise exception 'invalid_transition: % → accepted', v.status;
  end if;
  update public.web_orders set status = 'accepted' where id = o_id;
  insert into public.web_order_events (order_id, status) values (o_id, 'accepted');
  return query select * from public.web_orders where id = o_id;
end $$;

create or replace function public.web_order_deliver(o_id uuid, company uuid, price numeric default null)
returns setof public.web_orders language plpgsql security definer set search_path = public as $$
declare v public.web_orders%rowtype; c public.delivery_companies%rowtype; v_fee numeric;
begin
  if not public.has_permission('weborders', 'edit') then raise exception 'permission denied: weborders.edit'; end if;
  v := public._order_for_update(o_id);
  if v.status <> 'accepted' then
    raise exception 'invalid_transition: % → delivered', v.status;
  end if;
  select * into c from public.delivery_companies where id = company;
  if c.id is null then raise exception 'delivery_company_not_found'; end if;

  v_fee := coalesce(price, public.delivery_fee(c.id, v.wilaya_code, v.commune, v.delivery_mode), v.delivery_price);

  -- Stock leaves the shop exactly once.
  if v.stock_applied_at is null then
    perform public._order_stock(o_id, -1);
  end if;

  update public.web_orders
     set status = 'delivered',
         delivery_company_id = c.id,
         delivery_company_name = c.name,
         delivery_price = v_fee,
         stock_applied_at = coalesce(stock_applied_at, now())
   where id = o_id;
  insert into public.web_order_events (order_id, status, note) values (o_id, 'delivered', c.name);
  return query select * from public.web_orders where id = o_id;
end $$;

create or replace function public.web_order_return(o_id uuid, reason text default '')
returns setof public.web_orders language plpgsql security definer set search_path = public as $$
declare v public.web_orders%rowtype;
begin
  if not public.has_permission('weborders', 'edit') then raise exception 'permission denied: weborders.edit'; end if;
  v := public._order_for_update(o_id);
  if v.status <> 'delivered' then
    raise exception 'invalid_transition: % → returned', v.status;
  end if;
  if v.stock_applied_at is not null then
    perform public._order_stock(o_id, 1);
  end if;
  update public.web_orders set status = 'returned', stock_applied_at = null where id = o_id;
  insert into public.web_order_events (order_id, status, note) values (o_id, 'returned', coalesce(reason, ''));
  return query select * from public.web_orders where id = o_id;
end $$;

create or replace function public.web_order_cash(o_id uuid)
returns setof public.web_orders language plpgsql security definer set search_path = public as $$
declare v public.web_orders%rowtype;
begin
  if not public.has_any_permission(array['weborders'], 'pay') then raise exception 'permission denied: weborders.pay'; end if;
  v := public._order_for_update(o_id);
  if v.status = 'completed' and v.cashed_at is not null then
    return query select * from public.web_orders where id = o_id;   -- idempotent
    return;
  end if;
  if v.status <> 'delivered' then
    raise exception 'invalid_transition: % → completed', v.status;
  end if;
  -- Money reaches the caisse exactly once.
  if v.cashed_at is null then
    insert into public.caisse_transactions (type, amount, description, date, source, web_order_id)
    values ('deposit', v.total, 'Commande web ' || v.reference || ' — ' || v.customer_name, now(), 'web_order', v.id);
  end if;
  update public.web_orders set status = 'completed', cashed_at = coalesce(cashed_at, now()) where id = o_id;
  insert into public.web_order_events (order_id, status) values (o_id, 'completed');
  return query select * from public.web_orders where id = o_id;
end $$;

create or replace function public.web_order_cancel(o_id uuid, reason text default '')
returns setof public.web_orders language plpgsql security definer set search_path = public as $$
declare v public.web_orders%rowtype;
begin
  if not (public.has_permission('weborders', 'edit') or public.has_permission('weborders', 'delete')) then
    raise exception 'permission denied: weborders.edit';
  end if;
  v := public._order_for_update(o_id);
  if v.status in ('completed', 'canceled') then
    raise exception 'invalid_transition: % → canceled', v.status;
  end if;
  if v.stock_applied_at is not null then
    perform public._order_stock(o_id, 1);
  end if;
  update public.web_orders set status = 'canceled', stock_applied_at = null where id = o_id;
  insert into public.web_order_events (order_id, status, note) values (o_id, 'canceled', coalesce(reason, ''));
  return query select * from public.web_orders where id = o_id;
end $$;

-- ============================================================================
--  8. STOREFRONT VIEWS (public — their WHERE clause IS the visibility rule)
-- ============================================================================

drop view if exists public.v_shop_products;
create view public.v_shop_products as
select
  p.id,
  p.product_type,
  p.name,
  p.description,
  p.brand,
  p.category,
  coalesce(w.web_price, p.sale_price) as price,
  p.quantity,
  p.size_category,
  coalesce((
    select jsonb_agg(jsonb_build_object('size', s.size, 'quantity', s.quantity) order by s.position, s.size)
      from public.product_sizes s where s.product_id = p.id
  ), '[]'::jsonb) as sizes,
  p.color,
  p.material,
  p.gender,
  p.season,
  p.collection,
  coalesce((
    select array_agg(i.path order by i.position) from public.product_images i where i.product_id = p.id
  ), array[]::text[]) as images,
  coalesce(w.featured, false) as featured,
  p.created_at
from public.products p
left join public.web_product_settings w on w.product_id = p.id
where coalesce(w.hidden, false) = false
  and coalesce(w.web_price, p.sale_price) > 0;

drop view if exists public.v_live_offers;
create view public.v_live_offers as
select
  o.id, o.title, o.description, o.image_path, o.active, o.start_date, o.end_date,
  o.original_total, o.offer_total, o.discount_amount, o.discount_percent, o.created_at,
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', l.product_id, 'product_name', l.product_name, 'quantity', l.quantity,
             'original_price', l.original_price, 'offer_price', l.offer_price))
      from public.offer_lines l where l.offer_id = o.id
  ), '[]'::jsonb) as lines
from public.special_offers o
where o.active
  and (o.start_date is null or o.start_date <= now())
  and (o.end_date is null or o.end_date >= now());

-- ============================================================================
--  9. REPORTING VIEWS (security_invoker: they respect the caller's RLS)
-- ============================================================================

drop view if exists public.v_low_stock;
create view public.v_low_stock with (security_invoker = true) as
select id, product_type, name, category, quantity, min_quantity
  from public.products
 where quantity <= min_quantity;

drop view if exists public.v_stock_by_type;
create view public.v_stock_by_type with (security_invoker = true) as
select product_type,
       count(*)                          as articles,
       coalesce(sum(quantity), 0)        as units,
       coalesce(sum(quantity * purchase_price), 0) as stock_value
  from public.products
 group by product_type;

drop view if exists public.v_client_balances;
create view public.v_client_balances with (security_invoker = true) as
select c.id, c.name, c.phone,
       coalesce(sum(s.total), 0)          as total_bought,
       coalesce(sum(s.paid), 0)           as total_paid,
       coalesce(sum(s.total - s.paid), 0) as balance
  from public.clients c
  left join public.sales s on s.client_id = c.id
 group by c.id;

drop view if exists public.v_supplier_balances;
create view public.v_supplier_balances with (security_invoker = true) as
select su.id, su.name, su.phone,
       coalesce(sum(p.total), 0)          as total_bought,
       coalesce(sum(p.paid), 0)           as total_paid,
       coalesce(sum(p.total - p.paid), 0) as balance
  from public.suppliers su
  left join public.purchases p on p.supplier_id = su.id
 group by su.id;

drop view if exists public.v_caisse_balance;
create view public.v_caisse_balance with (security_invoker = true) as
select
  coalesce(sum(case when type = 'deposit' then amount end), 0)    as deposits,
  coalesce(sum(case when type = 'withdrawal' then amount end), 0) as withdrawals,
  coalesce(sum(case when type = 'deposit' then amount else -amount end), 0) as balance
from public.caisse_transactions;

drop view if exists public.v_web_order_stats;
create view public.v_web_order_stats with (security_invoker = true) as
select status, count(*) as orders, coalesce(sum(total), 0) as value
  from public.web_orders
 group by status;

-- ============================================================================
--  10. STARTER DATA (only inserted when missing)
-- ============================================================================

insert into public.store_settings (id) values (true) on conflict (id) do nothing;
insert into public.website_settings (id) values (true) on conflict (id) do nothing;
insert into public.contact_links (id) values (true) on conflict (id) do nothing;

insert into public.size_scales (category, label, position)
select v.category, v.label, v.position
from (values
  ('alpha','XS',0),('alpha','S',1),('alpha','M',2),('alpha','L',3),('alpha','XL',4),('alpha','XXL',5),('alpha','3XL',6),
  ('numeric','34',0),('numeric','36',1),('numeric','38',2),('numeric','40',3),('numeric','42',4),('numeric','44',5),('numeric','46',6),('numeric','48',7),
  ('shoes','36',0),('shoes','37',1),('shoes','38',2),('shoes','39',3),('shoes','40',4),('shoes','41',5),('shoes','42',6),('shoes','43',7),('shoes','44',8),('shoes','45',9),
  ('kids','2 ans',0),('kids','4 ans',1),('kids','6 ans',2),('kids','8 ans',3),('kids','10 ans',4),('kids','12 ans',5),('kids','14 ans',6),
  ('oneSize','TU',0)
) as v(category, label, position)
on conflict (category, label) do nothing;

insert into public.categories (name)
select unnest(array['T-shirts','Chemises','Pantalons','Robes','Vestes','Chaussures','Accessoires',
                    'Électronique','Cosmétiques','Maison','Alimentation','Sport'])
on conflict (name) do nothing;

insert into public.colors (name)
select unnest(array['Noir','Blanc','Gris','Bleu','Rouge','Vert','Beige','Marron','Rose','Jaune'])
on conflict (name) do nothing;

insert into public.materials (name)
select unnest(array['Coton','Polyester','Lin','Laine','Jean','Cuir','Soie','Viscose'])
on conflict (name) do nothing;

insert into public.worker_roles (name)
select unnest(array['Gérant','Vendeur','Caissier','Magasinier','Livreur'])
on conflict (name) do nothing;


-- ============================================================================
--  03_security.sql — grants, row-level security, storage buckets
-- ----------------------------------------------------------------------------
--  RLS decides WHICH rows a request may touch; GRANT decides whether the role
--  may touch the table at all. Both are needed.
--
--  Every back-office policy goes through has_permission(module, action), so a
--  worker who was not granted a module cannot read or change it — not from the
--  interface, and not by calling the REST API directly with their token.
-- ============================================================================

-- ============================================================================
--  1. GRANTS
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Anonymous shoppers: read the storefront, place an order, read their receipt.
revoke all on all tables in schema public from anon;
grant select on
  public.store_settings, public.website_settings, public.contact_links,
  public.wilayas, public.communes, public.delivery_companies, public.delivery_prices,
  public.v_shop_products, public.v_live_offers
to anon;
grant usage, select on sequence public.web_order_ref_seq to anon;

revoke execute on all functions in schema public from anon;
grant execute on function
  public.admin_exists(),
  public.place_web_order(text, text, text, text, text, text, uuid, jsonb, text),
  public.web_order_receipt(uuid),
  -- used inside RLS policies evaluated for anon requests
  public.has_permission(text, text),
  public.has_any_permission(text[], text),
  public.is_admin(),
  public.is_staff()
to anon;

-- Internal helpers must never be called directly from the API.
revoke execute on function
  public._apply_stock(uuid, text, integer),
  public._order_for_update(uuid),
  public._order_stock(uuid, integer)
from authenticated, anon, public;

-- Views keep their owner's rights (the storefront rule lives in their WHERE).
grant select on public.v_shop_products, public.v_live_offers to authenticated;

-- ============================================================================
--  2. ROW-LEVEL SECURITY
-- ============================================================================

do $$
declare t text; pol record;
begin
  foreach t in array array[
    'profiles','brands','categories','colors','materials','worker_roles','size_scales',
    'store_settings','website_settings','contact_links',
    'products','product_sizes','product_images',
    'clients','suppliers',
    'purchases','purchase_lines','purchase_payments',
    'sales','sale_lines','sale_payments',
    'workers','worker_advances','worker_absences','worker_payments',
    'expenses','caisse_transactions',
    'web_product_settings','special_offers','offer_lines',
    'wilayas','communes','delivery_companies','delivery_prices',
    'web_orders','web_order_lines','web_order_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Drop every existing policy so this file can be re-run cleanly.
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- Small helper to declare the four CRUD policies of a table in one call.
create or replace function public._crud_policies(
  p_table text, p_select text, p_insert text, p_update text, p_delete text
) returns void language plpgsql as $$
begin
  execute format('create policy %I on public.%I for select to authenticated using (%s)',
                 p_table || '_select', p_table, p_select);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                 p_table || '_insert', p_table, p_insert);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                 p_table || '_update', p_table, p_update, p_update);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)',
                 p_table || '_delete', p_table, p_delete);
end $$;

-- ── Accounts ────────────────────────────────────────────────────────────────
-- Everyone reads their own profile (that is how login works); the owner and
-- staff managers read all of them.
select public._crud_policies('profiles',
  $p$ id = auth.uid() or public.is_admin() or public.has_permission('workers','view') $p$,
  $p$ public.is_admin() $p$,
  $p$ id = auth.uid() or public.is_admin() $p$,
  $p$ public.is_admin() and id <> auth.uid() $p$);

-- ── Reference lists ─────────────────────────────────────────────────────────
-- Read by any active staff; extended from the product / purchase forms.
do $$
declare t text;
begin
  foreach t in array array['brands','categories','colors','materials','size_scales'] loop
    perform public._crud_policies(t,
      $p$ public.is_staff() $p$,
      $p$ public.has_any_permission(array['stock','purchase'],'create') or public.has_any_permission(array['stock','website'],'edit') $p$,
      $p$ public.has_any_permission(array['stock','website'],'edit') $p$,
      $p$ public.has_permission('stock','delete') $p$);
  end loop;
end $$;

select public._crud_policies('worker_roles',
  $p$ public.is_staff() $p$,
  $p$ public.has_any_permission(array['workers'],'create') or public.has_permission('workers','edit') $p$,
  $p$ public.has_permission('workers','edit') $p$,
  $p$ public.has_permission('workers','delete') $p$);

-- ── Store identity (public read) ────────────────────────────────────────────
create policy store_settings_public_read on public.store_settings for select to anon, authenticated using (true);
create policy store_settings_write_ins on public.store_settings for insert to authenticated
  with check (public.has_permission('settings','edit'));
create policy store_settings_write_upd on public.store_settings for update to authenticated
  using (public.has_permission('settings','edit')) with check (public.has_permission('settings','edit'));

create policy website_settings_public_read on public.website_settings for select to anon, authenticated using (true);
create policy website_settings_write_ins on public.website_settings for insert to authenticated
  with check (public.has_permission('website','edit'));
create policy website_settings_write_upd on public.website_settings for update to authenticated
  using (public.has_permission('website','edit')) with check (public.has_permission('website','edit'));

create policy contact_links_public_read on public.contact_links for select to anon, authenticated using (true);
create policy contact_links_write_ins on public.contact_links for insert to authenticated
  with check (public.has_permission('website','edit'));
create policy contact_links_write_upd on public.contact_links for update to authenticated
  using (public.has_permission('website','edit')) with check (public.has_permission('website','edit'));

-- ── Products (catalogue read by every staff screen) ─────────────────────────
-- Created from Stock, from a Purchase ("new product"), edited from Stock or
-- from the Website screen.
do $$
declare t text;
begin
  foreach t in array array['products','product_sizes','product_images'] loop
    perform public._crud_policies(t,
      $p$ public.is_staff() $p$,
      $p$ public.has_any_permission(array['stock','purchase'],'create') or public.has_any_permission(array['stock','website'],'edit') $p$,
      $p$ public.has_any_permission(array['stock','website'],'edit') or public.has_any_permission(array['stock','purchase'],'create') $p$,
      case when t = 'products'
           then $p$ public.has_permission('stock','delete') $p$
           else $p$ public.has_any_permission(array['stock','website'],'edit') or public.has_any_permission(array['stock','purchase'],'create') or public.has_permission('stock','delete') $p$
      end);
  end loop;
end $$;

-- ── Clients & suppliers ─────────────────────────────────────────────────────
select public._crud_policies('clients',
  $p$ public.has_any_permission(array['clients','pos','sales','dashboard','reports'],'view') $p$,
  $p$ public.has_any_permission(array['clients','pos'],'create') $p$,
  $p$ public.has_permission('clients','edit') $p$,
  $p$ public.has_permission('clients','delete') $p$);

select public._crud_policies('suppliers',
  $p$ public.has_any_permission(array['suppliers','purchase','dashboard','reports'],'view') $p$,
  $p$ public.has_any_permission(array['suppliers','purchase'],'create') $p$,
  $p$ public.has_permission('suppliers','edit') $p$,
  $p$ public.has_permission('suppliers','delete') $p$);

-- ── Purchases ───────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['purchases','purchase_lines'] loop
    perform public._crud_policies(t,
      $p$ public.has_any_permission(array['purchase','suppliers','caisse','dashboard','reports'],'view') $p$,
      $p$ public.has_permission('purchase','create') or public.has_permission('purchase','edit') $p$,
      $p$ public.has_permission('purchase','edit') or public.has_permission('purchase','create') $p$,
      $p$ public.has_permission('purchase','delete') or public.has_permission('purchase','edit') $p$);
  end loop;
end $$;

select public._crud_policies('purchase_payments',
  $p$ public.has_any_permission(array['purchase','suppliers','caisse','dashboard','reports'],'view') $p$,
  $p$ public.has_permission('purchase','pay') or public.has_permission('purchase','create') $p$,
  $p$ public.has_permission('purchase','pay') $p$,
  $p$ public.has_permission('purchase','delete') $p$);

-- ── Sales (the POS rings them up) ───────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['sales','sale_lines'] loop
    perform public._crud_policies(t,
      $p$ public.has_any_permission(array['sales','pos','clients','caisse','dashboard','reports'],'view') $p$,
      $p$ public.has_permission('pos','view') or public.has_permission('sales','create') $p$,
      $p$ public.has_permission('sales','edit') or public.has_permission('pos','view') $p$,
      $p$ public.has_permission('sales','delete') $p$);
  end loop;
end $$;

select public._crud_policies('sale_payments',
  $p$ public.has_any_permission(array['sales','pos','clients','caisse','dashboard','reports'],'view') $p$,
  $p$ public.has_permission('pos','view') or public.has_permission('sales','pay') $p$,
  $p$ public.has_permission('sales','pay') $p$,
  $p$ public.has_permission('sales','delete') $p$);

-- ── Workers ─────────────────────────────────────────────────────────────────
select public._crud_policies('workers',
  $p$ public.has_any_permission(array['workers','caisse','dashboard','reports'],'view') $p$,
  $p$ public.has_permission('workers','create') $p$,
  $p$ public.has_permission('workers','edit') or public.has_permission('workers','pay') $p$,
  $p$ public.has_permission('workers','delete') $p$);

do $$
declare t text;
begin
  foreach t in array array['worker_advances','worker_absences'] loop
    perform public._crud_policies(t,
      $p$ public.has_any_permission(array['workers','caisse','dashboard','reports'],'view') $p$,
      $p$ public.has_permission('workers','edit') or public.has_permission('workers','pay') $p$,
      $p$ public.has_permission('workers','edit') or public.has_permission('workers','pay') $p$,
      $p$ public.has_permission('workers','delete') or public.has_permission('workers','edit') $p$);
  end loop;
end $$;

select public._crud_policies('worker_payments',
  $p$ public.has_any_permission(array['workers','caisse','dashboard','reports'],'view') $p$,
  $p$ public.has_permission('workers','pay') $p$,
  $p$ public.has_permission('workers','pay') $p$,
  $p$ public.has_permission('workers','delete') $p$);

-- ── Expenses & caisse ───────────────────────────────────────────────────────
select public._crud_policies('expenses',
  $p$ public.has_any_permission(array['expenses','caisse','dashboard','reports'],'view') $p$,
  $p$ public.has_permission('expenses','create') $p$,
  $p$ public.has_permission('expenses','edit') $p$,
  $p$ public.has_permission('expenses','delete') $p$);

select public._crud_policies('caisse_transactions',
  $p$ public.has_any_permission(array['caisse','dashboard','reports'],'view') $p$,
  $p$ public.has_permission('caisse','create') $p$,
  $p$ public.has_permission('caisse','edit') $p$,
  $p$ public.has_permission('caisse','delete') $p$);

-- ── Website: catalogue exposure, offers ─────────────────────────────────────
select public._crud_policies('web_product_settings',
  $p$ public.is_staff() $p$,
  $p$ public.has_permission('website','edit') or public.has_permission('website','create') $p$,
  $p$ public.has_permission('website','edit') $p$,
  $p$ public.has_permission('website','delete') or public.has_permission('website','edit') $p$);

do $$
declare t text;
begin
  foreach t in array array['special_offers','offer_lines'] loop
    perform public._crud_policies(t,
      $p$ public.is_staff() $p$,
      $p$ public.has_permission('website','create') or public.has_permission('website','edit') $p$,
      $p$ public.has_permission('website','edit') $p$,
      case when t = 'special_offers'
           then $p$ public.has_permission('website','delete') $p$
           else $p$ public.has_permission('website','edit') or public.has_permission('website','delete') $p$
      end);
  end loop;
end $$;

-- ── Geography (public read, never written by the app) ───────────────────────
create policy wilayas_public_read  on public.wilayas  for select to anon, authenticated using (true);
create policy communes_public_read on public.communes for select to anon, authenticated using (true);

-- ── Delivery (public read for the order form) ───────────────────────────────
create policy delivery_companies_public_read on public.delivery_companies
  for select to anon, authenticated using (true);
create policy delivery_companies_ins on public.delivery_companies for insert to authenticated
  with check (public.has_permission('website','create') or public.has_permission('website','edit'));
create policy delivery_companies_upd on public.delivery_companies for update to authenticated
  using (public.has_permission('website','edit')) with check (public.has_permission('website','edit'));
create policy delivery_companies_del on public.delivery_companies for delete to authenticated
  using (public.has_permission('website','delete'));

create policy delivery_prices_public_read on public.delivery_prices
  for select to anon, authenticated using (true);
create policy delivery_prices_ins on public.delivery_prices for insert to authenticated
  with check (public.has_permission('website','edit') or public.has_permission('website','create'));
create policy delivery_prices_upd on public.delivery_prices for update to authenticated
  using (public.has_permission('website','edit')) with check (public.has_permission('website','edit'));
create policy delivery_prices_del on public.delivery_prices for delete to authenticated
  using (public.has_permission('website','edit') or public.has_permission('website','delete'));

-- ── Web orders (shoppers go through place_web_order(); staff only here) ─────
do $$
declare t text;
begin
  foreach t in array array['web_orders','web_order_lines','web_order_events'] loop
    perform public._crud_policies(t,
      $p$ public.has_any_permission(array['weborders','dashboard','reports'],'view') $p$,
      $p$ public.has_permission('weborders','edit') $p$,
      $p$ public.has_permission('weborders','edit') $p$,
      case when t = 'web_orders'
           then $p$ public.has_permission('weborders','delete') $p$
           else $p$ public.has_permission('weborders','edit') or public.has_permission('weborders','delete') $p$
      end);
  end loop;
end $$;

drop function if exists public._crud_policies(text, text, text, text, text);

-- ============================================================================
--  3. STORAGE BUCKETS — images are public to read, permission-gated to write
-- ============================================================================
--  product-images  : <product_id>/<random>.webp       stock / purchase / website
--  offer-images    : <offer_id>/<random>.webp         website
--  delivery-logos  : <company_id>/<random>.webp       website
--  store-assets    : logo/… favicon/… hero/…          settings / website
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,
     array['image/webp','image/jpeg','image/png','image/gif','image/avif']),
  ('offer-images',   'offer-images',   true, 5242880,
     array['image/webp','image/jpeg','image/png','image/gif','image/avif']),
  ('delivery-logos', 'delivery-logos', true, 2097152,
     array['image/webp','image/jpeg','image/png','image/svg+xml']),
  ('store-assets',   'store-assets',   true, 5242880,
     array['image/webp','image/jpeg','image/png','image/svg+xml','image/x-icon','image/vnd.microsoft.icon'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Who may write into which bucket.
create or replace function public.can_write_bucket(p_bucket text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_bucket
    when 'product-images' then
         public.has_any_permission(array['stock','purchase'],'create')
      or public.has_any_permission(array['stock','website'],'edit')
    when 'offer-images'   then public.has_any_permission(array['website'],'create') or public.has_permission('website','edit')
    when 'delivery-logos' then public.has_any_permission(array['website'],'create') or public.has_permission('website','edit')
    when 'store-assets'   then public.has_permission('settings','edit') or public.has_permission('website','edit')
    else false
  end
$$;
grant execute on function public.can_write_bucket(text) to authenticated;

drop policy if exists "market images public read"   on storage.objects;
drop policy if exists "market images staff insert"  on storage.objects;
drop policy if exists "market images staff update"  on storage.objects;
drop policy if exists "market images staff delete"  on storage.objects;

create policy "market images public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('product-images','offer-images','delivery-logos','store-assets'));

create policy "market images staff insert" on storage.objects
  for insert to authenticated
  with check (public.can_write_bucket(bucket_id));

create policy "market images staff update" on storage.objects
  for update to authenticated
  using (public.can_write_bucket(bucket_id))
  with check (public.can_write_bucket(bucket_id));

-- Deleting objects is the orphan sweep in Settings → owner / settings:edit.
create policy "market images staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('product-images','offer-images','delivery-logos','store-assets')
    and (public.is_admin() or public.has_permission('settings','edit'))
  );


-- ============================================================================
--  04_geography.sql — the 58 wilayas of Algeria and their communes
--  Source: github.com/othmanus/algeria-cities (ONS administrative listing)
--  Generated from src/data/algeria.ts. Idempotent.
-- ============================================================================

insert into public.wilayas (code, name, name_ar) values
  ('01', 'Adrar', 'أدرار'),
  ('02', 'Chlef', ' الشلف'),
  ('03', 'Laghouat', 'الأغواط'),
  ('04', 'Oum El Bouaghi', 'أم البواقي'),
  ('05', 'Batna', 'باتنة'),
  ('06', 'Béjaïa', ' بجاية'),
  ('07', 'Biskra', 'بسكرة'),
  ('08', 'Béchar', 'بشار'),
  ('09', 'Blida', 'البليدة'),
  ('10', 'Bouira', 'البويرة'),
  ('11', 'Tamanrasset', 'تمنراست'),
  ('12', 'Tébessa', 'تبسة'),
  ('13', 'Tlemcen', 'تلمسان'),
  ('14', 'Tiaret', 'تيارت'),
  ('15', 'Tizi Ouzou', 'تيزي وزو'),
  ('16', 'Alger', 'الجزائر'),
  ('17', 'Djelfa', 'الجلفة'),
  ('18', 'Jijel', 'جيجل'),
  ('19', 'Sétif', 'سطيف'),
  ('20', 'Saïda', 'سعيدة'),
  ('21', 'Skikda', 'سكيكدة'),
  ('22', 'Sidi Bel Abbès', 'سيدي بلعباس'),
  ('23', 'Annaba', 'عنابة'),
  ('24', 'Guelma', 'قالمة'),
  ('25', 'Constantine', 'قسنطينة'),
  ('26', 'Médéa', 'المدية'),
  ('27', 'Mostaganem', 'مستغانم'),
  ('28', 'M''Sila', 'المسيلة'),
  ('29', 'Mascara', 'معسكر'),
  ('30', 'Ouargla', 'ورقلة'),
  ('31', 'Oran', 'وهران'),
  ('32', 'El Bayadh', 'البيض'),
  ('33', 'Illizi', 'إليزي'),
  ('34', 'Bordj Bou Arreridj', 'برج بوعريريج'),
  ('35', 'Boumerdès', 'بومرداس'),
  ('36', 'El Tarf', 'الطارف'),
  ('37', 'Tindouf', 'تندوف'),
  ('38', 'Tissemsilt', 'تيسمسيلت'),
  ('39', 'El Oued', 'الوادي'),
  ('40', 'Khenchela', 'خنشلة'),
  ('41', 'Souk Ahras', 'سوق أهراس'),
  ('42', 'Tipaza', 'تيبازة'),
  ('43', 'Mila', 'ميلة'),
  ('44', 'Aïn Defla', 'عين الدفلة'),
  ('45', 'Naâma', 'النعامة'),
  ('46', 'Aïn Témouchent', 'عين تيموشنت'),
  ('47', 'Ghardaïa', 'غرداية'),
  ('48', 'Relizane', 'غليزان'),
  ('49', 'Timimoun', 'تيميمون'),
  ('50', 'Bordj Badji Mokhtar', 'برج باجي مختار'),
  ('51', 'Ouled Djellal', 'أولاد جلال'),
  ('52', 'Béni Abbès', 'بني عباس'),
  ('53', 'In Salah', 'عين صالح'),
  ('54', 'In Guezzam', 'عين قزام'),
  ('55', 'Touggourt', 'تقرت'),
  ('56', 'Djanet', 'جانت'),
  ('57', 'El Meghaier', 'المغير'),
  ('58', 'El Menia', 'المنيعة')
on conflict (code) do update set name = excluded.name, name_ar = excluded.name_ar;

-- 01 Adrar
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('01', 'Adrar', 'أدرار', 'Adrar'),
  ('01', 'Akabli', 'اقبلي', 'Aoulef'),
  ('01', 'Aoulef', 'أولف', 'Aoulef'),
  ('01', 'Bouda', 'بودة', 'Adrar'),
  ('01', 'Fenoughil', 'فنوغيل', 'Fenoughil'),
  ('01', 'In Zghmir', 'إن زغمير', 'Zaouiat Kounta'),
  ('01', 'Ouled Ahmed Timmi', 'أولاد أحمد تيمي', 'Adrar'),
  ('01', 'Reggane', 'رقان', 'Reggane'),
  ('01', 'Sali', 'سالي', 'Reggane'),
  ('01', 'Sebaa', 'السبع', 'Tsabit'),
  ('01', 'Tamantit', 'تامنطيط', 'Fenoughil'),
  ('01', 'Tamest', 'تامست', 'Fenoughil'),
  ('01', 'Timekten', 'تيمقتن', 'Aoulef'),
  ('01', 'Tit', 'تيت', 'Aoulef'),
  ('01', 'Tsabit', 'تسابيت', 'Tsabit'),
  ('01', 'Zaouiet Kounta', 'زاوية كنتة', 'Zaouiat Kounta')
on conflict (wilaya_code, name) do nothing;

-- 02 Chlef
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('02', 'Abou El Hassane', 'أبو الحسن', 'Abou El Hassane'),
  ('02', 'Ain Merane', 'عين مران', 'Ain Merane'),
  ('02', 'Benairia', 'بنايرية', 'Zeboudja'),
  ('02', 'Beni  Bouattab', 'بني بوعتاب', 'El Karimia'),
  ('02', 'Beni Haoua', 'بني حواء', 'Beni Haoua'),
  ('02', 'Beni Rached', 'بني راشد', 'Oued Fodda'),
  ('02', 'Boukadir', 'بوقادير', 'Boukadir'),
  ('02', 'Bouzeghaia', 'بوزغاية', 'Zeboudja'),
  ('02', 'Breira', 'بريرة', 'Beni Haoua'),
  ('02', 'Chettia', 'الشطية', 'Ouled Fares'),
  ('02', 'Chlef', 'الشلف', 'Chlef'),
  ('02', 'Dahra', 'الظهرة', 'Taougrit'),
  ('02', 'El Hadjadj', 'الحجاج', 'Ouled Ben Abdelkader'),
  ('02', 'El Karimia', 'الكريمية', 'El Karimia'),
  ('02', 'El Marsa', 'المرسى', 'El Marsa'),
  ('02', 'Harchoun', 'حرشون', 'El Karimia'),
  ('02', 'Herenfa', 'الهرانفة', 'Ain Merane'),
  ('02', 'Labiod Medjadja', 'الأبيض مجاجة', 'Ouled Fares'),
  ('02', 'Moussadek', 'مصدق', 'El Marsa'),
  ('02', 'Oued Fodda', 'وادي الفضة', 'Oued Fodda'),
  ('02', 'Oued Goussine', 'وا��ي قوسين', 'Beni Haoua'),
  ('02', 'Oued Sly', 'وادي سلي', 'Boukadir'),
  ('02', 'Ouled Abbes', 'أولاد عباس', 'Oued Fodda'),
  ('02', 'Ouled Ben Abdelkader', 'أولاد بن عبد القادر', 'Ouled Ben Abdelkader'),
  ('02', 'Ouled Fares', 'أولاد فارس', 'Ouled Fares'),
  ('02', 'Oum Drou', 'أم الدروع', 'Chlef'),
  ('02', 'Sendjas', 'سنجاس', 'Chlef'),
  ('02', 'Sidi Abderrahmane', 'سيدي عبد الرحمن', 'Tenes'),
  ('02', 'Sidi Akkacha', 'سيدي عكاشة', 'Tenes'),
  ('02', 'Sobha', 'الصبحة', 'Boukadir'),
  ('02', 'Tadjena', 'تاجنة', 'Abou El Hassane'),
  ('02', 'Talassa', 'تلعصة', 'Abou El Hassane'),
  ('02', 'Taougrit', 'تاوقريت', 'Taougrit'),
  ('02', 'Tenes', 'تنس', 'Tenes'),
  ('02', 'Zeboudja', 'الزبوجة', 'Zeboudja')
on conflict (wilaya_code, name) do nothing;

-- 03 Laghouat
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('03', 'Aflou', 'أفلو', 'Aflou'),
  ('03', 'Ain Madhi', 'عين ماضي', 'Ain Madhi'),
  ('03', 'Ain Sidi Ali', 'عين سيدي علي', 'Gueltat Sidi Saad'),
  ('03', 'Benacer Benchohra', 'بن ناصر بن شهرة', 'Ksar El Hirane'),
  ('03', 'Brida', 'بريدة', 'Brida'),
  ('03', 'El Assafia', 'العسافية', 'Sidi Makhlouf'),
  ('03', 'El Beidha', 'البيضاء', 'Gueltat Sidi Saad'),
  ('03', 'El Ghicha', 'الغيشة', 'El Ghicha'),
  ('03', 'El Haouaita', 'الحويطة', 'Ain Madhi'),
  ('03', 'Gueltat Sidi Saad', 'قلتة سيدي سعد', 'Gueltat Sidi Saad'),
  ('03', 'Hadj Mechri', 'الحاج مشري', 'Brida'),
  ('03', 'Hassi Delaa', 'حاسي الدلاعة', 'Hassi R''mel'),
  ('03', 'Hassi R''mel', 'حاسي الرمل', 'Hassi R''mel'),
  ('03', 'Kheneg', 'الخنق', 'Ain Madhi'),
  ('03', 'Ksar El Hirane', 'قصر الحيران', 'Ksar El Hirane'),
  ('03', 'Laghouat', 'الأغواط', 'Laghouat'),
  ('03', 'Oued M''zi', 'وادي مزي', 'Oued Morra'),
  ('03', 'Oued Morra', 'وادي مرة', 'Oued Morra'),
  ('03', 'Sebgag', 'سبقاق', 'Aflou'),
  ('03', 'Sidi Bouzid', 'سيدي بوزيد', 'Aflou'),
  ('03', 'Sidi Makhlouf', 'سيدي مخلوف', 'Sidi Makhlouf'),
  ('03', 'Tadjemout', 'تاجموت', 'Ain Madhi'),
  ('03', 'Tadjrouna', 'تاجرونة', 'Ain Madhi'),
  ('03', 'Taouiala', 'تاويالة', 'Brida')
on conflict (wilaya_code, name) do nothing;

-- 04 Oum El Bouaghi
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('04', 'Ain Babouche', 'عين ببوش', 'Ain Babouche'),
  ('04', 'Ain Beida', 'عين البيضاء', 'Ain Beida'),
  ('04', 'Ain Diss', 'عين الديس', 'Ain Babouche'),
  ('04', 'Ain Fekroun', 'عين فكرون', 'Ain Fekroun'),
  ('04', 'Ain Kercha', 'عين كرشة', 'Ain Kercha'),
  ('04', 'Ain M''lila', 'عين مليلة', 'Ain M''lila'),
  ('04', 'Ain Zitoun', 'عين الزيتون', 'Oum El Bouaghi'),
  ('04', 'Behir Chergui', 'بحير الشرقي', 'Meskiana'),
  ('04', 'Berriche', 'بريش', 'Ain Beida'),
  ('04', 'Bir Chouhada', 'بئر الشهداء', 'Souk Naamane'),
  ('04', 'Dhalaa', 'الضلعة', 'Dhalaa'),
  ('04', 'El Amiria', 'العامرية', 'Sigus'),
  ('04', 'El Belala', 'البلالة', 'Meskiana'),
  ('04', 'El Djazia', 'الجازية', 'Dhalaa'),
  ('04', 'El Fedjoudj Boughrara Sa', 'الفجوج بوغرارة سعودي', 'Ain Fekroun'),
  ('04', 'El Harmilia', 'الحرملية', 'Ain Kercha'),
  ('04', 'Fkirina', 'فكيرينة', 'F''kirina'),
  ('04', 'Hanchir Toumghani', 'هنشير تومغني', 'Ain Kercha'),
  ('04', 'Ksar Sbahi', 'قصر الصباحي', 'Ksar Sbahi'),
  ('04', 'Meskiana', 'مسكيانة', 'Meskiana'),
  ('04', 'Oued Nini', 'وادي نيني', 'F''kirina'),
  ('04', 'Ouled Gacem', 'أولاد قاسم', 'Ain M''lila'),
  ('04', 'Ouled Hamla', 'أولاد حملة', 'Ain M''lila'),
  ('04', 'Ouled Zouai', 'أولاد زواي', 'Souk Naamane'),
  ('04', 'Oum El Bouaghi', 'أم البواقي', 'Oum El Bouaghi'),
  ('04', 'Rahia', 'الرحية', 'Meskiana'),
  ('04', 'Sigus', 'سيقوس', 'Sigus'),
  ('04', 'Souk Naamane', 'سوق نعمان', 'Souk Naamane'),
  ('04', 'Zorg', 'الزرق', 'Ain Beida')
on conflict (wilaya_code, name) do nothing;

-- 05 Batna
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('05', 'Ain Djasser', 'عين جاسر', 'Ain Djasser'),
  ('05', 'Ain Touta', 'عين التوتة', 'Ain Touta'),
  ('05', 'Ain Yagout', 'عين ياقوت', 'El Madher'),
  ('05', 'Arris', 'أريس', 'Arris'),
  ('05', 'Azil Abedelkader', 'عزيل عبد القادر', 'Djezzar'),
  ('05', 'Barika', 'بريكة', 'Barika'),
  ('05', 'Batna', 'باتنة', 'Batna'),
  ('05', 'Beni Foudhala El Hakania', 'بني فضالة الحقانية', 'Ain Touta'),
  ('05', 'Bitam', 'بيطام', 'Barika'),
  ('05', 'Boulhilat', 'بولهيلات', 'Chemora'),
  ('05', 'Boumagueur', 'بومقر', 'N''gaous'),
  ('05', 'Boumia', 'بومية', 'El Madher'),
  ('05', 'Bouzina', 'بوزينة', 'Bouzina'),
  ('05', 'Chemora', 'الشمرة', 'Chemora'),
  ('05', 'Chir', 'شير', 'Theniet El Abed'),
  ('05', 'Djerma', 'جرمة', 'El Madher'),
  ('05', 'Djezzar', 'الجزار', 'Djezzar'),
  ('05', 'El Hassi', 'الحاسي', 'Ain Djasser'),
  ('05', 'El Madher', 'المعذر', 'El Madher'),
  ('05', 'Fesdis', 'فسديس', 'Batna'),
  ('05', 'Foum Toub', 'فم الطوب', 'Ichemoul'),
  ('05', 'Ghassira', 'غسيرة', 'Tkout'),
  ('05', 'Gosbat', 'القصبات', 'Ras El Aioun'),
  ('05', 'Guigba', 'القيقبة', 'Ras El Aioun'),
  ('05', 'Hidoussa', 'حيدوسة', 'Merouana'),
  ('05', 'Ichemoul', 'إشمول', 'Ichemoul'),
  ('05', 'Inoughissen', 'إينوغيسن', 'Ichemoul'),
  ('05', 'Kimmel', 'كيمل', 'Tkout'),
  ('05', 'Ksar Bellezma', 'قصر بلزمة', 'Merouana'),
  ('05', 'Larbaa', 'لارباع', 'Bouzina'),
  ('05', 'Lazrou', 'لازرو', 'Seriana'),
  ('05', 'Lemcene', 'لمسان', 'Ouled Si Slimane'),
  ('05', 'M Doukal', 'إمدوكل', 'Barika'),
  ('05', 'Maafa', 'معافة', 'Ain Touta'),
  ('05', 'Menaa', 'منعة', 'Menaa'),
  ('05', 'Merouana', 'مروانة', 'Merouana'),
  ('05', 'N Gaous', 'نقاوس', 'N''gaous'),
  ('05', 'Oued Chaaba', 'وادي الشعبة', 'Batna'),
  ('05', 'Oued El Ma', 'وادي الماء', 'Merouana'),
  ('05', 'Oued Taga', 'وادي الطاقة', 'Theniet El Abed'),
  ('05', 'Ouled Ammar', 'أولاد عمار', 'Djezzar'),
  ('05', 'Ouled Aouf', 'أولاد عوف', 'Ain Touta'),
  ('05', 'Ouled Fadel', 'أولاد فاضل', 'Timgad'),
  ('05', 'Ouled Sellem', 'أولاد سلام', 'Ras El Aioun'),
  ('05', 'Ouled Si Slimane', 'أولاد سي سليمان', 'Ouled Si Slimane'),
  ('05', 'Ouyoun El Assafir', 'عيون العصافير', 'Tazoult'),
  ('05', 'Rahbat', 'الرحبات', 'Ras El Aioun'),
  ('05', 'Ras El Aioun', 'رأس العيون', 'Ras El Aioun'),
  ('05', 'Sefiane', 'سفيان', 'N''gaous'),
  ('05', 'Seggana', 'سقانة', 'Seggana'),
  ('05', 'Seriana', 'سريانة', 'Seriana'),
  ('05', 'T Kout', 'تكوت', 'Tkout'),
  ('05', 'Talkhamt', 'تالخمت', 'Ras El Aioun'),
  ('05', 'Taxlent', 'تاكسلانت', 'Ouled Si Slimane'),
  ('05', 'Tazoult', 'تازولت', 'Tazoult'),
  ('05', 'Teniet El Abed', 'ثنية العابد', 'Theniet El Abed'),
  ('05', 'Tighanimine', 'تيغانمين', 'Arris'),
  ('05', 'Tigharghar', 'تغرغار', 'Menaa'),
  ('05', 'Tilatou', 'تيلاطو', 'Seggana'),
  ('05', 'Timgad', 'تيمقاد', 'Timgad'),
  ('05', 'Zanet El Beida', 'زانة البيضاء', 'Seriana')
on conflict (wilaya_code, name) do nothing;

-- 06 Béjaïa
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('06', 'Adekar', 'أدكار', 'Adekar'),
  ('06', 'Ait R''zine', 'أيت رزين', 'Ighil Ali'),
  ('06', 'Ait-Smail', 'أيت إسماعيل', 'Darguina'),
  ('06', 'Akbou', 'أقبو', 'Akbou'),
  ('06', 'Akfadou', 'أكفادو', 'Chemini'),
  ('06', 'Amalou', 'أمالو', 'Seddouk'),
  ('06', 'Amizour', 'أميزور', 'Amizour'),
  ('06', 'Aokas', 'أوقاس', 'Aokas'),
  ('06', 'Barbacha', 'برباشة', 'Barbacha'),
  ('06', 'Bejaia', 'بجاية', 'Bejaia'),
  ('06', 'Beni Djellil', 'بني جليل', 'Amizour'),
  ('06', 'Beni K''sila', 'بني كسيلة', 'Adekar'),
  ('06', 'Beni-Mallikeche', 'بني مليكش', 'Tazmalt'),
  ('06', 'Benimaouche', 'بني معوش', 'Beni Maouche'),
  ('06', 'Boudjellil', 'بو جليل', 'Tazmalt'),
  ('06', 'Bouhamza', 'بوحمزة', 'Seddouk'),
  ('06', 'Boukhelifa', 'بوخليفة', 'Tichy'),
  ('06', 'Chellata', 'شلاطة', 'Akbou'),
  ('06', 'Chemini', 'شميني', 'Chemini'),
  ('06', 'Darguina', 'درقينة', 'Darguina'),
  ('06', 'Dra El Caid', 'ذراع القايد', 'Kherrata'),
  ('06', 'El Kseur', 'القصر', 'El Kseur'),
  ('06', 'Fenaia Il Maten', 'فناية الماثن', 'El Kseur'),
  ('06', 'Feraoun', 'فرعون', 'Amizour'),
  ('06', 'Ighil-Ali', 'إغيل علي', 'Ighil Ali'),
  ('06', 'Ighram', 'اغرم', 'Akbou'),
  ('06', 'Kendira', 'كنديرة', 'Barbacha'),
  ('06', 'Kherrata', 'خراطة', 'Kherrata'),
  ('06', 'Leflaye', 'الفلاي', 'Sidi Aich'),
  ('06', 'M''cisna', 'مسيسنة', 'Seddouk'),
  ('06', 'Melbou', 'مالبو', 'Souk El Tenine'),
  ('06', 'Oued Ghir', 'وادي غير', 'Bejaia'),
  ('06', 'Ouzellaguen', 'أوزلاقن', 'Ifri Ouzellaguene'),
  ('06', 'Seddouk', 'صدوق', 'Seddouk'),
  ('06', 'Sidi Ayad', 'سيدي عياد', 'Sidi Aich'),
  ('06', 'Sidi-Aich', 'سيدي عيش', 'Sidi Aich'),
  ('06', 'Smaoun', 'سمعون', 'Amizour'),
  ('06', 'Souk El Tenine', 'سوق لإثنين', 'Souk El Tenine'),
  ('06', 'Souk Oufella', 'سوق اوفلا', 'Chemini'),
  ('06', 'Tala Hamza', 'تالة حمزة', 'Tichy'),
  ('06', 'Tamokra', 'تامقرة', 'Akbou'),
  ('06', 'Tamridjet', 'تامريجت', 'Souk El Tenine'),
  ('06', 'Taourit Ighil', 'تاوريرت إغيل', 'Adekar'),
  ('06', 'Taskriout', 'تاسكريوت', 'Darguina'),
  ('06', 'Tazmalt', 'تازمالت', 'Tazmalt'),
  ('06', 'Tibane', 'طيبان', 'Chemini'),
  ('06', 'Tichy', 'تيشي', 'Tichy'),
  ('06', 'Tifra', 'تيفرة', 'Sidi Aich'),
  ('06', 'Timezrit', 'تيمزريت', 'Timezrit'),
  ('06', 'Tinebdar', 'تينبدار', 'Sidi Aich'),
  ('06', 'Tizi-N''berber', 'تيزي نبربر', 'Aokas'),
  ('06', 'Toudja', 'توجة', 'El Kseur')
on conflict (wilaya_code, name) do nothing;

-- 07 Biskra
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('07', 'Ain Naga', 'عين الناقة', 'Sidi Okba'),
  ('07', 'Ain Zaatout', 'عين زعطوط', 'El Kantara'),
  ('07', 'Biskra', 'بسكرة', 'Biskra'),
  ('07', 'Bordj Ben Azzouz', 'برج بن عزوز', 'Tolga'),
  ('07', 'Bouchakroun', 'بوشقرون', 'Tolga'),
  ('07', 'Branis', 'برانيس', 'Djemorah'),
  ('07', 'Chetma', 'شتمة', 'Sidi Okba'),
  ('07', 'Djemorah', 'جمورة', 'Djemorah'),
  ('07', 'El Feidh', 'الفيض', 'Zeribet El Oued'),
  ('07', 'El Ghrous', 'الغروس', 'Foughala'),
  ('07', 'El Hadjab', 'الحاجب', 'Biskra'),
  ('07', 'El Haouch', 'الحوش', 'Sidi Okba'),
  ('07', 'El Kantara', 'القنطرة', 'El Kantara'),
  ('07', 'El Outaya', 'الوطاية', 'El Outaya'),
  ('07', 'Foughala', 'فوغالة', 'Foughala'),
  ('07', 'Khenguet Sidi Nadji', 'خنقة سيدي ناجي', 'Zeribet El Oued'),
  ('07', 'Lichana', 'ليشانة', 'Tolga'),
  ('07', 'Lioua', 'ليوة', 'Ourlal'),
  ('07', 'M''chouneche', 'مشونش', 'Mechouneche'),
  ('07', 'M''lili', 'مليلي', 'Ourlal'),
  ('07', 'Mekhadma', 'مخادمة', 'Ourlal'),
  ('07', 'Meziraa', 'المزيرعة', 'Zeribet El Oued'),
  ('07', 'Oumache', 'أوماش', 'Ourlal'),
  ('07', 'Ourlal', 'أورلال', 'Ourlal'),
  ('07', 'Sidi Okba', 'سيدي عقبة', 'Sidi Okba'),
  ('07', 'Tolga', 'طولقة', 'Tolga'),
  ('07', 'Zeribet El Oued', 'زريبة الوادي', 'Zeribet El Oued')
on conflict (wilaya_code, name) do nothing;

-- 08 Béchar
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('08', 'Abadla', 'العبادلة', 'Abadla'),
  ('08', 'Bechar', 'بشار', 'Bechar'),
  ('08', 'Beni-Ounif', 'بني ونيف', 'Beni Ounif'),
  ('08', 'Boukais', 'بوكايس', 'Lahmar'),
  ('08', 'Erg-Ferradj', 'عرق فراج', 'Abadla'),
  ('08', 'Kenadsa', 'القنادسة', 'Kenadsa'),
  ('08', 'Lahmar', 'لحمر', 'Lahmar'),
  ('08', 'Machraa-Houari-Boumediene', 'مشرع هواري بومدين', 'Abadla'),
  ('08', 'Meridja', 'المريجة', 'Kenadsa'),
  ('08', 'Mogheul', 'موغل', 'Lahmar'),
  ('08', 'Tabelbala', 'تبلبالة', 'Tabelbala'),
  ('08', 'Taghit', 'تاغيت', 'Taghit')
on conflict (wilaya_code, name) do nothing;

-- 09 Blida
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('09', 'Ain Romana', 'عين الرمانة', 'Mouzaia'),
  ('09', 'Beni Mered', 'بني مراد', 'Ouled Yaich'),
  ('09', 'Beni-Tamou', 'بني تامو', 'Oued El Alleug'),
  ('09', 'Benkhelil', 'بن خليل', 'Oued El Alleug'),
  ('09', 'Blida', 'البليدة', 'Blida'),
  ('09', 'Bouarfa', 'بوعرفة', 'Blida'),
  ('09', 'Boufarik', 'بوفاريك', 'Boufarik'),
  ('09', 'Bougara', 'بوقرة', 'Bougara'),
  ('09', 'Bouinan', 'بوعينان', 'Bouinan'),
  ('09', 'Chebli', 'الشبلي', 'Bouinan'),
  ('09', 'Chiffa', 'الشفة', 'Mouzaia'),
  ('09', 'Chrea', 'الشريعة', 'Ouled Yaich'),
  ('09', 'Djebabra', 'جبابرة', 'Meftah'),
  ('09', 'El-Affroun', 'العفرون', 'El Affroun'),
  ('09', 'Guerrouaou', 'قرواو', 'Boufarik'),
  ('09', 'Hammam Elouane', 'حمام ملوان', 'Bougara'),
  ('09', 'Larbaa', 'الأربعاء', 'Larbaa'),
  ('09', 'Meftah', 'مفتاح', 'Meftah'),
  ('09', 'Mouzaia', 'موزاية', 'Mouzaia'),
  ('09', 'Oued  Djer', 'وادي جر', 'El Affroun'),
  ('09', 'Oued El Alleug', 'وادي العلايق', 'Oued El Alleug'),
  ('09', 'Ouled Slama', 'اولاد سلامة', 'Bougara'),
  ('09', 'Ouled Yaich', 'أولاد يعيش', 'Ouled Yaich'),
  ('09', 'Souhane', 'صوحان', 'Larbaa'),
  ('09', 'Soumaa', 'الصومعة', 'Boufarik')
on conflict (wilaya_code, name) do nothing;

-- 10 Bouira
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('10', 'Aghbalou', 'أغبالو', 'M''chedallah'),
  ('10', 'Ahl El Ksar', 'أهل القصر', 'Bechloul'),
  ('10', 'Ain El Hadjar', 'عين الحجر', 'Ain Bessem'),
  ('10', 'Ain Laloui', 'عين العلوي', 'Ain Bessem'),
  ('10', 'Ain Turk', 'عين الترك', 'Bouira'),
  ('10', 'Ain-Bessem', 'عين بسام', 'Ain Bessem'),
  ('10', 'Ait Laaziz', 'أيت لعزيز', 'Bouira'),
  ('10', 'Aomar', 'أعمر', 'Kadiria'),
  ('10', 'Ath Mansour', 'آث  منصور', 'M''chedallah'),
  ('10', 'Bechloul', 'بشلول', 'Bechloul'),
  ('10', 'Bir Ghbalou', 'بئر غبالو', 'Bir Ghbalou'),
  ('10', 'Bordj Okhriss', 'برج أوخريص', 'Bordj Okhriss'),
  ('10', 'Bouderbala', 'بودربالة', 'Lakhdaria'),
  ('10', 'Bouira', 'البويرة', 'Bouira'),
  ('10', 'Boukram', '��وكرم', 'Lakhdaria'),
  ('10', 'Chorfa', 'شرفة', 'M''chedallah'),
  ('10', 'Dechmia', 'الدشمية', 'Sour El Ghozlane'),
  ('10', 'Dirah', 'ديرة', 'Sour El Ghozlane'),
  ('10', 'Djebahia', 'جباحية', 'Kadiria'),
  ('10', 'El Adjiba', 'العجيبة', 'Bechloul'),
  ('10', 'El Asnam', 'الأسنام', 'Bechloul'),
  ('10', 'El Hachimia', 'الهاشمية', 'El Hachimia'),
  ('10', 'El Khabouzia', 'الخبوزية', 'Bir Ghbalou'),
  ('10', 'El-Hakimia', 'الحاكمية', 'Sour El Ghozlane'),
  ('10', 'El-Mokrani', 'المقراني', 'Souk El Khemis'),
  ('10', 'Guerrouma', 'قرومة', 'Lakhdaria'),
  ('10', 'Hadjera Zerga', 'الحجرة الزرقاء', 'Bordj Okhriss'),
  ('10', 'Haizer', 'حيزر', 'Haizer'),
  ('10', 'Hanif', 'حنيف', 'M''chedallah'),
  ('10', 'Kadiria', 'قادرية', 'Kadiria'),
  ('10', 'Lakhdaria', 'الأخضرية', 'Lakhdaria'),
  ('10', 'M Chedallah', 'أمشدالة', 'M''chedallah'),
  ('10', 'Maala', 'معلة', 'Lakhdaria'),
  ('10', 'Maamora', 'المعمورة', 'Sour El Ghozlane'),
  ('10', 'Mezdour', 'مزدور', 'Bordj Okhriss'),
  ('10', 'Oued El Berdi', 'وادي البردي', 'El Hachimia'),
  ('10', 'Ouled Rached', 'أولاد راشد', 'Bechloul'),
  ('10', 'Raouraoua', 'روراوة', 'Bir Ghbalou'),
  ('10', 'Ridane', 'ريدان', 'Sour El Ghozlane'),
  ('10', 'Saharidj', 'سحاريج', 'M''chedallah'),
  ('10', 'Souk El Khemis', 'سوق الخميس', 'Souk El Khemis'),
  ('10', 'Sour El Ghozlane', 'سور الغزلان', 'Sour El Ghozlane'),
  ('10', 'Taghzout', 'تاغزوت', 'Haizer'),
  ('10', 'Taguedite', 'تاقديت', 'Bordj Okhriss'),
  ('10', 'Z''barbar (El Isseri )', 'زبربر', 'Lakhdaria')
on conflict (wilaya_code, name) do nothing;

-- 11 Tamanrasset
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('11', 'Abelsa', 'ابلسة', 'Silet'),
  ('11', 'Ain Amguel', 'عين امقل', 'Tamanrasset'),
  ('11', 'Idles', 'أدلس', 'Tazrouk'),
  ('11', 'Tamanrasset', 'تمنراست', 'Tamanrasset'),
  ('11', 'Tazrouk', 'تاظروك', 'Tazrouk')
on conflict (wilaya_code, name) do nothing;

-- 12 Tébessa
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('12', 'Ain Zerga', 'عين الزرقاء', 'Ouenza'),
  ('12', 'Bedjene', 'بجن', 'El Ogla'),
  ('12', 'Bekkaria', 'بكارية', 'El Kouif'),
  ('12', 'Bir Dheheb', 'بئر الذهب', 'Morsott'),
  ('12', 'Bir Mokkadem', 'بئر مقدم', 'Bir Mokadem'),
  ('12', 'Bir-El-Ater', 'بئر العاتر', 'Bir El Ater'),
  ('12', 'Boukhadra', 'بوخضرة', 'El Aouinet'),
  ('12', 'Boulhaf Dyr', 'بولحاف الدير', 'El Kouif'),
  ('12', 'Cheria', 'الشريعة', 'Cheria'),
  ('12', 'El Kouif', 'الكويف', 'El Kouif'),
  ('12', 'El Malabiod', 'الماء الابيض', 'El Malabiod'),
  ('12', 'El Meridj', 'المريج', 'Ouenza'),
  ('12', 'El Mezeraa', 'المزرعة', 'El Ogla'),
  ('12', 'El Ogla', 'العقلة', 'El Ogla'),
  ('12', 'El Ogla El Malha', 'العقلة المالحة', 'Bir El Ater'),
  ('12', 'El-Aouinet', 'العوينات', 'El Aouinet'),
  ('12', 'El-Houidjbet', 'الحويجبات', 'El Malabiod'),
  ('12', 'Ferkane', 'فركان', 'Negrine'),
  ('12', 'Guorriguer', 'قريقر', 'Bir Mokadem'),
  ('12', 'Hammamet', 'الحمامات', 'Bir Mokadem'),
  ('12', 'Morsott', 'مرسط', 'Morsott'),
  ('12', 'Negrine', 'نقرين', 'Negrine'),
  ('12', 'Ouenza', 'الونزة', 'Ouenza'),
  ('12', 'Oum Ali', 'أم علي', 'Oum Ali'),
  ('12', 'Saf Saf El Ouesra', 'صفصاف الوسرى', 'Oum Ali'),
  ('12', 'Stah Guentis', 'سطح قنطيس', 'El Ogla'),
  ('12', 'Tebessa', 'تبسة', 'Tebessa'),
  ('12', 'Telidjen', 'ثليجان', 'Cheria')
on conflict (wilaya_code, name) do nothing;

-- 13 Tlemcen
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('13', 'Ain Fetah', 'عين فتاح', 'Fellaoucene'),
  ('13', 'Ain Fezza', 'عين فزة', 'Chetouane'),
  ('13', 'Ain Ghoraba', 'عين غرابة', 'Mansourah'),
  ('13', 'Ain Kebira', 'عين الكبيرة', 'Fellaoucene'),
  ('13', 'Ain Nehala', 'عين النحالة', 'Ain Tellout'),
  ('13', 'Ain Tellout', 'عين تالوت', 'Ain Tellout'),
  ('13', 'Ain Youcef', 'عين يوسف', 'Remchi'),
  ('13', 'Amieur', 'عمير', 'Chetouane'),
  ('13', 'Azail', 'العزايل', 'Beni Snous'),
  ('13', 'Bab El Assa', 'باب العسة', 'Bab El Assa'),
  ('13', 'Beni Bahdel', 'بني بهدل', 'Beni Snous'),
  ('13', 'Beni Boussaid', 'بني بوسعيد', 'Beni Boussaid'),
  ('13', 'Beni Khellad', 'بني خلاد', 'Honnaine'),
  ('13', 'Beni Mester', 'بني مستر', 'Mansourah'),
  ('13', 'Beni Ouarsous', 'بني وارسوس', 'Remchi'),
  ('13', 'Beni Smiel', 'بني صميل', 'Ouled Mimoun'),
  ('13', 'Beni Snous', 'بني سنوس', 'Beni Snous'),
  ('13', 'Bensekrane', 'بن سكران', 'Bensekrane'),
  ('13', 'Bouhlou', 'بوحلو', 'Sabra'),
  ('13', 'Bouihi', 'البويهي', 'Sidi Djillali'),
  ('13', 'Chetouane', 'شتوان', 'Chetouane'),
  ('13', 'Dar Yaghmoracen', 'دار يغمراسن', 'Ghazaouet'),
  ('13', 'Djebala', 'جبالة', 'Nedroma'),
  ('13', 'El Aricha', 'العريشة', 'Sebdou'),
  ('13', 'El Fehoul', 'الفحول', 'Remchi'),
  ('13', 'El Gor', 'القور', 'Sebdou'),
  ('13', 'Fellaoucene', 'فلاوسن', 'Fellaoucene'),
  ('13', 'Ghazaouet', 'الغزوات', 'Ghazaouet'),
  ('13', 'Hammam Boughrara', 'حمام بوغرارة', 'Maghnia'),
  ('13', 'Hennaya', 'الحناية', 'Hennaya'),
  ('13', 'Honnaine', 'هنين', 'Honnaine'),
  ('13', 'M''sirda Fouaga', 'مسيردة الفواقة', 'Marsa Ben Mehdi'),
  ('13', 'Maghnia', 'مغنية', 'Maghnia'),
  ('13', 'Mansourah', 'منصورة', 'Mansourah'),
  ('13', 'Marsa Ben M''hidi', 'مرسى بن مهيدي', 'Marsa Ben Mehdi'),
  ('13', 'Nedroma', 'ندرومة', 'Nedroma'),
  ('13', 'Oued Lakhdar', 'وادي الخضر', 'Ouled Mimoun'),
  ('13', 'Ouled Mimoun', 'أولاد ميمون', 'Ouled Mimoun'),
  ('13', 'Ouled Riyah', 'أولاد رياح', 'Hennaya'),
  ('13', 'Remchi', 'الرمشي', 'Remchi'),
  ('13', 'Sabra', 'صبرة', 'Sabra'),
  ('13', 'Sebbaa Chioukh', 'سبعة شيوخ', 'Remchi'),
  ('13', 'Sebdou', 'سبدو', 'Sebdou'),
  ('13', 'Sidi Abdelli', 'سيدي العبدلي', 'Bensekrane'),
  ('13', 'Sidi Djillali', 'سيدي الجيلالي', 'Sidi Djillali'),
  ('13', 'Sidi Medjahed', 'سيدي مجاهد', 'Beni Boussaid'),
  ('13', 'Souahlia', 'السواحلية', 'Ghazaouet'),
  ('13', 'Souani', 'السواني', 'Bab El Assa'),
  ('13', 'Souk Tleta', 'سوق الثلاثاء', 'Bab El Assa'),
  ('13', 'Terny Beni Hediel', 'تيرني بني هديل', 'Mansourah'),
  ('13', 'Tianet', 'تيانت', 'Ghazaouet'),
  ('13', 'Tlemcen', 'تلمسان', 'Tlemcen'),
  ('13', 'Zenata', 'زناتة', 'Hennaya')
on conflict (wilaya_code, name) do nothing;

-- 14 Tiaret
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('14', 'Ain Bouchekif', 'عين بوشقيف', 'Dahmouni'),
  ('14', 'Ain Deheb', 'عين الذهب', 'Ain Deheb'),
  ('14', 'Ain Dzarit', 'عين دزاريت', 'Mahdia'),
  ('14', 'Ain El Hadid', 'عين الحديد', 'Frenda'),
  ('14', 'Ain Kermes', 'عين كرمس', 'Ain Kermes'),
  ('14', 'Bougara', 'بوقرة', 'Hamadia'),
  ('14', 'Chehaima', 'شحيمة', 'Ain Deheb'),
  ('14', 'Dahmouni', 'دحموني', 'Dahmouni'),
  ('14', 'Djebilet Rosfa', 'جبيلات الرصفاء', 'Ain Kermes'),
  ('14', 'Djillali Ben Amar', 'جيلالي بن عمار', 'Mechraa Sfa'),
  ('14', 'Faidja', 'الفايجة', 'Sougueur'),
  ('14', 'Frenda', 'فرندة', 'Frenda'),
  ('14', 'Guertoufa', 'قرطوفة', 'Rahouia'),
  ('14', 'Hamadia', 'حمادية', 'Hamadia'),
  ('14', 'Ksar Chellala', 'قصر الشلالة', 'Ksar Chellala'),
  ('14', 'Madna', 'مادنة', 'Ain Kermes'),
  ('14', 'Mahdia', 'مهدية', 'Mahdia'),
  ('14', 'Mechraa Safa', 'مشرع الصفا', 'Mechraa Sfa'),
  ('14', 'Medrissa', 'مدريسة', 'Ain Kermes'),
  ('14', 'Medroussa', 'مدروسة', 'Medroussa'),
  ('14', 'Meghila', 'مغيلة', 'Meghila'),
  ('14', 'Mellakou', 'ملاكو', 'Medroussa'),
  ('14', 'Nadorah', 'الناظورة', 'Mahdia'),
  ('14', 'Naima', 'النعيمة', 'Ain Deheb'),
  ('14', 'Oued Lilli', 'وادي ليلي', 'Oued Lili'),
  ('14', 'Rahouia', 'الرحوية', 'Rahouia'),
  ('14', 'Rechaiga', 'الرشايقة', 'Hamadia'),
  ('14', 'Sebaine', 'السبعين', 'Mahdia'),
  ('14', 'Sebt', 'السبت', 'Meghila'),
  ('14', 'Serghine', 'سرغين', 'Ksar Chellala'),
  ('14', 'Si Abdelghani', 'سي عبد الغني', 'Sougueur'),
  ('14', 'Sidi Abderrahmane', 'سيدي عبد الرحمن', 'Ain Kermes'),
  ('14', 'Sidi Ali Mellal', 'سيدي علي ملال', 'Oued Lili'),
  ('14', 'Sidi Bakhti', 'سيدي بختي', 'Medroussa'),
  ('14', 'Sidi Hosni', 'سيدي حسني', 'Meghila'),
  ('14', 'Sougueur', 'السوقر', 'Sougueur'),
  ('14', 'Tagdempt', 'تاقدمت', 'Mechraa Sfa'),
  ('14', 'Takhemaret', 'تخمرت', 'Frenda'),
  ('14', 'Tiaret', 'تيارت', 'Tiaret'),
  ('14', 'Tidda', 'تيدة', 'Oued Lili'),
  ('14', 'Tousnina', 'توسنينة', 'Sougueur'),
  ('14', 'Zmalet El Emir Abdelkade', 'زمالة  الأمير عبد القادر', 'Ksar Chellala')
on conflict (wilaya_code, name) do nothing;

-- 15 Tizi Ouzou
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('15', 'Abi-Youcef', 'أبي يوسف', 'Ain El Hammam'),
  ('15', 'Aghribs', 'أغريب', 'Azeffoun'),
  ('15', 'Agouni-Gueghrane', 'أقني قغران', 'Ouadhias'),
  ('15', 'Ain-El-Hammam', 'عين الحمام', 'Ain El Hammam'),
  ('15', 'Ain-Zaouia', 'عين الزاوية', 'Draa El Mizan'),
  ('15', 'Ait Aggouacha', 'أيت عقـواشة', 'Larbaa Nath Iraten'),
  ('15', 'Ait Bouaddou', 'أيت بــوادو', 'Ouadhias'),
  ('15', 'Ait Boumahdi', 'أيت بومهدي', 'Ouacif'),
  ('15', 'Ait Khellili', 'أيت خليلي', 'Mekla'),
  ('15', 'Ait Yahia Moussa', 'أيت يحي موسى', 'Draa El Mizan'),
  ('15', 'Ait-Aissa-Mimoun', 'أيت عيسى ميمون', 'Ouaguenoun'),
  ('15', 'Ait-Chafaa', 'أيت شافع', 'Azeffoun'),
  ('15', 'Ait-Mahmoud', 'أيت محمود', 'Beni Douala'),
  ('15', 'Ait-Oumalou', 'أيت  أومالو', 'Tizi Rached'),
  ('15', 'Ait-Toudert', 'أيت تودرت', 'Ouacif'),
  ('15', 'Ait-Yahia', 'أيت يحيى', 'Ain El Hammam'),
  ('15', 'Akbil', 'اقبيل', 'Ain El Hammam'),
  ('15', 'Akerrou', 'أقرو', 'Azeffoun'),
  ('15', 'Assi-Youcef', 'أسي يوسف', 'Boghni'),
  ('15', 'Azazga', 'عزازقة', 'Azazga'),
  ('15', 'Azeffoun', 'أزفون', 'Azeffoun'),
  ('15', 'Beni Zmenzer', 'بنــــي زمنزار', 'Beni Douala'),
  ('15', 'Beni-Aissi', 'بني عيسي', 'Beni Douala'),
  ('15', 'Beni-Douala', 'بني دوالة', 'Beni Douala'),
  ('15', 'Beni-Yenni', 'بني يني', 'Benni Yenni'),
  ('15', 'Beni-Zikki', 'بني زيكــي', 'Bouzeguene'),
  ('15', 'Boghni', 'بوغني', 'Boghni'),
  ('15', 'Boudjima', 'بوجيمة', 'Makouda'),
  ('15', 'Bounouh', 'بونوح', 'Boghni'),
  ('15', 'Bouzeguene', 'بوزقــن', 'Bouzeguene'),
  ('15', 'Draa-Ben-Khedda', 'ذراع بن خدة', 'Draa Ben Khedda'),
  ('15', 'Draa-El-Mizan', 'ذراع الميزان', 'Draa El Mizan'),
  ('15', 'Freha', 'فريحة', 'Azazga'),
  ('15', 'Frikat', 'فريقات', 'Draa El Mizan'),
  ('15', 'Iboudrarene', 'إبودرارن', 'Benni Yenni'),
  ('15', 'Idjeur', 'إيجــار', 'Bouzeguene'),
  ('15', 'Iferhounene', 'إفــرحــونان', 'Iferhounene'),
  ('15', 'Ifigha', 'إيفيغاء', 'Azazga'),
  ('15', 'Iflissen', 'إفليـــسن', 'Tigzirt'),
  ('15', 'Illilten', 'إيلـيــلتـن', 'Iferhounene'),
  ('15', 'Illoula Oumalou', 'إيلولة أومـــالو', 'Bouzeguene'),
  ('15', 'Imsouhal', 'إمســوحال', 'Iferhounene'),
  ('15', 'Irdjen', 'إيرجـــن', 'Larbaa Nath Iraten'),
  ('15', 'Larbaa Nath Irathen', 'الأربعــاء ناث إيراثن', 'Larbaa Nath Iraten'),
  ('15', 'M''kira', 'مكيرة', 'Tizi-Ghenif'),
  ('15', 'Maatkas', 'معـــاتقة', 'Maatkas'),
  ('15', 'Makouda', 'ماكودة', 'Makouda'),
  ('15', 'Mechtras', 'مشطراس', 'Boghni'),
  ('15', 'Mekla', 'مقــلع', 'Mekla'),
  ('15', 'Mizrana', 'ميزرانـــة', 'Tigzirt'),
  ('15', 'Ouacif', 'واسيف', 'Ouacif'),
  ('15', 'Ouadhias', 'واضية', 'Ouadhias'),
  ('15', 'Ouaguenoun', 'واقنون', 'Ouaguenoun'),
  ('15', 'Sidi Namane', 'سيدي نعمان', 'Draa Ben Khedda'),
  ('15', 'Souama', 'صوامـــع', 'Mekla'),
  ('15', 'Souk-El-Tenine', 'سوق الإثنين', 'Maatkas'),
  ('15', 'Tadmait', 'تادمايت', 'Draa Ben Khedda'),
  ('15', 'Tigzirt', 'تيقـزيرت', 'Tigzirt'),
  ('15', 'Timizart', 'تيمـيزار', 'Ouaguenoun'),
  ('15', 'Tirmitine', 'تيرمتين', 'Draa Ben Khedda'),
  ('15', 'Tizi N''tleta', 'تيزي نثلاثة', 'Ouadhias'),
  ('15', 'Tizi-Gheniff', 'تيزي غنيف', 'Tizi-Ghenif'),
  ('15', 'Tizi-Ouzou', 'تيزي وزو', 'Tizi Ouzou'),
  ('15', 'Tizi-Rached', 'تيزي راشد', 'Tizi Rached'),
  ('15', 'Yakourene', 'إعــكورن', 'Azazga'),
  ('15', 'Yatafene', 'يطــافن', 'Benni Yenni'),
  ('15', 'Zekri', 'زكري', 'Azazga')
on conflict (wilaya_code, name) do nothing;

-- 16 Alger
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('16', 'Ain Benian', 'عين بنيان', 'Cheraga'),
  ('16', 'Ain Taya', 'عين طاية', 'Dar El Beida'),
  ('16', 'Alger Centre', 'الجزائر الوسطى', 'Sidi M''hamed'),
  ('16', 'Bab El Oued', 'باب الوادي', 'Bab El Oued'),
  ('16', 'Bab Ezzouar', 'باب الزوار', 'Dar El Beida'),
  ('16', 'Baba Hassen', 'بابا حسن', 'Draria'),
  ('16', 'Bachedjerah', 'باش جراح', 'El Harrach'),
  ('16', 'Baraki', 'براقي', 'Baraki'),
  ('16', 'Ben Aknoun', 'ابن عكنون', 'Bouzareah'),
  ('16', 'Beni Messous', 'بني مسوس', 'Bouzareah'),
  ('16', 'Bir Mourad Rais', 'بئر مراد رايس', 'Bir Mourad Rais'),
  ('16', 'Bir Touta', 'بئر توتة', 'Birtouta'),
  ('16', 'Birkhadem', 'بئر خادم', 'Bir Mourad Rais'),
  ('16', 'Bologhine Ibnou Ziri', 'بولوغين بن زيري', 'Bab El Oued'),
  ('16', 'Bordj El Bahri', 'برج البحري', 'Dar El Beida'),
  ('16', 'Bordj El Kiffan', 'برج الكيفان', 'Dar El Beida'),
  ('16', 'Bourouba', 'بوروبة', 'El Harrach'),
  ('16', 'Bouzareah', 'بوزريعة', 'Bouzareah'),
  ('16', 'Casbah', 'القصبة', 'Bab El Oued'),
  ('16', 'Cheraga', 'الشراقة', 'Cheraga'),
  ('16', 'Dar El Beida', 'الدار البيضاء', 'Dar El Beida'),
  ('16', 'Dely Ibrahim', 'دالي ابراهيم', 'Cheraga'),
  ('16', 'Djasr Kasentina', 'جسر قسنطينة', 'Bir Mourad Rais'),
  ('16', 'Douira', 'الدويرة', 'Draria'),
  ('16', 'Draria', 'الدرارية', 'Draria'),
  ('16', 'El Achour', 'العاشور', 'Draria'),
  ('16', 'El Biar', 'الابيار', 'Bouzareah'),
  ('16', 'El Harrach', 'الحراش', 'El Harrach'),
  ('16', 'El Madania', 'المدنية', 'Sidi M''hamed'),
  ('16', 'El Magharia', 'المغارية', 'Hussein Dey'),
  ('16', 'El Marsa', 'المرسى', 'Dar El Beida'),
  ('16', 'El Mouradia', 'المرادية', 'Sidi M''hamed'),
  ('16', 'Hammamet', 'الحمامات', 'Cheraga'),
  ('16', 'Herraoua', 'هراوة', 'Rouiba'),
  ('16', 'Hussein Dey', 'حسين داي', 'Hussein Dey'),
  ('16', 'Hydra', 'حيدرة', 'Bir Mourad Rais'),
  ('16', 'Khraissia', 'الخرايسية', 'Draria'),
  ('16', 'Kouba', 'القبة', 'Hussein Dey'),
  ('16', 'Les Eucalyptus', 'الكاليتوس', 'Baraki'),
  ('16', 'Maalma', 'المعالمة', 'Zeralda'),
  ('16', 'Mohamed Belouzdad', 'محمد بلوزداد', 'Hussein Dey'),
  ('16', 'Mohammadia', 'المحمدية', 'Dar El Beida'),
  ('16', 'Oued Koriche', 'وادي قريش', 'Bab El Oued'),
  ('16', 'Oued Smar', 'وادي السمار', 'El Harrach'),
  ('16', 'Ouled Chebel', 'اولاد شبل', 'Birtouta'),
  ('16', 'Ouled Fayet', 'اولاد فايت', 'Cheraga'),
  ('16', 'Rahmania', 'الرحمانية', 'Zeralda'),
  ('16', 'Rais Hamidou', 'الرايس حميدو', 'Bab El Oued'),
  ('16', 'Reghaia', 'رغاية', 'Rouiba'),
  ('16', 'Rouiba', 'الرويبة', 'Rouiba'),
  ('16', 'Sehaoula', 'السحاولة', 'Bir Mourad Rais'),
  ('16', 'Sidi M''hamed', 'سيدي امحمد', 'Sidi M''hamed'),
  ('16', 'Sidi Moussa', 'سيدي موسى', 'Baraki'),
  ('16', 'Souidania', 'سويدانية', 'Zeralda'),
  ('16', 'Staoueli', 'سطاوالي', 'Zeralda'),
  ('16', 'Tessala El Merdja', 'تسالة المرجة', 'Birtouta'),
  ('16', 'Zeralda', 'زرالدة', 'Zeralda')
on conflict (wilaya_code, name) do nothing;

-- 17 Djelfa
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('17', 'Ain Chouhada', 'عين الشهداء', 'El Idrissia'),
  ('17', 'Ain El Ibel', 'عين الإبل', 'Ain El Ibel'),
  ('17', 'Ain Fekka', 'عين فقه', 'Had Sahary'),
  ('17', 'Ain Maabed', 'عين معبد', 'Hassi Bahbah'),
  ('17', 'Ain Oussera', 'عين وسارة', 'Ain Oussera'),
  ('17', 'Amourah', 'عمورة', 'Faidh El Botma'),
  ('17', 'Benhar', 'بنهار', 'Birine'),
  ('17', 'Benyagoub', 'بن يعقوب', 'Charef'),
  ('17', 'Birine', 'بيرين', 'Birine'),
  ('17', 'Bouira Lahdab', 'بويرة الأحداب', 'Had Sahary'),
  ('17', 'Charef', 'الشارف', 'Charef'),
  ('17', 'Dar Chioukh', 'دار الشيوخ', 'Dar Chioukh'),
  ('17', 'Deldoul', 'دلدول', 'Messaad'),
  ('17', 'Djelfa', 'الجلفة', 'Djelfa'),
  ('17', 'Douis', 'دويس', 'El Idrissia'),
  ('17', 'El Guedid', 'القديد', 'Charef'),
  ('17', 'El Idrissia', 'الادريسية', 'El Idrissia'),
  ('17', 'El Khemis', 'الخميس', 'Sidi Laadjel'),
  ('17', 'Faidh El Botma', 'فيض البطمة', 'Faidh El Botma'),
  ('17', 'Guernini', 'قرنيني', 'Ain Oussera'),
  ('17', 'Guettara', 'قطارة', 'Messaad'),
  ('17', 'Had Sahary', 'حد الصحاري', 'Had Sahary'),
  ('17', 'Hassi Bahbah', 'حاسي بحبح', 'Hassi Bahbah'),
  ('17', 'Hassi El Euch', 'حاسي العش', 'Hassi Bahbah'),
  ('17', 'Hassi Fedoul', 'حاسي فدول', 'Sidi Laadjel'),
  ('17', 'M''liliha', 'مليليحة', 'Dar Chioukh'),
  ('17', 'Messaad', 'مسعد', 'Messaad'),
  ('17', 'Moudjebara', 'مجبارة', 'Ain El Ibel'),
  ('17', 'Oum Laadham', 'أم العظام', 'Faidh El Botma'),
  ('17', 'Sed Rahal', 'سد الرحال', 'Messaad'),
  ('17', 'Selmana', 'سلمانة', 'Messaad'),
  ('17', 'Sidi Baizid', 'سيدي بايزيد', 'Dar Chioukh'),
  ('17', 'Sidi Laadjel', 'سيدي لعجال', 'Sidi Laadjel'),
  ('17', 'Taadmit', 'تعظميت', 'Ain El Ibel'),
  ('17', 'Zaafrane', 'زعفران', 'Hassi Bahbah'),
  ('17', 'Zaccar', 'زكار', 'Ain El Ibel')
on conflict (wilaya_code, name) do nothing;

-- 18 Jijel
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('18', 'Bordj T''har', 'برج الطهر', 'Chekfa'),
  ('18', 'Boudria Beniyadjis', 'بودريعة بني  ياجيس', 'Djimla'),
  ('18', 'Bouraoui Belhadef', 'بوراوي بلهادف', 'El Ancer'),
  ('18', 'Boussif Ouled Askeur', 'بوسيف أولاد عسكر', 'Taher'),
  ('18', 'Chahna', 'الشحنة', 'Taher'),
  ('18', 'Chekfa', 'الشقفة', 'Chekfa'),
  ('18', 'Djemaa Beni Habibi', 'الجمعة بني حبيبي', 'El Ancer'),
  ('18', 'Djimla', 'جيملة', 'Djimla'),
  ('18', 'El Ancer', 'العنصر', 'El Ancer'),
  ('18', 'El Aouana', 'العوانة', 'El Aouana'),
  ('18', 'El Kennar Nouchfi', 'القنار نشفي', 'Chekfa'),
  ('18', 'El Milia', 'الميلية', 'El Milia'),
  ('18', 'Emir Abdelkader', 'الامير عبد القادر', 'Taher'),
  ('18', 'Erraguene Souissi', 'أراقن سويسي', 'Ziamah Mansouriah'),
  ('18', 'Ghebala', 'غبالة', 'Settara'),
  ('18', 'Jijel', 'جيجل', 'Jijel'),
  ('18', 'Kaous', 'قاوس', 'Texenna'),
  ('18', 'Khiri Oued Adjoul', 'خيري واد عجول', 'El Ancer'),
  ('18', 'Oudjana', 'وجانة', 'Taher'),
  ('18', 'Ouled Rabah', 'أولاد رابح', 'Sidi Marouf'),
  ('18', 'Ouled Yahia Khadrouch', 'أولاد يحيى خدروش', 'El Milia'),
  ('18', 'Selma Benziada', 'سلمى بن زيادة', 'El Aouana'),
  ('18', 'Settara', 'السطارة', 'Settara'),
  ('18', 'Sidi Abdelaziz', 'سيدي عبد العزيز', 'Chekfa'),
  ('18', 'Sidi Marouf', 'سيدي معروف', 'Sidi Marouf'),
  ('18', 'Taher', 'الطاهير', 'Taher'),
  ('18', 'Texenna', 'تاكسنة', 'Texenna'),
  ('18', 'Ziama Mansouriah', 'زيامة منصورية', 'Ziamah Mansouriah')
on conflict (wilaya_code, name) do nothing;

-- 19 Sétif
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('19', 'Ain Abessa', 'عين عباسة', 'Ain Arnat'),
  ('19', 'Ain Arnat', 'عين أرنات', 'Ain Arnat'),
  ('19', 'Ain Azel', 'عين أزال', 'Ain Azel'),
  ('19', 'Ain El Kebira', 'عين الكبيرة', 'Ain El Kebira'),
  ('19', 'Ain Lahdjar', 'عين الحجر', 'Ain Azel'),
  ('19', 'Ain Oulmene', 'عين ولمان', 'Ain Oulmene'),
  ('19', 'Ain-Legradj', 'عين لقراج', 'Beni Ourtilane'),
  ('19', 'Ain-Roua', 'عين الروى', 'Bougaa'),
  ('19', 'Ain-Sebt', 'عين السبت', 'Beni Aziz'),
  ('19', 'Ait Naoual Mezada', 'أيت نوال مزادة', 'Bouandas'),
  ('19', 'Ait-Tizi', 'ايت تيزي', 'Bouandas'),
  ('19', 'Amoucha', 'عموشة', 'Amoucha'),
  ('19', 'Babor', 'بابور', 'Babor'),
  ('19', 'Bazer-Sakra', 'بازر سكرة', 'El Eulma'),
  ('19', 'Beidha Bordj', 'بيضاء برج', 'Ain Azel'),
  ('19', 'Bellaa', 'بلاعة', 'Bir El Arch'),
  ('19', 'Beni Chebana', 'بني شبانة', 'Beni Ourtilane'),
  ('19', 'Beni Fouda', 'بني فودة', 'Djemila'),
  ('19', 'Beni Ourtilane', 'بني ورتيلان', 'Beni Ourtilane'),
  ('19', 'Beni Oussine', 'بني وسين', 'Bougaa'),
  ('19', 'Beni-Aziz', 'بني عزيز', 'Beni Aziz'),
  ('19', 'Beni-Mouhli', 'بني موحلي', 'Beni Ourtilane'),
  ('19', 'Bir Haddada', 'بئر حدادة', 'Ain Azel'),
  ('19', 'Bir-El-Arch', 'بئر العرش', 'Bir El Arch'),
  ('19', 'Bouandas', 'بوعنداس', 'Bouandas'),
  ('19', 'Bougaa', 'بوقاعة', 'Bougaa'),
  ('19', 'Bousselam', 'بوسلام', 'Bouandas'),
  ('19', 'Boutaleb', 'بوطالب', 'Salah Bey'),
  ('19', 'Dehamcha', 'الدهامشة', 'Ain El Kebira'),
  ('19', 'Djemila', 'جميلة', 'Djemila'),
  ('19', 'Draa-Kebila', 'ذراع قبيلة', 'Hammam Guergour'),
  ('19', 'El Eulma', 'العلمة', 'El Eulma'),
  ('19', 'El Ouricia', 'أوريسيا', 'Ain Arnat'),
  ('19', 'El-Ouldja', 'الولجة', 'Bir El Arch'),
  ('19', 'Guellal', 'قلال', 'Ain Oulmene'),
  ('19', 'Guelta Zerka', 'قلتة زرقاء', 'El Eulma'),
  ('19', 'Guenzet', 'قنزات', 'Guenzet'),
  ('19', 'Guidjel', 'قجال', 'Guidjel'),
  ('19', 'Hamam Soukhna', 'حمام السخنة', 'Hammam Sokhna'),
  ('19', 'Hamma', 'الحامة', 'Salah Bey'),
  ('19', 'Hammam Guergour', 'حمام قرقور', 'Hammam Guergour'),
  ('19', 'Harbil', 'حربيل', 'Guenzet'),
  ('19', 'Kasr El Abtal', 'قصر الابطال', 'Ain Oulmene'),
  ('19', 'Maaouia', 'معاوية', 'Beni Aziz'),
  ('19', 'Maouaklane', 'ماوكلان', 'Maoklane'),
  ('19', 'Mezloug', 'مزلوق', 'Ain Arnat'),
  ('19', 'Oued El Bared', 'واد البارد', 'Amoucha'),
  ('19', 'Ouled Addouane', 'أولاد عدوان', 'Ain El Kebira'),
  ('19', 'Ouled Sabor', 'أولاد صابر', 'Guidjel'),
  ('19', 'Ouled Si Ahmed', 'أولاد سي أحمد', 'Ain Oulmene'),
  ('19', 'Ouled Tebben', 'أولاد تبان', 'Salah Bey'),
  ('19', 'Rosfa', 'الرصفة', 'Salah Bey'),
  ('19', 'Salah Bey', 'صالح باي', 'Salah Bey'),
  ('19', 'Serdj-El-Ghoul', 'سرج الغول', 'Babor'),
  ('19', 'Setif', 'سطيف', 'Setif'),
  ('19', 'Tachouda', 'تاشودة', 'Bir El Arch'),
  ('19', 'Tala-Ifacene', 'تالة إيفاسن', 'Maoklane'),
  ('19', 'Taya', 'الطاية', 'Hammam Sokhna'),
  ('19', 'Tella', 'التلة', 'Hammam Sokhna'),
  ('19', 'Tizi N''bechar', 'تيزي نبشار', 'Amoucha')
on conflict (wilaya_code, name) do nothing;

-- 20 Saïda
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('20', 'Ain El Hadjar', 'عين الحجر', 'Ain El Hadjar'),
  ('20', 'Ain Sekhouna', 'عين السخونة', 'El Hassasna'),
  ('20', 'Ain Soltane', 'عين السلطان', 'Ouled Brahim'),
  ('20', 'Doui Thabet', 'دوي ثابت', 'Youb'),
  ('20', 'El Hassasna', 'الحساسنة', 'El Hassasna'),
  ('20', 'Hounet', 'هونت', 'Sidi Boubekeur'),
  ('20', 'Maamora', 'المعمورة', 'El Hassasna'),
  ('20', 'Moulay Larbi', 'مولاي العربي', 'Ain El Hadjar'),
  ('20', 'Ouled Brahim', 'أولاد إبراهيم', 'Ouled Brahim'),
  ('20', 'Ouled Khaled', 'أولاد خالد', 'Sidi Boubekeur'),
  ('20', 'Saida', 'سعيدة', 'Saida'),
  ('20', 'Sidi Ahmed', 'سيدي احمد', 'Ain El Hadjar'),
  ('20', 'Sidi Amar', 'سيدي عمر', 'Sidi Boubekeur'),
  ('20', 'Sidi Boubekeur', 'سيدي بوبكر', 'Sidi Boubekeur'),
  ('20', 'Tircine', 'تيرسين', 'Ouled Brahim'),
  ('20', 'Youb', 'يوب', 'Youb')
on conflict (wilaya_code, name) do nothing;

-- 21 Skikda
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('21', 'Ain Bouziane', 'عين بوزيان', 'Sidi Mezghiche'),
  ('21', 'Ain Charchar', 'عين شرشار', 'Azzaba'),
  ('21', 'Ain Kechra', 'عين قشرة', 'Ain Kechra'),
  ('21', 'Ain Zouit', 'عين زويت', 'El Hadaiek'),
  ('21', 'Azzaba', 'عزابة', 'Azzaba'),
  ('21', 'Bekkouche Lakhdar', 'بكوش لخضر', 'Ben Azzouz'),
  ('21', 'Ben Azzouz', 'بن عزوز', 'Ben Azzouz'),
  ('21', 'Beni Bechir', 'بني بشير', 'Ramdane Djamel'),
  ('21', 'Beni Oulbane', 'بني ولبان', 'Sidi Mezghiche'),
  ('21', 'Beni Zid', 'بني زيد', 'Collo'),
  ('21', 'Bin El Ouiden', 'بين الويدان', 'Tamalous'),
  ('21', 'Bouchetata', 'بوشطاطة', 'El Hadaiek'),
  ('21', 'Cheraia', 'الشرايع', 'Collo'),
  ('21', 'Collo', 'القل', 'Collo'),
  ('21', 'Djendel Saadi Mohamed', 'جندل سعدي محمد', 'Azzaba'),
  ('21', 'El Arrouch', 'الحروش', 'El Harrouch'),
  ('21', 'El Ghedir', 'الغدير', 'Azzaba'),
  ('21', 'El Hadaiek', 'الحدائق', 'El Hadaiek'),
  ('21', 'El Marsa', 'المرسى', 'Ben Azzouz'),
  ('21', 'Emjez Edchich', 'مجاز الدشيش', 'El Harrouch'),
  ('21', 'Es Sebt', 'السبت', 'Azzaba'),
  ('21', 'Filfila', 'فلفلة', 'Skikda'),
  ('21', 'Hammadi Krouma', 'حمادي كرومة', 'Skikda'),
  ('21', 'Kanoua', 'قنواع', 'Zitouna'),
  ('21', 'Kerkara', 'الكركرة', 'Tamalous'),
  ('21', 'Khenag Maoune', 'خناق مايو', 'Ouled Attia'),
  ('21', 'Oued Zhour', 'وادي الزهور', 'Ouled Attia'),
  ('21', 'Ouldja Boulbalout', 'الولجة بولبلوط', 'Ain Kechra'),
  ('21', 'Ouled Attia', 'أولاد عطية', 'Ouled Attia'),
  ('21', 'Ouled Habbaba', 'أولاد حبابة', 'El Harrouch'),
  ('21', 'Oum Toub', 'أم الطوب', 'Oum Toub'),
  ('21', 'Ramdane Djamel', 'رمضان جمال', 'Ramdane Djamel'),
  ('21', 'Salah Bouchaour', 'صالح بو الشعور', 'El Harrouch'),
  ('21', 'Sidi Mezghiche', 'سيدي مزغيش', 'Sidi Mezghiche'),
  ('21', 'Skikda', 'سكيكدة', 'Skikda'),
  ('21', 'Tamalous', 'تمالوس', 'Tamalous'),
  ('21', 'Zerdezas', 'زردازة', 'El Harrouch'),
  ('21', 'Zitouna', 'الزيتونة', 'Zitouna')
on conflict (wilaya_code, name) do nothing;

-- 22 Sidi Bel Abbès
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('22', 'Ain El Berd', 'عين البرد', 'Ain El Berd'),
  ('22', 'Ain Kada', 'عين قادة', 'Sidi Ali Boussidi'),
  ('22', 'Ain Thrid', 'عين الثريد', 'Tessala'),
  ('22', 'Ain Tindamine', 'عين تندمين', 'Moulay Slissen'),
  ('22', 'Ain- Adden', 'عين أدن', 'Sfisef'),
  ('22', 'Amarnas', 'العمارنة', 'Sidi Lahcene'),
  ('22', 'Bedrabine El Mokrani', 'بضرابين المقراني', 'Ben Badis'),
  ('22', 'Belarbi', 'بلعربي', 'Mostefa  Ben Brahim'),
  ('22', 'Ben Badis', 'بن باديس', 'Ben Badis'),
  ('22', 'Benachiba Chelia', 'بن عشيبة شلية', 'Tenira'),
  ('22', 'Bir El Hammam', 'بئر الحمام', 'Marhoum'),
  ('22', 'Boudjebaa El Bordj', 'بوجبهة البرج', 'Sfisef'),
  ('22', 'Boukhanefis', 'بوخنفيس', 'Sidi Ali Ben Youb'),
  ('22', 'Chetouane Belaila', 'شيطوان البلايلة', 'Ben Badis'),
  ('22', 'Dhaya', 'الضاية', 'Telagh'),
  ('22', 'El Hacaiba', 'الحصيبة', 'Moulay Slissen'),
  ('22', 'Hassi Dahou', 'حاسي دحو', 'Tenira'),
  ('22', 'Hassi Zahana', 'حاسي زهانة', 'Ben Badis'),
  ('22', 'Lamtar', 'لمطار', 'Sidi Ali Boussidi'),
  ('22', 'M''cid', 'مسيد', 'Sfisef'),
  ('22', 'Makedra', 'مكدرة', 'Ain El Berd'),
  ('22', 'Marhoum', 'مرحوم', 'Marhoum'),
  ('22', 'Merine', 'مرين', 'Merine'),
  ('22', 'Mezaourou', 'مزاورو', 'Telagh'),
  ('22', 'Mostefa  Ben Brahim', 'مصطفى بن ابراهيم', 'Mostefa  Ben Brahim'),
  ('22', 'Moulay Slissen', 'مولاي سليسن', 'Moulay Slissen'),
  ('22', 'Oued Sebaa', 'وادي السبع', 'Ras El Ma'),
  ('22', 'Oued Sefioun', 'وادي سفيون', 'Tenira'),
  ('22', 'Oued Taourira', 'وادي تاوريرة', 'Merine'),
  ('22', 'Ras El Ma', 'راس الماء', 'Ras El Ma'),
  ('22', 'Redjem Demouche', 'رجم دموش', 'Ras El Ma'),
  ('22', 'Sehala Thaoura', 'السهالة الثورة', 'Tessala'),
  ('22', 'Sfisef', 'سفيزف', 'Sfisef'),
  ('22', 'Sidi Ali Benyoub', 'سيدي علي بن يوب', 'Sidi Ali Ben Youb'),
  ('22', 'Sidi Ali Boussidi', 'سيدي علي بوسيدي', 'Sidi Ali Boussidi'),
  ('22', 'Sidi Bel-Abbes', 'سيدي بلعباس', 'Sidi Bel Abbes'),
  ('22', 'Sidi Brahim', 'سيدي ابراهيم', 'Ain El Berd'),
  ('22', 'Sidi Chaib', 'سيدي شعيب', 'Marhoum'),
  ('22', 'Sidi Dahou Zairs', 'سيدي دحو الزاير', 'Sidi Ali Boussidi'),
  ('22', 'Sidi Hamadouche', 'سيدي حمادوش', 'Ain El Berd'),
  ('22', 'Sidi Khaled', 'سيدي خالد', 'Sidi Lahcene'),
  ('22', 'Sidi Lahcene', 'سيدي لحسن', 'Sidi Lahcene'),
  ('22', 'Sidi Yacoub', 'سيدي يعقوب', 'Sidi Lahcene'),
  ('22', 'Tabia', 'طابية', 'Sidi Ali Ben Youb'),
  ('22', 'Taoudmout', 'تاودموت', 'Merine'),
  ('22', 'Tefessour', 'تفسور', 'Merine'),
  ('22', 'Teghalimet', 'تغاليمت', 'Telagh'),
  ('22', 'Telagh', 'تلاغ', 'Telagh'),
  ('22', 'Tenira', 'تنيرة', 'Tenira'),
  ('22', 'Tessala', 'تسالة', 'Tessala'),
  ('22', 'Tilmouni', 'تلموني', 'Mostefa  Ben Brahim'),
  ('22', 'Zerouala', 'زروا��ة', 'Mostefa  Ben Brahim')
on conflict (wilaya_code, name) do nothing;

-- 23 Annaba
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('23', 'Ain El Berda', 'عين الباردة', 'Ain El Berda'),
  ('23', 'Annaba', 'عنابة', 'Annaba'),
  ('23', 'Berrahal', 'برحال', 'Berrahal'),
  ('23', 'Chetaibi', 'شطايبي', 'Chetaibi'),
  ('23', 'Cheurfa', 'الشرفة', 'Ain El Berda'),
  ('23', 'El Bouni', 'البوني', 'El Bouni'),
  ('23', 'El Eulma', 'العلمة', 'Ain El Berda'),
  ('23', 'El Hadjar', 'الحجار', 'El Hadjar'),
  ('23', 'Oued El Aneb', 'واد العنب', 'Berrahal'),
  ('23', 'Seraidi', 'سرايدي', 'Annaba'),
  ('23', 'Sidi Amar', 'سيدي عمار', 'El Hadjar'),
  ('23', 'Treat', 'التريعات', 'Berrahal')
on conflict (wilaya_code, name) do nothing;

-- 24 Guelma
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('24', 'Ain Ben Beida', 'عين بن بيضاء', 'Bouchegouf'),
  ('24', 'Ain Larbi', 'عين العربي', 'Ain Makhlouf'),
  ('24', 'Ain Makhlouf', 'عين مخلوف', 'Ain Makhlouf'),
  ('24', 'Ain Regada', 'عين رقادة', 'Oued Zenati'),
  ('24', 'Ain Sandel', 'عين صندل', 'Khezaras'),
  ('24', 'Belkheir', 'بلخير', 'Guelaat Bousbaa'),
  ('24', 'Bendjarah', 'بن جراح', 'Guelma'),
  ('24', 'Beni Mezline', 'بني مزلين', 'Guelaat Bousbaa'),
  ('24', 'Bordj Sabath', 'برج صباط', 'Oued Zenati'),
  ('24', 'Bou Hachana', 'بوحشانة', 'Khezaras'),
  ('24', 'Bou Hamdane', 'بوحمدان', 'Hammam Debagh'),
  ('24', 'Bouati Mahmoud', 'بوعاتي محمود', 'Heliopolis'),
  ('24', 'Bouchegouf', 'بوشقوف', 'Bouchegouf'),
  ('24', 'Boumahra Ahmed', 'بومهرة أحمد', 'Guelaat Bousbaa'),
  ('24', 'Dahouara', 'الدهوارة', 'Hammam N''bails'),
  ('24', 'Djeballah Khemissi', 'جبالة الخميسي', 'Guelaat Bousbaa'),
  ('24', 'El Fedjoudj', 'الفجوج', 'Heliopolis'),
  ('24', 'Guelaat Bou Sbaa', 'قلعة بوصبع', 'Guelaat Bousbaa'),
  ('24', 'Guelma', 'قالمة', 'Guelma'),
  ('24', 'Hammam Debagh', 'حمام دباغ', 'Hammam Debagh'),
  ('24', 'Hammam N''bail', 'حمام النبايل', 'Hammam N''bails'),
  ('24', 'Heliopolis', 'هيليوبوليس', 'Heliopolis'),
  ('24', 'Houari Boumedienne', 'هواري بومدين', 'Ain Hessainia'),
  ('24', 'Khezaras', 'لخزارة', 'Khezaras'),
  ('24', 'Medjez Amar', 'مجاز عمار', 'Ain Hessainia'),
  ('24', 'Medjez Sfa', 'مجاز الصفاء', 'Bouchegouf'),
  ('24', 'Nechmaya', 'نشماية', 'Guelaat Bousbaa'),
  ('24', 'Oued Cheham', 'وادي الشحم', 'Hammam N''bails'),
  ('24', 'Oued Ferragha', 'وادي فراغة', 'Bouchegouf'),
  ('24', 'Oued Zenati', 'وادي الزناتي', 'Oued Zenati'),
  ('24', 'Ras El Agba', 'رأس العقبة', 'Ain Hessainia'),
  ('24', 'Roknia', 'الركنية', 'Hammam Debagh'),
  ('24', 'Sellaoua Announa', 'سلاوة عنونة', 'Ain Hessainia'),
  ('24', 'Tamlouka', 'تاملوكة', 'Ain Makhlouf')
on conflict (wilaya_code, name) do nothing;

-- 25 Constantine
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('25', 'Ain Abid', 'عين عبيد', 'Ain Abid'),
  ('25', 'Ain Smara', 'عين السمارة', 'El Khroub'),
  ('25', 'Ben Badis', 'أبن باديس الهرية', 'Ain Abid'),
  ('25', 'Beni Hamidane', 'بني حميدان', 'Zighoud Youcef'),
  ('25', 'Constantine', 'قسنطينة', 'Constantine'),
  ('25', 'Didouche Mourad', 'ديدوش مراد', 'Hamma Bouziane'),
  ('25', 'El Khroub', 'الخروب', 'El Khroub'),
  ('25', 'Hamma Bouziane', 'حامة بوزيان', 'Hamma Bouziane'),
  ('25', 'Ibn Ziad', 'ابن زياد', 'Ibn Ziad'),
  ('25', 'Messaoud Boudjeriou', 'بوجريو مسعود', 'Ibn Ziad'),
  ('25', 'Ouled Rahmoun', 'أولاد رحمون', 'El Khroub'),
  ('25', 'Zighoud Youcef', 'زيغود يوسف', 'Zighoud Youcef')
on conflict (wilaya_code, name) do nothing;

-- 26 Médéa
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('26', 'Ain Boucif', 'عين بوسيف', 'Ain Boucif'),
  ('26', 'Ain Ouksir', 'عين اقصير', 'Chellalat El Adhaoura'),
  ('26', 'Aissaouia', 'العيساوية', 'Tablat'),
  ('26', 'Aziz', 'عزيز', 'Aziz'),
  ('26', 'Baata', 'بعطة', 'El Omaria'),
  ('26', 'Ben Chicao', 'بن شكاو', 'Ouzera'),
  ('26', 'Beni Slimane', 'بني سليمان', 'Beni Slimane'),
  ('26', 'Berrouaghia', 'البرواقية', 'Berrouaghia'),
  ('26', 'Bir Ben Laabed', 'بئر بن عابد', 'Guelb El Kebir'),
  ('26', 'Boghar', 'بوغار', 'Ouled Antar'),
  ('26', 'Bouaiche', 'بوعيش', 'Chahbounia'),
  ('26', 'Bouaichoune', 'بوعيشون', 'Si Mahdjoub'),
  ('26', 'Bouchrahil', 'بوشراحيل', 'Sidi Naamane'),
  ('26', 'Boughzoul', 'بوغزول', 'Chahbounia'),
  ('26', 'Bouskene', 'بوسكن', 'Beni Slimane'),
  ('26', 'Chabounia', 'الشهبونية', 'Chahbounia'),
  ('26', 'Chelalet El Adhaoura', 'شلالة العذاورة', 'Chellalat El Adhaoura'),
  ('26', 'Cheniguel', 'شنيقل', 'Chellalat El Adhaoura'),
  ('26', 'Derrag', 'دراق', 'Aziz'),
  ('26', 'Djouab', 'جواب', 'Souaghi'),
  ('26', 'Draa Esmar', 'ذراع السمار', 'Medea'),
  ('26', 'El Azizia', 'العزيزية', 'El Azizia'),
  ('26', 'El Guelbelkebir', 'القلب الكبير', 'Guelb El Kebir'),
  ('26', 'El Hamdania', 'الحمدانية', 'Ouzera'),
  ('26', 'El Haoudane', 'الحوضان', 'Tablat'),
  ('26', 'El Omaria', 'العمارية', 'El Omaria'),
  ('26', 'El Ouinet', 'العوينات', 'Ain Boucif'),
  ('26', 'Hannacha', 'حناشة', 'Ouamri'),
  ('26', 'Kef Lakhdar', 'الكاف الاخضر', 'Ain Boucif'),
  ('26', 'Khams Djouamaa', 'خمس جوامع', 'Sidi Naamane'),
  ('26', 'Ksar El Boukhari', 'قصر البخاري', 'Ksar El Boukhari'),
  ('26', 'M''fatha', 'مفاتحة', 'Ksar El Boukhari'),
  ('26', 'Maghraoua', 'مغراوة', 'El Azizia'),
  ('26', 'Medea', 'المدية', 'Medea'),
  ('26', 'Medjebar', 'مجبر', 'Seghouane'),
  ('26', 'Mezerana', 'مزغنة', 'Tablat'),
  ('26', 'Mihoub', 'ميهوب', 'El Azizia'),
  ('26', 'Ouamri', 'عوامري', 'Ouamri'),
  ('26', 'Oued Harbil', 'وادي حربيل', 'Ouamri'),
  ('26', 'Ouled Antar', 'أولاد عنتر', 'Ouled Antar'),
  ('26', 'Ouled Bouachra', 'أولاد بوعشرة', 'Si Mahdjoub'),
  ('26', 'Ouled Brahim', 'أولاد إبراهيم', 'El Omaria'),
  ('26', 'Ouled Deid', 'أولاد دايد', 'Berrouaghia'),
  ('26', 'Ouled Emaaraf', 'أولاد امعرف', 'Ain Boucif'),
  ('26', 'Ouled Hellal', 'أولاد هلال', 'Ouled Antar'),
  ('26', 'Oum El Djellil', 'أم الجليل', 'Aziz'),
  ('26', 'Ouzera', 'وزرة', 'Ouzera'),
  ('26', 'Rebaia', 'الربعية', 'Berrouaghia'),
  ('26', 'Saneg', 'السانق', 'Ksar El Boukhari'),
  ('26', 'Sedraya', 'سدراية', 'Guelb El Kebir'),
  ('26', 'Seghouane', 'سغوان', 'Seghouane'),
  ('26', 'Si Mahdjoub', 'سي المحجوب', 'Si Mahdjoub'),
  ('26', 'Sidi Demed', 'سيدي دامد', 'Ain Boucif'),
  ('26', 'Sidi Naamane', 'سيدي نعمان', 'Sidi Naamane'),
  ('26', 'Sidi Rabie', 'سيدي الربيع', 'Beni Slimane'),
  ('26', 'Sidi Zahar', 'سيدي زهار', 'Souaghi'),
  ('26', 'Sidi Ziane', 'سيدي زيان', 'Souaghi'),
  ('26', 'Souagui', 'السواقي', 'Souaghi'),
  ('26', 'Tablat', 'تابلاط', 'Tablat'),
  ('26', 'Tafraout', 'تفراوت', 'Chellalat El Adhaoura'),
  ('26', 'Tamesguida', 'تمسقيدة', 'Medea'),
  ('26', 'Tizi Mahdi', 'تيزي مهدي', 'Ouzera'),
  ('26', 'Tletat Ed Douair', 'ثلاث دوائر', 'Seghouane'),
  ('26', 'Zoubiria', 'الزبيرية', 'Seghouane')
on conflict (wilaya_code, name) do nothing;

-- 27 Mostaganem
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('27', 'Achaacha', 'عشعاشة', 'Achaacha'),
  ('27', 'Ain-Boudinar', 'عين بودينار', 'Kheir Eddine'),
  ('27', 'Ain-Nouissy', 'عين نويسي', 'Ain Nouicy'),
  ('27', 'Ain-Sidi Cherif', 'عين سيدي الشريف', 'Mesra'),
  ('27', 'Ain-Tedles', 'عين تادلس', 'Ain Tedeles'),
  ('27', 'Benabdelmalek Ramdane', 'بن عبد المالك رمضان', 'Sidi Lakhdar'),
  ('27', 'Bouguirat', 'بوقيراط', 'Bouguirat'),
  ('27', 'Fornaka', 'فرناقة', 'Ain Nouicy'),
  ('27', 'Hadjadj', 'حجاج', 'Sidi Lakhdar'),
  ('27', 'Hassi Mameche', 'حاسي ماماش', 'Hassi Mameche'),
  ('27', 'Hassiane', 'الحسيان (بني ياحي', 'Ain Nouicy'),
  ('27', 'Khadra', 'خضرة', 'Achaacha'),
  ('27', 'Kheir-Eddine', 'خير الدين', 'Kheir Eddine'),
  ('27', 'Mansourah', 'منصورة', 'Mesra'),
  ('27', 'Mazagran', 'مزغران', 'Hassi Mameche'),
  ('27', 'Mesra', 'ماسرة', 'Mesra'),
  ('27', 'Mostaganem', 'مستغانم', 'Mostaganem'),
  ('27', 'Nekmaria', 'نكمارية', 'Achaacha'),
  ('27', 'Oued El Kheir', 'وادي الخير', 'Ain Tedeles'),
  ('27', 'Ouled Boughalem', 'أولاد بوغالم', 'Achaacha'),
  ('27', 'Ouled-Maalah', 'أولاد مع الله', 'Sidi Ali'),
  ('27', 'Safsaf', 'صفصاف', 'Bouguirat'),
  ('27', 'Sayada', 'صيادة', 'Kheir Eddine'),
  ('27', 'Sidi Ali', 'سيدي علي', 'Sidi Ali'),
  ('27', 'Sidi Belaattar', 'سيدي بلعطار', 'Ain Tedeles'),
  ('27', 'Sidi-Lakhdar', 'سيدي لخضر', 'Sidi Lakhdar'),
  ('27', 'Sirat', 'سيرات', 'Bouguirat'),
  ('27', 'Souaflia', 'السوافلية', 'Bouguirat'),
  ('27', 'Sour', 'سور', 'Ain Tedeles'),
  ('27', 'Stidia', 'ستيدية', 'Hassi Mameche'),
  ('27', 'Tazgait', 'تزقايت', 'Sidi Ali'),
  ('27', 'Touahria', 'الطواهرية', 'Mesra')
on conflict (wilaya_code, name) do nothing;

-- 28 M'Sila
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('28', 'Ain El Hadjel', 'عين الحجل', 'Ain El Hadjel'),
  ('28', 'Ain El Melh', 'عين الملح', 'Ain El Melh'),
  ('28', 'Ain Fares', 'عين فارس', 'Ain El Melh'),
  ('28', 'Ain Khadra', 'عين الخضراء', 'Magra'),
  ('28', 'Ain Rich', 'عين الريش', 'Ain El Melh'),
  ('28', 'Belaiba', 'بلعايبة', 'Magra'),
  ('28', 'Ben Srour', 'بن سرور', 'Ben Srour'),
  ('28', 'Beni Ilmane', 'بني يلمان', 'Sidi Aissa'),
  ('28', 'Benzouh', 'بن زوه', 'Ouled Sidi Brahim'),
  ('28', 'Berhoum', 'برهوم', 'Magra'),
  ('28', 'Bir Foda', 'بئر فضة', 'Ain El Melh'),
  ('28', 'Bou Saada', 'بوسعادة', 'Bousaada'),
  ('28', 'Bouti Sayeh', 'بوطي السايح', 'Sidi Aissa'),
  ('28', 'Chellal', 'شلال', 'Chellal'),
  ('28', 'Dehahna', 'دهاهنة', 'Magra'),
  ('28', 'Djebel Messaad', 'جبل مساعد', 'Djebel Messaad'),
  ('28', 'El Hamel', 'الهامل', 'Bousaada'),
  ('28', 'El Houamed', 'الحوامد', 'Khoubana'),
  ('28', 'Hammam Dalaa', 'حمام الضلعة', 'Hammam Dalaa'),
  ('28', 'Khettouti Sed-El-Jir', 'خطوطي سد الجير', 'Chellal'),
  ('28', 'Khoubana', 'خبانة', 'Khoubana'),
  ('28', 'M''cif', 'مسيف', 'Khoubana'),
  ('28', 'M''sila', 'المسيلة', 'M''sila'),
  ('28', 'M''tarfa', 'المطارفة', 'Ouled Derradj'),
  ('28', 'Maadid', 'المعاضيد', 'Ouled Derradj'),
  ('28', 'Maarif', 'معاريف', 'Chellal'),
  ('28', 'Magra', 'مقرة', 'Magra'),
  ('28', 'Medjedel', 'امجدل', 'Medjedel'),
  ('28', 'Menaa', 'مناعة', 'Medjedel'),
  ('28', 'Mohamed Boudiaf', 'محمد بوضياف', 'Ben Srour'),
  ('28', 'Ouanougha', 'ونوغة', 'Hammam Dalaa'),
  ('28', 'Ouled Addi Guebala', 'أولاد عدي لقبالة', 'Ouled Derradj'),
  ('28', 'Ouled Derradj', 'أولاد دراج', 'Ouled Derradj'),
  ('28', 'Ouled Madhi', 'أولاد ماضي', 'Chellal'),
  ('28', 'Ouled Mansour', 'أولاد منصور', 'Hammam Dalaa'),
  ('28', 'Ouled Sidi Brahim', 'أولاد سيدي ابراهيم', 'Ouled Sidi Brahim'),
  ('28', 'Ouled Slimane', 'أولاد سليمان', 'Ben Srour'),
  ('28', 'Oulteme', 'ولتام', 'Bousaada'),
  ('28', 'Sidi Aissa', 'سيدي عيسى', 'Sidi Aissa'),
  ('28', 'Sidi Ameur', 'سيدي عامر', 'Sidi Ameur'),
  ('28', 'Sidi Hadjeres', 'سيدي هجرس', 'Ain El Hadjel'),
  ('28', 'Sidi M''hamed', 'سيدي امحمد', 'Ain El Melh'),
  ('28', 'Slim', 'سليم', 'Djebel Messaad'),
  ('28', 'Souamaa', 'السوامع', 'Ouled Derradj'),
  ('28', 'Tamsa', 'تامسة', 'Sidi Ameur'),
  ('28', 'Tarmount', 'تارمونت', 'Hammam Dalaa'),
  ('28', 'Zarzour', 'زرزور', 'Ben Srour')
on conflict (wilaya_code, name) do nothing;

-- 29 Mascara
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('29', 'Ain Fares', 'عين فارس', 'Ain Fares'),
  ('29', 'Ain Fekan', 'عين فكان', 'Ain Fekan'),
  ('29', 'Ain Ferah', 'عين فراح', 'Oued El Abtal'),
  ('29', 'Ain Frass', 'عين أفرص', 'Ain Fekan'),
  ('29', 'Alaimia', 'العلايمية', 'Oggaz'),
  ('29', 'Aouf', 'عوف', 'Aouf'),
  ('29', 'Benian', 'بنيان', 'Aouf'),
  ('29', 'Bou Henni', 'بوهني', 'Sig'),
  ('29', 'Bouhanifia', 'بوحنيفية', 'Bouhanifia'),
  ('29', 'Chorfa', 'الشرفاء', 'Sig'),
  ('29', 'El Bordj', 'البرج', 'El Bordj'),
  ('29', 'El Gaada', 'القعدة', 'Zahana'),
  ('29', 'El Ghomri', 'الغمري', 'Mohammadia'),
  ('29', 'El Gueitena', 'القطنة', 'Bouhanifia'),
  ('29', 'El Hachem', 'الحشم', 'Hachem'),
  ('29', 'El Keurt', 'القرط', 'Tizi'),
  ('29', 'El Mamounia', 'المأمونية', 'Ain Fares'),
  ('29', 'El Menaouer', 'المنور', 'El Bordj'),
  ('29', 'Ferraguig', 'فراقيق', 'Mohammadia'),
  ('29', 'Froha', 'فروحة', 'Tizi'),
  ('29', 'Gharrous', 'غروس', 'Aouf'),
  ('29', 'Ghriss', 'غريس', 'Ghriss'),
  ('29', 'Guerdjoum', 'قرجوم', 'Oued Taria'),
  ('29', 'Hacine', 'حسين', 'Bouhanifia'),
  ('29', 'Khalouia', 'خلوية', 'El Bordj'),
  ('29', 'Makhda', 'ماقضة', 'Ghriss'),
  ('29', 'Maoussa', 'ماوسة', 'Ghriss'),
  ('29', 'Mascara', 'معسكر', 'Mascara'),
  ('29', 'Matemore', 'المطمور', 'Ghriss'),
  ('29', 'Mocta-Douz', 'مقطع الدوز', 'Mohammadia'),
  ('29', 'Mohammadia', 'المحمدية', 'Mohammadia'),
  ('29', 'Nesmot', 'نسمط', 'Hachem'),
  ('29', 'Oggaz', 'عقاز', 'Oggaz'),
  ('29', 'Oued El Abtal', 'وادي الأبطال', 'Oued El Abtal'),
  ('29', 'Oued Taria', 'وادي التاغية', 'Oued Taria'),
  ('29', 'Ras El Ain Amirouche', 'رأس عين عميروش', 'Oggaz'),
  ('29', 'Sedjerara', 'سجرارة', 'Mohammadia'),
  ('29', 'Sehailia', 'السهايلية', 'Tighennif'),
  ('29', 'Sidi Abdeldjebar', 'سيدي عبد الجبار', 'Oued El Abtal'),
  ('29', 'Sidi Abdelmoumene', 'سيدي عبد المومن', 'Mohammadia'),
  ('29', 'Sidi Boussaid', 'سيدي بوسعيد', 'Ghriss'),
  ('29', 'Sidi Kada', 'سيدي قادة', 'Tighennif'),
  ('29', 'Sig', 'سيق', 'Sig'),
  ('29', 'Tighennif', 'تيغنيف', 'Tighennif'),
  ('29', 'Tizi', 'تيزي', 'Tizi'),
  ('29', 'Zahana', 'زهانة', 'Zahana'),
  ('29', 'Zelamta', 'زلامطة', 'Hachem')
on conflict (wilaya_code, name) do nothing;

-- 30 Ouargla
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('30', 'Ain Beida', 'عين البيضاء', 'Sidi Khouiled'),
  ('30', 'El Borma', 'البرمة', 'El Borma'),
  ('30', 'Hassi Ben Abdellah', 'حاسي بن عبد الله', 'Sidi Khouiled'),
  ('30', 'Hassi Messaoud', 'حاسي مسعود', 'Hassi Messaoud'),
  ('30', 'N''goussa', 'انقوسة', 'N''goussa'),
  ('30', 'Ouargla', 'ورقلة', 'Ouargla'),
  ('30', 'Rouissat', 'الرويسات', 'Ouargla'),
  ('30', 'Sidi Khouiled', 'سيدي خويلد', 'Sidi Khouiled')
on conflict (wilaya_code, name) do nothing;

-- 31 Oran
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('31', 'Ain Biya', 'عين البية', 'Bethioua'),
  ('31', 'Ain Kerma', 'عين الكرمة', 'Boutlelis'),
  ('31', 'Ain Turk', 'عين الترك', 'Ain Turk'),
  ('31', 'Arzew', 'أرزيو', 'Arzew'),
  ('31', 'Ben Freha', 'بن فريحة', 'Gdyel'),
  ('31', 'Bethioua', 'بطيوة', 'Bethioua'),
  ('31', 'Bir El Djir', 'بئر الجير', 'Bir El Djir'),
  ('31', 'Boufatis', 'بوفاتيس', 'Oued Tlelat'),
  ('31', 'Bousfer', 'بوسفر', 'Ain Turk'),
  ('31', 'Boutlelis', 'بوتليليس', 'Boutlelis'),
  ('31', 'El Ancor', 'العنصر', 'Ain Turk'),
  ('31', 'El Braya', 'البراية', 'Oued Tlelat'),
  ('31', 'El Kerma', 'الكرمة', 'Es Senia'),
  ('31', 'Es Senia', 'السانية', 'Es Senia'),
  ('31', 'Gdyel', 'قديل', 'Gdyel'),
  ('31', 'Hassi Ben Okba', 'حاسي بن عقبة', 'Bir El Djir'),
  ('31', 'Hassi Bounif', 'حاسي بونيف', 'Bir El Djir'),
  ('31', 'Hassi Mefsoukh', 'حاسي مفسوخ', 'Gdyel'),
  ('31', 'Marsat El Hadjadj', 'مرسى الحجاج', 'Bethioua'),
  ('31', 'Mers El Kebir', 'المرسى الكبير', 'Ain Turk'),
  ('31', 'Messerghin', 'مسرغين', 'Boutlelis'),
  ('31', 'Oran', 'وهران', 'Oran'),
  ('31', 'Oued Tlelat', 'وادي تليلات', 'Oued Tlelat'),
  ('31', 'Sidi Ben Yebka', 'سيدي بن يبقى', 'Arzew'),
  ('31', 'Sidi Chami', 'سيدي الشحمي', 'Es Senia'),
  ('31', 'Tafraoui', 'طفراوي', 'Oued Tlelat')
on conflict (wilaya_code, name) do nothing;

-- 32 El Bayadh
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('32', 'Ain El Orak', 'عين العراك', 'Labiodh Sidi Cheikh'),
  ('32', 'Arbaouat', 'اربوات', 'Labiodh Sidi Cheikh'),
  ('32', 'Boualem', 'بوعلام', 'Boualem'),
  ('32', 'Bougtoub', 'بوقطب', 'Bougtoub'),
  ('32', 'Boussemghoun', 'بوسمغون', 'Boussemghoun'),
  ('32', 'Brezina', 'بريزينة', 'Brezina'),
  ('32', 'Cheguig', 'الشقيق', 'Rogassa'),
  ('32', 'Chellala', 'شلالة', 'Chellala'),
  ('32', 'El Bayadh', 'البيض', 'El Bayadh'),
  ('32', 'El Bnoud', 'البنود', 'Labiodh Sidi Cheikh'),
  ('32', 'El Kheiter', 'الخيثر', 'Bougtoub'),
  ('32', 'El Mehara', 'المحرة', 'Chellala'),
  ('32', 'Ghassoul', 'الغاسول', 'Brezina'),
  ('32', 'Kef El Ahmar', 'الكاف الأحمر', 'Rogassa'),
  ('32', 'Krakda', 'كراكدة', 'Brezina'),
  ('32', 'Labiodh Sidi Cheikh', 'الأبيض سيدي الشيخ', 'Labiodh Sidi Cheikh'),
  ('32', 'Rogassa', 'رقاصة', 'Rogassa'),
  ('32', 'Sidi Ameur', 'سيدي عامر', 'Boualem'),
  ('32', 'Sidi Slimane', 'سيدي سليمان', 'Boualem'),
  ('32', 'Sidi Tiffour', 'سيدي طيفور', 'Boualem'),
  ('32', 'Stitten', 'ستيتن', 'Boualem'),
  ('32', 'Tousmouline', 'توسمولين', 'Bougtoub')
on conflict (wilaya_code, name) do nothing;

-- 33 Illizi
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('33', 'Bordj Omar Driss', 'برج عمر إدريس', 'In Amenas'),
  ('33', 'Debdeb', 'دبداب', 'In Amenas'),
  ('33', 'Illizi', 'إيليزي', 'Illizi'),
  ('33', 'In Amenas', 'إن أمناس', 'In Amenas')
on conflict (wilaya_code, name) do nothing;

-- 34 Bordj Bou Arreridj
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('34', 'Ain Taghrout', 'عين تاغروت', 'Ain Taghrout'),
  ('34', 'Ain Tesra', 'عين تسرة', 'Ras El Oued'),
  ('34', 'B. B. Arreridj', 'برج بوعريرج', 'Bordj Bou Arreridj'),
  ('34', 'Belimour', 'بليمور', 'Bordj Ghedir'),
  ('34', 'Ben Daoud', 'بن داود', 'Mansourah'),
  ('34', 'Bir Kasdali', 'بئر قاصد علي', 'Bir Kasdali'),
  ('34', 'Bordj Ghedir', 'برج الغدير', 'Bordj Ghedir'),
  ('34', 'Bordj Zemmoura', 'برج زمورة', 'Bordj Zemmoura'),
  ('34', 'Colla', 'القلة', 'Djaafra'),
  ('34', 'Djaafra', 'جعافرة', 'Djaafra'),
  ('34', 'El Achir', 'الياشير', 'Medjana'),
  ('34', 'El Annasseur', 'العناصر', 'Bordj Ghedir'),
  ('34', 'El Euch', 'العش', 'El Hamadia'),
  ('34', 'El M''hir', 'المهير', 'Mansourah'),
  ('34', 'El Main', 'الماين', 'Djaafra'),
  ('34', 'Elhammadia', 'الحمادية', 'El Hamadia'),
  ('34', 'Ghailasa', 'غيلاسة', 'Bordj Ghedir'),
  ('34', 'Haraza', 'حرازة', 'Mansourah'),
  ('34', 'Hasnaoua', 'حسناوة', 'Medjana'),
  ('34', 'Khelil', 'خليل', 'Bir Kasdali'),
  ('34', 'Ksour', 'القصور', 'El Hamadia'),
  ('34', 'Mansoura', 'المنصورة', 'Mansourah'),
  ('34', 'Medjana', 'مجانة', 'Medjana'),
  ('34', 'Ouled Brahem', 'أولاد أبراهم', 'Ras El Oued'),
  ('34', 'Ouled Dahmane', 'أولاد دحمان', 'Bordj Zemmoura'),
  ('34', 'Ouled Sidi-Brahim', 'أولاد سيدي ابراهيم', 'Mansourah'),
  ('34', 'Rabta', 'الرابطة', 'El Hamadia'),
  ('34', 'Ras El Oued', 'رأس الوادي', 'Ras El Oued'),
  ('34', 'Sidi-Embarek', 'سيدي أمبارك', 'Bir Kasdali'),
  ('34', 'Taglait', 'تقلعيت', 'Bordj Ghedir'),
  ('34', 'Tassamert', 'تسامرت', 'Bordj Zemmoura'),
  ('34', 'Tefreg', 'تفرق', 'Djaafra'),
  ('34', 'Teniet En Nasr', 'ثنية النصر', 'Medjana'),
  ('34', 'Tixter', 'تيكستار', 'Ain Taghrout')
on conflict (wilaya_code, name) do nothing;

-- 35 Boumerdès
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('35', 'Afir', 'أعفير', 'Dellys'),
  ('35', 'Ammal', 'عمال', 'Thenia'),
  ('35', 'Baghlia', 'بغلية', 'Baghlia'),
  ('35', 'Ben Choud', 'بن شود', 'Dellys'),
  ('35', 'Beni Amrane', 'بني عمران', 'Thenia'),
  ('35', 'Bordj Menaiel', 'برج منايل', 'Bordj Menaiel'),
  ('35', 'Boudouaou', 'بودواو', 'Boudouaou'),
  ('35', 'Boudouaou El Bahri', 'بودواو البحري', 'Boudouaou'),
  ('35', 'Boumerdes', 'بومرداس', 'Boumerdes'),
  ('35', 'Bouzegza Keddara', 'بوزقزة قدارة', 'Boudouaou'),
  ('35', 'Chabet El Ameur', 'شعبة العامر', 'Isser'),
  ('35', 'Corso', 'قورصو', 'Boumerdes'),
  ('35', 'Dellys', 'دلس', 'Dellys'),
  ('35', 'Djinet', 'جنات', 'Bordj Menaiel'),
  ('35', 'El Kharrouba', 'الخروبة', 'Boudouaou'),
  ('35', 'Hammedi', 'حمادي', 'Khemis El Khechna'),
  ('35', 'Isser', 'يسر', 'Isser'),
  ('35', 'Khemis El Khechna', 'خميس الخشنة', 'Khemis El Khechna'),
  ('35', 'Larbatache', 'الاربعطاش', 'Khemis El Khechna'),
  ('35', 'Leghata', 'لقاطة', 'Bordj Menaiel'),
  ('35', 'Naciria', 'الناصرية', 'Naciria'),
  ('35', 'Ouled Aissa', 'أولاد عيسى', 'Naciria'),
  ('35', 'Ouled Hedadj', 'أولاد هداج', 'Boudouaou'),
  ('35', 'Ouled Moussa', 'أولاد موسى', 'Khemis El Khechna'),
  ('35', 'Si Mustapha', 'سي مصطفى', 'Isser'),
  ('35', 'Sidi Daoud', 'سيدي داود', 'Baghlia'),
  ('35', 'Souk El Had', 'سوق الحد', 'Thenia'),
  ('35', 'Taourga', 'تاورقة', 'Baghlia'),
  ('35', 'Thenia', 'الثنية', 'Thenia'),
  ('35', 'Tidjelabine', 'تيجلابين', 'Boumerdes'),
  ('35', 'Timezrit', 'تيمزريت', 'Isser'),
  ('35', 'Zemmouri', 'زموري', 'Bordj Menaiel')
on conflict (wilaya_code, name) do nothing;

-- 36 El Tarf
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('36', 'Ain El Assel', 'عين العسل', 'El Tarf'),
  ('36', 'Ain Kerma', 'عين الكرمة', 'Bouhadjar'),
  ('36', 'Asfour', 'عصفور', 'Besbes'),
  ('36', 'Ben M Hidi', 'بن مهيدي', 'Ben M''hidi'),
  ('36', 'Berrihane', 'بريحان', 'Ben M''hidi'),
  ('36', 'Besbes', 'البسباس', 'Besbes'),
  ('36', 'Bougous', 'بوقوس', 'El Tarf'),
  ('36', 'Bouhadjar', 'بوحجار', 'Bouhadjar'),
  ('36', 'Bouteldja', 'بوثلجة', 'Bouteldja'),
  ('36', 'Chebaita Mokhtar', 'شبيطة مختار', 'Drean'),
  ('36', 'Chefia', 'الشافية', 'Bouteldja'),
  ('36', 'Chihani', 'شحاني', 'Drean'),
  ('36', 'Drean', 'الذرعـان', 'Drean'),
  ('36', 'Echatt', 'الشط', 'Ben M''hidi'),
  ('36', 'El Aioun', 'العيون', 'El Kala'),
  ('36', 'El Kala', 'القالة', 'El Kala'),
  ('36', 'El Tarf', 'الطارف', 'El Tarf'),
  ('36', 'Hammam Beni Salah', 'حمام بني صالح', 'Bouhadjar'),
  ('36', 'Lac Des Oiseaux', 'بحيرة الطيور', 'Bouteldja'),
  ('36', 'Oued Zitoun', 'وادي الزيتون', 'Bouhadjar'),
  ('36', 'Raml Souk', 'رمل السوق', 'El Kala'),
  ('36', 'Souarekh', 'السوارخ', 'El Kala'),
  ('36', 'Zerizer', 'زريزر', 'Besbes'),
  ('36', 'Zitouna', 'الزيتونة', 'El Tarf')
on conflict (wilaya_code, name) do nothing;

-- 37 Tindouf
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('37', 'Oum El Assel', 'أم العسل', 'Tindouf'),
  ('37', 'Tindouf', 'تندوف', 'Tindouf')
on conflict (wilaya_code, name) do nothing;

-- 38 Tissemsilt
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('38', 'Ammari', 'عماري', 'Ammari'),
  ('38', 'Beni Chaib', 'بني شعيب', 'Bordj Bounaama'),
  ('38', 'Beni Lahcene', 'بني لحسن', 'Bordj Bounaama'),
  ('38', 'Bordj Bounaama', 'برج بونعامة', 'Bordj Bounaama'),
  ('38', 'Bordj El Emir Abdelkader', 'برج الأمير عبد القادر', 'Bordj Emir Abdelkader'),
  ('38', 'Boucaid', 'بوقائد', 'Lazharia'),
  ('38', 'Khemisti', 'خميستي', 'Khemisti'),
  ('38', 'Larbaa', 'الأربعاء', 'Lazharia'),
  ('38', 'Lardjem', 'لرجام', 'Lardjem'),
  ('38', 'Layoune', 'العيون', 'Khemisti'),
  ('38', 'Lazharia', 'الأزهرية', 'Lazharia'),
  ('38', 'Maacem', 'المعاصم', 'Ammari'),
  ('38', 'Melaab', 'الملعب', 'Lardjem'),
  ('38', 'Ouled Bessam', 'أولاد بسام', 'Tissemsilt'),
  ('38', 'Sidi Abed', 'سيدي عابد', 'Ammari'),
  ('38', 'Sidi Boutouchent', 'سيدي بوتوشنت', 'Theniet El Had'),
  ('38', 'Sidi Lantri', 'سيدي العنتري', 'Lardjem'),
  ('38', 'Sidi Slimane', 'سيدي سليمان', 'Bordj Bounaama'),
  ('38', 'Tamellahet', 'تملاحت', 'Lardjem'),
  ('38', 'Theniet El Had', 'ثنية الاحد', 'Theniet El Had'),
  ('38', 'Tissemsilt', 'تيسمسيلت', 'Tissemsilt'),
  ('38', 'Youssoufia', 'اليوسفية', 'Bordj Emir Abdelkader')
on conflict (wilaya_code, name) do nothing;

-- 39 El Oued
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('39', 'Bayadha', 'البياضة', 'Bayadha'),
  ('39', 'Ben Guecha', 'بن  قشة', 'Taleb Larbi'),
  ('39', 'Debila', 'الدبيلة', 'Debila'),
  ('39', 'Douar El Maa', 'دوار الماء', 'Taleb Larbi'),
  ('39', 'El Ogla', 'العقلة', 'Robbah'),
  ('39', 'El-Oued', 'الوادي', 'El Oued'),
  ('39', 'Guemar', 'قمار', 'Guemar'),
  ('39', 'Hamraia', 'الحمراية', 'Reguiba'),
  ('39', 'Hassani Abdelkrim', 'حساني عبد الكريم', 'Debila'),
  ('39', 'Hassi Khalifa', 'حاسي خليفة', 'Hassi Khalifa'),
  ('39', 'Kouinine', 'كوينين', 'El Oued'),
  ('39', 'Magrane', 'المقرن', 'Magrane'),
  ('39', 'Mih Ouansa', 'اميه وانسة', 'Mih Ouensa'),
  ('39', 'Nakhla', 'النخلة', 'Robbah'),
  ('39', 'Oued El Alenda', 'وادي العلندة', 'Mih Ouensa'),
  ('39', 'Ourmes', 'ورماس', 'Guemar'),
  ('39', 'Reguiba', 'الرقيبة', 'Reguiba'),
  ('39', 'Robbah', 'الرباح', 'Robbah'),
  ('39', 'Sidi Aoun', 'سيدي عون', 'Magrane'),
  ('39', 'Taghzout', 'تغزوت', 'Guemar'),
  ('39', 'Taleb Larbi', 'الطالب العربي', 'Taleb Larbi'),
  ('39', 'Trifaoui', 'الطريفاوي', 'Hassi Khalifa')
on conflict (wilaya_code, name) do nothing;

-- 40 Khenchela
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('40', 'Ain Touila', 'عين الطويلة', 'Ain Touila'),
  ('40', 'Babar', 'بابار', 'Babar'),
  ('40', 'Baghai', 'بغاي', 'El Hamma'),
  ('40', 'Bouhmama', 'بوحمامة', 'Bouhmama'),
  ('40', 'Chechar', 'ششار', 'Chechar'),
  ('40', 'Chelia', 'شلية', 'Bouhmama'),
  ('40', 'Djellal', 'جلال', 'Chechar'),
  ('40', 'El Hamma', 'الحامة', 'El Hamma'),
  ('40', 'El Mahmal', 'المحمل', 'Ouled Rechache'),
  ('40', 'El Oueldja', 'الولجة', 'Chechar'),
  ('40', 'Ensigha', 'انسيغة', 'El Hamma'),
  ('40', 'Kais', 'قايس', 'Kais'),
  ('40', 'Khenchela', 'خنشلة', 'Khenchela'),
  ('40', 'Khirane', 'خيران', 'Chechar'),
  ('40', 'M''sara', 'مصارة', 'Bouhmama'),
  ('40', 'M''toussa', 'متوسة', 'Ain Touila'),
  ('40', 'Ouled Rechache', 'أولاد رشاش', 'Ouled Rechache'),
  ('40', 'Remila', 'الرميلة', 'Kais'),
  ('40', 'Tamza', 'طامزة', 'El Hamma'),
  ('40', 'Taouzianat', 'تاوزيانت', 'Kais'),
  ('40', 'Yabous', 'يابوس', 'Bouhmama')
on conflict (wilaya_code, name) do nothing;

-- 41 Souk Ahras
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('41', 'Ain Soltane', 'عين سلطان', 'Sedrata'),
  ('41', 'Ain Zana', 'عين الزانة', 'Ouled Driss'),
  ('41', 'Bir Bouhouche', 'بئر بوحوش', 'Bir Bouhouche'),
  ('41', 'Drea', 'الدريعة', 'Taoura'),
  ('41', 'Haddada', 'الحدادة', 'Haddada'),
  ('41', 'Hanencha', 'الحنانشة', 'Mechroha'),
  ('41', 'Khedara', 'الخضارة', 'Haddada'),
  ('41', 'Khemissa', 'خميسة', 'Sedrata'),
  ('41', 'M''daourouche', 'مداوروش', 'M''daourouche'),
  ('41', 'Machroha', 'المشروحة', 'Mechroha'),
  ('41', 'Merahna', 'المراهنة', 'Merahna'),
  ('41', 'Oued Kebrit', 'وادي الكبريت', 'Oum El Adhaim'),
  ('41', 'Ouillen', 'ويلان', 'Merahna'),
  ('41', 'Ouled Driss', 'أولاد إدريس', 'Ouled Driss'),
  ('41', 'Ouled Moumen', 'أولاد مومن', 'Haddada'),
  ('41', 'Oum El Adhaim', 'أم العظايم', 'Oum El Adhaim'),
  ('41', 'Ragouba', 'الراقوبة', 'M''daourouche'),
  ('41', 'Safel El Ouiden', 'سافل الويدان', 'Bir Bouhouche'),
  ('41', 'Sedrata', 'سدراتة', 'Sedrata'),
  ('41', 'Sidi Fredj', 'سيدي فرج', 'Merahna'),
  ('41', 'Souk Ahras', 'سوق أهراس', 'Souk Ahras'),
  ('41', 'Taoura', 'تاورة', 'Taoura'),
  ('41', 'Terraguelt', 'ترقالت', 'Oum El Adhaim'),
  ('41', 'Tiffech', 'تيفاش', 'M''daourouche'),
  ('41', 'Zaarouria', 'الزعرورية', 'Taoura'),
  ('41', 'Zouabi', 'الزوابي', 'Bir Bouhouche')
on conflict (wilaya_code, name) do nothing;

-- 42 Tipaza
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('42', 'Aghbal', 'أغبال', 'Gouraya'),
  ('42', 'Ahmer El Ain', 'أحمر العين', 'Ahmar El Ain'),
  ('42', 'Ain Tagourait', 'عين تاقورايت', 'Bou Ismail'),
  ('42', 'Attatba', 'الحطاطبة', 'Kolea'),
  ('42', 'Beni Mileuk', 'بني ميلك', 'Damous'),
  ('42', 'Bou Haroun', 'بوهارون', 'Bou Ismail'),
  ('42', 'Bou Ismail', 'بواسماعيل', 'Bou Ismail'),
  ('42', 'Bourkika', 'بورقيقة', 'Ahmar El Ain'),
  ('42', 'Chaiba', 'الشعيبة', 'Kolea'),
  ('42', 'Cherchell', 'شرشال', 'Cherchell'),
  ('42', 'Damous', 'الداموس', 'Damous'),
  ('42', 'Douaouda', 'دواودة', 'Fouka'),
  ('42', 'Fouka', 'فوكة', 'Fouka'),
  ('42', 'Gouraya', 'قوراية', 'Gouraya'),
  ('42', 'Hadjout', 'حجوط', 'Hadjout'),
  ('42', 'Hadjret Ennous', 'حجرة النص', 'Cherchell'),
  ('42', 'Khemisti', 'خميستي', 'Bou Ismail'),
  ('42', 'Kolea', 'القليعة', 'Kolea'),
  ('42', 'Larhat', 'الأرهاط', 'Damous'),
  ('42', 'Menaceur', 'مناصر', 'Sidi Amar'),
  ('42', 'Merad', 'مراد', 'Hadjout'),
  ('42', 'Messelmoun', 'مسلمون', 'Gouraya'),
  ('42', 'Nador', 'الناظور', 'Sidi Amar'),
  ('42', 'Sidi Ghiles', 'سيدي غيلاس', 'Cherchell'),
  ('42', 'Sidi Rached', 'سيدي راشد', 'Ahmar El Ain'),
  ('42', 'Sidi Semiane', 'سيدي سميان', 'Cherchell'),
  ('42', 'Sidi-Amar', 'سيدي عامر', 'Sidi Amar'),
  ('42', 'Tipaza', 'تيبازة', 'Tipaza')
on conflict (wilaya_code, name) do nothing;

-- 43 Mila
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('43', 'Ahmed Rachedi', 'أحمد راشدي', 'Oued Endja'),
  ('43', 'Ain Beida Harriche', ' عين البيضاء أحريش', 'Ain Beida Harriche'),
  ('43', 'Ain Mellouk', 'عين الملوك', 'Chelghoum Laid'),
  ('43', 'Ain Tine', 'عين التين', 'Mila'),
  ('43', 'Amira Arres', 'اعميرة اراس', 'Terrai Bainen'),
  ('43', 'Benyahia Abderrahmane', 'بن يحي عبد الرحمن', 'Tadjenanet'),
  ('43', 'Bouhatem', 'بوحاتم', 'Bouhatem'),
  ('43', 'Chelghoum Laid', 'شلغوم العيد', 'Chelghoum Laid'),
  ('43', 'Chigara', 'الشيقارة', 'Sidi Merouane'),
  ('43', 'Derrahi Bousselah', 'دراحي بوصلاح', 'Bouhatem'),
  ('43', 'El Ayadi Barbes', 'العياضي برباس', 'Ain Beida Harriche'),
  ('43', 'El Mechira', 'مشيرة', 'Teleghma'),
  ('43', 'Ferdjioua', 'فرجيوة', 'Ferdjioua'),
  ('43', 'Grarem Gouga', 'القرارم قوقة', 'Grarem Gouga'),
  ('43', 'Hamala', 'حمالة', 'Grarem Gouga'),
  ('43', 'Mila', 'ميلة', 'Mila'),
  ('43', 'Minar Zarza', 'مينار زارزة', 'Tassadane Haddada'),
  ('43', 'Oued Athmenia', 'وادي العثمانية', 'Chelghoum Laid'),
  ('43', 'Oued Endja', 'وادي النجاء', 'Oued Endja'),
  ('43', 'Oued Seguen', 'وادي سقان', 'Teleghma'),
  ('43', 'Ouled Khalouf', 'أولاد اخلوف', 'Tadjenanet'),
  ('43', 'Rouached', 'الرواشد', 'Rouached'),
  ('43', 'Sidi Khelifa', 'سيدي خليفة', 'Mila'),
  ('43', 'Sidi Merouane', 'سيدي مروان', 'Sidi Merouane'),
  ('43', 'Tadjenanet', 'تاجنانت', 'Tadjenanet'),
  ('43', 'Tassadane Haddada', 'تسدان حدادة', 'Tassadane Haddada'),
  ('43', 'Tassala Lematai', 'تسالة لمطاعي', 'Terrai Bainen'),
  ('43', 'Teleghma', 'التلاغمة', 'Teleghma'),
  ('43', 'Terrai Bainen', 'ترعي باينان', 'Terrai Bainen'),
  ('43', 'Tiberguent', 'تيبرقنت', 'Rouached'),
  ('43', 'Yahia Beniguecha', 'يحي بني قشة', 'Ferdjioua'),
  ('43', 'Zeghaia', 'زغاية', 'Oued Endja')
on conflict (wilaya_code, name) do nothing;

-- 44 Aïn Defla
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('44', 'Ain-Benian', 'عين البنيان', 'Hammam Righa'),
  ('44', 'Ain-Bouyahia', 'عين بويحيى', 'El Abadia'),
  ('44', 'Ain-Defla', 'عين الدفلى', 'Ain Defla'),
  ('44', 'Ain-Lechiakh', 'عين الاشياخ', 'Ain Lechiakh'),
  ('44', 'Ain-Soltane', 'عين السلطان', 'Ain Lechiakh'),
  ('44', 'Ain-Torki', 'عين التركي', 'Hammam Righa'),
  ('44', 'Arib', 'عريب', 'El Amra'),
  ('44', 'Bathia', 'بطحية', 'Bathia'),
  ('44', 'Belaas', 'بلعاص', 'Bathia'),
  ('44', 'Ben Allal', 'بن علال', 'Miliana'),
  ('44', 'Bir-Ould-Khelifa', 'بئر ولد خليفة', 'Bordj El Emir Khaled'),
  ('44', 'Birbouche', 'بربوش', 'Djendel'),
  ('44', 'Bordj-Emir-Khaled', 'برج الأمير خالد', 'Bordj El Emir Khaled'),
  ('44', 'Boumedfaa', 'بومدفع', 'Boumedfaa'),
  ('44', 'Bourached', 'بوراشد', 'Djelida'),
  ('44', 'Djelida', 'جليدة', 'Djelida'),
  ('44', 'Djemaa Ouled Cheikh', 'جمعة أولاد الشيخ', 'Djelida'),
  ('44', 'Djendel', 'جندل', 'Djendel'),
  ('44', 'El-Abadia', 'العبادية', 'El Abadia'),
  ('44', 'El-Amra', 'العامرة', 'El Amra'),
  ('44', 'El-Attaf', 'العطاف', 'El Attaf'),
  ('44', 'El-Maine', 'الماين', 'Rouina'),
  ('44', 'Hammam-Righa', 'حمام ريغة', 'Hammam Righa'),
  ('44', 'Hassania', 'الحسانية', 'Bathia'),
  ('44', 'Hoceinia', 'الحسينية', 'Boumedfaa'),
  ('44', 'Khemis-Miliana', 'خميس مليانة', 'Khemis'),
  ('44', 'Mekhatria', 'المخاطرية', 'El Amra'),
  ('44', 'Miliana', 'مليانة', 'Miliana'),
  ('44', 'Oued Chorfa', 'وادي الشرفاء', 'Djendel'),
  ('44', 'Oued Djemaa', 'واد الجمعة', 'Ain Lechiakh'),
  ('44', 'Rouina', 'الروينة', 'Rouina'),
  ('44', 'Sidi-Lakhdar', 'سيدي الأخضر', 'Khemis'),
  ('44', 'Tacheta Zegagha', 'تاشتة زقاغة', 'El Abadia'),
  ('44', 'Tarik-Ibn-Ziad', 'طارق بن زياد', 'Bordj El Emir Khaled'),
  ('44', 'Tiberkanine', 'تبركانين', 'El Attaf'),
  ('44', 'Zeddine', 'زدين', 'Rouina')
on conflict (wilaya_code, name) do nothing;

-- 45 Naâma
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('45', 'Ain Ben Khelil', 'عين بن خليل', 'Mecheria'),
  ('45', 'Ain Sefra', 'عين الصفراء', 'Ain Sefra'),
  ('45', 'Asla', 'عسلة', 'Asla'),
  ('45', 'Djenienne Bourezg', 'جنين بورزق', 'Moghrar'),
  ('45', 'El Biodh', 'البيوض', 'Mecheria'),
  ('45', 'Kasdir', 'القصدير', 'Mekmen Ben Amar'),
  ('45', 'Makmen Ben Amar', 'مكمن بن عمار', 'Mekmen Ben Amar'),
  ('45', 'Mecheria', 'المشرية', 'Mecheria'),
  ('45', 'Moghrar', 'مغرار', 'Moghrar'),
  ('45', 'Naama', 'النعامة', 'Naama'),
  ('45', 'Sfissifa', 'سفيسيفة', 'Sfissifa'),
  ('45', 'Tiout', 'تيوت', 'Ain Sefra')
on conflict (wilaya_code, name) do nothing;

-- 46 Aïn Témouchent
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('46', 'Aghlal', 'أغلال', 'Ain Kihel'),
  ('46', 'Ain El Arbaa', 'عين الأربعاء', 'Ain Larbaa'),
  ('46', 'Ain Kihal', 'عين الكيحل', 'Ain Kihel'),
  ('46', 'Ain Temouchent', 'عين تموشنت', 'Ain Temouchent'),
  ('46', 'Ain Tolba', 'عين الطلبة', 'Ain Kihel'),
  ('46', 'Aoubellil', 'عقب الليل', 'Ain Kihel'),
  ('46', 'Beni Saf', 'بني صاف', 'Beni Saf'),
  ('46', 'Bouzedjar', 'بوزجار', 'El Amria'),
  ('46', 'Chaabat El Ham', 'شعبة اللحم', 'El Maleh'),
  ('46', 'Chentouf', 'شنتوف', 'Hammam Bou Hadjar'),
  ('46', 'El Amria', 'العامرية', 'El Amria'),
  ('46', 'El Maleh', 'المالح', 'El Maleh'),
  ('46', 'El Messaid', 'المساعيد', 'El Amria'),
  ('46', 'Emir Abdelkader', 'الأمير عبد القادر', 'Beni Saf'),
  ('46', 'Hammam Bou Hadjar', 'حمام بوحجر', 'Hammam Bou Hadjar'),
  ('46', 'Hassasna', 'الحساسنة', 'Hammam Bou Hadjar'),
  ('46', 'Hassi El Ghella', 'حاسي الغلة', 'El Amria'),
  ('46', 'Oued Berkeche', 'وادي برقش', 'Hammam Bou Hadjar'),
  ('46', 'Oued Sebbah', 'وادي الصباح', 'Ain Larbaa'),
  ('46', 'Ouled Boudjemaa', 'أولاد بوجمعة', 'El Amria'),
  ('46', 'Ouled Kihal', 'أولاد الكيحل', 'El Maleh'),
  ('46', 'Oulhaca El Gheraba', 'ولهاصة الغرابة', 'Oulhassa Gheraba'),
  ('46', 'Sidi Ben Adda', 'سيدي بن عدة', 'Ain Temouchent'),
  ('46', 'Sidi Boumediene', 'سيدي بومدين', 'Ain Larbaa'),
  ('46', 'Sidi Ouriache', 'سيدي ورياش', 'Oulhassa Gheraba'),
  ('46', 'Sidi Safi', 'سيدي صافي', 'Beni Saf'),
  ('46', 'Tamzoura', 'تامزورة', 'Ain Larbaa'),
  ('46', 'Terga', 'تارقة', 'El Maleh')
on conflict (wilaya_code, name) do nothing;

-- 47 Ghardaïa
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('47', 'Berriane', 'بريان', 'Berriane'),
  ('47', 'Bounoura', 'بونورة', 'Bounoura'),
  ('47', 'Dhayet Bendhahoua', 'ضاية بن ضحوة', 'Dhayet Ben Dhahoua'),
  ('47', 'El Atteuf', 'العطف', 'Bounoura'),
  ('47', 'El Guerrara', 'القرارة', 'El Guerrara'),
  ('47', 'Ghardaia', 'غرداية', 'Ghardaia'),
  ('47', 'Mansoura', 'المنصورة', 'Mansourah'),
  ('47', 'Metlili', 'متليلي', 'Metlili'),
  ('47', 'Sebseb', 'سبسب', 'Metlili'),
  ('47', 'Zelfana', 'زلفانة', 'Zelfana')
on conflict (wilaya_code, name) do nothing;

-- 48 Relizane
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('48', 'Ain Rahma', 'عين الرحمة', 'Yellel'),
  ('48', 'Ain-Tarek', 'عين طارق', 'Ain Tarek'),
  ('48', 'Ammi Moussa', 'عمي موسى', 'Ammi Moussa'),
  ('48', 'Belaassel Bouzagza', 'بلعسل بوزقزة', 'El Matmar'),
  ('48', 'Bendaoud', 'بن داود', 'Relizane'),
  ('48', 'Beni Dergoun', 'بني درقن', 'Zemmoura'),
  ('48', 'Beni Zentis', 'بني زنطيس', 'Sidi M''hamed Ben Ali'),
  ('48', 'Dar Ben Abdelah', 'دار بن عبد الله', 'Zemmoura'),
  ('48', 'Djidiouia', 'جديوية', 'Djidiouia'),
  ('48', 'El H''madna', 'الحمادنة', 'El H''madna'),
  ('48', 'El Hassi', 'الحاسي', 'Ammi Moussa'),
  ('48', 'El Ouldja', 'الولجة', 'Ammi Moussa'),
  ('48', 'El-Guettar', 'القطار', 'Mazouna'),
  ('48', 'El-Matmar', 'المطمر', 'El Matmar'),
  ('48', 'Had Echkalla', 'حد الشكالة', 'Ain Tarek'),
  ('48', 'Hamri', 'حمري', 'Djidiouia'),
  ('48', 'Kalaa', 'القلعة', 'Yellel'),
  ('48', 'Lahlef', 'لحلاف', 'Oued Rhiou'),
  ('48', 'Mazouna', 'مازونة', 'Mazouna'),
  ('48', 'Mediouna', 'مديونة', 'Sidi M''hamed Ben Ali'),
  ('48', 'Mendes', 'منداس', 'Mendes'),
  ('48', 'Merdja Sidi Abed', 'مرجة سيدي عابد', 'Oued Rhiou'),
  ('48', 'Ouarizane', 'واريزان', 'Oued Rhiou'),
  ('48', 'Oued El Djemaa', 'وادي الجمعة', 'El H''madna'),
  ('48', 'Oued Essalem', 'وادي السلام', 'Mendes'),
  ('48', 'Oued-Rhiou', 'وادي رهيو', 'Oued Rhiou'),
  ('48', 'Ouled Aiche', 'أولاد يعيش', 'Ammi Moussa'),
  ('48', 'Ouled Sidi Mihoub', 'أولاد سيدي الميهوب', 'Djidiouia'),
  ('48', 'Ramka', 'الرمكة', 'Ramka'),
  ('48', 'Relizane', 'غليزان', 'Relizane'),
  ('48', 'Sidi Khettab', 'سيدي  خطاب', 'El Matmar'),
  ('48', 'Sidi Lazreg', 'سيدي لزرق', 'Mendes'),
  ('48', 'Sidi M''hamed Benali', 'سيدي أمحمد بن علي', 'Sidi M''hamed Ben Ali'),
  ('48', 'Sidi M''hamed Benaouda', 'سيدي امحمد بن عودة', 'El Matmar'),
  ('48', 'Sidi Saada', 'سيدي سعادة', 'Yellel'),
  ('48', 'Souk El Had', 'سوق الحد', 'Ramka'),
  ('48', 'Yellel', 'يلل', 'Yellel'),
  ('48', 'Zemmoura', 'زمورة', 'Zemmoura')
on conflict (wilaya_code, name) do nothing;

-- 49 Timimoun
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('49', 'Aougrout', 'أوقروت', 'Aougrout'),
  ('49', 'Charouine', 'شروين', 'Charouine'),
  ('49', 'Deldoul', 'دلدول', 'Aougrout'),
  ('49', 'Ksar Kaddour', 'قصر قدور', 'Tinerkouk'),
  ('49', 'Metarfa', 'المطارفة', 'Aougrout'),
  ('49', 'Ouled Aissa', 'أولاد عيسى', 'Charouine'),
  ('49', 'Ouled Said', 'أولاد السعيد', 'Timimoun'),
  ('49', 'Talmine', 'طالمين', 'Charouine'),
  ('49', 'Timimoun', 'تيميمون', 'Timimoun'),
  ('49', 'Tinerkouk', 'تنركوك', 'Tinerkouk')
on conflict (wilaya_code, name) do nothing;

-- 50 Bordj Badji Mokhtar
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('50', 'Bordj Badji Mokhtar', 'برج باجي مختار', 'Bordj Badji Mokhtar'),
  ('50', 'Timiaouine', 'تيمياوين', 'Bordj Badji Mokhtar')
on conflict (wilaya_code, name) do nothing;

-- 51 Ouled Djellal
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('51', 'Besbes', 'بسباس', 'Sidi Khaled'),
  ('51', 'Chaiba', 'الشعيبة', 'Ouled Djellal'),
  ('51', 'Doucen', 'الدوسن', 'Ouled Djellal'),
  ('51', 'Ouled Djellal', 'أولاد جلال', 'Ouled Djellal'),
  ('51', 'Ras El Miad', 'رأس الميعاد', 'Sidi Khaled'),
  ('51', 'Sidi Khaled', 'سيدي  خالد', 'Sidi Khaled')
on conflict (wilaya_code, name) do nothing;

-- 52 Béni Abbès
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('52', 'Beni-Abbes', 'بني عباس', 'Beni Abbes'),
  ('52', 'Beni-Ikhlef', 'بن يخلف', 'Kerzaz'),
  ('52', 'El Ouata', 'الواتة', 'El Ouata'),
  ('52', 'Igli', 'إقلي', 'Igli'),
  ('52', 'Kerzaz', 'كرزاز', 'Kerzaz'),
  ('52', 'Ksabi', 'القصابي', 'Ouled Khodeir'),
  ('52', 'Ouled-Khodeir', 'أولاد خضير', 'Ouled Khodeir'),
  ('52', 'Tamtert', 'تامترت', 'Beni Abbes'),
  ('52', 'Timoudi', 'تيمودي', 'Kerzaz')
on conflict (wilaya_code, name) do nothing;

-- 53 In Salah
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('53', 'Ain Salah', 'عين صالح', 'In Salah'),
  ('53', 'Foggaret Ezzoua', 'فقارة الزوى', 'In Salah'),
  ('53', 'Inghar', 'إينغر', 'In Ghar')
on conflict (wilaya_code, name) do nothing;

-- 54 In Guezzam
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('54', 'Ain Guezzam', 'عين قزام', 'In Guezzam'),
  ('54', 'Tin Zouatine', 'تين زواتين', 'Tin Zouatine')
on conflict (wilaya_code, name) do nothing;

-- 55 Touggourt
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('55', 'Benaceur', 'بن ناصر', 'Taibet'),
  ('55', 'Blidet Amor', 'بلدة اعمر', 'Temacine'),
  ('55', 'El Alia', 'العالية', 'El-Hadjira'),
  ('55', 'El-Hadjira', 'الحجيرة', 'El-Hadjira'),
  ('55', 'M''naguer', 'المنقر', 'Taibet'),
  ('55', 'Megarine', 'المقارين', 'Megarine'),
  ('55', 'Nezla', 'النزلة', 'Touggourt'),
  ('55', 'Sidi Slimane', 'سيدي سليمان', 'Megarine'),
  ('55', 'Taibet', 'الطيبات', 'Taibet'),
  ('55', 'Tebesbest', 'تبسبست', 'Touggourt'),
  ('55', 'Temacine', 'تماسين', 'Temacine'),
  ('55', 'Touggourt', 'تقرت', 'Touggourt'),
  ('55', 'Zaouia El Abidia', 'الزاوية العابدية', 'Touggourt')
on conflict (wilaya_code, name) do nothing;

-- 56 Djanet
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('56', 'Bordj El Haouass', 'برج الحواس', 'Djanet'),
  ('56', 'Djanet', 'جانت', 'Djanet')
on conflict (wilaya_code, name) do nothing;

-- 57 El Meghaier
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('57', 'Djamaa', 'جامعة', 'Djamaa'),
  ('57', 'El-M''ghaier', 'المغير', 'El Meghaier'),
  ('57', 'M''rara', 'المرارة', 'Djamaa'),
  ('57', 'Oum Touyour', 'أم الطيور', 'El Meghaier'),
  ('57', 'Sidi Amrane', 'سيدي عمران', 'Djamaa'),
  ('57', 'Sidi Khelil', 'سيدي خليل', 'El Meghaier'),
  ('57', 'Still', 'سطيل', 'El Meghaier'),
  ('57', 'Tenedla', 'تندلة', 'Djamaa')
on conflict (wilaya_code, name) do nothing;

-- 58 El Menia
insert into public.communes (wilaya_code, name, name_ar, daira) values
  ('58', 'El Meniaa', 'المنيعة', 'El Menia'),
  ('58', 'Hassi Fehal', 'حاسي الفحل', 'Mansourah'),
  ('58', 'Hassi Gara', 'حاسي القارة', 'El Menia')
on conflict (wilaya_code, name) do nothing;



