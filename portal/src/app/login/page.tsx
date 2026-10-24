import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="anim-up mx-auto my-12 max-w-sm rounded-[1.5rem] border border-line p-8 shadow-[var(--shadow-md)]">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Sign in to see your wholesale prices and order.</p>
      <AuthForm mode="login" />
      <p className="mt-6 text-sm text-muted">
        New here? <Link className="font-semibold text-brand underline" href="/signup">Apply for a wholesale account</Link>
      </p>
    </div>
  );
}
