-- Atomic stock transfer between two locations.
--
-- A transfer is two ledger movements that must succeed or fail together:
--   * TRANSFER_OUT at the source location      (negative quantity)
--   * TRANSFER_IN  at the destination location  (positive quantity)
-- Both carry the same reference_type ('TRANSFER') and reference_id, so the
-- pair can be traced back to one transfer event later.
--
-- supabase-js / PostgREST cannot span a single transaction across two separate
-- .rpc() calls, so the two record_inventory_movement() calls are wrapped here.
-- A plpgsql function body runs in one transaction: if the TRANSFER_IN call
-- raises, the TRANSFER_OUT call is rolled back with it and the source is never
-- deducted.
--
-- Assumes the record_inventory_movement() signature from 0001_init.sql:
--   record_inventory_movement(
--     p_organisation_id, p_location_id, p_product_variant_id,
--     p_movement_type, p_quantity,
--     p_reference_type, p_reference_id, p_external_reference, p_note)

create or replace function public.record_stock_transfer(
  p_organisation_id uuid,
  p_source_location_id uuid,
  p_destination_location_id uuid,
  p_product_variant_id uuid,
  p_quantity numeric,
  p_reference_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Transfer quantity must be a positive number';
  end if;

  if p_source_location_id = p_destination_location_id then
    raise exception 'Source and destination locations must be different';
  end if;

  -- Deduct from the source.
  perform record_inventory_movement(
    p_organisation_id    => p_organisation_id,
    p_location_id        => p_source_location_id,
    p_product_variant_id => p_product_variant_id,
    p_movement_type      => 'TRANSFER_OUT',
    p_quantity           => -p_quantity,
    p_reference_type     => 'TRANSFER',
    p_reference_id       => p_reference_id,
    p_external_reference => null,
    p_note               => p_note
  );

  -- Add to the destination. If this raises, the TRANSFER_OUT above rolls back
  -- with it.
  perform record_inventory_movement(
    p_organisation_id    => p_organisation_id,
    p_location_id        => p_destination_location_id,
    p_product_variant_id => p_product_variant_id,
    p_movement_type      => 'TRANSFER_IN',
    p_quantity           => p_quantity,
    p_reference_type     => 'TRANSFER',
    p_reference_id       => p_reference_id,
    p_external_reference => null,
    p_note               => p_note
  );

  return p_reference_id;
end;
$$;
