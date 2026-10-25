-- Shipment cost per product type (Frozen / Dry). Added to the computed
-- retail and wholesale price of a product of that type. value_type matches
-- price_variables: 'number' / 'currency' add a flat amount, 'percentage'
-- adds that percent of the price calculated so far.

create table if not exists public.shipment_costs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_type text not null check (product_type in ('frozen', 'dry')),
  value numeric not null default 0 check (value >= 0),
  value_type text not null default 'number' check (value_type in ('number', 'percentage', 'currency')),
  updated_at timestamptz not null default now(),
  unique (organisation_id, product_type)
);

alter table public.shipment_costs enable row level security;

drop policy if exists "org members can access shipment costs" on public.shipment_costs;
create policy "org members can access shipment costs"
  on public.shipment_costs for all
  using (organisation_id in (select user_org_ids()))
  with check (organisation_id in (select user_org_ids()));
