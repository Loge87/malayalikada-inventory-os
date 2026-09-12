-- Product delete: soft-delete (deactivate) when history exists, otherwise a
-- real delete. "History" means any inventory_movements OR purchase_order_items
-- referencing any of the product's variants.
--
-- inventory_movements.product_variant_id is ON DELETE CASCADE, so a plain
-- DELETE would silently destroy ledger history instead of raising — the
-- inventory rule says movements are permanent, so this is checked explicitly
-- rather than relied on as a constraint. purchase_order_items.product_variant_id
-- has no cascade, so it WOULD raise on delete; checked explicitly too rather
-- than caught as an exception, so both cases are handled the same way.

alter table public.products
  add column is_active boolean not null default true;

create or replace function public.delete_product(
  p_organisation_id uuid,
  p_product_id uuid
)
returns text -- 'deleted' or 'deactivated'
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_has_history boolean;
begin
  if not exists (
    select 1 from public.products
    where id = p_product_id and organisation_id = p_organisation_id
  ) then
    raise exception 'Product not found';
  end if;

  select
    exists (
      select 1
      from public.inventory_movements m
      join public.product_variants v on v.id = m.product_variant_id
      where v.product_id = p_product_id
    )
    or exists (
      select 1
      from public.purchase_order_items poi
      join public.product_variants v on v.id = poi.product_variant_id
      where v.product_id = p_product_id
    )
  into v_has_history;

  if v_has_history then
    update public.products
    set is_active = false
    where id = p_product_id and organisation_id = p_organisation_id;
    return 'deactivated';
  end if;

  delete from public.products
  where id = p_product_id and organisation_id = p_organisation_id;
  return 'deleted';
end;
$$;
