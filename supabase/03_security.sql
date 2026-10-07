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
