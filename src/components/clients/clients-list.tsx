"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteClient } from "@/app/(app)/clients/actions";
import { useIsWideDesktop } from "@/lib/use-media-query";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { usePermissions } from "@/components/providers/role-provider";
import { cn } from "@/lib/utils";

export type EditableClient = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  address: string;
  isActive: boolean;
};

function ActiveStatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        isActive
          ? "bg-status-success/10 text-status-success"
          : "bg-muted text-muted-foreground"
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function ClientRow({
  client,
  isSelected,
  canManage,
  onEdit,
}: {
  client: EditableClient;
  isSelected: boolean;
  canManage: boolean;
  onEdit: (clientId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteClient, undefined);
  const router = useRouter();

  // Render-phase "adjust state when something changes" (not an effect) —
  // collapses the confirm/cancel form back once a delete actually
  // completes. Same pattern as LocationsList/ProductsTable.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "ok" in state) {
      setConfirming(false);
    }
  }

  useEffect(() => {
    if (!state) return;
    if ("ok" in state) {
      router.refresh();
      // state.result is "deactivated" when the client had stock-out history
      // — say so rather than claiming "deleted" for a row that's actually
      // still there. Same wording rule as deleteProduct/deleteLocation.
      toastManager.add({
        title:
          state.result === "deactivated"
            ? `${client.name} deactivated`
            : `${client.name} deleted`,
        type: "success",
      });
    } else {
      // CORRECTED this pass — item 8: this table is now table-layout:
      // fixed with a fixed Actions column width, so an inline error
      // paragraph here would either overflow or wrap and grow the row's
      // fixed height; a toast carries it instead.
      toastManager.add({ title: state.error, type: "error" });
    }
  }, [state, router, client.name]);

  return (
    <tr
      onClick={() => onEdit(client.id)}
      aria-selected={isSelected}
      className="table-row cursor-pointer"
      // A fixed row height (item 8) — this table's own default
      // --space-table-row-height, not the Team table's denser compact
      // token (this list isn't trying to cram in extra rows the way
      // Team's pagination-driven table is).
      style={{ height: "var(--space-table-row-height)" }}
    >
      <td className="py-3 pr-2">
        <span className="block truncate font-medium" title={client.name}>
          {client.name}
        </span>
        {client.contactPerson ? (
          <span className="block truncate text-xs text-muted-foreground" title={client.contactPerson}>
            {client.contactPerson}
          </span>
        ) : null}
      </td>
      <td className="py-3 pr-2 text-muted-foreground">
        <span className="block truncate">{client.phone}</span>
        {client.email ? (
          <span className="block truncate text-xs" title={client.email}>
            {client.email}
          </span>
        ) : null}
      </td>
      <td
        className="hidden truncate py-3 pr-2 text-muted-foreground sm:table-cell"
        title={client.address}
      >
        {client.address}
      </td>
      <td className="py-3 pr-2">
        <ActiveStatusPill isActive={client.isActive} />
      </td>
      <td
        className="cell-number py-3"
        onClick={(event) => event.stopPropagation()}
      >
        {!canManage ? null : !confirming ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(client.id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/30 hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        ) : (
          // CORRECTED this pass — item 8: the "Delete X?" confirmation
          // text used to sit inline here, but this cell's own column is
          // now a fixed, narrow width (--client-col-actions) — a long
          // client name would wrap it and grow this row past its fixed
          // height. The destructive-red Confirm button plus its own
          // title attribute (below) carries the same "you're about to
          // delete this" signal without needing the row to flex for it.
          <form
            action={formAction}
            className="flex items-center justify-end gap-2"
            title={`Delete "${client.name}"?`}
          >
            <input type="hidden" name="clientId" value={client.id} />
            <Button type="submit" variant="destructive" size="sm" disabled={pending}>
              {pending ? "Deleting…" : "Confirm"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </form>
        )}
        {state && "error" in state ? (
          <p className="mt-1 text-xs text-destructive">{state.error}</p>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * The clients list — mirrors LocationsList exactly: no search/sort/
 * pagination (an organisation's client count is manageable without it),
 * delete lives directly on each row as a two-step confirm/cancel.
 */
export function ClientsList({
  clients,
  selectedClientId,
  onSelectClient,
}: {
  clients: EditableClient[];
  /** The client currently open in the desktop side panel (owned by the
   *  parent, ClientsPageContent) — only used to highlight its row. */
  selectedClientId: string | null;
  /** Desktop: open/replace the side panel with this client. Mobile never
   *  calls this — openEdit() below routes to the full-page edit route
   *  instead. */
  onSelectClient: (clientId: string) => void;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const isWideDesktop = useIsWideDesktop();

  function openEdit(clientId: string) {
    if (isWideDesktop) {
      onSelectClient(clientId);
    } else {
      router.push(`/clients/${clientId}/edit`);
    }
  }

  return (
    <div className="overflow-x-auto">
      {/* .table/.table-head — not raw markup — see
          expiring-soon-table.tsx's own note for why. table-layout: fixed
          + a <colgroup> (item 8) — the Address <col> is hidden the same
          breakpoint its <th>/<td> already are (sm:table-column, mirroring
          their own sm:table-cell), so it doesn't reserve dead width on a
          narrow screen where no cell in that column actually renders. */}
      <table className="table table-fixed">
        <colgroup>
          <col style={{ width: "var(--client-col-name)" }} />
          <col style={{ width: "var(--client-col-contact)" }} />
          <col
            className="hidden sm:table-column"
            style={{ width: "var(--client-col-address)" }}
          />
          <col style={{ width: "var(--client-col-status)" }} />
          <col style={{ width: "var(--client-col-actions)" }} />
        </colgroup>
        <thead>
          <tr className="table-head">
            <th className="pr-2 font-medium text-muted-foreground">Name</th>
            <th className="pr-2 font-medium text-muted-foreground">Contact</th>
            <th className="hidden pr-2 font-medium text-muted-foreground sm:table-cell">
              Address
            </th>
            <th className="pr-2 font-medium text-muted-foreground">Status</th>
            <th className="font-medium" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              isSelected={selectedClientId === client.id}
              canManage={can("clients:manage")}
              onEdit={openEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
