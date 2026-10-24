import type { Metadata } from "next";

import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPortalSettings } from "@/lib/portal";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPortalSettings();
  return {
    title: `${settings.businessName} Wholesale`,
    description: `Order wholesale from ${settings.businessName}.`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main className="min-h-[60vh]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
