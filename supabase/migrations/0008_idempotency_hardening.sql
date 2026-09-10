-- Idempotency hardening for record_inventory_movement + integration_events.
--
-- The idempotency guard was a check-then-insert (IF EXISTS ... THEN return;
-- INSERT ...) with no constraint behind it. Sequential single calls were always
-- caught, but two calls with the same external_reference that both pass the
-- EXISTS check before either commits (concurrent delivery / aggressive webhook
-- retries) could both insert and double-deduct stock.
--
-- 1. A partial unique index makes a duplicate (organisation_id,
--    external_reference) impossible at the storage layer.
-- 2. record_inventory_movement catches the resulting unique_violation and
--    treats it as the same safe no-op as an EXISTS hit (returns NULL).
-- 3. integration_events gains a 'duplicate' status so an idempotent no-op is
--    distinguishable from a real processing outcome in the audit trail.
--
-- Every statement here is written to be safely re-runnable.

-- 1. Partial unique index.
-- Build fails if duplicates already exist. Find them with:
--   select organisation_id, external_reference, count(*)
--   from public.inventory_movements
--   where external_reference is not null
--   group by 1, 2 having count(*) > 1;
create unique index if not exists inventory_movements_org_external_reference_key
  on public.inventory_movements (organisation_id, external_reference)
  where external_reference is not null;

-- 2. Ledger function — CREATE OR REPLACE, so this is idempotent and guarantees
--    the unique_violation handler is present regardless of prior state.
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

-- 3. integration_events status — drop-if-exists then add, so re-running just
--    replaces the constraint with an identical one.
alter table public.integration_events
  drop constraint if exists integration_events_processing_status_check;
alter table public.integration_events
  add constraint integration_events_processing_status_check
  check (processing_status in ('pending', 'processed', 'failed', 'duplicate'));
