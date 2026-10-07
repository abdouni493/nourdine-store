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
