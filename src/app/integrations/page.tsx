import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type MappingRow = {
  id: string;
  source_system: string;
  location_external_id: string;
  locations: { name: string } | null;
};

type EventRow = {
  id: string;
  source_system: string;
  event_type: string;
  external_reference: string | null;
  processing_status: "pending" | "processed" | "failed";
  retry_count: number;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
};

const STATUS_STYLES: Record<EventRow["processing_status"], string> = {
  processed: "bg-muted text-foreground",
  pending: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export default async function IntegrationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Both tables are RLS-scoped to the caller's organisation.
  const [mappingsRes, eventsRes] = await Promise.all([
    supabase
      .from("external_location_mappings")
      .select("id, source_system, location_external_id, locations(name)")
      .order("source_system")
      .order("location_external_id")
      .returns<MappingRow[]>(),
    supabase
      .from("integration_events")
      .select(
        "id, source_system, event_type, external_reference, processing_status, retry_count, last_error, received_at, processed_at"
      )
      .order("received_at", { ascending: false })
      .limit(50)
      .returns<EventRow[]>(),
  ]);

  const firstError = mappingsRes.error || eventsRes.error;
  if (firstError) {
    throw firstError;
  }

  const mappings = mappingsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const failedCount = events.filter(
    (e) => e.processing_status === "failed"
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="font-heading text-xl font-medium">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          POS and channel events. Stock only ever changes through the inventory
          ledger — channels never write quantities directly.
        </p>
      </div>

      {/* Location mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Location mappings</CardTitle>
          <CardDescription>
            Maps a channel&apos;s own location id to an internal location.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappings.length > 0 ? (
            <ul className="divide-y divide-border">
              {mappings.map((mapping) => (
                <li
                  key={mapping.id}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="font-mono">
                    {mapping.source_system} / {mapping.location_external_id}
                  </span>
                  <span className="text-muted-foreground">
                    → {mapping.locations?.name ?? "Unknown location"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No mappings yet — add rows to external_location_mappings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Event log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>
            Last {events.length} received
            {failedCount > 0 ? ` · ${failedCount} failed` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Event</th>
                    <th className="py-2 pr-4 font-medium">Reference</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-border align-top">
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
                          {event.retry_count > 0
                            ? ` ·${event.retry_count}`
                            : ""}
                        </span>
                        {event.last_error ? (
                          <span className="block max-w-xs text-xs text-destructive">
                            {event.last_error}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-muted-foreground text-xs whitespace-nowrap">
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
    </div>
  );
}
