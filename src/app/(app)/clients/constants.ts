export type ClientFormState = { error: string } | { ok: true } | undefined;

export type UpdateClientState = { error: string } | { ok: true } | undefined;

export type DeleteClientState =
  | { error: string }
  | { ok: true; result: "deleted" | "deactivated" }
  | undefined;
