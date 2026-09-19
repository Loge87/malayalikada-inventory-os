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
import { LocationEditContent } from "@/components/locations/location-edit-content";
import type { EditableLocation } from "@/components/locations/locations-list";

/**
 * Desktop-width edit surface: a persistent panel that's part of the page's
 * own layout (LocationsPageContent's flex row), not an overlay — the list
 * narrows to make room for it. Mirrors ProductEditPanel exactly.
 *
 * Mobile uses a dedicated full page instead (location-edit-page-content.tsx)
 * — LocationsList's openEdit() decides which one applies, using the same
 * breakpoint as the nav, so this component is only ever mounted on desktop.
 */
export function LocationEditPanel({
  location,
  onClose,
}: {
  location: EditableLocation;
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
        <CardTitle className="truncate">{location.name}</CardTitle>
        <CardDescription>Location details.</CardDescription>
      </CardHeader>
      <CardContent>
        <LocationEditContent key={location.id} location={location} />
      </CardContent>
    </Card>
  );
}
