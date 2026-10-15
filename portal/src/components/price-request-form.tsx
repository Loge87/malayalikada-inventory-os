"use client";

import { useActionState } from "react";

import { requestPriceList, type FormState } from "@/app/actions";

export function PriceRequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPriceList, undefined);

  if (state && "ok" in state) {
    return <p className="rounded-lg bg-brand/10 p-4 text-sm">{state.message ?? "Thanks. We will be in touch."}</p>;
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input className="input" name="businessName" placeholder="Business name" required />
      <input className="input" name="contactName" placeholder="Contact person (optional)" />
      <input className="input" name="email" type="email" placeholder="Email" required />
      <input className="input" name="phone" type="tel" placeholder="Phone (optional)" />
      {/* honeypot field, hidden from people */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <textarea className="input sm:col-span-2" name="message" placeholder="Anything we should know? (optional)" maxLength={1000} />
      {state && "error" in state ? <p className="text-sm text-danger sm:col-span-2" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary sm:col-span-2 sm:w-fit" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Request price list"}
      </button>
    </form>
  );
}
