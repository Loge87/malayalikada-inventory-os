-- Initial schema for the Malayalikada Grocery Inventory OS.
--
-- This file was reconstructed on 2026-09-10 from the live database
-- (information_schema / pg_catalog introspection) because the original schema
-- was applied directly through the Supabase SQL editor and never committed.
-- It reproduces exactly what is live: 7 core tables, the `user_org_ids()` and
-- `record_inventory_movement()` functions, and their RLS policies. There are no
-- triggers — `inventory_levels` is maintained inside the ledger function.
--
-- The database this describes already exists, so when adopting the migration
-- history, mark 0001 as applied rather than re-running it.
--
-- Architecture (see CLAUDE.md):
--   organisation -> locations -> products -> product_variants -> inventory_levels
--   Stock only ever changes via record_inventory_movement(), which inserts an
--   inventory_movements row and folds it into the derived inventory_levels
--   aggregate. inventory_movements / inventory_levels have a SELECT-only RLS
--   policy, so nothing outside the SECURITY DEFINER function can write them.

-- gen_random_uuid() is in core Postgres (>= 13); no extension needed.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  type text not null check (type in ('warehouse', 'store')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  category text,
  brand text,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  sku text not null,
  barcode text,
  unit text not null default 'each',
  created_at timestamptz not null default now(),
  unique (organisation_id, sku)
);

create table public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  on_hand numeric not null default 0,
  reserved numeric not null default 0,
  incoming numeric not null default 0,
  in_transit numeric not null default 0,
  damaged numeric not null default 0,
  expired numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (location_id, product_variant_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  movement_type text not null check (movement_type in (
    'PURCHASE_RECEIVED', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN',
    'DAMAGE', 'EXPIRY', 'ADJUSTMENT', 'RETURN'
  )),
  quantity numeric not null,
  reference_type text,
  reference_id uuid,
  external_reference text,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Helper: the organisation ids the current user belongs to
------------------------------------------------------------------------------

-- SECURITY DEFINER so RLS policies can call it without recursing through
-- user_roles' own policy. Live definition has no `set search_path`; every
-- reference inside is already schema-qualified.
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
as $$
  select organisation_id from public.user_roles where user_id = auth.uid();
$$;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------

alter table public.organisations      enable row level security;
alter table public.user_roles         enable row level security;
alter table public.locations          enable row level security;
alter table public.products           enable row level security;
alter table public.product_variants   enable row level security;
alter table public.inventory_levels   enable row level security;
alter table public.inventory_movements enable row level security;

create policy "org members can view their org"
  on public.organisations for select
  using (id in (select user_org_ids()));

create policy "org members can view their roles"
  on public.user_roles for select
  using (organisation_id in (select user_org_ids()));

create policy "org members can access locations"
  on public.locations for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create policy "org members can access products"
  on public.products for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create policy "org members can access variants"
  on public.product_variants for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create policy "org members can view inventory levels"
  on public.inventory_levels for select
  using (organisation_id in (select user_org_ids()));

create policy "org members can view movements"
  on public.inventory_movements for select
  using (organisation_id in (select user_org_ids()));

-- NOTE: inventory_movements / inventory_levels deliberately have no
-- INSERT/UPDATE/DELETE policy. All writes go through record_inventory_movement()
-- below, which is SECURITY DEFINER.

------------------------------------------------------------------------------
-- The ledger function: the only supported way to change stock
------------------------------------------------------------------------------

-- Verbatim from the live database. SECURITY DEFINER (bypasses the SELECT-only
-- RLS on inventory_movements / inventory_levels); no `set search_path` pin, and
-- the table references inside are unqualified — matching what is live.
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
as $$
declare
  v_movement_id uuid;
begin
  -- Idempotency check: if this external_reference was already processed, do nothing.
  if p_external_reference is not null then
    if exists (
      select 1 from inventory_movements
      where organisation_id = p_organisation_id
        and external_reference = p_external_reference
    ) then
      return null; -- already processed, safe no-op
    end if;
  end if;

  insert into inventory_movements (
    organisation_id, location_id, product_variant_id, movement_type,
    quantity, reference_type, reference_id, external_reference, note, created_by
  ) values (
    p_organisation_id, p_location_id, p_product_variant_id, p_movement_type,
    p_quantity, p_reference_type, p_reference_id, p_external_reference, p_note, auth.uid()
  )
  returning id into v_movement_id;

  insert into inventory_levels (organisation_id, location_id, product_variant_id, on_hand, updated_at)
  values (p_organisation_id, p_location_id, p_product_variant_id, p_quantity, now())
  on conflict (location_id, product_variant_id)
  do update set
    on_hand = inventory_levels.on_hand + excluded.on_hand,
    updated_at = now();

  return v_movement_id;
end;
$$;

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------

-- The original schema was applied through the Supabase SQL editor as `postgres`,
-- so table privileges for `anon` / `authenticated` / `service_role` come from
-- Supabase's default privileges rather than explicit GRANTs. A fresh
-- `supabase db reset` reproduces the same grants for the same reason.
