import { createAdminClient } from "@/lib/supabase/admin";
import { computeDisplayPrice, loadPricingContext } from "@/lib/price-formula";
import { getOrganisationId, type PortalSettings } from "@/lib/portal";

export const PAGE_SIZE = 24;

export type Facet = { name: string; count: number };

export type StockState = "in" | "low" | "out";

export type CatalogueItem = {
  id: string;
  name: string;
  variantName: string;
  sku: string;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  unitsPerCase: number;
  currency: string;
  stock: StockState;
  /** Only filled in for approved retailers. */
  casesAvailable: number | null;
  /** Price per case. Only filled in for approved retailers; null = no price set. */
  casePrice: number | null;
};

export type CatalogueQuery = {
  q?: string;
  category?: string;
  brand?: string;
  page?: number;
  pageSize?: number;
  sort?: "sku" | "newest";
};

const LOW_STOCK_CASES = 5;

export async function loadFulfilmentLocationIds(settings: PortalSettings): Promise<string[]> {
  if (settings.fulfilmentLocationIds.length > 0) return settings.fulfilmentLocationIds;
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id")
    .eq("organisation_id", getOrganisationId())
    .eq("type", "warehouse")
    .eq("is_active", true)
    .order("created_at");
  return (data ?? []).map((l) => l.id);
}

export async function loadFacets(): Promise<{
  brands: Facet[];
  categories: Facet[];
  total: number;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("product_variants")
    .select("products!inner(category, brand)")
    .eq("organisation_id", getOrganisationId())
    .eq("portal_visible", true)
    .limit(5000);
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const row of data ?? []) {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;
    if (p?.brand) brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
    if (p?.category) categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
  }
  const toList = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  return { brands: toList(brands), categories: toList(categories), total: data?.length ?? 0 };
}

export async function loadCatalogue(
  query: CatalogueQuery,
  settings: PortalSettings,
  showPrices: boolean
): Promise<{ items: CatalogueItem[]; total: number; page: number }> {
  const admin = createAdminClient();
  const organisationId = getOrganisationId();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const from = (page - 1) * pageSize;

  let q = admin
    .from("product_variants")
    .select(
      "id, name, sku, units_per_pack, pack_price, currency, products!inner(name, category, brand, image_url, product_type)",
      { count: "exact" }
    )
    .eq("organisation_id", organisationId)
    .eq("portal_visible", true);

  if (query.category) q = q.eq("products.category", query.category);
  if (query.brand) q = q.eq("products.brand", query.brand);
  if (query.q?.trim()) {
    // strip characters that would break the PostgREST filter syntax
    const term = query.q.trim().replace(/[,()%*\\]/g, " ");
    q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  const { data, count, error } = await (query.sort === "newest"
    ? q.order("created_at", { ascending: false })
    : q.order("sku")
  ).range(from, from + pageSize - 1);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: count ?? 0, page };

  const variantIds = rows.map((r) => r.id);
  const locationIds = await loadFulfilmentLocationIds(settings);

  const [levels, pricing, signed] = await Promise.all([
    locationIds.length
      ? admin
          .from("inventory_levels")
          .select("product_variant_id, on_hand, reserved")
          .in("product_variant_id", variantIds)
          .in("location_id", locationIds)
      : Promise.resolve({ data: [] as { product_variant_id: string; on_hand: number; reserved: number }[] }),
    showPrices ? loadPricingContext(admin, organisationId) : Promise.resolve(null),
    (async () => {
      const paths = rows
        .map((r) => (Array.isArray(r.products) ? r.products[0] : r.products)?.image_url)
        .filter((p): p is string => Boolean(p));
      if (paths.length === 0) return new Map<string, string>();
      const { data: urls } = await admin.storage.from("product-images").createSignedUrls(paths, 3600);
      return new Map((urls ?? []).filter((u) => u.path && u.signedUrl).map((u) => [u.path as string, u.signedUrl]));
    })(),
  ]);

  const free = new Map<string, number>();
  for (const l of levels.data ?? []) {
    const avail = Math.max(Number(l.on_hand) - Number(l.reserved), 0);
    free.set(l.product_variant_id, (free.get(l.product_variant_id) ?? 0) + avail);
  }

  const items: CatalogueItem[] = rows.map((r) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const perCase = Number(r.units_per_pack) || 1;
    const avail = free.get(r.id) ?? 0;
    const cases = Math.floor(avail / (settings.stockBasis === "case" ? 1 : perCase));
    let casePrice: number | null = null;
    if (pricing) {
      const price = computeDisplayPrice(
        r.pack_price === null ? null : Number(r.pack_price),
        pricing.activeFormulas.wholesale,
        pricing.variables,
        product?.product_type ?? null
      );
      casePrice = price.kind === "computed" ? price.amount : null;
    }
    return {
      id: r.id,
      name: product?.name ?? r.name,
      variantName: r.name,
      sku: r.sku,
      category: product?.category ?? null,
      brand: product?.brand ?? null,
      imageUrl: product?.image_url ? (signed.get(product.image_url) ?? null) : null,
      unitsPerCase: perCase,
      currency: r.currency,
      stock: cases <= 0 ? "out" : cases <= LOW_STOCK_CASES ? "low" : "in",
      casesAvailable: showPrices ? cases : null,
      casePrice,
    };
  });

  return { items, total: count ?? items.length, page };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
