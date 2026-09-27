-- Client delete: soft-delete (deactivate) when referenced by stock_outs,
-- otherwise a real delete. Same shape as delete_product (0012_*.sql) and
-- delete_location (0020_*.sql, updated 0021_*.sql) — one history check
-- instead of several, since clients (0021_stock_out_schema.sql) are only
-- ever referenced by stock_outs.client_id, which has no cascade — a plain
-- DELETE would otherwise raise a raw FK-violation instead of the same
-- graceful deactivate every other resource in this app gets.

create or replace function public.delete_client(
  p_organisation_id uuid,
  p_client_id uuid
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
    select 1 from public.clients
    where id = p_client_id and organisation_id = p_organisation_id
  ) then
    raise exception 'Client not found';
  end if;

  select exists (
    select 1 from public.stock_outs where client_id = p_client_id
  )
  into v_has_history;

  if v_has_history then
    update public.clients
    set is_active = false
    where id = p_client_id and organisation_id = p_organisation_id;
    return 'deactivated';
  end if;

  delete from public.clients
  where id = p_client_id and organisation_id = p_organisation_id;
  return 'deleted';
end;
$$;
