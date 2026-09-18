import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  MovementForm,
  type LocationOption,
  type VariantOption,
} from "@/components/movements/movement-form";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/app/(app)/movements/constants";
import { formatDateTime } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VariantRow = {
  id: string;
  name: string;
  sku: string;
  products: { name: string } | null;
};

type MovementRow = {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  locations: { name: string } | null;
  product_variants:
    | { name: string; products: { name: string } | null }
    | null;
};

type LevelRow = {
  on_hand: number;
  locations: { name: string } | null;
  product_variants:
    | { name: string; products: { name: string } | null }
    | null;
};

function variantLabel(name: string, sku: string, productName?: string) {
  const base = productName ? `${productName} — ${name}` : name;
  return `${base} (${sku})`;
}

function formatMovementType(type: string) {
  return MOVEMENT_TYPE_LABELS[type as MovementType] ?? type;
}

export default async function MovementsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // All four reads are RLS-scoped to the caller's organisation.
  const [locationsRes, variantsRes, movementsRes, levelsRes] = await Promise.all(
    [
      supabase.from("locations").select("id, name").order("name"),
      supabase
        .from("product_variants")
        .select("id, name, sku, products(name)")
        .order("name")
        .returns<VariantRow[]>(),
      supabase
        .from("inventory_movements")
        .select(
          "id, movement_type, quantity, created_at, locations(name), product_variants(name, products(name))"
        )
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<MovementRow[]>(),
      supabase
        .from("inventory_levels")
        .select(
          "on_hand, locations(name), product_variants(name, products(name))"
        )
        .order("on_hand", { ascending: false })
        .returns<LevelRow[]>(),
    ]
  );

  const firstError =
    locationsRes.error ||
    variantsRes.error ||
    movementsRes.error ||
    levelsRes.error;
  if (firstError) {
    throw firstError;
  }

  const locations: LocationOption[] = (locationsRes.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
  }));

  const variants: VariantOption[] = (variantsRes.data ?? []).map((v) => ({
    id: v.id,
    label: variantLabel(v.name, v.sku, v.products?.name),
  }));

  const movements = movementsRes.data ?? [];
  const levels = levelsRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Movements</h1>
        <p className="text-page-subtitle">
          Record a stock movement and see current on-hand by location.
        </p>
      </div>

      <MovementForm locations={locations} variants={variants} />

      <Card>
        <CardHeader>
          <CardTitle>On hand</CardTitle>
          <CardDescription>
            Current quantity per location and variant, derived from the ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {levels.length > 0 ? (
            <ul className="divide-y divide-border">
              {levels.map((level, i) => (
                <li
                  key={`${level.locations?.name}-${level.product_variants?.name}-${i}`}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {level.product_variants?.products?.name
                        ? `${level.product_variants.products.name} — `
                        : ""}
                      {level.product_variants?.name ?? "Unknown variant"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {level.locations?.name ?? "Unknown location"}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {level.on_hand}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No stock on hand yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent movements</CardTitle>
          <CardDescription>Last {movements.length} recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length > 0 ? (
            <ul className="divide-y divide-border">
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {movement.product_variants?.products?.name
                        ? `${movement.product_variants.products.name} — `
                        : ""}
                      {movement.product_variants?.name ?? "Unknown variant"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatMovementType(movement.movement_type)} ·{" "}
                      {movement.locations?.name ?? "Unknown location"} ·{" "}
                      {formatDateTime(movement.created_at)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {movement.quantity > 0
                      ? `+${movement.quantity}`
                      : movement.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No movements yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
