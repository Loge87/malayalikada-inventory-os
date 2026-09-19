"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LocationEditContent } from "@/components/locations/location-edit-content";
import type { EditableLocation } from "@/components/locations/locations-list";

/**
 * The mobile-width full-page equivalent of LocationEditPanel — same fields,
 * same LocationEditContent, just page chrome instead of a persistent side
 * panel. Mirrors ProductEditPageContent.
 */
export function LocationEditPageContent({
  location,
}: {
  location: EditableLocation;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/locations"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Locations
      </Link>

      <div>
        <h1 className="text-page-title">{location.name}</h1>
        <p className="text-page-subtitle">Location details.</p>
      </div>

      <LocationEditContent key={location.id} location={location} />
    </div>
  );
}
