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
    if (state && "ok" in state) {
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
    }
  }, [state, router, client.name]);

  return (
    <tr
      onClick={() => onEdit(client.id)}
      aria-selected={isSelected}
      className={cn(
        "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50",
        isSelected && "bg-brand-accent/5 hover:bg-brand-accent/10"
      )}
    >
      <td className="py-3 pr-2">
        <span className="block truncate font-medium">{client.name}</span>
        {client.contactPerson ? (
          <span className="block truncate text-xs text-muted-foreground">
            {client.contactPerson}
          </span>
        ) : null}
      </td>
      <td className="py-3 pr-2 text-muted-foreground">
        <span className="block">{client.phone}</span>
        {client.email ? <span className="block text-xs">{client.email}</span> : null}
      </td>
      <td className="hidden py-3 pr-2 text-muted-foreground sm:table-cell">
        {client.address}
      </td>
      <td className="py-3 pr-2">
        <ActiveStatusPill isActive={client.isActive} />
      </td>
      <td
        className="py-3 pl-2 text-right"
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
          <form
            action={formAction}
            className="flex flex-wrap items-center justify-end gap-2"
          >
            <input type="hidden" name="clientId" value={client.id} />
            <span className="text-xs text-muted-foreground">
              Delete &ldquo;{client.name}&rdquo;?
            </span>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs">
            <th className="py-2 font-medium text-muted-foreground">Name</th>
            <th className="py-2 font-medium text-muted-foreground">Contact</th>
            <th className="hidden py-2 font-medium text-muted-foreground sm:table-cell">
              Address
            </th>
            <th className="py-2 font-medium text-muted-foreground">Status</th>
            <th className="py-2 pl-2 font-medium" aria-hidden />
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
