-- Stock count workflow.
-- See CLAUDE.md and docs/PRODUCT_SPEC.md (MVP: "stock counts, adjustments").
--
-- A count snapshots inventory_levels.on_hand per variant at a location, staff
-- enter the physically counted quantities, and completing the count records one
-- ADJUSTMENT ledger movement per discrepancy (reference_type 'stock_count',
-- reference_id = the count id) then closes it. Nothing writes inventory_levels
-- directly — the corrections go through record_inventory_movement like every
-- other stock change.

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  started_by uuid not null default auth.uid() references auth.users (id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One active count per location — prevents two counts snapshotting the same
-- expected quantities and both applying adjustments.
create unique index stock_counts_one_in_progress_per_location_idx
  on public.stock_counts (organisation_id, location_id)
  where status = 'in_progress';

create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  stock_count_id uuid not null references public.stock_counts (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  expected_quantity numeric not null,
  counted_quantity numeric,
  created_at timestamptz not null default now(),
  unique (stock_count_id, product_variant_id)
);

create index stock_count_items_stock_count_id_idx
  on public.stock_count_items (stock_count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

create policy "org members can access stock counts"
  on public.stock_counts for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create policy "org members can access stock count items"
  on public.stock_count_items for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

------------------------------------------------------------------------------
-- start_stock_count: open a count and snapshot every variant held at the
-- location, all in one transaction.
------------------------------------------------------------------------------
create or replace function public.start_stock_count(
  p_organisation_id uuid,
  p_location_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_count_id uuid;
begin
  begin
    insert into public.stock_counts (organisation_id, location_id)
    values (p_organisation_id, p_location_id)
    returning id into v_count_id;
  exception when unique_violation then
    raise exception 'A stock count is already in progress for this location';
  end;

  insert into public.stock_count_items (
    organisation_id, stock_count_id, product_variant_id, expected_quantity
  )
  select il.organisation_id, v_count_id, il.product_variant_id, il.on_hand
  from public.inventory_levels il
  where il.organisation_id = p_organisation_id
    and il.location_id = p_location_id;

  return v_count_id;
end;
$$;

------------------------------------------------------------------------------
-- save_stock_count_counts: persist entered counts for an in-progress count.
-- p_counts is [{ "item_id": <uuid>, "counted_quantity": <number|null> }].
-- Only counted_quantity is writable here — expected_quantity is the snapshot.
------------------------------------------------------------------------------
create or replace function public.save_stock_count_counts(
  p_organisation_id uuid,
  p_stock_count_id uuid,
  p_counts jsonb
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.stock_counts
  where id = p_stock_count_id and organisation_id = p_organisation_id;

  if not found then
    raise exception 'Stock count not found';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'Stock count is already completed';
  end if;

  update public.stock_count_items sci
  set counted_quantity = nullif(c.val ->> 'counted_quantity', '')::numeric
  from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) as c(val)
  where sci.id = (c.val ->> 'item_id')::uuid
    and sci.stock_count_id = p_stock_count_id
    and sci.organisation_id = p_organisation_id;
end;
$$;

------------------------------------------------------------------------------
-- complete_stock_count: persist final counts, record one ADJUSTMENT per
-- discrepancy through the ledger, then close the count. One transaction; the
-- row lock + status check make it safe against a double-click.
------------------------------------------------------------------------------
create or replace function public.complete_stock_count(
  p_organisation_id uuid,
  p_stock_count_id uuid,
  p_counts jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_count public.stock_counts;
  v_item public.stock_count_items;
begin
  select * into v_count
  from public.stock_counts
  where id = p_stock_count_id and organisation_id = p_organisation_id
  for update;

  if not found then
    raise exception 'Stock count not found';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'Stock count is already completed';
  end if;

  perform public.save_stock_count_counts(p_organisation_id, p_stock_count_id, p_counts);

  for v_item in
    select * from public.stock_count_items
    where stock_count_id = p_stock_count_id
      and counted_quantity is not null
      and counted_quantity <> expected_quantity
  loop
    perform public.record_inventory_movement(
      p_organisation_id    => p_organisation_id,
      p_location_id        => v_count.location_id,
      p_product_variant_id => v_item.product_variant_id,
      p_movement_type      => 'ADJUSTMENT',
      p_quantity           => v_item.counted_quantity - v_item.expected_quantity,
      p_reference_type     => 'stock_count',
      p_reference_id       => p_stock_count_id,
      p_external_reference => null,
      p_note               => null
    );
  end loop;

  update public.stock_counts
  set status = 'completed', completed_at = now()
  where id = p_stock_count_id;
end;
$$;
