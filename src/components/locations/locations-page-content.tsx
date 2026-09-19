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
  LocationsList,
  type EditableLocation,
} from "@/components/locations/locations-list";
import { LocationEditPanel } from "@/components/locations/location-edit-panel";

/**
 * Owns the one piece of state LocationsList and the edit panel both need to
 * share: which location (if any) is open. Mirrors ProductsPageContent
 * exactly — at lg (1024px) and up this renders LocationEditPanel as a second
 * column; below that, LocationsList's own openEdit() routes to the full-page
 * edit route instead, so selectedLocation is deliberately gated on
 * isWideDesktop too.
 */
export function LocationsPageContent({
  locations,
  emptyMessage,
}: {
  locations: EditableLocation[];
  emptyMessage: string;
}) {
  const isWideDesktop = useIsWideDesktop();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const selectedLocation = isWideDesktop
    ? (locations.find((l) => l.id === selectedLocationId) ?? null)
    : null;

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <Card elevated>
          <CardHeader>
            <CardTitle>All locations</CardTitle>
            <CardDescription>
              Click a row or Edit to change its details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {locations.length > 0 ? (
              <LocationsList
                locations={locations}
                selectedLocationId={selectedLocation?.id ?? null}
                onSelectLocation={setSelectedLocationId}
              />
            ) : (
              <p className="text-muted-foreground">{emptyMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedLocation ? (
        <div className="w-[400px] shrink-0 xl:w-[440px]">
          <LocationEditPanel
            location={selectedLocation}
            onClose={() => setSelectedLocationId(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
