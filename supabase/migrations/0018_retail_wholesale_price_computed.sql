-- Retail price and wholesale price are both calculated (never entered
-- manually) via the organisation's Price Settings (CGST, SGST, profit
-- margin, logistics charges, additional charges — src/lib/
-- price-calculation.ts): retail_price applies that multiplier to
-- unit_price (selling one at a time); wholesale_price applies the exact
-- same multiplier to pack_price (selling by the case). Drops both manual
-- columns added in 0015_variant_retail_wholesale_price.sql — a stored
-- value for either would go stale the moment CGST/SGST/margin/charges
-- change, which defeats the point of them being calculated figures.
--
-- pack_price itself is unchanged and NOT run through the Price Settings
-- multiplier — it stays the simple, manually-overridable
-- product_variants.pack_price (unit_price × units_per_pack,
-- 0010_variant_pricing.sql). Only retail_price and wholesale_price are
-- derived from unit_price/pack_price at render time.

alter table public.product_variants
  drop column retail_price,
  drop column wholesale_price;

------------------------------------------------------------------------------
-- create_product_variant / create_product_with_variant: drop both
-- p_retail_price and p_wholesale_price, back to their pre-0015 shape
-- (0010_variant_pricing.sql / 0011_product_images.sql) — DROP + CREATE,
-- same reasoning as every prior parameter change to these two.
------------------------------------------------------------------------------
drop function if exists public.create_product_variant(
  uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, uuid, numeric
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

drop function if exists public.create_product_with_variant(
  uuid, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, uuid, numeric
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
    p_initial_location_id, p_initial_quantity
  );
end;
$$;
