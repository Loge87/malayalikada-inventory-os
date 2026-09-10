# Master Product-Build Prompt — Malayalikada Grocery Inventory OS

> The original product master prompt, preserved verbatim for full product context.
> `CLAUDE.md` holds the non-negotiable engineering rules; this document is the
> product vision, data model, development phases, and scope (MVP / V2 / V3).

You are helping me design and build a scalable grocery inventory management SaaS product. The first customer/pilot is Malayalikada in New Zealand.

## Product Purpose

Build a central Inventory Operating System that is the single source of truth for all grocery stock. The main warehouse receives goods and distributes them to multiple retail stores (Store 1, Store 2, Store 3, etc.). Shopify, POS systems, mobile apps and future channels must consume inventory data from this system rather than maintaining independent inventory truth.

## Core Requirements

1. Multi-tenant architecture from day one.
2. Organisation → locations → products → inventory.
3. Main warehouse plus unlimited retail stores.
4. Show total stock and stock by location.
5. Separate on-hand, reserved, available, incoming, in-transit, damaged and expired stock.
6. Track every stock change as an immutable inventory movement/audit event.
7. Support purchase orders and goods receiving.
8. Support stock transfers with lifecycle: Draft → Approved → Picking → Dispatched → In Transit → Received.
9. Support barcode scanning.
10. Support batch/lot and expiry tracking, with FEFO capability.
11. Support stock counts, adjustments, returns, damage and wastage.
12. Support retail and wholesale use cases.
13. Provide controlled APIs for Shopify, POS and mobile applications.
14. Use webhooks/events for integration synchronisation where appropriate.
15. Include integration logs, retries and failure visibility.

16. POS is an integration channel, not the inventory master. The POS owns checkout, payment, receipt, sale and refund transaction details; the Inventory OS owns stock truth.
17. POS sales and returns must enter the Inventory OS as controlled inventory movement events. External systems must never directly overwrite inventory quantities.
18. Support a POS connector pattern using APIs and webhooks where available, with scheduled synchronisation only as a fallback.
19. Maintain external references/idempotency keys so duplicate POS webhooks or retries cannot double-deduct stock.
20. A POS SALE must deduct stock from the exact selling location only after the configured transaction state is reached (normally completed/paid).
21. A POS RETURN/REFUND must create a return movement and support sellable, damaged or quarantine disposition.
22. Product mapping between Inventory OS and POS must support internal product ID, SKU, barcode and external POS product/variant IDs.
23. POS integrations must expose sync status, failures, retry history and reconciliation tools.
24. The MVP must be POS-ready at architecture/API level, but do not build a full POS checkout product in the first release.

16. Strong role-based permissions and audit trails.
17. Design for future forecasting, smart reorder recommendations and automated purchasing.

## Recommended Stack

- Frontend: Next.js + React + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Backend/API: Next.js server/API
- Database: PostgreSQL via Supabase
- Authentication: Supabase Auth
- Authorisation: Row Level Security + application roles
- Storage: Supabase Storage
- Hosting: Vercel
- Version control: GitHub
- Testing: Vitest + Playwright
- Monitoring: Sentry
- Product analytics: PostHog
- API testing: Bruno or Postman
- Design: Figma + FigJam
- Documentation: Notion/GitHub

## Core Data Model

Design and explain an ERD including:

```
organisations
users
roles
locations
products
product_variants
categories
brands
units
suppliers
supplier_products
inventory_levels
inventory_batches
inventory_movements
purchase_orders
purchase_order_items
goods_receipts
stock_transfers
stock_transfer_items
sales
sale_items
stock_adjustments
customers
wholesale_customers
integrations
integration_events
webhook_events
audit_logs
```

## Inventory Rule

Never simply overwrite stock. Use an inventory ledger.

Example:

```
PURCHASE_RECEIVED +100
SALE -20
TRANSFER_OUT -50
TRANSFER_IN +50
DAMAGE -3
EXPIRY -2
ADJUSTMENT +1
```

The system must always be able to explain who changed stock, what changed, when, where, why and what reference transaction caused it.

## Source of Truth

- Inventory OS = master inventory source.
- Shopify = online commerce/customer experience.
- POS = store sales interface.
- Mobile app = customer/staff experience.

All integrations must use controlled APIs/events and must have clear ownership of each data type.

## Development Phases

- Phase 1: Discovery
- Phase 2: PRD + user journeys + MVP scope
- Phase 3: System architecture + ERD + API design
- Phase 4: Figma UX/UI + design system + prototype
- Phase 5: Database + authentication + roles
- Phase 6: Inventory core
- Phase 7: Purchasing + receiving + expiry + wastage
- Phase 8: Dashboard + reports
- Phase 9: Shopify/POS integrations
- Phase 10: QA, security and UAT
- Phase 11: Deployment and data migration
- Phase 12: SaaS scalability and future roadmap

## MVP

Products, barcode, categories, suppliers, locations, inventory levels, inventory movements, transfers, purchasing, receiving, batches, expiry, wastage, stock counts, dashboard, reports, roles and audit logs.

## UX Principles

Make the application operational, fast and simple for warehouse/store staff. Prioritise barcode-first workflows, bulk actions, clear stock status, minimal data entry, strong error prevention and obvious location context.

## Key Dashboard Questions

- How much stock do we have?
- Where is it?
- How much is available to sell?
- What is reserved?
- What is incoming?
- What is in transit?
- What is expiring?
- What is damaged?
- What needs reordering?
- What changed and who changed it?

## Important

- Do not start coding until the PRD, user journeys, MVP feature map, ERD, inventory rules and screen map are defined.
- Do not over-engineer with microservices, Kubernetes or AI in the MVP.
- Keep the architecture modular so Shopify, POS and mobile apps can be added without changing the inventory core.

## When Working On This Product

Always:

- Explain decisions simply.
- Separate MVP from future features.
- Identify dependencies and risks.
- Protect the inventory source of truth.
- Think about real warehouse/store workflows.
- Keep the product scalable beyond Malayalikada.
- Provide implementation-ready artefacts, schemas, API contracts, acceptance criteria and test cases when requested.

## POS Integration Architecture

Inventory OS = inventory source of truth.
POS = store checkout/sales interface.

Preferred flow:

```
POS completed sale
→ webhook/API event
→ integration_events
→ validate tenant/location/product mapping
→ enforce idempotency
→ create SALE inventory movement
→ update derived inventory availability
→ log success/failure
→ optionally publish availability to Shopify/other channels.
```

Return flow:

```
POS return/refund
→ RETURN event
→ determine disposition: SELLABLE / DAMAGED / QUARANTINE
→ create inventory movement
→ update location availability.
```

Example POS event:

```json
{
  "event_type": "SALE",
  "source": "POS",
  "external_reference": "SALE-94829",
  "location_external_id": "STORE_01",
  "sku": "RICE-001",
  "barcode": "9412345678901",
  "quantity": 2,
  "transaction_status": "COMPLETED",
  "occurred_at": "<timestamp>"
}
```

## POS Integration Data Model Additions

Add/extend:

- integrations
- integration_credentials (secure storage/reference)
- external_product_mappings
- external_location_mappings
- integration_events
- webhook_events
- sync_jobs
- reconciliation_runs

Important fields:

- tenant/organisation_id
- integration_id
- source_system
- external_reference
- idempotency_key
- processing_status
- retry_count
- last_error
- received_at
- processed_at

## POS Acceptance Criteria

1. A completed POS sale deducts the correct quantity from the correct store exactly once.
2. Retried/duplicate webhooks do not duplicate the stock movement.
3. A return restores stock only according to the selected disposition.
4. Unknown SKU/barcode/product mappings are rejected safely and visible for reconciliation.
5. Failed integration events are logged and retryable.
6. POS downtime must not corrupt the Inventory OS ledger.
7. Every POS-created stock movement retains its source and transaction reference.
8. POS, Shopify and mobile channels never become independent stock masters.

## Updated Product Roadmap

**MVP:**
Inventory core + SKU/product-name/barcode identification + warehouse/store locations + inventory ledger + receiving + transfers + adjustments + counts + batch/expiry + roles/audit + POS-ready Integration API/event model.

**V2:**
Real POS connectors + Shopify integration + purchase/supplier enhancements + wholesale + mobile workflows + reconciliation dashboard.

**V3:**
Forecasting + smart reorder + automated purchase orders + inter-store balancing + supplier analytics + AI inventory assistant.

**DO NOT BUILD IN MVP:**
A full checkout/POS product, payment processing, EFTPOS, cash drawers, receipt printers, till reconciliation, payroll or accounting ledger.
