-- Adds retail_price and wholesale_price to product_variants, alongside the
-- existing pack_price/unit_price (0010_variant_pricing.sql). pack_price and
-- unit_price are cost-side (what a pack/unit costs to buy in); retail_price
-- and wholesale_price are the two customer-facing selling prices. All four
-- stay independent, nullable numerics — nothing here derives one from
-- another.

alter table public.product_variants
  add column retail_price numeric check (retail_price >= 0),
  add column wholesale_price numeric check (wholesale_price >= 0);

------------------------------------------------------------------------------
-- create_product_variant / create_product_with_variant: thread the two new
-- prices through. Adding parameters needs DROP + CREATE, not CREATE OR
-- REPLACE — same reasoning as 0011's p_brand addition: both are only ever
-- called by name via RPC, so changing their signature is safe.
------------------------------------------------------------------------------
drop function if exists public.create_product_variant(
  uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, uuid, numeric
);

create function public.create_product_variant(
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
  p_retail_price numeric,
  p_wholesale_price numeric,
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
    currency, pack_price, units_per_pack, unit_price,
    retail_price, wholesale_price
  ) values (
    p_organisation_id, p_product_id, p_name, p_sku, p_barcode, p_unit,
    p_currency, p_pack_price, p_units_per_pack, p_unit_price,
    p_retail_price, p_wholesale_price
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

drop function if exists public.create_product_with_variant(
  uuid, text, text, text, text, text, text, text, numeric, numeric, numeric, uuid, numeric
);

create function public.create_product_with_variant(
  p_organisation_id uuid,
  p_product_name text,
  p_category text,
  p_brand text,
  p_variant_name text,
  p_sku text,
  p_barcode text,
  p_unit text,
  p_currency text,
  p_pack_price numeric,
  p_units_per_pack numeric,
  p_unit_price numeric,
  p_retail_price numeric,
  p_wholesale_price numeric,
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
  insert into public.products (organisation_id, name, category, brand)
  values (p_organisation_id, p_product_name, p_category, p_brand)
  returning id into v_product_id;

  return public.create_product_variant(
    p_organisation_id, v_product_id, p_variant_name, p_sku, p_barcode, p_unit,
    p_currency, p_pack_price, p_units_per_pack, p_unit_price,
    p_retail_price, p_wholesale_price,
    p_initial_location_id, p_initial_quantity
  );
end;
$$;
