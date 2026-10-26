"use client";

import { useActionState } from "react";

import { changePassword, updateProfile, type SettingsState } from "@/app/settings-actions";

function Notice({ state }: { state: SettingsState }) {
  if (!state) return null;
  return "error" in state ? (
    <p className="text-sm font-medium text-danger" role="alert">{state.error}</p>
  ) : (
    <p className="text-sm font-medium text-brand" role="status">{state.message}</p>
  );
}

export function ProfileForm({ businessName, contactName, phone, email }: {
  businessName: string; contactName: string; phone: string; email: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">Email
        <input className="input mt-1.5 bg-soft" value={email} readOnly disabled />
      </label>
      <label className="block text-sm font-medium">Business name
        <input className="input mt-1.5" name="businessName" defaultValue={businessName} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Contact person
          <input className="input mt-1.5" name="contactName" defaultValue={contactName} autoComplete="name" />
        </label>
        <label className="block text-sm font-medium">Phone
          <input className="input mt-1.5" name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
        </label>
      </div>
      <Notice state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">New password
        <input className="input mt-1.5" name="password" type="password" minLength={8} autoComplete="new-password" required />
      </label>
      <label className="block text-sm font-medium">Confirm new password
        <input className="input mt-1.5" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
      </label>
      <Notice state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
    </form>
  );
}
