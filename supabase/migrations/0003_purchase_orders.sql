-- Simplified purchase order flow.
--
-- A purchase order is a header (`purchase_orders`) plus one or more line items
-- (`purchase_order_items`). Both are organisation-scoped business tables, so
-- they carry `organisation_id` and RLS matching the project pattern.
--
-- NOTE: 0001_init.sql is not in this repo, so the RLS predicate below is
-- written to match `getCurrentOrganisationId()` (one org per user via
-- `user_roles`). If 0001 defines a helper (e.g. `current_organisation_id()`),
-- swap the subquery for that helper so all policies stay consistent.

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  supplier_name text not null,
  destination_location_id uuid not null references public.locations (id),
  status text not null default 'draft' check (status in ('draft', 'received')),
  received_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id),
  quantity_ordered numeric not null check (quantity_ordered > 0),
  created_at timestamptz not null default now()
);

create index if not exists purchase_order_items_purchase_order_id_idx
  on public.purchase_order_items (purchase_order_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "purchase_orders in caller's organisation"
  on public.purchase_orders for all
  using (
    organisation_id = (
      select organisation_id from public.user_roles where user_id = auth.uid()
    )
  )
  with check (
    organisation_id = (
      select organisation_id from public.user_roles where user_id = auth.uid()
    )
  );

create policy "purchase_order_items in caller's organisation"
  on public.purchase_order_items for all
  using (
    organisation_id = (
      select organisation_id from public.user_roles where user_id = auth.uid()
    )
  )
  with check (
    organisation_id = (
      select organisation_id from public.user_roles where user_id = auth.uid()
    )
  );

-- Receiving a PO: one PURCHASE_RECEIVED ledger movement per line item, then
-- flip the PO to 'received' — all in one transaction. The `for update` lock
-- plus the status check make this idempotent: a second click (or a retry after
-- a dropped response) raises instead of double-receiving stock.
create or replace function public.receive_purchase_order(
  p_organisation_id uuid,
  p_purchase_order_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_po public.purchase_orders;
  v_item public.purchase_order_items;
begin
  select * into v_po
    from public.purchase_orders
   where id = p_purchase_order_id
     and organisation_id = p_organisation_id
   for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  if v_po.status <> 'draft' then
    raise exception 'Purchase order has already been received';
  end if;

  for v_item in
    select * from public.purchase_order_items
     where purchase_order_id = p_purchase_order_id
  loop
    perform public.record_inventory_movement(
      p_organisation_id    => p_organisation_id,
      p_location_id        => v_po.destination_location_id,
      p_product_variant_id => v_item.product_variant_id,
      p_movement_type      => 'PURCHASE_RECEIVED',
      p_quantity           => v_item.quantity_ordered,
      p_reference_type     => 'purchase_order',
      p_reference_id       => p_purchase_order_id,
      p_external_reference => null,
      p_note               => null
    );
  end loop;

  update public.purchase_orders
     set status = 'received',
         received_at = now()
   where id = p_purchase_order_id;
end;
$$;
