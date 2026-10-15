-- Wholesale ordering portal — Phase 1: database foundation.
--
-- The portal is a SEPARATE app on this same database. Retailers sign in with
-- Supabase Auth but have NO user_roles row, so every internal table stays
-- invisible to them (user_org_ids() returns nothing). They can only read their
-- own rows in the portal_* / retailers tables below. All portal writes and the
-- catalogue (which must also work for guests) go through the portal's server
-- using the service role, after it has checked the session.
--
-- Stock rules:
--   * Placing an order RESERVES stock (inventory_levels.reserved += units).
--   * Cancelling releases it. Dispatching releases it AND records a SALE
--     through record_inventory_movement (the ledger stays the only thing that
--     changes on_hand).
--   * place/cancel/dispatch are the only other writers of `reserved`.
--
-- A "case" is product_variants.units_per_pack (already exists, 0010).
-- Price per case is computed by the app from the organisation's wholesale
-- price formula; the portal server passes it in at order time and the order
-- stores it as a snapshot. place_portal_order is therefore callable by the
-- service role only.

------------------------------------------------------------------------------
-- Product flag
------------------------------------------------------------------------------
alter table public.product_variants
  add column portal_visible boolean not null default false;

create index product_variants_portal_visible_idx
  on public.product_variants (organisation_id)
  where portal_visible;

------------------------------------------------------------------------------
-- Settings (one row per organisation) — Settings > Wholesale pricing
------------------------------------------------------------------------------
create table public.portal_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations (id) on delete cascade,
  is_enabled boolean not null default true,
  min_order_value numeric not null default 100 check (min_order_value >= 0),
  -- Empty array = default: all active warehouse-type locations.
  fulfilment_location_ids uuid[] not null default '{}',
  -- Where stock counts are kept: 'unit' = on_hand counts single units (a case
  -- uses units_per_pack of them); 'case' = on_hand already counts cases.
  stock_basis text not null default 'unit' check (stock_basis in ('unit', 'case')),
  notify_email text,
  guest_message text not null default 'Sign in to see wholesale prices, or contact us to request a price list.',
  updated_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Retailers (managed by the distributor; also created by portal sign-up)
------------------------------------------------------------------------------
create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  business_name text not null,
  contact_name text,
  email text not null,
  phone text,
  address text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index retailers_org_email_idx on public.retailers (organisation_id, lower(email));

-- Guests asking for a price list / contacting the distributor
create table public.portal_price_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  business_name text,
  contact_name text,
  email text not null,
  phone text,
  message text,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Orders
------------------------------------------------------------------------------
create sequence public.portal_order_number_seq start 1001;

create table public.portal_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete restrict,
  order_number bigint not null default nextval('public.portal_order_number_seq'),
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'picked', 'dispatched', 'delivered', 'cancelled')),
  currency text not null,
  total numeric not null check (total >= 0),
  notes text,
  cancel_reason text,
  seen_at timestamptz,            -- null = distributor hasn't opened it yet
  placed_at timestamptz not null default now(),
  approved_at timestamptz,
  picked_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  unique (organisation_id, order_number)
);
create index portal_orders_org_status_idx on public.portal_orders (organisation_id, status, placed_at desc);
create index portal_orders_retailer_idx on public.portal_orders (retailer_id, placed_at desc);

create table public.portal_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.portal_orders (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete restrict,
  -- Snapshots so later edits to the product never change a placed order
  product_name text not null,
  sku text not null,
  units_per_case numeric not null check (units_per_case > 0),
  cases integer not null check (cases > 0),
  case_price numeric not null check (case_price >= 0),
  line_total numeric not null check (line_total >= 0),
  unique (order_id, product_variant_id)
);

-- Where each line's reserved stock came from (a line can split across
-- locations); this is what cancel/dispatch release or ship.
create table public.portal_order_allocations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.portal_order_items (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete restrict,
  product_variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity numeric not null check (quantity > 0)   -- in inventory_levels units
);
create index portal_order_allocations_item_idx on public.portal_order_allocations (order_item_id);

-- Emails are queued here and sent once SMTP exists; until then they are just
-- a log the distributor can see.
create table public.portal_email_outbox (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  order_id uuid references public.portal_orders (id) on delete set null,
  kind text not null,
  to_email text,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------
alter table public.portal_settings          enable row level security;
alter table public.retailers                enable row level security;
alter table public.portal_price_requests    enable row level security;
alter table public.portal_orders            enable row level security;
alter table public.portal_order_items       enable row level security;
alter table public.portal_order_allocations enable row level security;
alter table public.portal_email_outbox      enable row level security;

-- Distributor side: any org member (role tiers are enforced app-side, as for
-- every other settings table in this codebase).
create policy "org members manage portal settings" on public.portal_settings for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create policy "org members manage retailers" on public.retailers for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create policy "org members manage price requests" on public.portal_price_requests for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

-- Orders are changed only through the functions below, so members get SELECT
-- plus the harmless "mark as seen" update.
create policy "org members view portal orders" on public.portal_orders for select
  using (organisation_id in (select user_org_ids()));
create policy "org members mark portal orders seen" on public.portal_orders for update
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));
create policy "org members view portal order items" on public.portal_order_items for select
  using (organisation_id in (select user_org_ids()));
create policy "org members view portal allocations" on public.portal_order_allocations for select
  using (organisation_id in (select user_org_ids()));
create policy "org members view email outbox" on public.portal_email_outbox for select
  using (organisation_id in (select user_org_ids()));

-- Retailer side: own rows only, read-only.
create policy "retailer views own profile" on public.retailers for select
  using (user_id = auth.uid());
create policy "retailer views own orders" on public.portal_orders for select
  using (retailer_id in (select id from public.retailers where user_id = auth.uid()));
create policy "retailer views own order items" on public.portal_order_items for select
  using (order_id in (
    select o.id from public.portal_orders o
    join public.retailers r on r.id = o.retailer_id
    where r.user_id = auth.uid()));

-- Column-level guard: members may only touch seen_at directly.
revoke update on public.portal_orders from authenticated;
grant update (seen_at) on public.portal_orders to authenticated;

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------

-- Service role (portal server) or a member of the order's organisation.
create or replace function public.portal_caller_is_staff(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.role() = 'service_role'
      or p_organisation_id in (select organisation_id from public.user_roles where user_id = auth.uid());
$$;

-- Locations that fulfil portal orders, in priority order.
create or replace function public.portal_fulfilment_locations(p_organisation_id uuid)
returns table (location_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id
  from public.locations l
  left join public.portal_settings s on s.organisation_id = l.organisation_id
  where l.organisation_id = p_organisation_id
    and l.is_active
    and (
      (coalesce(cardinality(s.fulfilment_location_ids), 0) > 0 and l.id = any (s.fulfilment_location_ids))
      or (coalesce(cardinality(s.fulfilment_location_ids), 0) = 0 and l.type = 'warehouse')
    )
  order by l.created_at, l.id;
$$;

------------------------------------------------------------------------------
-- place_portal_order
--
-- p_lines: [{"variant_id": uuid, "cases": int, "case_price": numeric}, ...]
-- Returns jsonb:
--   {"ok": true,  "order_id": ..., "order_number": ..., "total": ...}
--   {"ok": false, "reason": "shortage", "shortages": [{variant_id, name, sku,
--       requested_cases, available_cases}]}
--   {"ok": false, "reason": "below_minimum", "min_order_value": n, "total": n}
--   {"ok": false, "reason": "not_approved" | "portal_disabled" | "empty_cart"}
-- Nothing is reserved unless every line passes.
------------------------------------------------------------------------------
create or replace function public.place_portal_order(
  p_organisation_id uuid,
  p_retailer_id uuid,
  p_lines jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.portal_settings;
  v_retailer public.retailers;
  v_line record;
  v_loc record;
  v_variant public.product_variants;
  v_locations uuid[];
  v_per_case numeric;
  v_avail numeric;
  v_need numeric;
  v_take numeric;
  v_total numeric := 0;
  v_currency text;
  v_shortages jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_order_number bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'place_portal_order is for the portal server only';
  end if;

  select * into v_settings from public.portal_settings where organisation_id = p_organisation_id;
  if v_settings.id is null then
    -- No settings row yet: behave as defaults (enabled, min 100, warehouses).
    v_settings.is_enabled := true;
    v_settings.min_order_value := 100;
    v_settings.stock_basis := 'unit';
  end if;
  if not v_settings.is_enabled then
    return jsonb_build_object('ok', false, 'reason', 'portal_disabled');
  end if;

  select * into v_retailer from public.retailers
  where id = p_retailer_id and organisation_id = p_organisation_id;
  if v_retailer.id is null or v_retailer.status <> 'approved' then
    return jsonb_build_object('ok', false, 'reason', 'not_approved');
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_cart');
  end if;

  select array_agg(location_id) into v_locations
  from public.portal_fulfilment_locations(p_organisation_id);
  if v_locations is null then
    raise exception 'No fulfilment location is configured';
  end if;

  -- Merge duplicate lines; sort by variant id so concurrent orders lock
  -- inventory rows in the same order (no deadlocks).
  drop table if exists _lines;
  create temp table _lines on commit drop as
    select (l ->> 'variant_id')::uuid as variant_id,
           sum((l ->> 'cases')::int)::int as cases,
           max((l ->> 'case_price')::numeric) as case_price
    from jsonb_array_elements(p_lines) l
    group by 1;

  if exists (select 1 from _lines where cases <= 0 or case_price is null or case_price < 0) then
    raise exception 'Invalid cart line';
  end if;

  for v_line in select * from _lines order by variant_id loop
    select * into v_variant from public.product_variants
    where id = v_line.variant_id and organisation_id = p_organisation_id and portal_visible;
    if v_variant.id is null then
      v_shortages := v_shortages || jsonb_build_object(
        'variant_id', v_line.variant_id, 'name', null, 'sku', null,
        'requested_cases', v_line.cases, 'available_cases', 0);
      continue;
    end if;

    v_per_case := case when v_settings.stock_basis = 'case' then 1 else v_variant.units_per_pack end;

    -- Lock this variant's rows at the fulfilment locations and add up what is free.
    select coalesce(sum(greatest(il.on_hand - il.reserved, 0)), 0) into v_avail
    from (
      select on_hand, reserved from public.inventory_levels
      where product_variant_id = v_variant.id and location_id = any (v_locations)
      order by location_id
      for update
    ) il;

    if floor(v_avail / v_per_case) < v_line.cases then
      v_shortages := v_shortages || jsonb_build_object(
        'variant_id', v_variant.id, 'name', v_variant.name, 'sku', v_variant.sku,
        'requested_cases', v_line.cases,
        'available_cases', floor(v_avail / v_per_case));
    else
      v_total := v_total + v_line.cases * v_line.case_price;
      v_currency := coalesce(v_currency, v_variant.currency);
    end if;
  end loop;

  if jsonb_array_length(v_shortages) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'shortage', 'shortages', v_shortages);
  end if;

  if v_total < v_settings.min_order_value then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum',
      'min_order_value', v_settings.min_order_value, 'total', v_total);
  end if;

  insert into public.portal_orders (organisation_id, retailer_id, currency, total, notes)
  values (p_organisation_id, p_retailer_id, coalesce(v_currency, 'NZD'), v_total, p_notes)
  returning id, order_number into v_order_id, v_order_number;

  -- Everything passed: create lines and reserve across locations in priority order.
  for v_line in select * from _lines order by variant_id loop
    select * into v_variant from public.product_variants where id = v_line.variant_id;
    v_per_case := case when v_settings.stock_basis = 'case' then 1 else v_variant.units_per_pack end;

    insert into public.portal_order_items (
      order_id, organisation_id, product_variant_id, product_name, sku,
      units_per_case, cases, case_price, line_total
    )
    select v_order_id, p_organisation_id, v_variant.id, p.name || ' - ' || v_variant.name, v_variant.sku,
           v_variant.units_per_pack, v_line.cases, v_line.case_price, v_line.cases * v_line.case_price
    from public.products p where p.id = v_variant.product_id
    returning id into v_item_id;

    v_need := v_line.cases * v_per_case;
    for v_loc in
      select il.location_id, greatest(il.on_hand - il.reserved, 0) as free
      from public.inventory_levels il
      join unnest(v_locations) with ordinality as o(loc, ord) on o.loc = il.location_id
      where il.product_variant_id = v_variant.id
      order by o.ord
    loop
      exit when v_need <= 0;
      v_take := least(v_loc.free, v_need);
      continue when v_take <= 0;

      update public.inventory_levels
      set reserved = reserved + v_take, updated_at = now()
      where location_id = v_loc.location_id and product_variant_id = v_variant.id;

      insert into public.portal_order_allocations (
        order_item_id, organisation_id, location_id, product_variant_id, quantity
      ) values (v_item_id, p_organisation_id, v_loc.location_id, v_variant.id, v_take);

      v_need := v_need - v_take;
    end loop;

    if v_need > 0 then
      raise exception 'Stock changed while reserving; please retry'; -- should not happen: rows are locked
    end if;
  end loop;

  v_currency := coalesce(v_currency, 'NZD');

  -- Queue notifications (sent once SMTP exists).
  insert into public.portal_email_outbox (organisation_id, order_id, kind, to_email, subject, body)
  values
    (p_organisation_id, v_order_id, 'new_order_distributor', v_settings.notify_email,
     'New wholesale order #' || v_order_number || ' from ' || v_retailer.business_name,
     'Order #' || v_order_number || ' for ' || v_currency || ' ' || v_total || ' is waiting for your approval.'),
    (p_organisation_id, v_order_id, 'order_received_retailer', v_retailer.email,
     'We received your order #' || v_order_number,
     'Thanks ' || coalesce(v_retailer.contact_name, v_retailer.business_name) ||
     ' - your order #' || v_order_number || ' (' || v_currency || ' ' || v_total || ') has been received.');

  return jsonb_build_object('ok', true, 'order_id', v_order_id,
                            'order_number', v_order_number, 'total', v_total);
end;
$$;

------------------------------------------------------------------------------
-- cancel_portal_order
-- Staff: any open order. Retailer (portal server passes p_retailer_id): only
-- their own order and only while still 'submitted'.
------------------------------------------------------------------------------
create or replace function public.cancel_portal_order(
  p_order_id uuid,
  p_retailer_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.portal_orders;
  v_alloc record;
begin
  select * into v_order from public.portal_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found'; end if;

  if p_retailer_id is not null then
    if auth.role() <> 'service_role' then
      raise exception 'Not allowed';
    end if;
    if v_order.retailer_id <> p_retailer_id then raise exception 'Order not found'; end if;
    if v_order.status <> 'submitted' then
      raise exception 'This order can no longer be cancelled online - please contact us';
    end if;
  else
    if not public.portal_caller_is_staff(v_order.organisation_id) then
      raise exception 'Not allowed';
    end if;
    if v_order.status not in ('submitted', 'approved', 'picked') then
      raise exception 'Order is already %', v_order.status;
    end if;
  end if;

  for v_alloc in
    select a.* from public.portal_order_allocations a
    join public.portal_order_items i on i.id = a.order_item_id
    where i.order_id = p_order_id
    order by a.product_variant_id, a.location_id
  loop
    update public.inventory_levels
    set reserved = greatest(reserved - v_alloc.quantity, 0), updated_at = now()
    where location_id = v_alloc.location_id and product_variant_id = v_alloc.product_variant_id;
  end loop;

  update public.portal_orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
  where id = p_order_id;
end;
$$;

------------------------------------------------------------------------------
-- set_portal_order_status: submitted -> approved -> picked, dispatched -> delivered
-- (dispatch itself has its own function because it moves stock)
------------------------------------------------------------------------------
create or replace function public.set_portal_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.portal_orders;
begin
  select * into v_order from public.portal_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found'; end if;
  if not public.portal_caller_is_staff(v_order.organisation_id) then
    raise exception 'Not allowed';
  end if;

  if not (
    (v_order.status = 'submitted' and p_status = 'approved') or
    (v_order.status in ('submitted', 'approved') and p_status = 'picked') or
    (v_order.status = 'dispatched' and p_status = 'delivered')
  ) then
    raise exception 'Cannot move an order from % to %', v_order.status, p_status;
  end if;

  update public.portal_orders set
    status = p_status,
    approved_at  = case when p_status = 'approved'  then now() else approved_at end,
    picked_at    = case when p_status = 'picked'    then now() else picked_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = p_order_id;
end;
$$;

------------------------------------------------------------------------------
-- dispatch_portal_order: release the reservation and ship through the ledger
------------------------------------------------------------------------------
create or replace function public.dispatch_portal_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.portal_orders;
  v_alloc record;
begin
  select * into v_order from public.portal_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found'; end if;
  if not public.portal_caller_is_staff(v_order.organisation_id) then
    raise exception 'Not allowed';
  end if;
  if v_order.status not in ('approved', 'picked') then
    raise exception 'Only approved or picked orders can be dispatched (this one is %)', v_order.status;
  end if;

  for v_alloc in
    select a.* from public.portal_order_allocations a
    join public.portal_order_items i on i.id = a.order_item_id
    where i.order_id = p_order_id
    order by a.product_variant_id, a.location_id
  loop
    update public.inventory_levels
    set reserved = greatest(reserved - v_alloc.quantity, 0), updated_at = now()
    where location_id = v_alloc.location_id and product_variant_id = v_alloc.product_variant_id;

    perform public.record_inventory_movement(
      p_organisation_id    => v_order.organisation_id,
      p_location_id        => v_alloc.location_id,
      p_product_variant_id => v_alloc.product_variant_id,
      p_movement_type      => 'SALE',
      p_quantity           => -v_alloc.quantity,
      p_reference_type     => 'portal_order',
      p_reference_id       => v_order.id,
      p_external_reference => 'portal_order:' || v_order.id || ':' || v_alloc.id
    );
  end loop;

  update public.portal_orders set status = 'dispatched', dispatched_at = now() where id = p_order_id;
end;
$$;

------------------------------------------------------------------------------
-- Execute permissions: functions are public-executable by default.
------------------------------------------------------------------------------
revoke all on function public.place_portal_order(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.place_portal_order(uuid, uuid, jsonb, text) to service_role;

revoke all on function public.cancel_portal_order(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_portal_order(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.set_portal_order_status(uuid, text) from public, anon;
grant execute on function public.set_portal_order_status(uuid, text) to authenticated, service_role;

revoke all on function public.dispatch_portal_order(uuid) from public, anon;
grant execute on function public.dispatch_portal_order(uuid) to authenticated, service_role;

revoke all on function public.portal_caller_is_staff(uuid) from public, anon;
revoke all on function public.portal_fulfilment_locations(uuid) from public, anon, authenticated;
grant execute on function public.portal_fulfilment_locations(uuid) to service_role;
