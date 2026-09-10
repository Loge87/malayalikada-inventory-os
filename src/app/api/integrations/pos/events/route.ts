import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POS event intake — see docs/PRODUCT_SPEC.md ("POS INTEGRATION ARCHITECTURE").
 *
 * Flow: authenticate the channel → log the raw event to integration_events
 * (audit trail of everything received) → resolve the location mapping and the
 * product → for a COMPLETED SALE, deduct stock through record_inventory_movement
 * using external_reference as the idempotency key.
 *
 * Auth here is a single shared secret (POS_WEBHOOK_SECRET) plus an
 * x-organisation-id header. A real deployment would key this per integration
 * via integration_credentials (product spec, V2).
 */

type PosEvent = {
  event_type?: string;
  source?: string;
  external_reference?: string;
  location_external_id?: string;
  sku?: string;
  barcode?: string;
  quantity?: number;
  transaction_status?: string;
  occurred_at?: string;
};

export async function POST(request: NextRequest) {
  const secret = process.env.POS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "POS integration endpoint is not configured." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const organisationId = request.headers.get("x-organisation-id");
  if (!organisationId) {
    return NextResponse.json(
      { error: "Missing x-organisation-id header." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  let event: PosEvent | null = null;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      event = parsed as PosEvent;
    }
  } catch {
    // event stays null — logged below as an unparseable body
  }

  const supabase = createAdminClient();

  // The service-role client bypasses RLS, so confirm the tenant exists.
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", organisationId)
    .maybeSingle();
  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }
  if (!org) {
    return NextResponse.json({ error: "Unknown organisation." }, { status: 404 });
  }

  // Log the event first — the audit trail records everything received.
  const { data: logged, error: logError } = await supabase
    .from("integration_events")
    .insert({
      organisation_id: organisationId,
      source_system: event?.source ?? "POS",
      event_type: event?.event_type ?? "UNKNOWN",
      external_reference: event?.external_reference ?? null,
      payload: event ?? { raw_body: rawBody },
      processing_status: "pending",
    })
    .select("id")
    .single();
  if (logError || !logged) {
    return NextResponse.json(
      { error: logError?.message ?? "Could not record the event." },
      { status: 500 }
    );
  }
  const eventId: string = logged.id;

  async function fail(status: number, reason: string) {
    await supabase
      .from("integration_events")
      .update({
        processing_status: "failed",
        last_error: reason,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    return NextResponse.json(
      { integration_event_id: eventId, status: "failed", reason },
      { status }
    );
  }

  async function processed(body: Record<string, unknown>) {
    await supabase
      .from("integration_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    return NextResponse.json(
      { integration_event_id: eventId, status: "processed", ...body },
      { status: 200 }
    );
  }

  if (!event) {
    return fail(400, "Request body is not a JSON object.");
  }
  if (!event.event_type) {
    return fail(400, "Missing event_type.");
  }
  if (!event.external_reference) {
    return fail(400, "Missing external_reference (idempotency key).");
  }
  if (!event.location_external_id) {
    return fail(422, "Missing location_external_id.");
  }

  // Resolve the internal location.
  const { data: mapping, error: mappingError } = await supabase
    .from("external_location_mappings")
    .select("location_id")
    .eq("organisation_id", organisationId)
    .eq("source_system", event.source ?? "POS")
    .eq("location_external_id", event.location_external_id)
    .maybeSingle();
  if (mappingError) {
    return fail(500, mappingError.message);
  }
  if (!mapping) {
    return fail(
      422,
      `No location mapping for ${event.source ?? "POS"} / ${event.location_external_id}.`
    );
  }

  // Resolve the product variant by sku, else barcode.
  const identifier = event.sku
    ? { column: "sku" as const, value: event.sku }
    : event.barcode
      ? { column: "barcode" as const, value: event.barcode }
      : null;
  if (!identifier) {
    return fail(422, "Event has neither sku nor barcode.");
  }

  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq(identifier.column, identifier.value)
    .limit(2);
  if (variantError) {
    return fail(500, variantError.message);
  }
  if (!variants || variants.length === 0) {
    return fail(422, `No product variant for ${identifier.column} ${identifier.value}.`);
  }
  if (variants.length > 1) {
    return fail(
      422,
      `${identifier.column} ${identifier.value} matches multiple product variants.`
    );
  }
  const productVariantId: string = variants[0].id;

  // Only a COMPLETED SALE moves stock (spec requirement 20 / acceptance
  // criteria 1). Everything else is acknowledged and left for a future handler.
  const isCompletedSale =
    event.event_type === "SALE" && event.transaction_status === "COMPLETED";
  if (!isCompletedSale) {
    return processed({
      stock_movement: "skipped",
      reason:
        event.event_type === "SALE"
          ? `transaction_status is ${event.transaction_status ?? "unset"}, not COMPLETED`
          : `event_type ${event.event_type} is not handled yet`,
    });
  }

  const quantity = Number(event.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fail(422, "quantity must be a positive number.");
  }

  // Deduct through the ledger. record_inventory_movement no-ops when this
  // external_reference was already applied — a retried webhook never
  // double-deducts (acceptance criteria 2).
  const { data: movementId, error: rpcError } = await supabase.rpc(
    "record_inventory_movement",
    {
      p_organisation_id: organisationId,
      p_location_id: mapping.location_id,
      p_product_variant_id: productVariantId,
      p_movement_type: "SALE",
      p_quantity: -quantity,
      p_reference_type: "integration_event",
      p_reference_id: eventId,
      p_external_reference: event.external_reference,
    }
  );
  if (rpcError) {
    return fail(500, rpcError.message);
  }

  return processed({
    stock_movement: movementId ? "recorded" : "duplicate_ignored",
    movement_id: movementId ?? null,
    location_id: mapping.location_id,
    product_variant_id: productVariantId,
  });
}
