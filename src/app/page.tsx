"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/shell";

function ShellFromQuery() {
  const params = useSearchParams();
  return <Shell vis={params.get("vis")} focusPlantId={params.get("plante") ?? undefined} initialQuestion={params.get("q") ?? undefined} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <ShellFromQuery />
    </Suspense>
  );
}
