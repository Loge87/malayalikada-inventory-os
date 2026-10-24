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
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="text-xl font-extrabold tracking-tight text-brand">{settings.businessName}</div>
          <p className="mt-2 max-w-xs text-sm text-muted">{SITE.tagline}</p>
          <div className="mt-4 space-y-1 text-sm text-muted">
            {SITE.address ? <p>{SITE.address}</p> : null}
            {SITE.phone ? <p>{SITE.phone}</p> : null}
            {SITE.email ? <p>{SITE.email}</p> : null}
            <p>{SITE.region}</p>
          </div>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm hover:text-brand">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {year} {settings.businessName}. All rights reserved.</p>
          <p>Trade prices are shown to approved retailers only.</p>
        </div>
      </div>
    </footer>
  );
}
