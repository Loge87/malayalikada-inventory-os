-- Per-line-item batch / expiry data when receiving a purchase order.
--
-- receive_purchase_order gains p_batches: a JSON array of
--   { "purchase_order_item_id": <uuid>, "batch_number": <text>, "expiry_date": <date|null> }
--
-- For each PO line item with a matching entry that carries a batch_number, the
-- PURCHASE_RECEIVED movement is recorded with that batch data, so
-- record_inventory_movement (0005) creates the inventory_batches row. Line items
-- with no entry are received exactly as before — p_batches defaults to '[]', so
-- an existing 2-argument call is unchanged.
--
-- Adding a parameter needs DROP + CREATE (CREATE OR REPLACE cannot change the
-- argument list). The function is only ever called via PostgREST RPC, so the
-- drop has no dependents; it runs inside the migration transaction.

drop function if exists public.receive_purchase_order(uuid, uuid);

create function public.receive_purchase_order(
  p_organisation_id uuid,
  p_purchase_order_id uuid,
  p_batches jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_po public.purchase_orders;
  v_item public.purchase_order_items;
  v_batch_number text;
  v_expiry_date date;
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
    -- Look up this line item's batch entry (if any). SELECT ... INTO sets both
    -- targets to NULL when nothing matches, so they reset every iteration.
    select
      nullif(btrim(b.entry ->> 'batch_number'), ''),
      nullif(b.entry ->> 'expiry_date', '')::date
    into v_batch_number, v_expiry_date
    from jsonb_array_elements(coalesce(p_batches, '[]'::jsonb)) as b(entry)
    where b.entry ->> 'purchase_order_item_id' = v_item.id::text
    limit 1;

    perform public.record_inventory_movement(
      p_organisation_id    => p_organisation_id,
      p_location_id        => v_po.destination_location_id,
      p_product_variant_id => v_item.product_variant_id,
      p_movement_type      => 'PURCHASE_RECEIVED',
      p_quantity           => v_item.quantity_ordered,
      p_reference_type     => 'purchase_order',
      p_reference_id       => p_purchase_order_id,
      p_external_reference => null,
      p_note               => null,
      p_batch_number       => v_batch_number,
      p_expiry_date        => v_expiry_date
    );
  end loop;

  update public.purchase_orders
     set status = 'received',
         received_at = now()
   where id = p_purchase_order_id;
end;
$function$;
