import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BulkUploadFlow } from "@/components/products/bulk-upload/bulk-upload-flow";

export default async function BulkUploadPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
      <div>
        <Link
          href="/products"
          className="text-muted-foreground text-sm underline"
        >
          ← Products
        </Link>
        <h1 className="font-heading mt-1 text-xl font-medium">Bulk upload</h1>
        <p className="text-muted-foreground text-sm">
          Import many products and variants at once from a CSV or Excel file.
        </p>
      </div>

      <BulkUploadFlow />
    </div>
  );
}
