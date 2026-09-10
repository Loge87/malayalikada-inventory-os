# Malayalikada Grocery Inventory OS — project rules

These rules are non-negotiable. Follow them in every change, no matter how small the task looks.

## Core architecture
- Multi-tenant from day one. Every table that holds business data has an `organisation_id` column and RLS scoped to it.
- Organisation → locations → products → product_variants → inventory_levels.
- Main warehouse plus unlimited retail store locations, all rows in the same `locations` table distinguished by a `type` column.

## The inventory rule (most important rule in this project)
- **Never write directly to `inventory_levels`.** Every stock change is an insert into `inventory_movements`. `inventory_levels` is a derived/aggregated view of the movements, updated only by the `record_inventory_movement` function.
- Movement types: `PURCHASE_RECEIVED`, `SALE`, `TRANSFER_OUT`, `TRANSFER_IN`, `DAMAGE`, `EXPIRY`, `ADJUSTMENT`, `RETURN`.
- If you find yourself writing `UPDATE inventory_levels SET on_hand = ...` anywhere outside the ledger function, stop — that violates the architecture.
- The system must always be able to answer: who changed stock, what changed, when, where, why, and what reference transaction caused it. Every movement row needs `created_by`, `reference_type`, `reference_id`, and a timestamp.

## Multi-tenancy and access control
- Every query must be implicitly scoped by RLS to the caller's organisation — never rely on the client to filter by `organisation_id`.
- Roles: owner, admin, staff. Staff can record movements and view stock. Only admin/owner can approve transfers and adjust roles.

## POS / external integration rules (architecture only in MVP — no live connector yet)
- POS, Shopify, and mobile apps are never independent stock masters. They only ever produce events that flow into `inventory_movements` via the ledger function.
- Every external event must carry an idempotency key. Duplicate/retried webhooks must never double-deduct stock — check `external_reference` before inserting a movement.
- A POS sale deducts stock only once the transaction is in a completed/paid state, never on cart creation.

## What NOT to build in this MVP
- No full POS checkout, payment processing, EFTPOS, or receipt printing.
- No microservices, no Kubernetes, no AI/forecasting features yet.
- No direct database triggers that silently mutate `inventory_levels` — all mutation goes through the one function.

## When in doubt
Ask before writing code that touches `inventory_levels` schema or RLS policies directly. Everything else, use best judgment and keep it simple — this is a 7-day MVP, not the final architecture.