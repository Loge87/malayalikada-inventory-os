"use client";

import { useRouter } from "next/navigation";
import { Camera, ChevronDown, PencilLine, Upload } from "lucide-react";

import { useCameraScan } from "@/components/barcode/use-camera-scan";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The single "Add product" entry point: a split button whose three options
 * (scan / manual / bulk upload) replace the old intermediate choice page.
 * "Scan barcode" starts the camera directly from this click (useCameraScan
 * requires that — see its docstring), showing a full-screen scanner overlay
 * right here on /products rather than navigating to an explanatory page
 * first; a successful scan lands on the same create form, pre-filled.
 */
export function AddProductMenu() {
  const router = useRouter();
  const { phase, isOpen, videoRef, start, close } = useCameraScan((barcode) => {
    router.push(`/products/new?barcode=${encodeURIComponent(barcode)}`);
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm">
              Add product
              <ChevronDown className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={start}>
            <Camera className="size-4" />
            Scan barcode
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/products/new")}>
            <PencilLine className="size-4" />
            Enter manually
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push("/products/bulk-upload")}
          >
            <Upload className="size-4" />
            Bulk upload
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="font-heading text-sm font-semibold">
              Scan barcode
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <video
              ref={videoRef}
              className="aspect-video w-full rounded-md bg-black object-cover"
              playsInline
              muted
              autoPlay
            />
            {phase.kind === "error" ? (
              <p className="text-sm text-destructive">{phase.message}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {phase.kind === "requesting"
                  ? "Requesting camera…"
                  : "Point the camera at a barcode."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
