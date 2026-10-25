import { cookies } from "next/headers";

/**
 * The cart lives in a small cookie: "variantId:cases,variantId:cases". It is
 * only ever read and written on the server, and prices / stock are always
 * re-checked from the database, so nothing in it is trusted.
 */
const COOKIE = "wp_cart";
const MAX_LINES = 80;
const MAX_CASES = 999;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CartLine = { variantId: string; cases: number };

export async function readCart(): Promise<CartLine[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  const lines: CartLine[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const [id, qty] = part.split(":");
    const cases = Math.floor(Number(qty));
    if (!id || !UUID_RE.test(id) || seen.has(id) || !Number.isFinite(cases) || cases < 1) continue;
    seen.add(id);
    lines.push({ variantId: id.toLowerCase(), cases: Math.min(cases, MAX_CASES) });
    if (lines.length >= MAX_LINES) break;
  }
  return lines;
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(COOKIE);
    return;
  }
  store.set(
    COOKIE,
    lines
      .slice(0, MAX_LINES)
      .map((l) => `${l.variantId}:${Math.min(Math.max(Math.floor(l.cases), 1), MAX_CASES)}`)
      .join(","),
    {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    }
  );
}

export async function cartCount(): Promise<number> {
  return (await readCart()).length;
}

export { MAX_CASES, MAX_LINES };
