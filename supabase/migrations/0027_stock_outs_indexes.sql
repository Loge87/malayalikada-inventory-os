-- Missing indexes on stock_outs, found while diagnosing slow /stock-out
-- History filtering. 0021_stock_out_schema.sql only indexed location_id and
-- client_id — product_variant_id (the Product filter) and created_at (the
-- default sort, and the date-range filter) had none at all, meaning both
-- degrade to a sequential scan as the table grows. organisation_id wasn't
-- on the original list either, but it's the same class of gap and matters
-- on every single query against this table regardless of which filters are
-- applied — it's what RLS (user_org_ids()) implicitly filters by.

create index if not exists stock_outs_product_variant_id_idx
  on public.stock_outs (product_variant_id);

create index if not exists stock_outs_created_at_idx
  on public.stock_outs (created_at desc);

create index if not exists stock_outs_organisation_id_idx
  on public.stock_outs (organisation_id);
