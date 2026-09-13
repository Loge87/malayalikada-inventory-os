import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/get-current-user";

export default async function Home() {
  const user = await getCurrentUser();

  redirect(user ? "/dashboard" : "/login");
}
