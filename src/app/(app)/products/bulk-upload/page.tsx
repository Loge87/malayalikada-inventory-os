import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { BulkUploadFlow } from "@/components/products/bulk-upload/bulk-upload-flow";

export default async function BulkUploadPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <Link
          href="/products"
          className="text-muted-foreground text-sm underline"
        >
          ← Products
        </Link>
        <h1 className="text-page-title mt-1">Bulk upload</h1>
        <p className="text-page-subtitle">
          Import many products and variants at once from a CSV or Excel file.
        </p>
      </div>

      <BulkUploadFlow />
    </div>
  );
}
