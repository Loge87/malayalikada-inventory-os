-- Stock Out feature — Stage 4: the atomic RPC + audit log reference
-- resolution.
--
-- A stock-out reuses SALE (approved with the user — see the Stage 4
-- confirmation): stock is leaving a location permanently, same as any other
-- sale, just to a named client instead of through POS. It's recorded with a
-- NEGATIVE quantity (CLAUDE.md's own worked example: "SALE -20"), and is
-- distinguished from a POS sale purely by reference_type/reference_id —
-- exactly the same mechanism purchase_orders/record_stock_transfer already
-- use, extended with one more reference_type rather than a new concept.
--
-- record_stock_out wraps three steps in one transaction — insert the
-- stock_outs row (so record_inventory_movement has a reference_id to point
-- at), record the ledger movement, backfill stock_outs.movement_id — the
-- same "supabase-js can't span a transaction across separate .rpc() calls"
-- reasoning as record_stock_transfer (0002_*.sql): if any step raises, the
-- whole thing rolls back, so there's no way to end up with a stock_outs row
-- that has no corresponding movement, or a movement with no stock_outs row.
--
-- The on_hand sufficiency check (Stage 4 point 3) lives here, inside the one
-- atomic transaction, `select ... for update` locking the inventory_levels
-- row so two concurrent stock-outs against the same variant/location can't
-- both read a stale on_hand and both succeed.
--
-- Permission/assignment checks (is this user assigned to p_location_id at
-- all, do they have ANY assigned location) are NOT here — those live in the
-- Next.js server action (app/(app)/stock-out/actions.ts), same convention
-- as every other role-tier check in this app (RLS/RPCs scope by
-- organisation only; who's allowed to call them with which arguments is an
-- app-side concern).

create or replace function public.record_stock_out(
  p_organisation_id uuid,
  p_location_id uuid,
  p_product_variant_id uuid,
  p_client_id uuid,
  p_quantity numeric
)
returns uuid -- the new stock_outs row's id
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_location_name text;
  v_on_hand numeric;
  v_stock_out_id uuid;
  v_movement_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number';
  end if;

  select name into v_location_name
  from public.locations
  where id = p_location_id and organisation_id = p_organisation_id;

  if v_location_name is null then
    raise exception 'Location not found';
  end if;

  select on_hand into v_on_hand
  from public.inventory_levels
  where location_id = p_location_id and product_variant_id = p_product_variant_id
  for update;

  if coalesce(v_on_hand, 0) < p_quantity then
    raise exception 'Only % units available at %', coalesce(v_on_hand, 0), v_location_name;
  end if;

  insert into public.stock_outs (organisation_id, location_id, product_variant_id, client_id, quantity)
  values (p_organisation_id, p_location_id, p_product_variant_id, p_client_id, p_quantity)
  returning id into v_stock_out_id;

  v_movement_id := public.record_inventory_movement(
    p_organisation_id    => p_organisation_id,
    p_location_id        => p_location_id,
    p_product_variant_id => p_product_variant_id,
    p_movement_type      => 'SALE',
    p_quantity           => -p_quantity,
    p_reference_type     => 'stock_out',
    p_reference_id        => v_stock_out_id
  );

  update public.stock_outs
  set movement_id = v_movement_id
  where id = v_stock_out_id;

  return v_stock_out_id;
end;
$$;

------------------------------------------------------------------------------
-- Audit log: resolve a 'stock_out' reference into "Stock out to [Client
-- Name] at [Location Name]" (Stage 4 point 5). Re-joins locations (alias l2)
-- rather than reusing the outer query's already-joined location, same style
-- as the existing 'TRANSFER' branch just above it — self-contained rather
-- than resting on stock_outs.location_id always matching the movement's own
-- location_id (true by construction, but not worth relying on silently).
------------------------------------------------------------------------------
create or replace function public.list_audit_log(
  p_organisation_id uuid,
  p_limit integer default 50,
  p_offset integer default 0,
  p_location_id uuid default null,
  p_movement_type text default null,
  p_user_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  id uuid,
  created_at timestamptz,
  movement_type text,
  quantity numeric,
  location_id uuid,
  location_name text,
  product_variant_id uuid,
  variant_name text,
  sku text,
  product_name text,
  created_by uuid,
  created_by_email text,
  reference_type text,
  reference_id uuid,
  reference_label text,
  total_count bigint
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_org_admin_or_owner(p_organisation_id) then
    raise exception 'Only an admin or owner can view the audit log';
  end if;

  return query
  with base as (
    select m.*
    from public.inventory_movements m
    where m.organisation_id = p_organisation_id
      and (p_location_id is null or m.location_id = p_location_id)
      and (p_movement_type is null or m.movement_type = p_movement_type)
      and (p_user_id is null or m.created_by = p_user_id)
      and (p_date_from is null or m.created_at >= p_date_from)
      and (p_date_to is null or m.created_at <= p_date_to)
  )
  select
    b.id,
    b.created_at,
    b.movement_type,
    b.quantity,
    b.location_id,
    l.name as location_name,
    b.product_variant_id,
    pv.name as variant_name,
    pv.sku,
    p.name as product_name,
    b.created_by,
    au.email::text as created_by_email,
    b.reference_type,
    b.reference_id,
    case b.reference_type
      when 'purchase_order' then (
        select 'Purchase order — ' || po.supplier_name
          || coalesce(' (' || to_char(po.received_at, 'DD Mon YYYY') || ')', '')
        from public.purchase_orders po
        where po.id = b.reference_id
      )
      when 'TRANSFER' then (
        select case when b.quantity < 0 then 'Transfer to ' || l2.name
                     else 'Transfer from ' || l2.name
               end
        from public.inventory_movements other
        join public.locations l2 on l2.id = other.location_id
        where other.reference_id = b.reference_id
          and other.id <> b.id
        limit 1
      )
      when 'stock_count' then (
        select 'Stock count — ' || to_char(sc.started_at, 'DD Mon YYYY')
        from public.stock_counts sc
        where sc.id = b.reference_id
      )
      when 'initial_stock' then 'Initial stock'
      when 'integration_event' then (
        select 'POS sale — ' || ie.source_system
          || case when ie.external_reference is not null
                  then ' (' || ie.external_reference || ')'
                  else ''
             end
        from public.integration_events ie
        where ie.id = b.reference_id
      )
      when 'stock_out' then (
        select 'Stock out to ' || c.name || ' at ' || l2.name
        from public.stock_outs so
        join public.clients c on c.id = so.client_id
        join public.locations l2 on l2.id = so.location_id
        where so.id = b.reference_id
      )
      else null
    end as reference_label,
    count(*) over () as total_count
  from base b
  left join public.locations l on l.id = b.location_id
  left join public.product_variants pv on pv.id = b.product_variant_id
  left join public.products p on p.id = pv.product_id
  left join auth.users au on au.id = b.created_by
  order by b.created_at desc
  limit p_limit offset p_offset;
end;
$$;
