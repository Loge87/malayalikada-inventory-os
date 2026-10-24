import Link from "next/link";

import { SITE } from "@/lib/site";
import { getPortalSettings } from "@/lib/portal";

export async function SiteFooter() {
  const settings = await getPortalSettings();
  const year = new Date().getFullYear();

  const columns = [
    { title: "Shop", links: [["Brands", "/brands"], ["Categories", "/categories"], ["All products", "/products"]] },
    { title: "Trade", links: [["Apply for an account", "/signup"], ["Sign in", "/login"], ["How ordering works", "/trade"]] },
    { title: "Company", links: [["Contact", "/contact"], ["Request a price list", "/contact"]] },
  ] as const;

  return (
    <footer className="mt-24 border-t border-line bg-soft">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-lg font-extrabold text-white">
              {settings.businessName.slice(0, 1)}
            </span>
            <span className="text-lg font-extrabold tracking-tight">{settings.businessName}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{SITE.tagline}</p>
          <div className="mt-5 space-y-1 text-sm text-muted">
            {SITE.address ? <p>{SITE.address}</p> : null}
            {SITE.phone ? <p>{SITE.phone}</p> : null}
            {SITE.email ? <p>{SITE.email}</p> : null}
            <p>{SITE.region}</p>
          </div>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink">{c.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted transition-colors hover:text-brand">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {year} {settings.businessName}. All rights reserved.</p>
          <p>Trade prices are shown to approved retailers only.</p>
        </div>
      </div>
    </footer>
  );
}
