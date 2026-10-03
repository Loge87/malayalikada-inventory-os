-- Stock Out feature — Stage 2: let admins (not just owners) into /settings/team
-- far enough to assign locations to staff.
--
-- Location assignment itself needs no new RLS: user_locations (0021_*.sql)
-- already has an "org members can access" for-all policy, same convention as
-- locations/products — role-tier restriction (locations:manage, admin+owner)
-- is enforced app-side by the new assignMemberLocations server action, not
-- here.
--
-- The one thing that WAS hard-gated to owners at the DB level is
-- list_org_members (0013_team_management.sql) — an admin calling it today
-- gets a raw exception, since it only ever checked is_org_owner(). An admin
-- needs to see the member list (who's staff, what's already assigned) to do
-- anything useful with location assignment, so that gate is broadened here.
-- Invite/role-change/remove stay owner-only and untouched: they still go
-- through user_roles' own RLS policies (is_org_owner-gated), which this
-- migration does not modify.

create or replace function public.is_org_owner_or_admin(p_organisation_id uuid)
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

create or replace function public.list_org_members(p_organisation_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_org_owner_or_admin(p_organisation_id) then
    raise exception 'Only an organisation owner or admin can list members';
  end if;

  return query
    select ur.user_id, au.email::text, ur.role, ur.created_at
    from public.user_roles ur
    join auth.users au on au.id = ur.user_id
    where ur.organisation_id = p_organisation_id
    order by ur.created_at asc;
end;
$$;
