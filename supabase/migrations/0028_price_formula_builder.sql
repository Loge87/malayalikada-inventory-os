-- Visual Price Formula Builder — Stage 1: schema.
--
-- Two new tables, replacing the CGST/SGST/margin/logistics/additional-charges
-- calculation (price_settings, 0016/0019_*.sql) with a user-built graph:
--
--   price_variables — named values an org defines once and reuses across
--     formulas (e.g. "GST" = 9, percentage). Standalone rows, not scoped to
--     retail or wholesale — the same variable can be dragged onto either
--     canvas.
--   price_formulas  — the saved graph itself, one row per org per canvas
--     ('retail' or 'wholesale'). nodes/edges are stored exactly as React
--     Flow represents them (jsonb), so canvas position/zoom/connections
--     round-trip byte-for-byte with no lossy re-derivation — this table is
--     a serialized UI document, not a normalized formula representation.
--     The evaluator (Stage 4) is what actually interprets the graph; this
--     table just persists it.
--
-- Same RLS shape as every other business table: "org members can access X"
-- for all, scoped by user_org_ids(). Role-tier restriction (admin/owner
-- only) is enforced app-side via lib/permissions.ts "pricing:manage" — the
-- same permission price_settings already gates, since this IS price
-- settings, just a different editor for it. Not a new permission.

create table public.price_variables (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  -- Deliberately unconstrained in sign (no `>= 0` check, unlike
  -- pack_price/unit_price/retail_price/wholesale_price elsewhere) — those
  -- are literal prices, always non-negative; a price variable is whatever
  -- the org defines it to mean, and a negative value (e.g. a flat discount
  -- amount meant to be added, not subtracted) is a legitimate modelling
  -- choice the graph shouldn't foreclose.
  value numeric not null,
  value_type text not null check (value_type in ('number', 'percentage', 'currency')),
  created_at timestamptz not null default now(),
  -- Two variables with the same name in one org would be genuinely
  -- confusing in the canvas's variable picker/list (which node is which?)
  -- — this is a UX guard, not something the spec asked for outright, but
  -- cheap to add now and hard to retrofit once real data exists.
  unique (organisation_id, name)
);

alter table public.price_variables enable row level security;

create policy "org members can access price variables"
  on public.price_variables for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));

create table public.price_formulas (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  formula_type text not null check (formula_type in ('retail', 'wholesale')),
  -- Array of {id, type, position: {x, y}, data} — `type` distinguishes the
  -- fixed start node ("unit_price" / "pack_box_price"), a `variable` node
  -- (data references a price_variables.id), and an `operator` node (data
  -- names +, -, x, /, %). Shape enforced app-side (Stage 3/4), not by a
  -- jsonb schema constraint — same "validate in the application layer"
  -- choice this codebase already makes for currency/value_type-style small
  -- fixed vocabularies, just one level deeper (a whole node shape, not a
  -- single column) because Postgres has no practical way to constrain
  -- jsonb array-of-object shape without a much heavier check.
  nodes jsonb not null default '[]'::jsonb,
  -- Array of {id, source, target} — a plain edge list, React Flow's own
  -- shape. Which edges are actually reachable from the start node (i.e.
  -- which ones the evaluator uses) is a Stage 4 concern, not something
  -- enforced at write time here.
  edges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  -- One canvas per org per type — the two canvases the spec describes
  -- ("Retail Price" and "Wholesale Price") are exactly these two rows,
  -- never more. Enables a plain upsert(onConflict: "organisation_id,
  -- formula_type"), same shape as price_settings' single-row-per-org
  -- upsert.
  unique (organisation_id, formula_type)
);

alter table public.price_formulas enable row level security;

create policy "org members can access price formulas"
  on public.price_formulas for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));
