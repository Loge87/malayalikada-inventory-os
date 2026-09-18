"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { ALL_MOVEMENT_TYPES, movementTypeLabel } from "@/lib/movement-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/dashboard/table-pagination";

export const PAGE_SIZE = 10;

export type AuditLogRow = {
  id: string;
  created_at: string;
  movement_type: string;
  quantity: number;
  location_id: string | null;
  location_name: string | null;
  product_variant_id: string | null;
  variant_name: string | null;
  sku: string | null;
  product_name: string | null;
  created_by: string | null;
  created_by_email: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reference_label: string | null;
  total_count: number;
};

export type IntegrationEventRow = {
  id: string;
  source_system: string;
  event_type: string;
  external_reference: string | null;
  processing_status: "pending" | "processed" | "failed" | "duplicate";
  retry_count: number;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
};

type LocationOption = { id: string; name: string };
type ActorOption = { user_id: string; email: string };

const ALL = "all";

const STATUS_STYLES: Record<IntegrationEventRow["processing_status"], string> = {
  processed: "bg-muted text-foreground",
  pending: "bg-muted text-muted-foreground",
  duplicate: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function signed(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}

function variantLabel(row: AuditLogRow): string {
  if (!row.variant_name) return "Unknown variant";
  return row.product_name
    ? `${row.product_name} — ${row.variant_name}`
    : row.variant_name;
}

type Filters = {
  dateFrom: string;
  dateTo: string;
  locationId: string;
  movementType: string;
  userId: string;
};

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  locationId: ALL,
  movementType: ALL,
  userId: ALL,
};

export function AuditLogView({
  organisationId,
  locations,
  actors,
  initialRows,
  initialTotalCount,
  integrationEvents,
}: {
  organisationId: string;
  locations: LocationOption[];
  actors: ActorOption[];
  initialRows: AuditLogRow[];
  initialTotalCount: number;
  integrationEvents: IntegrationEventRow[];
}) {
  const [tab, setTab] = useState<"movements" | "integrations">("movements");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(initialRows);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasActiveFilters =
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.locationId !== ALL ||
    filters.movementType !== ALL ||
    filters.userId !== ALL;

  async function load(nextFilters: Filters, nextPage: number) {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_audit_log", {
      p_organisation_id: organisationId,
      p_limit: PAGE_SIZE,
      p_offset: (nextPage - 1) * PAGE_SIZE,
      p_location_id: nextFilters.locationId === ALL ? null : nextFilters.locationId,
      p_movement_type: nextFilters.movementType === ALL ? null : nextFilters.movementType,
      p_user_id: nextFilters.userId === ALL ? null : nextFilters.userId,
      p_date_from: nextFilters.dateFrom
        ? new Date(`${nextFilters.dateFrom}T00:00:00.000Z`).toISOString()
        : null,
      p_date_to: nextFilters.dateTo
        ? new Date(`${nextFilters.dateTo}T23:59:59.999Z`).toISOString()
        : null,
    });
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    const nextRows = (data ?? []) as AuditLogRow[];
    setRows(nextRows);
    setTotalCount(nextRows[0]?.total_count ?? 0);
    setPage(nextPage);
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    load(next, 1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    load(EMPTY_FILTERS, 1);
  }

  const locationItems: Record<string, string> = {
    [ALL]: "All locations",
    ...Object.fromEntries(locations.map((l) => [l.id, l.name])),
  };
  const movementTypeItems: Record<string, string> = {
    [ALL]: "All types",
    ...Object.fromEntries(ALL_MOVEMENT_TYPES.map((t) => [t, movementTypeLabel(t)])),
  };
  const actorItems: Record<string, string> = {
    [ALL]: "All users",
    ...Object.fromEntries(actors.map((a) => [a.user_id, a.email])),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab("movements")}
          aria-pressed={tab === "movements"}
          className={
            tab === "movements"
              ? "rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
              : "rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
          }
        >
          Inventory Movements
        </button>
        <button
          type="button"
          onClick={() => setTab("integrations")}
          aria-pressed={tab === "integrations"}
          className={
            tab === "integrations"
              ? "rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
              : "rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
          }
        >
          Integration Events
        </button>
      </div>

      {tab === "movements" ? (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Movements</CardTitle>
            <CardDescription>
              {totalCount} movement{totalCount === 1 ? "" : "s"} matching the
              current filters.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-caption">From</span>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter("dateFrom", e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-caption">To</span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter("dateTo", e.target.value)}
                  className="w-36"
                />
              </div>
              <Select
                items={locationItems}
                value={filters.locationId}
                onValueChange={(v) => v != null && updateFilter("locationId", v)}
              >
                <SelectTrigger className="w-fit min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(locationItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={movementTypeItems}
                value={filters.movementType}
                onValueChange={(v) => v != null && updateFilter("movementType", v)}
              >
                <SelectTrigger className="w-fit min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(movementTypeItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {actors.length > 0 ? (
                <Select
                  items={actorItems}
                  value={filters.userId}
                  onValueChange={(v) => v != null && updateFilter("userId", v)}
                >
                  <SelectTrigger className="w-fit min-w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(actorItems).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : null}

            <div className={loading ? "opacity-50" : undefined}>
              {rows.length > 0 ? (
                <>
                <p className="mb-1 text-xs text-muted-foreground sm:hidden">
                  Scroll to see more →
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">When</th>
                        <th className="py-2 pr-4 font-medium">Item</th>
                        <th className="py-2 pr-4 font-medium">Location</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 text-right font-medium">Qty</th>
                        <th className="py-2 pr-4 font-medium">Reference</th>
                        <th className="py-2 font-medium">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                            {formatDateTime(row.created_at)}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="block max-w-48 truncate font-medium">
                              {variantLabel(row)}
                            </span>
                            {row.sku ? (
                              <span className="block font-mono text-xs text-muted-foreground">
                                {row.sku}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {row.location_name ?? "—"}
                          </td>
                          <td className="py-2 pr-4">
                            {movementTypeLabel(row.movement_type)}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium tabular-nums">
                            {signed(row.quantity)}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {row.reference_label ?? row.reference_type ?? "Manual entry"}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {row.created_by_email ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No movements match these filters
                </p>
              )}
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              onChange={(nextPage) => load(filters, nextPage)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Integration Events</CardTitle>
            <CardDescription>
              Last {integrationEvents.length} POS/webhook events received —
              including failures, so they&apos;re visible and retryable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {integrationEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Event</th>
                      <th className="py-2 pr-4 font-medium">Reference</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrationEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="border-t border-border align-top transition-colors hover:bg-muted/40"
                      >
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {event.source_system} · {event.event_type}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {event.external_reference ?? "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${
                              STATUS_STYLES[event.processing_status]
                            }`}
                          >
                            {event.processing_status}
                            {event.retry_count > 0 ? ` ·${event.retry_count}` : ""}
                          </span>
                          {event.last_error ? (
                            <span className="block max-w-xs text-xs text-destructive">
                              {event.last_error}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                          {formatDateTime(event.received_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">No events received yet</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
