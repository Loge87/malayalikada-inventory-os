"use client";

import { useActionState, useEffect, useRef } from "react";

import { createProduct } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ProductForm() {
  const [state, formAction, pending] = useActionState(createProduct, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <CardDescription>
          Create a product, then add variants to it below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="product-name">Name</FieldLabel>
              <Input
                id="product-name"
                name="name"
                placeholder="Basmati Rice"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-category">Category</FieldLabel>
              <Input
                id="product-category"
                name="category"
                placeholder="Grains"
                required
              />
            </Field>

            {state && "error" in state ? (
              <FieldError>{state.error}</FieldError>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Adding…" : "Add product"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
