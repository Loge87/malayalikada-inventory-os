"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ClientEditContent } from "@/components/clients/client-edit-content";
import type { EditableClient } from "@/components/clients/clients-list";

/**
 * The mobile-width full-page equivalent of ClientEditPanel — same fields,
 * same ClientEditContent, just page chrome instead of a persistent side
 * panel. Mirrors LocationEditPageContent.
 */
export function ClientEditPageContent({ client }: { client: EditableClient }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/clients"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Clients
      </Link>

      <div>
        <h1 className="text-page-title">{client.name}</h1>
        <p className="text-page-subtitle">Client details.</p>
      </div>

      <ClientEditContent key={client.id} client={client} />
    </div>
  );
}
