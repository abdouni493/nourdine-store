-- ============================================================================
--  WHOLESALE ("GROS") PRICE
--  Safe to run more than once.
-- ============================================================================

-- Second sale price on the article (0 = none).
alter table public.products
  add column if not exists wholesale_price numeric(12,2) not null default 0;

-- Wholesale price set when stock is received.
alter table public.purchase_lines
  add column if not exists wholesale_price numeric(12,2) not null default 0;

-- Default price list of a client.
alter table public.clients
  add column if not exists price_type text not null default 'retail';
alter table public.clients drop constraint if exists clients_price_type_check;
alter table public.clients
  add constraint clients_price_type_check check (price_type in ('retail','wholesale'));

-- Price list each sale line was charged at.
alter table public.sale_lines
  add column if not exists price_type text not null default 'retail';
alter table public.sale_lines drop constraint if exists sale_lines_price_type_check;
alter table public.sale_lines
  add constraint sale_lines_price_type_check check (price_type in ('retail','wholesale'));

-- The receiving document now also sets the article's wholesale price.
create or replace function public.on_purchase_line()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform public._apply_stock(old.product_id, old.size, -old.quantity);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public._apply_stock(new.product_id, new.size, new.quantity);
    update public.products
       set purchase_price  = case when new.purchase_price > 0 then new.purchase_price else purchase_price end,
           sale_price      = case when new.sale_price > 0 then new.sale_price else sale_price end,
           wholesale_price = case when new.wholesale_price > 0 then new.wholesale_price else wholesale_price end,
           min_quantity    = case when new.min_quantity > 0 then new.min_quantity else min_quantity end
     where id = new.product_id;
  end if;
  perform public.recalc_purchase_totals(coalesce(new.purchase_id, old.purchase_id));
  return null;
end $$;

-- Refresh the PostgREST schema cache so the API sees the new columns.
notify pgrst, 'reload schema';
