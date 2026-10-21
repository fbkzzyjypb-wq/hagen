"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IdentificationScreen } from "@/components/screens/identification";

function IdentificationFromQuery() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <p className="p-8 text-center text-sm text-muted-foreground">Mangler identifiserings-id.</p>;
  return <IdentificationScreen id={id} />;
}

export default function IdentificationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Laster ...</div>}>
      <IdentificationFromQuery />
    </Suspense>
  );
}
