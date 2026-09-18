import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  getCurrentOrganisationId,
  getOrganisationPriceSettings,
} from "@/lib/organisation";
import { ScanLookup } from "@/components/scan/scan-lookup";
import { ProductCreatedToast } from "@/components/products/product-created-toast";

export default async function ScanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  const priceSettings = organisationId
    ? await getOrganisationPriceSettings(supabase, organisationId)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Scan / lookup</h1>
        <p className="text-page-subtitle">
          Scan or enter a barcode to see the product variant and its stock by
          location.
        </p>
      </div>

      <ScanLookup priceSettings={priceSettings} />
      <ProductCreatedToast />
    </div>
  );
}
