"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LocationOption = { id: string; name: string };

export function LocationPicker({
  locations,
  selectedLocationId,
}: {
  locations: LocationOption[];
  selectedLocationId: string | null;
}) {
  const router = useRouter();

  const items: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );

  return (
    <Select
      items={items}
      value={selectedLocationId}
      onValueChange={(value) => {
        if (typeof value === "string") {
          router.replace(`/batches?location=${value}`);
        }
      }}
    >
      <SelectTrigger className="w-full sm:w-72" aria-label="Location">
        <SelectValue placeholder="Select a location" />
      </SelectTrigger>
      <SelectContent>
        {locations.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
