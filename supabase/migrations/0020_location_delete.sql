-- Location delete: soft-delete (deactivate) when history exists, otherwise a
-- real delete. Mirrors delete_product (0012_product_delete.sql) exactly.
--
-- "History" means any inventory_movements, inventory_levels, inventory_batches,
-- or stock_counts referencing the location, or any purchase_orders with this
-- location as their destination. inventory_movements/inventory_levels/
-- inventory_batches/stock_counts.location_id are all ON DELETE CASCADE, so a
-- plain DELETE would silently destroy ledger/audit history instead of raising
-- — checked explicitly, same rationale as delete_product's comment.
-- purchase_orders.destination_location_id has no cascade, so it would
-- otherwise raise a raw FK-violation on delete; checked explicitly too, so
-- both cases resolve to the same graceful deactivate.
--
-- external_location_mappings (POS integration config, not business history)
-- is deliberately NOT checked — POS has no live connector in this MVP (see
-- CLAUDE.md), and a config mapping isn't evidence of real activity the way a
-- movement or PO is.

create or replace function public.delete_location(
  p_organisation_id uuid,
  p_location_id uuid
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
    select 1 from public.locations
    where id = p_location_id and organisation_id = p_organisation_id
  ) then
    raise exception 'Location not found';
  end if;

  select
    exists (
      select 1 from public.inventory_movements where location_id = p_location_id
    )
    or exists (
      select 1 from public.inventory_levels where location_id = p_location_id
    )
    or exists (
      select 1 from public.inventory_batches where location_id = p_location_id
    )
    or exists (
      select 1 from public.stock_counts where location_id = p_location_id
    )
    or exists (
      select 1 from public.purchase_orders where destination_location_id = p_location_id
    )
  into v_has_history;

  if v_has_history then
    update public.locations
    set is_active = false
    where id = p_location_id and organisation_id = p_organisation_id;
    return 'deactivated';
  end if;

  delete from public.locations
  where id = p_location_id and organisation_id = p_organisation_id;
  return 'deleted';
end;
$$;
