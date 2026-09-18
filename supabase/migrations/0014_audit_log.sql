-- Audit log (/audit-log, admin/owner only).
--
-- inventory_movements already has everything CLAUDE.md's inventory rule
-- requires ("who changed stock, what changed, when, where, why, and what
-- reference transaction caused it") — this just makes it queryable: paginated,
-- filterable, with the actor's email (auth.users isn't reachable from a plain
-- client query) and each reference_id resolved into a human-readable label
-- instead of a raw UUID.

------------------------------------------------------------------------------
-- is_org_admin_or_owner: broader than is_org_owner (0013_*.sql) — the audit
-- log and its supporting lookups are admin+owner, not owner-only.
------------------------------------------------------------------------------
create or replace function public.is_org_admin_or_owner(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_roles
    where organisation_id = p_organisation_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

------------------------------------------------------------------------------
-- list_audit_log: one page of inventory_movements, filtered, with the
-- variant/product/location/actor joined and reference_id resolved per
-- reference_type:
--   purchase_order    -> purchase_orders (supplier + received date)
--   TRANSFER          -> the *paired* movement sharing this reference_id
--                        (TRANSFER_OUT/TRANSFER_IN aren't a real table row —
--                        record_stock_transfer's reference_id only ties the
--                        two ledger rows together, see 0002_*.sql), so the
--                        other side's location is looked up directly
--   stock_count       -> stock_counts (started date)
--   initial_stock     -> no lookup needed, it's this same movement's variant
--   integration_event -> integration_events (source system + external ref)
--   anything else (incl. null, a manual /movements entry) -> left null;
--     the page shows "Manual entry" for that case itself.
-- total_count is a window function over the filtered set (before
-- limit/offset), for the page's pagination controls.
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

------------------------------------------------------------------------------
-- list_audit_log_users: distinct actors who've actually recorded a movement
-- in this org, for the "filter by user" dropdown — narrower than the team
-- page's full member list (list_org_members, 0013_*.sql, owner-only) both in
-- who it's gated to (admin+owner, matching this page) and in scope (only
-- people who've done something, not every member).
------------------------------------------------------------------------------
create or replace function public.list_audit_log_users(p_organisation_id uuid)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_org_admin_or_owner(p_organisation_id) then
    raise exception 'Only an admin or owner can view the audit log';
  end if;

  return query
    select distinct m.created_by, au.email::text
    from public.inventory_movements m
    join auth.users au on au.id = m.created_by
    where m.organisation_id = p_organisation_id
    order by 2;
end;
$$;
