"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(updatePassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          {email ? `Choose a new password for ${email}.` : "Choose a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>

            {state?.error ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
