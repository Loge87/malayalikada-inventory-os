import { createAdminClient } from "@/lib/supabase/admin";
import { computeDisplayPrice, loadPricingContext } from "@/lib/price-formula";
import { getOrganisationId, type PortalSettings } from "@/lib/portal";
import type { ProductType } from "@/lib/product-type";

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
  /** Frozen or dry. */
  type?: "frozen" | "dry";
  /** Only products with at least one case available. */
  inStock?: boolean;
  /** Only products added in the last 30 days. */
  isNew?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "sku" | "newest" | "name";
};

const NEW_WINDOW_DAYS = 30;
const FETCH_CHUNK = 1000;

/** PostgREST caps a response at ~1000 rows, so read big lists in chunks. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < 20000; from += FETCH_CHUNK) {
    const { data, error } = await page(from, from + FETCH_CHUNK - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < FETCH_CHUNK) break;
  }
  return all;
}

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
  types: { frozen: number; dry: number };
  total: number;
}> {
  const admin = createAdminClient();
  const data = await fetchAll((from, to) =>
    admin
      .from("product_variants")
      .select("id, products!inner(category, brand, product_type)")
      .eq("organisation_id", getOrganisationId())
      .eq("portal_visible", true)
      .order("id")
      .range(from, to)
  );
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  const types = { frozen: 0, dry: 0 };
  for (const row of data) {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;
    if (p?.brand) brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
    if (p?.category) categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
    if (p?.product_type === "frozen") types.frozen += 1;
    if (p?.product_type === "dry") types.dry += 1;
  }
  const toList = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  return { brands: toList(brands), categories: toList(categories), types, total: data.length };
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

  const locationIds = await loadFulfilmentLocationIds(settings);
  const SELECT =
    "id, name, sku, units_per_pack, pack_price, currency, products!inner(name, category, brand, image_url, product_type)";

  // Search also matches the product's own name and brand (not just the
  // variant name and SKU), via a separate look-up of matching product ids.
  let searchProductIds: string[] = [];
  const term = query.q?.trim().replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    const { data: matches } = await admin
      .from("products")
      .select("id")
      .eq("organisation_id", organisationId)
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
      .limit(150);
    searchProductIds = (matches ?? []).map((m) => m.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function filtered<T>(builder: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let b: any = builder;
    b = b.eq("organisation_id", organisationId).eq("portal_visible", true);
    if (query.category) b = b.eq("products.category", query.category);
    if (query.brand) b = b.eq("products.brand", query.brand);
    if (query.type) b = b.eq("products.product_type", query.type);
    if (query.isNew) {
      const since = new Date(Date.now() - NEW_WINDOW_DAYS * 86400000).toISOString();
      b = b.gte("created_at", since);
    }
    if (term) {
      const parts = [`name.ilike.%${term}%`, `sku.ilike.%${term}%`];
      if (searchProductIds.length > 0) parts.push(`product_id.in.(${searchProductIds.join(",")})`);
      b = b.or(parts.join(","));
    }
    return b as T;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ordered<T>(builder: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let b: any = builder;
    if (query.sort === "newest") b = b.order("created_at", { ascending: false });
    else if (query.sort === "name") b = b.order("name", { referencedTable: "products" }).order("sku");
    else b = b.order("sku");
    return b as T;
  }

  type Row = {
    id: string;
    name: string;
    sku: string;
    units_per_pack: number;
    pack_price: number | null;
    currency: string;
    products:
      | { name: string; category: string | null; brand: string | null; image_url: string | null; product_type: string | null }
      | { name: string; category: string | null; brand: string | null; image_url: string | null; product_type: string | null }[]
      | null;
  };

  let rows: Row[] = [];
  let count = 0;

  if (query.inStock) {
    // Which variants have at least one case free at the fulfilment locations?
    const inStock = new Set<string>();
    if (locationIds.length > 0) {
      const levels = await fetchAll((f, t) =>
        admin
          .from("inventory_levels")
          .select("product_variant_id, on_hand, reserved, product_variants!inner(units_per_pack)")
          .in("location_id", locationIds)
          .order("id")
          .range(f, t)
      );
      const free = new Map<string, { avail: number; perCase: number }>();
      for (const l of levels) {
        const pv = Array.isArray(l.product_variants) ? l.product_variants[0] : l.product_variants;
        const entry = free.get(l.product_variant_id) ?? { avail: 0, perCase: Number(pv?.units_per_pack) || 1 };
        entry.avail += Math.max(Number(l.on_hand) - Number(l.reserved), 0);
        free.set(l.product_variant_id, entry);
      }
      for (const [id, { avail, perCase }] of free) {
        if (Math.floor(avail / (settings.stockBasis === "case" ? 1 : perCase)) >= 1) inStock.add(id);
      }
    }
    const candidates = await fetchAll((f, t) =>
      ordered(filtered(admin.from("product_variants").select("id, products!inner(name)"))).range(f, t)
    );
    const matchingIds = candidates.map((c) => c.id).filter((id) => inStock.has(id));
    count = matchingIds.length;
    const pageIds = matchingIds.slice(from, from + pageSize);
    if (pageIds.length > 0) {
      const { data, error } = await admin.from("product_variants").select(SELECT).in("id", pageIds);
      if (error) throw error;
      const byId = new Map((data as Row[]).map((r) => [r.id, r]));
      rows = pageIds.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
    }
  } else {
    const { data, count: exact, error } = await ordered(
      filtered(admin.from("product_variants").select(SELECT, { count: "exact" }))
    ).range(from, from + pageSize - 1);
    if (error) throw error;
    rows = (data ?? []) as Row[];
    count = exact ?? rows.length;
  }

  if (rows.length === 0) return { items: [], total: count, page };

  const items = await buildItems(rows, locationIds, settings, showPrices);

  return { items, total: count, page };
}


type ItemRow = {
  id: string;
  name: string;
  sku: string;
  units_per_pack: number;
  pack_price: number | null;
  currency: string;
  products:
    | { name: string; category: string | null; brand: string | null; image_url: string | null; product_type: string | null }
    | { name: string; category: string | null; brand: string | null; image_url: string | null; product_type: string | null }[]
    | null;
};

const ITEM_SELECT =
  "id, name, sku, units_per_pack, pack_price, currency, products!inner(name, category, brand, image_url, product_type)";

async function buildItems(
  rows: ItemRow[],
  locationIds: string[],
  settings: PortalSettings,
  showPrices: boolean
): Promise<CatalogueItem[]> {
  const admin = createAdminClient();
  const organisationId = getOrganisationId();
  const variantIds = rows.map((r) => r.id);

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

  return rows.map((r) => {
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
        (product?.product_type as ProductType | null) ?? null
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
}

/** Cart / order look-ups: the same shape as the catalogue, for specific variants. */
export async function loadItemsByIds(
  ids: string[],
  settings: PortalSettings,
  showPrices: boolean
): Promise<CatalogueItem[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("product_variants")
    .select(ITEM_SELECT)
    .eq("organisation_id", getOrganisationId())
    .eq("portal_visible", true)
    .in("id", ids);
  if (error) throw error;
  const locationIds = await loadFulfilmentLocationIds(settings);
  const items = await buildItems((data ?? []) as ItemRow[], locationIds, settings, showPrices);
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is CatalogueItem => Boolean(i));
}

/**
 * Bulk-order look-up: finds portal-visible variants by SKU or barcode
 * (case-insensitive) and returns them keyed by the lower-cased code.
 */
export async function loadItemsByCodes(
  codes: string[],
  settings: PortalSettings,
  showPrices: boolean
): Promise<Map<string, CatalogueItem>> {
  const clean = [...new Set(codes.map((c) => c.trim().replace(/[,()"%*\\]/g, "")).filter(Boolean))];
  const result = new Map<string, CatalogueItem>();
  if (clean.length === 0) return result;

  const candidates = [...new Set(clean.flatMap((c) => [c, c.toUpperCase(), c.toLowerCase()]))];
  const admin = createAdminClient();
  const organisationId = getOrganisationId();
  const select = `${ITEM_SELECT}, barcode`;

  const [bySku, byBarcode] = await Promise.all([
    admin.from("product_variants").select(select).eq("organisation_id", organisationId).eq("portal_visible", true).in("sku", candidates),
    admin.from("product_variants").select(select).eq("organisation_id", organisationId).eq("portal_visible", true).in("barcode", candidates),
  ]);
  if (bySku.error) throw bySku.error;
  if (byBarcode.error) throw byBarcode.error;

  type Row = ItemRow & { barcode: string | null };
  const rows = new Map<string, Row>();
  for (const r of [...(byBarcode.data ?? []), ...(bySku.data ?? [])] as unknown as Row[]) rows.set(r.id, r);

  const locationIds = await loadFulfilmentLocationIds(settings);
  const items = await buildItems([...rows.values()], locationIds, settings, showPrices);
  const byId = new Map(items.map((i) => [i.id, i]));
  // Barcodes first so a SKU match wins when both exist.
  for (const r of rows.values()) {
    const item = byId.get(r.id);
    if (item && r.barcode) result.set(r.barcode.toLowerCase(), item);
  }
  for (const r of rows.values()) {
    const item = byId.get(r.id);
    if (item) result.set(r.sku.toLowerCase(), item);
  }
  return result;
}

export { formatMoney } from "@/lib/money";
