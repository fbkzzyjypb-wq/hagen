"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { compressImage } from "@/lib/images";

export function PhotoCapture({ plantId, label = "Ta bilde", variant = "default" }: { plantId: string; label?: string; variant?: "default" | "outline" | "secondary" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const [blob, thumb] = await Promise.all([compressImage(file, 1600, 0.82), compressImage(file, 320, 0.75)]);
        await db.photos.add({ id: newId(), plantId, blob, thumb, takenAt: file.lastModified || Date.now() });
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Button variant={variant} size="lg" className="h-11 rounded-xl" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
        {busy ? "Lagrer ..." : label}
      </Button>
    </>
  );
}
