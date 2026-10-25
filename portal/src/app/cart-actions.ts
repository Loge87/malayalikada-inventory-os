"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadCartDetails } from "@/lib/cart-details";
import { MAX_CASES, MAX_LINES, readCart, writeCart } from "@/lib/cart";
import { getCurrentRetailer, getOrganisationId, getPortalSettings, type Retailer } from "@/lib/portal";

export type CartResult = { ok: true; count: number } | { ok: false; error: string };

async function requireApproved(): Promise<{ error: string } | { retailer: Retailer }> {
  const retailer = await getCurrentRetailer();
  if (!retailer) return { error: "Please sign in to order." };
  if (retailer.status === "pending") return { error: "Your account is waiting for approval." };
  if (retailer.status === "suspended") return { error: "Your account is on hold. Please contact us." };
  return { retailer };
}

export async function addToCart(variantId: string, cases: number): Promise<CartResult> {
  const auth = await requireApproved();
  if ("error" in auth) return { ok: false, error: auth.error };

  const qty = Math.floor(Number(cases));
  if (!variantId || !Number.isFinite(qty) || qty < 1) return { ok: false, error: "Choose how many cases." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("product_variants")
    .select("id")
    .eq("id", variantId)
    .eq("organisation_id", getOrganisationId())
    .eq("portal_visible", true)
    .maybeSingle();
  if (!data) return { ok: false, error: "This product is no longer available." };

  const lines = await readCart();
  const existing = lines.find((l) => l.variantId === variantId.toLowerCase());
  if (existing) existing.cases = Math.min(existing.cases + qty, MAX_CASES);
  else if (lines.length >= MAX_LINES) return { ok: false, error: "Your cart is full. Please place this order first." };
  else lines.push({ variantId: variantId.toLowerCase(), cases: Math.min(qty, MAX_CASES) });

  await writeCart(lines);
  revalidatePath("/", "layout");
  return { ok: true, count: lines.length };
}

export async function setCartQty(variantId: string, cases: number): Promise<CartResult> {
  const auth = await requireApproved();
  if ("error" in auth) return { ok: false, error: auth.error };

  const qty = Math.floor(Number(cases));
  const lines = (await readCart()).filter((l) => l.variantId !== variantId.toLowerCase());
  if (Number.isFinite(qty) && qty >= 1) lines.push({ variantId: variantId.toLowerCase(), cases: Math.min(qty, MAX_CASES) });
  // keep the original order stable-ish: re-read to restore position
  const original = await readCart();
  const order = new Map(original.map((l, i) => [l.variantId, i]));
  lines.sort((a, b) => (order.get(a.variantId) ?? 999) - (order.get(b.variantId) ?? 999));

  await writeCart(lines);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true, count: lines.length };
}

export async function clearCart(): Promise<void> {
  await writeCart([]);
  revalidatePath("/", "layout");
}

export type PlaceOrderState =
  | { error: string; shortages?: { name: string; sku: string; requested: number; available: number }[] }
  | undefined;

export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const auth = await requireApproved();
  if ("error" in auth) return { error: auth.error };
  const { retailer } = auth;

  const settings = await getPortalSettings();
  if (!settings.isEnabled) return { error: "Ordering is paused right now. Please try again soon." };

  const cart = await loadCartDetails(settings);
  if (cart.lines.length === 0) return { error: "Your cart is empty." };

  const blocked = cart.lines.filter((l) => l.problem !== null);
  if (blocked.length > 0) {
    return {
      error: "Some items need attention before you can order. Update your cart and try again.",
      shortages: blocked.map((l) => ({
        name: l.item.name,
        sku: l.item.sku,
        requested: l.cases,
        available: l.availableCases,
      })),
    };
  }
  if (cart.subtotal < settings.minOrderValue) {
    return { error: `The minimum order is ${settings.minOrderValue} ${settings.currency}. Please add more to your cart.` };
  }

  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("place_portal_order", {
    p_organisation_id: getOrganisationId(),
    p_retailer_id: retailer.id,
    p_lines: cart.lines.map((l) => ({
      variant_id: l.item.id,
      cases: l.cases,
      case_price: l.item.casePrice,
    })),
    p_notes: notes,
  });
  if (error) return { error: "Sorry, we could not place your order. Please try again." };

  const result = data as
    | { ok: true; order_id: string; order_number: number }
    | { ok: false; reason: string; shortages?: { name: string; sku: string; requested_cases: number; available_cases: number }[]; min_order_value?: number };

  if (!result.ok) {
    switch (result.reason) {
      case "shortage":
        return {
          error: "Some items no longer have enough stock. Nothing has been reserved. Update your cart and try again.",
          shortages: (result.shortages ?? []).map((s) => ({
            name: s.name,
            sku: s.sku,
            requested: s.requested_cases,
            available: s.available_cases,
          })),
        };
      case "below_minimum":
        return { error: `The minimum order is ${result.min_order_value ?? settings.minOrderValue} ${settings.currency}.` };
      case "not_approved":
        return { error: "Your account is not approved to order yet." };
      case "portal_disabled":
        return { error: "Ordering is paused right now. Please try again soon." };
      default:
        return { error: "Your cart is empty." };
    }
  }

  await writeCart([]);
  revalidatePath("/", "layout");
  redirect(`/orders/${result.order_id}?placed=1`);
}

export async function cancelOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireApproved();
  if ("error" in auth) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_portal_order", {
    p_order_id: orderId,
    p_retailer_id: auth.retailer.id,
    p_reason: "Cancelled by the retailer",
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") || "Could not cancel this order." };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}
