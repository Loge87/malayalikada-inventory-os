import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="anim-up mx-auto my-12 max-w-sm rounded-[1.5rem] border border-line p-8 shadow-[var(--shadow-md)]">
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
