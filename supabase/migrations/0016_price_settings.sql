-- Organisation-level price settings (CGST, SGST, profit margin, logistics
-- charges, additional charges — all percentages, per the /settings/pricing
-- page). A dedicated table rather than flat columns on organisations:
-- `scheme` names the tax scheme these percentages apply under (currently
-- always 'IN_GST' — CGST/SGST are India-specific), validated app-side like
-- product_variants.currency, so a future second scheme needs no migration.
-- One row per organisation.
--
-- Not wired into any retail/wholesale price calculation yet — this table
-- only captures and stores the settings. That's a deliberate later step.

create table public.price_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations (id) on delete cascade,
  scheme text not null default 'IN_GST',
  cgst_percent numeric not null default 0 check (cgst_percent >= 0),
  sgst_percent numeric not null default 0 check (sgst_percent >= 0),
  profit_margin_percent numeric not null default 0 check (profit_margin_percent >= 0),
  logistics_charges_percent numeric not null default 0 check (logistics_charges_percent >= 0),
  additional_charges_percent numeric not null default 0 check (additional_charges_percent >= 0),
  updated_at timestamptz not null default now()
);

alter table public.price_settings enable row level security;

-- Same "any org member" shape as locations/products/variants (0001_init.sql)
-- — role-tier restriction (admin/owner only, not staff — lib/permissions.ts
-- "pricing:manage") is enforced app-side, not at RLS, matching how
-- products:delete/locations:manage already work in this codebase.
create policy "org members can access price settings"
  on public.price_settings for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));
