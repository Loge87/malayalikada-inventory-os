-- Minimal POS-ready integration layer.
-- See docs/PRODUCT_SPEC.md — "POS INTEGRATION ARCHITECTURE" and
-- "POS ACCEPTANCE CRITERIA".
--
-- integration_events is the append-only audit trail: every event received from
-- an external channel gets a row, whether it is processed, skipped or fails.
-- Stock idempotency is enforced downstream by record_inventory_movement (it
-- no-ops a repeated external_reference), so a retried/duplicate webhook lands as
-- another audit row but never double-deducts stock.
--
-- external_location_mappings resolves a channel's own location id (e.g.
-- 'STORE_01') to an internal locations.id.

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  source_system text not null,
  event_type text not null,
  external_reference text,
  payload jsonb not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'failed')),
  retry_count integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index integration_events_org_status_idx
  on public.integration_events (organisation_id, processing_status);
create index integration_events_org_external_ref_idx
  on public.integration_events (organisation_id, external_reference);

create table public.external_location_mappings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  source_system text not null default 'POS',
  location_external_id text not null,
  location_id uuid not null references public.locations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organisation_id, source_system, location_external_id)
);

alter table public.integration_events enable row level security;
alter table public.external_location_mappings enable row level security;

-- integration_events is written by the service-role webhook handler, so members
-- only get read access (audit view / reconciliation), like inventory_movements.
create policy "org members can view integration events"
  on public.integration_events for select
  using (organisation_id in (select user_org_ids()));

-- Mappings are operator-managed configuration, so members get full access
-- within their org (like locations / products).
create policy "org members can access location mappings"
  on public.external_location_mappings for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));
