// The permission model — one source of truth for both server code (page
// guards, server actions) and client code (hide/disable UI). This is UX
// clarity, not the real security boundary: RLS scopes every query to the
// caller's organisation regardless of role, and — for the handful of
// actions below where RLS doesn't yet distinguish role tiers either
// (products/locations mutations use "any org member" policies) — the
// server actions themselves call hasPermission() too, so a hidden button
// isn't the only thing standing between staff and a restricted action.
export type Role = "owner" | "admin" | "staff";

export type Permission =
  | "products:delete"
  | "locations:manage"
  | "clients:manage"
  | "integrations:view"
  | "audit:view"
  | "roles:manage"
  | "pricing:manage"
  | "financials:view";

// staff: view everything, record movements (sales/adjustments/transfers/
//   receiving/stock counts), scan/add products.
// admin: staff + delete products, manage locations, manage clients, view
//   integration logs, view the audit log, manage price settings (CGST/SGST/
//   margin/charges), view sensitive financial figures (landed cost, USD
//   conversion — dashboard's Stock by Location table).
// owner: admin + manage user roles (no UI for this yet — see roles.ts).
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  staff: new Set([]),
  admin: new Set([
    "products:delete",
    "locations:manage",
    "clients:manage",
    "integrations:view",
    "audit:view",
    "pricing:manage",
    "financials:view",
  ]),
  owner: new Set([
    "products:delete",
    "locations:manage",
    "clients:manage",
    "integrations:view",
    "audit:view",
    "roles:manage",
    "pricing:manage",
    "financials:view",
  ]),
};

export function hasPermission(
  role: string | null | undefined,
  permission: Permission
): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as Role].has(permission);
}
