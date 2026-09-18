"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Upload } from "lucide-react";

import { useCameraCapture } from "@/lib/use-camera-capture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Product image picker shared by the create and edit forms — "Take photo"
 * opens a live camera view in a centered dialog (same mechanics as the
 * barcode scanner: a real <video> preview, not just an <input capture>
 * hint) and a "Capture" tap grabs one still frame; "Upload image" opens the
 * plain file picker. Both paths converge on the same hidden `name="image"`
 * file input, so the server action that reads it (createProductWithVariant
 * / updateProduct) needs no separate code path for a camera-captured photo
 * — capturing just fills in the same field a manual upload would, and it's
 * saved exactly when the surrounding form is submitted.
 */
export function ProductImageField({
  idPrefix,
  name = "image",
  initialPreviewUrl = null,
}: {
  idPrefix: string;
  name?: string;
  initialPreviewUrl?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const { phase, isOpen, videoRef, start, close, capture } = useCameraCapture();

  function adoptFile(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }
    setPreview(URL.createObjectURL(file));
  }

  async function handleCapture() {
    setCaptureError(null);
    const file = await capture();
    if (file) {
      adoptFile(file);
      close();
    } else {
      // The video hadn't actually produced a frame yet (rare, but possible
      // right as the stream starts) — let the user just try again rather
      // than silently doing nothing.
      setCaptureError("Camera isn't ready yet — try again in a moment.");
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setVideoReady(false);
      setCaptureError(null);
      close();
    }
  }

  const displayedPreview = preview ?? initialPreviewUrl;

  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-image`}>Product image</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
          {displayedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayedPreview} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={start}>
              <Camera className="size-4" />
              Take photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload image
            </Button>
          </div>
          {/* Hidden — both "Take photo" (via adoptFile) and a direct click
             (native picker) write into this same input, so the form only
             ever has one `image` field to submit. */}
          <Input
            ref={fileInputRef}
            id={`${idPrefix}-image`}
            name={name}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </div>
      </div>
      <FieldDescription>PNG, JPEG, or WEBP, up to 5MB.</FieldDescription>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take a photo</DialogTitle>
          </DialogHeader>
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-md bg-black object-cover"
            playsInline
            muted
            autoPlay
            onLoadedMetadata={() => setVideoReady(true)}
          />
          {phase.kind === "error" ? (
            <p className="text-sm text-destructive">{phase.message}</p>
          ) : captureError ? (
            <p className="text-sm text-destructive">{captureError}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {phase.kind === "requesting" || !videoReady
                ? "Starting camera…"
                : "Frame the product, then capture."}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            {phase.kind === "live" ? (
              <Button type="button" onClick={handleCapture} disabled={!videoReady}>
                Capture
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Field>
  );
}
