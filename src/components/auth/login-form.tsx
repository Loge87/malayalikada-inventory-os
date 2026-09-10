"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/(auth)/actions";
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OAuthButton } from "@/components/auth/oauth-button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Enter your email and password to access your account.
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
                autoComplete="current-password"
                required
              />
            </Field>

            {state?.error ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>

            <FieldSeparator>or</FieldSeparator>
            <OAuthButton />

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-foreground underline">
                Sign up
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
