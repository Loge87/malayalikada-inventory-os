-- Stock Out feature — Stage 1: schema.
--
-- Three new tables:
--   user_locations — many-to-many staff-to-location assignment (NOT a single
--     location_id column on user_roles — a staff member can be assigned to
--     more than one location, e.g. covering two stores).
--   clients        — who stock is being handed out to (e.g. a wholesale
--     buyer, a sister store not yet in this system, a market stall).
--   stock_outs     — one row per stock-out transaction: which client took
--     how much of which variant from which location, and the
--     inventory_movements row that actually moved the stock (nullable until
--     that movement is recorded — see Stage 4).
--
-- Same RLS shape as every other business table (locations, products, ...):
-- "org members can access X" for all, scoped by user_org_ids(). Role-tier
-- restriction (e.g. only admin/owner managing clients, or a staff member
-- only recording stock-outs from a location they're assigned to) is
-- enforced app-side, exactly like locations:manage/products:delete already
-- are — RLS here only ever scopes by organisation.

create table public.user_locations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id, location_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  contact_person text,
  phone text not null,
  email text,
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create table public.stock_outs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  quantity numeric not null check (quantity > 0),
  -- Nullable until the ledger movement is recorded (Stage 4: the stock_outs
  -- row is inserted first so record_inventory_movement has a reference_id to
  -- point at, then this is filled in with the movement it produced).
  movement_id uuid references public.inventory_movements (id),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index stock_outs_location_id_idx on public.stock_outs (location_id);
create index stock_outs_client_id_idx on public.stock_outs (client_id);

alter table public.user_locations enable row level security;
alter table public.clients        enable row level security;
alter table public.stock_outs     enable row level security;

create policy "org members can access user_locations"
  on public.user_locations for all
  using (organisation_id in (select public.user_org_ids()))
  with check (organisation_id in (select public.user_org_ids()));

create policy "org members can access clients"
  on public.clients for all
  using (organisation_id in (select public.user_org_ids()))
  with check (organisation_id in (select public.user_org_ids()));

create policy "org members can access stock_outs"
  on public.stock_outs for all
  using (organisation_id in (select public.user_org_ids()))
  with check (organisation_id in (select public.user_org_ids()));

-- delete_location() (0020_location_delete.sql) already blocks a hard delete
-- when inventory_movements/inventory_levels/inventory_batches/stock_counts/
-- purchase_orders reference the location, deactivating it instead — the
-- same reasoning now applies to stock_outs (also ON DELETE CASCADE above,
-- and a real business record, not config). Redefined here rather than
-- editing 0020 in place, since that migration may already have been applied
-- — CREATE OR REPLACE is idempotent either way.
create or replace function public.delete_location(
  p_organisation_id uuid,
  p_location_id uuid
)
returns text -- 'deleted' or 'deactivated'
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_has_history boolean;
begin
  if not exists (
    select 1 from public.locations
    where id = p_location_id and organisation_id = p_organisation_id
  ) then
    raise exception 'Location not found';
  end if;

  select
    exists (
      select 1 from public.inventory_movements where location_id = p_location_id
    )
    or exists (
      select 1 from public.inventory_levels where location_id = p_location_id
    )
    or exists (
      select 1 from public.inventory_batches where location_id = p_location_id
    )
    or exists (
      select 1 from public.stock_counts where location_id = p_location_id
    )
    or exists (
      select 1 from public.purchase_orders where destination_location_id = p_location_id
    )
    or exists (
      select 1 from public.stock_outs where location_id = p_location_id
    )
  into v_has_history;

  if v_has_history then
    update public.locations
    set is_active = false
    where id = p_location_id and organisation_id = p_organisation_id;
    return 'deactivated';
  end if;

  delete from public.locations
  where id = p_location_id and organisation_id = p_organisation_id;
  return 'deleted';
end;
$$;
