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
