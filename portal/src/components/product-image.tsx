export function ProductImage({ src, alt, fit = "contain" }: { src: string | null; alt: string; fit?: "contain" | "cover" }) {
  return (
    // Signed storage URLs expire, so next/image optimisation does not apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? "/placeholder-product.svg"}
      alt={src ? alt : `${alt} (no image available)`}
      className={`h-full w-full ${src && fit === "contain" ? "object-contain p-4" : "object-cover"}`}
      loading="lazy"
    />
  );
}
