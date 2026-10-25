import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="anim-drift pointer-events-none absolute -right-24 top-0 size-96 rounded-full bg-brand/10 blur-3xl" aria-hidden />
      <div className="anim-drift pointer-events-none absolute -left-20 bottom-0 size-80 rounded-full bg-accent/15 blur-3xl [animation-delay:-6s]" aria-hidden />
      <div className="anim-up card relative mx-auto my-16 max-w-md p-8 shadow-[var(--shadow-lg)] sm:p-10">
        <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-brand/10 text-2xl">🏪</div>
        <h1 className="text-2xl font-extrabold tracking-tight">Apply for a wholesale account</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          We approve every retailer by hand. Once approved you will see prices and can place bulk orders.
        </p>
        <AuthForm mode="signup" />
        <p className="mt-6 text-sm text-muted">
          Already approved? <Link className="font-semibold text-brand underline" href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
