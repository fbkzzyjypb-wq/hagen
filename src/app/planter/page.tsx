"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlantsScreen } from "@/components/screens/plants";

function PlantsFromQuery() {
  const params = useSearchParams();
  const bedId = params.get("bed") ?? undefined;
  return <PlantsScreen key={bedId ?? ""} bedId={bedId} />;
}

export default function PlantsPage() {
  return (
    <Suspense fallback={null}>
      <PlantsFromQuery />
    </Suspense>
  );
}
