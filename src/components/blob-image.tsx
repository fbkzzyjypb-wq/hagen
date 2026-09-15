"use client";

import { useEffect, useMemo } from "react";

export function BlobImage({ blob, alt, className }: { blob: Blob | undefined; alt: string; className?: string }) {
  const url = useMemo(() => (blob && typeof window !== "undefined" ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  if (!url) return <div className={className} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} draggable={false} />;
}
