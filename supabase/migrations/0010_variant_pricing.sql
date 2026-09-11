-- Pricing / pack-size fields on product_variants, plus an atomic "create
-- variant (+ optional product) with optional initial stock" path.
--
-- Currency is validated app-side against a small, easily-extended constant
-- list rather than a DB CHECK, so adding a currency later doesn't need a
-- migration.

alter table public.product_variants
  add column currency text not null default 'NZD',
  add column pack_price numeric check (pack_price >= 0),
  add column units_per_pack numeric not null default 1 check (units_per_pack > 0),
  add column unit_price numeric check (unit_price >= 0);

------------------------------------------------------------------------------
-- create_product_variant: insert a variant and, if a location + quantity are
-- given, record the opening stock through the ledger (never inventory_levels
-- directly) as a single PURCHASE_RECEIVED movement, reference_type
-- 'initial_stock', reference_id = the new variant's id. One transaction.
------------------------------------------------------------------------------
create or replace function public.create_product_variant(
  p_organisation_id uuid,
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_unit text,
  p_currency text,
  p_pack_price numeric,
  p_units_per_pack numeric,
  p_unit_price numeric,
  p_initial_location_id uuid default null,
  p_initial_quantity numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_variant_id uuid;
begin
  insert into public.product_variants (
    organisation_id, product_id, name, sku, barcode, unit,
    currency, pack_price, units_per_pack, unit_price
  ) values (
    p_organisation_id, p_product_id, p_name, p_sku, p_barcode, p_unit,
    p_currency, p_pack_price, p_units_per_pack, p_unit_price
  )
  returning id into v_variant_id;

  if p_initial_location_id is not null
     and p_initial_quantity is not null
     and p_initial_quantity > 0 then
    perform public.record_inventory_movement(
      p_organisation_id    => p_organisation_id,
      p_location_id        => p_initial_location_id,
      p_product_variant_id => v_variant_id,
      p_movement_type      => 'PURCHASE_RECEIVED',
      p_quantity           => p_initial_quantity,
      p_reference_type     => 'initial_stock',
      p_reference_id       => v_variant_id
    );
  end if;

  return v_variant_id;
end;
$$;

------------------------------------------------------------------------------
-- create_product_with_variant: the /products/new (scan) entry point. Creates
-- the product, then delegates to create_product_variant for the variant +
-- optional initial stock — so both entry points share the same variant-
-- creation and stock-recording code, not two implementations. One transaction.
------------------------------------------------------------------------------
create or replace function public.create_product_with_variant(
  p_organisation_id uuid,
  p_product_name text,
  p_category text,
  p_variant_name text,
  p_sku text,
  p_barcode text,
  p_unit text,
  p_currency text,
  p_pack_price numeric,
  p_units_per_pack numeric,
  p_unit_price numeric,
  p_initial_location_id uuid default null,
  p_initial_quantity numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_product_id uuid;
begin
  insert into public.products (organisation_id, name, category)
  values (p_organisation_id, p_product_name, p_category)
  returning id into v_product_id;

  return public.create_product_variant(
    p_organisation_id, v_product_id, p_variant_name, p_sku, p_barcode, p_unit,
    p_currency, p_pack_price, p_units_per_pack, p_unit_price,
    p_initial_location_id, p_initial_quantity
  );
end;
$$;
