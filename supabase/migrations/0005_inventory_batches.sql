-- Batch / expiry tracking for received stock (supports a FEFO — first-expiry,
-- first-out — view).
--
-- inventory_batches records a lot of stock received into a location: its batch
-- number, optional expiry date (not every grocery product expires), and how
-- much of the lot is left. Rows are created only by record_inventory_movement()
-- when a PURCHASE_RECEIVED movement carries batch data. Like inventory_movements
-- / inventory_levels it is SELECT-only under RLS and written by the SECURITY
-- DEFINER ledger function — quantity_remaining is not meant to be poked directly.

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  batch_number text not null,
  expiry_date date,
  quantity_received numeric not null check (quantity_received > 0),
  quantity_remaining numeric not null check (quantity_remaining >= 0),
  received_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

-- FEFO lookups are "batches at a location, ordered by expiry".
create index inventory_batches_location_expiry_idx
  on public.inventory_batches (location_id, expiry_date);
create index inventory_batches_product_variant_idx
  on public.inventory_batches (product_variant_id);

alter table public.inventory_batches enable row level security;

create policy "org members can view batches"
  on public.inventory_batches for select
  using (organisation_id in (select user_org_ids()));

-- ---------------------------------------------------------------------------
-- record_inventory_movement gains two optional trailing params: p_batch_number
-- and p_expiry_date. When p_batch_number is supplied on a PURCHASE_RECEIVED
-- movement, an inventory_batches row is created alongside the ledger entry.
--
-- Backward compatible: the new params default to NULL, so any existing call
-- that omits them behaves exactly as before — same inventory_movements row,
-- same inventory_levels upsert, no batch row. record_stock_transfer and
-- receive_purchase_order call this by name with named args and are unaffected.
--
-- Adding parameters needs DROP + CREATE rather than CREATE OR REPLACE. The
-- function is only referenced by name (from other functions and via PostgREST
-- RPC), never as a tracked dependency, so the drop is safe. Runs inside the
-- migration transaction, so there is no window where the function is missing.
-- ---------------------------------------------------------------------------

drop function if exists public.record_inventory_movement(
  uuid, uuid, uuid, text, numeric, text, uuid, text, text
);

create function public.record_inventory_movement(
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
