-- Sufficiency guard for stock-leaving movement types.
--
-- Root cause of the "50 in stock on /products, 0 available in Stock Out"
-- bug: record_inventory_movement had no floor at zero at all — a
-- TRANSFER_OUT of 1000 units from a location that only had 50 was allowed
-- to silently push that location's on_hand to -950, while the paired
-- TRANSFER_IN landed the full 1000 at the destination. Summed across
-- locations that nets out to a normal-looking "50" (/products), while the
-- specific location Stock Out checks was genuinely, correctly negative.
--
-- This adds a check for TRANSFER_OUT, DAMAGE, and EXPIRY — movements that
-- represent real stock leaving a location for a specific reason (moved
-- elsewhere, physically damaged, expired) and can never legitimately remove
-- more than what's actually there. ADJUSTMENT is deliberately left
-- uncapped: it's the intended mechanism for correcting exactly this kind of
-- discrepancy (e.g. reconciling a bad physical count), so it must be able
-- to move on_hand to any value, including through zero, in either
-- direction. RETURN/PURCHASE_RECEIVED/TRANSFER_IN only ever add stock, so
-- they need no check either. SALE already has its own pre-check (Stock
-- Out's record_stock_out RPC, 0024_stock_out.sql) — this doesn't duplicate
-- that, but does mean SALE recorded any other way (a future manual entry,
-- a POS webhook) would NOT be caught here; that's a deliberate choice to
-- match exactly what was asked, not an oversight — extending it to SALE
-- generically is a separate decision.
--
-- `for update` locks the inventory_levels row for the duration of this
-- transaction, so two concurrent stock-leaving movements against the same
-- location/variant can't both read stale on_hand and both pass the check.

create or replace function public.record_inventory_movement(
  p_organisation_id uuid,
  p_location_id uuid,
  p_product_variant_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_external_reference text default null,
  p_note text default null,
  p_batch_number text default null,
  p_expiry_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_current_on_hand numeric;
begin
  -- Fast path: skip the work if this key is already recorded.
  if p_external_reference is not null then
    if exists (
      select 1 from public.inventory_movements
      where organisation_id = p_organisation_id
        and external_reference = p_external_reference
    ) then
      return null; -- already processed, safe no-op
    end if;
  end if;

  -- Sufficiency guard — see the header comment above for which movement
  -- types this applies to and why. Checked against the CURRENT quantity
  -- being applied (p_quantity is already negative for these types, e.g.
  -- record_stock_transfer passes -p_quantity for TRANSFER_OUT), not the
  -- caller's own framing of it.
  if p_movement_type in ('TRANSFER_OUT', 'DAMAGE', 'EXPIRY') then
    select on_hand into v_current_on_hand
    from public.inventory_levels
    where location_id = p_location_id and product_variant_id = p_product_variant_id
    for update;

    if coalesce(v_current_on_hand, 0) + p_quantity < 0 then
      raise exception 'Insufficient stock: % available, % requested',
        coalesce(v_current_on_hand, 0), -p_quantity;
    end if;
  end if;

  -- Authoritative guard: the partial unique index rejects a duplicate
  -- external_reference even if a concurrent call raced past the check above.
  begin
    insert into public.inventory_movements (
      organisation_id, location_id, product_variant_id, movement_type,
      quantity, reference_type, reference_id, external_reference, note, created_by
    ) values (
      p_organisation_id, p_location_id, p_product_variant_id, p_movement_type,
      p_quantity, p_reference_type, p_reference_id, p_external_reference, p_note, auth.uid()
    )
    returning id into v_movement_id;
  exception when unique_violation then
    return null; -- a concurrent call recorded this external_reference first
  end;

  insert into public.inventory_levels (organisation_id, location_id, product_variant_id, on_hand, updated_at)
  values (p_organisation_id, p_location_id, p_product_variant_id, p_quantity, now())
  on conflict (location_id, product_variant_id)
  do update set
    on_hand = public.inventory_levels.on_hand + excluded.on_hand,
    updated_at = now();

  -- Optional batch / expiry tracking — received stock only.
  if p_batch_number is not null then
    if p_movement_type <> 'PURCHASE_RECEIVED' then
      raise exception 'batch tracking only applies to PURCHASE_RECEIVED movements (got %)', p_movement_type;
    end if;

    insert into public.inventory_batches (
      organisation_id, product_variant_id, location_id, batch_number,
      expiry_date, quantity_received, quantity_remaining, created_by
    ) values (
      p_organisation_id, p_product_variant_id, p_location_id, p_batch_number,
      p_expiry_date, p_quantity, p_quantity, auth.uid()
    );
  elsif p_expiry_date is not null then
    raise exception 'expiry_date requires a batch_number';
  end if;

  return v_movement_id;
end;
$$;
