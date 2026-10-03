-- Splits price_formulas into a draft row (what the canvas edits) and,
-- once Apply Changes has ever been pressed, an active row (what every real
-- retail_price/wholesale_price computation reads) per organisation +
-- formula_type. Existing rows all become drafts (the column default) —
-- there is no active row for any organisation yet, which is correct: no
-- formula has ever been applied before this migration existed.

alter table public.price_formulas
  add column status text not null default 'draft' check (status in ('draft', 'active'));

alter table public.price_formulas
  drop constraint if exists price_formulas_organisation_id_formula_type_key;

alter table public.price_formulas
  add constraint price_formulas_organisation_id_formula_type_status_key
  unique (organisation_id, formula_type, status);
