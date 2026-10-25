-- Barcode scans look up product_variants by (organisation_id, barcode) and
-- then join inventory_levels by product_variant_id. Neither had an index, so
-- every scan was a sequential scan that gets slower as the catalogue grows.

create index if not exists product_variants_org_barcode_idx
  on public.product_variants (organisation_id, barcode)
  where barcode is not null;

create index if not exists inventory_levels_variant_idx
  on public.inventory_levels (product_variant_id);
