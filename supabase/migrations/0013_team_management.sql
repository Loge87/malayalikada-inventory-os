-- Team/role management (/settings/team, owner-only).
--
-- user_roles had a SELECT policy only until now (0001_init.sql) — this adds
-- the write side, scoped so an owner can only ever touch rows in their own
-- organisation, plus a helper for looking up an invitee by email and a
-- helper for listing members with their auth.users email, since neither
-- auth.users nor "is the caller an owner of this row's org" is reachable
-- from a plain RLS-scoped client query.

------------------------------------------------------------------------------
-- is_org_owner: the recursion-safe way to ask "is the caller an owner of
-- organisation X" from within user_roles' own RLS policies. SECURITY
-- DEFINER so it can read user_roles without re-triggering the RLS it's
-- being used to write (same reasoning as user_org_ids() in 0001_init.sql).
------------------------------------------------------------------------------
create or replace function public.is_org_owner(p_organisation_id uuid)
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
      and role = 'owner'
  );
$$;

------------------------------------------------------------------------------
-- Write policies: an owner may insert/update/delete rows in their own org,
-- never another one's — is_org_owner(row.organisation_id) already implies
-- the row belongs to an org the caller is in, so nothing else is needed.
------------------------------------------------------------------------------
create policy "owners can add members to their org"
  on public.user_roles for insert
  with check (public.is_org_owner(organisation_id));

create policy "owners can update members in their org"
  on public.user_roles for update
  using (public.is_org_owner(organisation_id))
  with check (public.is_org_owner(organisation_id));

create policy "owners can remove members from their org"
  on public.user_roles for delete
  using (public.is_org_owner(organisation_id));

------------------------------------------------------------------------------
-- Guard: an organisation must always have at least one owner. This is the
-- real, unbypassable backstop — the server actions also check this first
-- for a friendlier error message, but this trigger is what actually
-- enforces it (including against a direct SQL edit).
------------------------------------------------------------------------------
create or replace function public.prevent_removing_last_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_other_owners integer;
begin
  if OLD.role = 'owner' and (TG_OP = 'DELETE' or NEW.role <> 'owner') then
    select count(*) into v_other_owners
    from public.user_roles
    where organisation_id = OLD.organisation_id
      and role = 'owner'
      and id <> OLD.id;

    if v_other_owners = 0 then
      raise exception 'An organisation must have at least one owner';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger trg_prevent_removing_last_owner
  before update or delete on public.user_roles
  for each row
  execute function public.prevent_removing_last_owner();

------------------------------------------------------------------------------
-- lookup_invitee: resolves an email to an auth.users id for the "Invite
-- member" flow, gated to organisation owners (auth.users isn't reachable
-- from a plain client query at all, and this must not become a way for
-- anyone to enumerate which emails have accounts). Also reports whether the
-- person is already in this org, or already in a different one — this app
-- assumes one organisation per user (getCurrentOrganisationId relies on
-- .single()), so adding someone who already belongs elsewhere would break
-- their session, not just this org's member list.
------------------------------------------------------------------------------
create or replace function public.lookup_invitee(
  p_organisation_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_existing_org uuid;
begin
  if not public.is_org_owner(p_organisation_id) then
    raise exception 'Only an organisation owner can look up invitees';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;

  if v_user_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select organisation_id into v_existing_org
  from public.user_roles
  where user_id = v_user_id
  limit 1;

  if v_existing_org is null then
    return jsonb_build_object('status', 'ok', 'user_id', v_user_id);
  elsif v_existing_org = p_organisation_id then
    return jsonb_build_object('status', 'already_member', 'user_id', v_user_id);
  else
    return jsonb_build_object('status', 'in_other_org');
  end if;
end;
$$;

------------------------------------------------------------------------------
-- list_org_members: user_roles + auth.users email + created_at ("date
-- added"), for the team page's member list. Gated to owners for the same
-- reason as lookup_invitee — this is the only place emails leave auth.users.
------------------------------------------------------------------------------
create or replace function public.list_org_members(p_organisation_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_org_owner(p_organisation_id) then
    raise exception 'Only an organisation owner can list members';
  end if;

  return query
    select ur.user_id, au.email::text, ur.role, ur.created_at
    from public.user_roles ur
    join auth.users au on au.id = ur.user_id
    where ur.organisation_id = p_organisation_id
    order by ur.created_at asc;
end;
$$;
