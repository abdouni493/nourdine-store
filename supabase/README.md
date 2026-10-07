# Supabase backend

Complete schema for the marketplace (clothes and general products): the back
office, the storefront, the online order lifecycle, staff accounts and
permissions, and the image buckets.

## 1. Run the SQL

Open **Supabase → SQL Editor**, paste **`00_full_setup.sql`** and click *Run*.
That is all four files below, concatenated in order. To run them one at a time
instead:

| # | File | What it creates |
|---|------|-----------------|
| 1 | `01_schema.sql` | 37 tables, foreign keys, indexes, reference sequences |
| 2 | `02_logic.sql` | Permission helpers, account triggers, stock movements, derived totals, order-lifecycle RPCs, storefront and reporting views, starter lists |
| 3 | `03_security.sql` | Grants, row-level security on every table, the 4 storage buckets and their policies |
| 4 | `04_geography.sql` | The 58 wilayas and their 1 541 communes |

Every file is idempotent, so re-running one is safe.

## 2. Two settings in the dashboard

1. **Authentication → Providers → Email → turn off "Confirm email".**
   Accounts created by the app (the owner, then each worker) can then sign in
   straight away. The SQL also marks new e-mails as confirmed, but with the
   setting on, Supabase still tries to send a confirmation mail. Its built-in
   mailer allows only a few per hour, so creating workers would fail.
2. *(Optional)* **Authentication → URL configuration**: set the site URL to
   wherever the app is deployed.

## 3. Accounts

All accounts live in **`auth.users`**. `public.profiles` holds each account's
role and permission matrix, and the `handle_new_user()` trigger writes it.

**Owner (admin).** On the login page, click **Create admin account**. The button
only shows while `admin_exists()` returns `false`. Once the first account
exists it disappears for good. The **first** account is always the owner.

**Workers.** In *Employés*, create the worker, tick **Compte**, and enter an
e-mail and password. The app signs the worker up on a separate client, so the
owner stays signed in. The trigger then:

* links the account to the worker only when the worker card has the **same
  e-mail** and no account yet, so nobody can borrow a worker's permissions;
* copies the worker's permission matrix onto the profile.

From then on `sync_worker_profile()` keeps them in sync. Changing permissions,
role, name or *active* on the worker card applies on the worker's next request.
Deleting the worker also deletes their login.

**Any other signup** (someone calling the API with the public key) is created
**inactive with no permissions**, so it cannot open the back office.

Reset a worker's password from the SQL editor:

```sql
select public.admin_set_password('<profiles.id of the worker>', 'NewPassword123');
```

## 4. Permissions

`has_permission(module, action)` is the single gate. It reads
`profiles.permissions`, which is the same JSON the app's permission dialog
writes:

```json
{
  "stock":     { "enabled": true,  "actions": ["view", "create", "edit"] },
  "weborders": { "enabled": true,  "actions": ["view", "edit", "pay"] },
  "caisse":    { "enabled": false, "actions": [] }
}
```

Modules: `dashboard`, `stock`, `purchase`, `pos`, `sales`, `clients`,
`suppliers`, `workers`, `expenses`, `caisse`, `reports`, `settings`, `website`,
`weborders`.
Actions: `view`, `create`, `edit`, `delete`, `print`, `pay`.

The same matrix is enforced in three places:

| Where | What it does |
|-------|--------------|
| Sidebar | Lists only modules that are enabled and have `view` |
| Routes | `RequireModule` sends a worker who types a forbidden URL to their first allowed page |
| Buttons | `<Button action="delete">` and `<Can action="edit">` hide what isn't granted |
| Database | RLS policies refuse the request even if the API is called directly |

The owner (`is_admin`) passes everything.

## 5. Products: clothes or general

`products.product_type` is `'clothing'` or `'general'`.

* **clothing**: per-size stock in `product_sizes`, where `products.quantity` is
  the sum of the sizes. It also has colour, material, gender, season and
  collection.
* **general**: name, description, brand, category, images and a single
  `products.quantity`. It has no sizes and none of the garment fields.

Purchases, counter sales and web orders all move stock through `_apply_stock()`.
An empty size, or any general product, moves `products.quantity`; a named size
moves that size's row.

## 6. Web order lifecycle

```
pending ──accept──▶ accepted ──deliver──▶ delivered ──cash──▶ completed
   │                    │                     │
   └──────cancel────────┘                     └──return──▶ returned
canceled / returned ──accept──▶ accepted
```

| RPC | Effect | Permission |
|-----|--------|-----------|
| `place_web_order(...)` | Storefront entry point (anon). Re-prices every line from the catalogue or the live offer, and the fee from the tariff grid; applies free shipping | public |
| `web_order_accept(id)` | → `accepted` | weborders:edit |
| `web_order_deliver(id, company, price)` | → `delivered`, **takes the units out of stock** | weborders:edit |
| `web_order_return(id, reason)` | → `returned`, **puts them back** | weborders:edit |
| `web_order_cash(id)` | → `completed`, **books the total into the caisse** | weborders:pay |
| `web_order_cancel(id, reason)` | → `canceled`, returns stock if it had left | weborders:edit/delete |
| `web_order_receipt(id)` | The thank-you page's read of one order | public |

`stock_applied_at` and `cashed_at` act as guards: stock is never taken out
twice, and the money is never booked twice.

## 7. Storage buckets

All four buckets are public to read and permission-gated to write.

| Bucket | Path | Who may upload |
|--------|------|----------------|
| `product-images` | `<product_id>/<random>.webp` | stock create/edit, purchase create, website edit |
| `offer-images` | `<offer_id>/<random>.webp` | website create/edit |
| `delivery-logos` | `<company_id>/<random>.webp` | website create/edit |
| `store-assets` | `logo/…`, `favicon/…`, `hero/…` | settings edit, website edit |

Uploads always go through `uploadImage()` (`src/lib/imageUpload.ts`), which
compresses the file first. Objects are never overwritten. The orphan sweep
(**Paramètres → Nettoyer les images**) deletes images that are no longer
referenced, and needs the owner or settings:edit.

## 8. Views

* Storefront (public): `v_shop_products`, `v_live_offers`
* Reporting (respect the caller's RLS): `v_low_stock`, `v_stock_by_type`,
  `v_client_balances`, `v_supplier_balances`, `v_caisse_balance`,
  `v_web_order_stats`

## 9. Connecting the app

`.env` at the repo root:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

The anon key is meant to ship in the browser bundle: row-level security, not
secrecy, is what protects the data. **Never** put the service-role key here.
