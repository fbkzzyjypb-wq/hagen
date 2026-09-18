"use client";

import { useEffect, useRef } from "react";

/**
 * Viser en Blob som bilde. Objekt-URL-en lages og frigjøres i effekten (ikke i render), ellers blir den
 * frigjort av StrictMode sin dobbeltkjøring i utvikling og bildet vises ikke.
 */
export function BlobImage({ blob, alt, className }: { blob: Blob | undefined; alt: string; className?: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !blob) return;
    const url = URL.createObjectURL(blob);
    img.src = url;
    return () => {
      img.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  if (!blob) return <div className={className} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imgRef} alt={alt} className={className} draggable={false} />;
}
