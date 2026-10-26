"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";

export type OrderActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) {
    return { supabase, error: "You don't have permission to manage wholesale orders." };
  }
  return { supabase, error: null as string | null };
}

function done(orderId: string): OrderActionResult {
  revalidatePath("/wholesale-orders");
  revalidatePath(`/wholesale-orders/${orderId}`);
  return { ok: true };
}

/** submitted → approved, approved/submitted → picked, dispatched → delivered. */
export async function setOrderStatus(
  orderId: string,
  status: "approved" | "picked" | "delivered"
): Promise<OrderActionResult> {
  const { supabase, error: denied } = await requireAdmin();
  if (denied) return { error: denied };
  const { error } = await supabase.rpc("set_portal_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) return { error: error.message };
  return done(orderId);
}

/** Ships the order: releases the reservation and records the stock movement. */
export async function dispatchOrder(orderId: string): Promise<OrderActionResult> {
  const { supabase, error: denied } = await requireAdmin();
  if (denied) return { error: denied };
  const { error } = await supabase.rpc("dispatch_portal_order", { p_order_id: orderId });
  if (error) return { error: error.message };
  return done(orderId);
}

/** Cancels the order and releases the reserved stock. */
export async function cancelOrder(orderId: string, reason: string): Promise<OrderActionResult> {
  const { supabase, error: denied } = await requireAdmin();
  if (denied) return { error: denied };
  const { error } = await supabase.rpc("cancel_portal_order", {
    p_order_id: orderId,
    p_reason: reason.trim() || null,
  });
  if (error) return { error: error.message };
  return done(orderId);
}
