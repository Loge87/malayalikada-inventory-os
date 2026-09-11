export const LOCATION_TYPES = ["warehouse", "store"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export type LocationFormState = { error: string } | { ok: true } | undefined;
