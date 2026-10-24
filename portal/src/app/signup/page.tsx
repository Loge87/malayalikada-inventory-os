import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Apply for a wholesale account</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        We approve every retailer by hand. Once approved you will see prices and can place bulk orders.
      </p>
      <AuthForm mode="signup" />
      <p className="mt-6 text-sm text-muted">
        Already approved? <Link className="font-semibold text-brand underline" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
