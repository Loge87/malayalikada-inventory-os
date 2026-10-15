-- Wholesale portal — Phase 2 support.
--
-- 1. set_retailer_status(): approve / suspend / reinstate a retailer from the
--    inventory app, and queue the approval email. A function (not a plain
--    UPDATE) because the email outbox is deliberately not writable by members.
-- 2. record_stock_out(): refuse to sell stock that wholesale orders have
--    reserved. Same function as 0026, only the availability check changes from
--    on_hand to on_hand - reserved.

create or replace function public.set_retailer_status(p_retailer_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retailer public.retailers;
begin
  if p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Invalid status';
  end if;

  select * into v_retailer from public.retailers where id = p_retailer_id for update;
  if v_retailer.id is null then raise exception 'Retailer not found'; end if;
  if not public.portal_caller_is_staff(v_retailer.organisation_id) then
    raise exception 'Not allowed';
  end if;
  if v_retailer.status = p_status then return; end if;

  update public.retailers set
    status = p_status,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    updated_at = now()
  where id = p_retailer_id;

  if p_status = 'approved' then
    insert into public.portal_email_outbox (organisation_id, kind, to_email, subject, body)
    values (v_retailer.organisation_id, 'retailer_approved', v_retailer.email,
            'Your wholesale account has been approved',
            'Hi ' || coalesce(v_retailer.contact_name, v_retailer.business_name) ||
            ', your wholesale account is approved. Sign in to the portal to see prices and place orders.');
  end if;
end;
$$;

revoke all on function public.set_retailer_status(uuid, text) from public, anon;
grant execute on function public.set_retailer_status(uuid, text) to authenticated, service_role;

create or replace function public.record_stock_out(
  p_organisation_id uuid,
  p_location_id uuid,
  p_product_variant_id uuid,
  p_client_id uuid,
  p_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location_name text;
  v_available numeric;
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

  -- on_hand minus stock reserved for wholesale portal orders
  select on_hand - reserved into v_available
  from public.inventory_levels
  where location_id = p_location_id and product_variant_id = p_product_variant_id
  for update;

  if coalesce(v_available, 0) < p_quantity then
    raise exception 'Only % units available at %', greatest(coalesce(v_available, 0), 0), v_location_name;
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
