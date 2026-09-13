import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { ScanLookup } from "@/components/scan/scan-lookup";

export default async function ScanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="font-heading text-xl font-medium">Scan / lookup</h1>
        <p className="text-muted-foreground text-sm">
          Scan or enter a barcode to see the product variant and its stock by
          location.
        </p>
      </div>

      <ScanLookup />
    </div>
  );
}
