"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signup } from "@/app/(auth)/actions";
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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OAuthButton } from "@/components/auth/oauth-button";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Sign up with your email address to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>

            {state?.error ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>

            <FieldSeparator>or</FieldSeparator>
            <OAuthButton />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                Sign in
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
