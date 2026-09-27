-- Fix: record_stock_out must be SECURITY DEFINER, not SECURITY INVOKER.
--
-- Root cause of "50 in stock everywhere, Stock Out says 0 available" —
-- confirmed live: inventory_levels deliberately has only a SELECT RLS
-- policy ("org members can view inventory levels", 0001_init.sql); there is
-- no UPDATE/ALL policy at all, by design — every write to that table is
-- meant to go exclusively through record_inventory_movement, which is
-- SECURITY DEFINER.
--
-- record_stock_out was declared SECURITY INVOKER, so its own
-- `select on_hand ... for update` ran as the calling (authenticated) user.
-- Postgres treats FOR UPDATE/FOR SHARE row-locking as requiring policy
-- coverage for the lock itself, not just the read: with no UPDATE-category
-- policy on inventory_levels, that locking SELECT silently returned zero
-- rows for a real user session — even though a plain SELECT (no lock) on
-- the same row, under the identical session, returned it fine. v_on_hand
-- came back NULL, coalesce(NULL, 0) = 0, and every stock-out was rejected
-- with "Only 0 units available" regardless of the real on_hand value.
-- Service-role tests never surfaced this: that key bypasses RLS entirely.
--
-- Fix: SECURITY DEFINER, matching record_inventory_movement (which this
-- function already calls) and every other function in this codebase that
-- reads/locks inventory_levels directly. This is the existing convention,
-- not a new one — regular org members were never meant to have direct
-- write/lock access to inventory_levels; only the one ledger function
-- (and now this one) may. The business-logic checks (location belongs to
-- the org, on_hand sufficiency) are unchanged; only the privilege mode is.
-- Permission/assignment checks (is this user assigned to p_location_id,
-- do they have any assigned location) still live entirely in the Next.js
-- server action, as documented in 0024_stock_out.sql — that doesn't change
-- just because this function now runs with elevated privileges for its own
-- internal reads/writes.

create or replace function public.record_stock_out(
  p_organisation_id uuid,
  p_location_id uuid,
  p_product_variant_id uuid,
  p_client_id uuid,
  p_quantity numeric
)
returns uuid -- the new stock_outs row's id
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location_name text;
  v_on_hand numeric;
  v_stock_out_id uuid;
  v_movement_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number';
  end if;

  select name into v_location_name
  from public.locations
  where id = p_location_id and organisation_id = p_organisation_id;

  if v_location_name is null then
    raise exception 'Location not found';
  end if;

  select on_hand into v_on_hand
  from public.inventory_levels
  where location_id = p_location_id and product_variant_id = p_product_variant_id
  for update;

  if coalesce(v_on_hand, 0) < p_quantity then
    raise exception 'Only % units available at %', coalesce(v_on_hand, 0), v_location_name;
  end if;

  insert into public.stock_outs (organisation_id, location_id, product_variant_id, client_id, quantity)
  values (p_organisation_id, p_location_id, p_product_variant_id, p_client_id, p_quantity)
  returning id into v_stock_out_id;

  v_movement_id := public.record_inventory_movement(
    p_organisation_id    => p_organisation_id,
    p_location_id        => p_location_id,
    p_product_variant_id => p_product_variant_id,
    p_movement_type      => 'SALE',
    p_quantity           => -p_quantity,
    p_reference_type     => 'stock_out',
    p_reference_id       => v_stock_out_id
  );

  update public.stock_outs
  set movement_id = v_movement_id
  where id = v_stock_out_id;

  return v_stock_out_id;
end;
$$;
