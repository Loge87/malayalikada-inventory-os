-- Organisation-level default/base currency (ISO 4217 code), set from the
-- "Price Settings" section of /settings. This is only ever the pre-filled
-- *default* for NEW products/variants going forward (manual, scan, and
-- bulk-upload creation) — it deliberately does NOT retroactively change any
-- existing variant's own currency (product_variants.currency,
-- 0010_variant_pricing.sql). A variant's own currency field still governs
-- how that variant's prices are formatted/displayed everywhere they're
-- shown (list, detail panel, scan result), since a business may genuinely
-- stock some products priced in a supplier's foreign currency.
--
-- Validated app-side against the CURRENCIES constant, same as
-- product_variants.currency — no DB CHECK, so adding a currency later needs
-- no migration.

alter table public.organisations
  add column default_currency text not null default 'NZD';

-- organisations previously had no UPDATE policy at all (name/id never
-- changed from the app before now). Same "any org member" shape as
-- locations/products/variants/price_settings — role-tier restriction
-- (admin/owner only, not staff — lib/permissions.ts "pricing:manage") is
-- enforced app-side, not at RLS.
create policy "org members can update their org"
  on public.organisations for update
  using (id in (select user_org_ids()))
  with check (id in (select user_org_ids()));
