-- Splits Price Settings into two independent rate sets — retail and
-- wholesale — instead of one set applied to both. The existing
-- cgst_percent/sgst_percent/profit_margin_percent/logistics_charges_percent/
-- additional_charges_percent columns (0016_price_settings.sql) become the
-- RETAIL rate set as-is (no rename — any already-saved row keeps meaning
-- exactly what it always meant for retail). This adds a mirrored wholesale_*
-- rate set, plus a flag: when true, wholesale price calculates from the
-- retail rates instead (live — re-reads retail's current values every time,
-- never a stale copy taken at save time). Defaults true, so an org that
-- saved settings before this migration keeps behaving exactly as before
-- (wholesale mirrored the one rate set) until they explicitly customize
-- wholesale and uncheck it.

alter table public.price_settings
  add column wholesale_cgst_percent numeric not null default 0
    check (wholesale_cgst_percent >= 0),
  add column wholesale_sgst_percent numeric not null default 0
    check (wholesale_sgst_percent >= 0),
  add column wholesale_profit_margin_percent numeric not null default 0
    check (wholesale_profit_margin_percent >= 0),
  add column wholesale_logistics_charges_percent numeric not null default 0
    check (wholesale_logistics_charges_percent >= 0),
  add column wholesale_additional_charges_percent numeric not null default 0
    check (wholesale_additional_charges_percent >= 0),
  add column wholesale_use_same_as_retail boolean not null default true;
