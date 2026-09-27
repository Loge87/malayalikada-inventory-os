"use client";

import { useState } from "react";

import { useIsWideDesktop } from "@/lib/use-media-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClientsList,
  type EditableClient,
} from "@/components/clients/clients-list";
import { ClientEditPanel } from "@/components/clients/client-edit-panel";

/**
 * Owns the one piece of state ClientsList and the edit panel both need to
 * share: which client (if any) is open. Mirrors LocationsPageContent
 * exactly — at lg (1024px) and up this renders ClientEditPanel as a second
 * column; below that, ClientsList's own openEdit() routes to the full-page
 * edit route instead.
 */
export function ClientsPageContent({
  clients,
  emptyMessage,
}: {
  clients: EditableClient[];
  emptyMessage: string;
}) {
  const isWideDesktop = useIsWideDesktop();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = isWideDesktop
    ? (clients.find((c) => c.id === selectedClientId) ?? null)
    : null;

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <Card elevated>
          <CardHeader>
            <CardTitle>All clients</CardTitle>
            <CardDescription>
              Click a row or Edit to change its details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length > 0 ? (
              <ClientsList
                clients={clients}
                selectedClientId={selectedClient?.id ?? null}
                onSelectClient={setSelectedClientId}
              />
            ) : (
              <p className="text-muted-foreground">{emptyMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedClient ? (
        <div className="w-[400px] shrink-0 xl:w-[440px]">
          <ClientEditPanel
            client={selectedClient}
            onClose={() => setSelectedClientId(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
