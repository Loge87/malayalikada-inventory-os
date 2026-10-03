-- Replaces the freeform node-graph price_formulas (0028_*.sql) with a flat,
-- left-to-right chain — the canvas is no longer a general graph (boxes
-- connected by arbitrary wires, x/y positions, operator nodes with two
-- input handles); it's a single ordered sequence: a fixed starting value,
-- then zero or more (operator, variable) steps applied one after another,
-- in order. "Unit Price + CGST + SGST" is the entire shape — no branching,
-- no nesting, no layout to persist.
--
-- Nothing from the old graph carries forward (confirmed explicitly — any
-- previously-saved formula is being discarded, not migrated), so this is a
-- clean drop + recreate rather than an ALTER. price_variables (0028_*.sql)
-- is untouched: named variables are exactly as reusable under a flat chain
-- as they were as graph nodes.
--
-- No draft/active status distinction yet — every row here is implicitly
-- "the current draft," there is exactly one per org per formula_type, same
-- as before. That distinction (and the clone-on-Apply semantics it needs)
-- is a later, separate schema change, once there's an actual "Apply" step
-- to support — adding it now would be building ahead of the stage that
-- needs it.

drop table if exists public.price_formulas;

create table public.price_formulas (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  formula_type text not null check (formula_type in ('retail', 'wholesale')),
  -- Array of {operator, variableId} in application order — e.g.
  -- [{"operator": "add", "variableId": "<cgst-id>"}, {"operator": "add",
  -- "variableId": "<sgst-id>"}] represents "Unit Price + CGST + SGST". The
  -- fixed starting value (Unit Price / Pack-Box Price) is never stored
  -- here — it's implied by formula_type and the product's own current
  -- price at evaluation time, never a value that could itself go stale in
  -- this table. `operator` is one of 'add'/'subtract'/'multiply'/'divide'/
  -- 'percent' (lib/price-formula.ts's OPERATOR_KINDS) and `variableId`
  -- references price_variables.id — both validated app-side, same
  -- "small fixed vocabulary, no jsonb-shape constraint" choice as before.
  -- A variableId that no longer resolves (its variable was deleted) is an
  -- evaluation-time concern (lib/price-formula.ts), not something enforced
  -- at write time here.
  chain jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  -- One row per org per formula_type — unchanged from before.
  unique (organisation_id, formula_type)
);

alter table public.price_formulas enable row level security;

create policy "org members can access price formulas"
  on public.price_formulas for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));
