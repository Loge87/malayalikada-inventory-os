"use client";

import { createContext, useContext, type ReactNode } from "react";

import { hasPermission, type Permission, type Role } from "@/lib/permissions";

const RoleContext = createContext<Role | null>(null);

/** Makes the current user's role available to any client component in the
 *  tree without prop-drilling it through every layer (ProductsTable ->
 *  ProductEditPanel -> ProductEditContent, etc.) — set once in
 *  (app)/layout.tsx from the same role lookup already used for the nav's
 *  ProfileSection. */
export function RoleProvider({
  role,
  children,
}: {
  role: Role | null;
  children: ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** Client-side counterpart to hasPermission() — same underlying rule table,
 *  just reading the role from context instead of a passed-in argument. This
 *  is UX only (hide/disable); the actions this gates also check
 *  hasPermission() server-side — see lib/permissions.ts. */
export function usePermissions() {
  const role = useContext(RoleContext);
  return {
    role,
    can: (permission: Permission) => hasPermission(role, permission),
  };
}
