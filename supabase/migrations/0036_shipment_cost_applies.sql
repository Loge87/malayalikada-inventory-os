-- Shipment costs now apply to BOTH the retail and the wholesale price by
-- default. These flags let a formula opt a product type's shipment cost out
-- (the card can be removed from that formula in Settings → Price Settings).

alter table public.shipment_costs
  add column if not exists retail_enabled boolean not null default true,
  add column if not exists wholesale_enabled boolean not null default true;
