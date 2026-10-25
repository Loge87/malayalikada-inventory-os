"use client";

import { useActionState } from "react";

import { login, signup, type FormState } from "@/app/actions";

function Field({ label, name, type = "text", required = true, autoComplete }: {
  label: string; name: string; type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input className="input" name={name} type={type} required={required} autoComplete={autoComplete} />
    </label>
  );
}

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    mode === "login" ? login : signup,
    undefined
  );

  if (state && "ok" in state) {
    return <p className="rounded-lg bg-brand/10 p-4 text-sm">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" ? (
        <>
          <Field label="Business name" name="businessName" autoComplete="organization" />
          <Field label="Contact person" name="contactName" required={false} autoComplete="name" />
          <Field label="Phone" name="phone" type="tel" required={false} autoComplete="tel" />
        </>
      ) : null}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {state && "error" in state ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Apply for an account"}
      </button>
    </form>
  );
}
