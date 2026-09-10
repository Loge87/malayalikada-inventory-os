-- Harden record_inventory_movement() against search_path hijacking.
--
-- The function is SECURITY DEFINER (it runs as the owner to bypass the
-- SELECT-only RLS on inventory_movements / inventory_levels). The original
-- definition (0001) had no `search_path` pin and referenced its tables
-- unqualified, so a caller could prepend a schema to their session
-- search_path containing look-alike `inventory_movements` / `inventory_levels`
-- tables and have the definer-privileged function write those instead.
--
-- Fix: pin `search_path` to `public, pg_temp` (pg_temp explicitly last so a
-- temp table can't shadow a real one) and schema-qualify every table
-- reference. Behaviour is otherwise identical to 0001.

create or replace function public.record_inventory_movement(
  p_organisation_id uuid,
  p_location_id uuid,
  p_product_variant_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_external_reference text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
begin
  -- Idempotency check: if this external_reference was already processed, do nothing.
  if p_external_reference is not null then
    if exists (
      select 1 from public.inventory_movements
      where organisation_id = p_organisation_id
        and external_reference = p_external_reference
    ) then
      return null; -- already processed, safe no-op
    end if;
  end if;

  insert into public.inventory_movements (
    organisation_id, location_id, product_variant_id, movement_type,
    quantity, reference_type, reference_id, external_reference, note, created_by
  ) values (
    p_organisation_id, p_location_id, p_product_variant_id, p_movement_type,
    p_quantity, p_reference_type, p_reference_id, p_external_reference, p_note, auth.uid()
  )
  returning id into v_movement_id;

  insert into public.inventory_levels (organisation_id, location_id, product_variant_id, on_hand, updated_at)
  values (p_organisation_id, p_location_id, p_product_variant_id, p_quantity, now())
  on conflict (location_id, product_variant_id)
  do update set
    on_hand = public.inventory_levels.on_hand + excluded.on_hand,
    updated_at = now();

  return v_movement_id;
end;
$$;
