"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addRetailer,
  deleteRetailer,
  setRetailerStatus,
  updateRetailer,
  type RetailerStatus,
} from "@/app/(app)/retailers/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type RetailerRow = {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: RetailerStatus;
  hasLogin: boolean;
  createdAt: string;
};

type Filter = "all" | RetailerStatus;

const STATUS_LABEL: Record<RetailerStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  suspended: "Suspended",
};

const STATUS_STYLE: Record<RetailerStatus, string> = {
  pending: "bg-status-warning/10 text-status-warning",
  approved: "bg-status-success/10 text-status-success",
  suspended: "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: RetailerStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function RetailerForm({
  retailer,
  onDone,
}: {
  retailer: RetailerRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    retailer ? updateRetailer : addRetailer,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({
        title: retailer ? "Retailer updated" : "Retailer added",
        type: "success",
      });
      onDone();
    }
  }, [state, router, onDone, retailer]);

  return (
    <form action={formAction}>
      <FieldGroup>
        {retailer ? (
          <input type="hidden" name="retailerId" value={retailer.id} />
        ) : null}
        <Field>
          <FieldLabel htmlFor="retailer-business">Business name</FieldLabel>
          <Input
            id="retailer-business"
            name="businessName"
            defaultValue={retailer?.businessName}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="retailer-contact">Contact person</FieldLabel>
          <Input
            id="retailer-contact"
            name="contactName"
            defaultValue={retailer?.contactName ?? ""}
            placeholder="Optional"
          />
        </Field>
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor="retailer-email">Email</FieldLabel>
            <Input
              id="retailer-email"
              name="email"
              type="email"
              defaultValue={retailer?.email}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="retailer-phone">Phone</FieldLabel>
            <Input
              id="retailer-phone"
              name="phone"
              defaultValue={retailer?.phone ?? ""}
              placeholder="Optional"
            />
          </Field>
        </Field>
        <Field>
          <FieldLabel htmlFor="retailer-address">Delivery address</FieldLabel>
          <Input
            id="retailer-address"
            name="address"
            defaultValue={retailer?.address ?? ""}
            placeholder="Optional"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="retailer-notes">Internal notes</FieldLabel>
          <Input
            id="retailer-notes"
            name="notes"
            defaultValue={retailer?.notes ?? ""}
            placeholder="Only you see this"
          />
        </Field>

        {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : retailer ? "Save changes" : "Add retailer"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function RowActions({
  retailer,
  onEdit,
}: {
  retailer: RetailerRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function changeStatus(status: RetailerStatus, done: string) {
    startTransition(async () => {
      const res = await setRetailerStatus(retailer.id, status);
      if (res && "error" in res) {
        toastManager.add({ title: res.error, type: "error" });
        return;
      }
      toastManager.add({ title: done, type: "success" });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRetailer(retailer.id);
      if ("error" in res) {
        toastManager.add({ title: res.error, type: "error" });
        return;
      }
      toastManager.add({
        title:
          res.result === "deleted"
            ? "Retailer deleted"
            : "Retailer has past orders, so they were suspended instead",
        type: "success",
      });
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm">Delete {retailer.businessName}?</span>
        <Button size="sm" variant="destructive" disabled={pending} onClick={remove}>
          {pending ? "Deleting…" : "Delete"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {retailer.status === "pending" ? (
        <>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => changeStatus("approved", "Retailer approved")}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => changeStatus("suspended", "Request declined")}
          >
            Decline
          </Button>
        </>
      ) : null}
      {retailer.status === "approved" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => changeStatus("suspended", "Retailer suspended")}
        >
          Suspend
        </Button>
      ) : null}
      {retailer.status === "suspended" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => changeStatus("approved", "Retailer reinstated")}
        >
          Reinstate
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={onEdit}>
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    </div>
  );
}

export function RetailersManager({ retailers }: { retailers: RetailerRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RetailerRow | null>(null);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(
    () => ({
      all: retailers.length,
      pending: retailers.filter((r) => r.status === "pending").length,
      approved: retailers.filter((r) => r.status === "approved").length,
      suspended: retailers.filter((r) => r.status === "suspended").length,
    }),
    [retailers]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return retailers.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!q ||
          r.businessName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.contactName ?? "").toLowerCase().includes(q))
    );
  }, [retailers, filter, query]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Waiting" },
    { id: "approved", label: "Approved" },
    { id: "suspended", label: "Suspended" },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={filter === t.id ? "default" : "outline"}
              onClick={() => setFilter(t.id)}
            >
              {t.label} ({counts[t.id]})
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="sm:w-64"
          />
          <Button className="whitespace-nowrap" onClick={() => setAdding(true)}>
            Add retailer
          </Button>
        </div>
      </div>

      <Card elevated>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-muted-foreground">
              {retailers.length === 0
                ? "No retailers yet. They appear here when they sign up in the portal, or add one yourself."
                : "No retailers match."}
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.businessName}</span>
                      <StatusPill status={r.status} />
                      {!r.hasLogin ? (
                        <span className="text-xs text-muted-foreground">
                          Not signed up yet
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {[r.contactName, r.email, r.phone].filter(Boolean).join(" · ")}
                    </div>
                    {r.address ? (
                      <div className="text-sm text-muted-foreground">{r.address}</div>
                    ) : null}
                  </div>
                  <RowActions retailer={r} onEdit={() => setEditing(r)} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New retailer</DialogTitle>
            <DialogDescription>
              Added retailers are approved straight away. They create their
              login by signing up in the portal with this email.
            </DialogDescription>
          </DialogHeader>
          <RetailerForm retailer={null} onDone={() => setAdding(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit retailer</DialogTitle>
            <DialogDescription>
              Changing the email here does not change their login email.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <RetailerForm
              key={editing.id}
              retailer={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
