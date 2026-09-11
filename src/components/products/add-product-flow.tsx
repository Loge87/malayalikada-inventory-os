"use client";

import { useState } from "react";

import { BarcodeInput } from "@/components/barcode/barcode-input";
import { CameraScanButton } from "@/components/barcode/camera-scan-button";
import { NewProductForm } from "@/components/products/new-product-form";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = "choice" | "scan" | "form";

/**
 * The single "add a product" entry point, reachable two ways:
 *   - /scan's "no product found" screen -> here with ?barcode= already set,
 *     which skips straight to the form (unchanged from before).
 *   - /products' "Add product" button -> here with no barcode, which shows
 *     the choice below first.
 * Both paths land on the same NewProductForm.
 */
export function AddProductFlow({
  initialBarcode,
  locations,
}: {
  initialBarcode: string;
  locations: LocationOption[];
}) {
  const [step, setStep] = useState<Step>(initialBarcode ? "form" : "choice");
  const [barcode, setBarcode] = useState(initialBarcode);

  if (step === "choice") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add a product</CardTitle>
          <CardDescription>
            Scan the barcode if you have the item on hand, or enter its
            details manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button type="button" onClick={() => setStep("scan")}>
            Scan barcode
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep("form")}
          >
            Enter manually
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "scan") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan a barcode</CardTitle>
          <CardDescription>
            Scan with a hardware reader, use the camera, or type the barcode
            and press Enter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BarcodeInput
            onScan={(code) => {
              setBarcode(code);
              setStep("form");
            }}
          />
          <CameraScanButton
            onScan={(code) => {
              setBarcode(code);
              setStep("form");
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setStep("choice")}
          >
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <NewProductForm
      barcode={barcode}
      locations={locations}
      returnTo="/products"
      onBack={initialBarcode ? undefined : () => setStep("choice")}
    />
  );
}
