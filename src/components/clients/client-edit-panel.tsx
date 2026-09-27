"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientEditContent } from "@/components/clients/client-edit-content";
import type { EditableClient } from "@/components/clients/clients-list";

/**
 * Desktop-width edit surface: a persistent panel that's part of the page's
 * own layout (ClientsPageContent's flex row), not an overlay — the list
 * narrows to make room for it. Mirrors LocationEditPanel exactly.
 */
export function ClientEditPanel({
  client,
  onClose,
}: {
  client: EditableClient;
  onClose: () => void;
}) {
  return (
    <Card
      elevated
      className="sticky top-6 max-h-[calc(100vh-3rem)] animate-in overflow-y-auto fade-in slide-in-from-right-4 scrollbar-hover-thin duration-300"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close panel"
        className="absolute top-3 right-3"
      >
        <XIcon className="size-4" />
      </Button>
      <CardHeader className="pr-12">
        <CardTitle className="truncate">{client.name}</CardTitle>
        <CardDescription>Client details.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClientEditContent key={client.id} client={client} />
      </CardContent>
    </Card>
  );
}
