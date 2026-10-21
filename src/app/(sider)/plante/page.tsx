"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlantDetailScreen } from "@/components/screens/plant-detail";

function PlantDetailFromQuery() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <p className="p-8 text-center text-sm text-muted-foreground">Mangler plante-id.</p>;
  return <PlantDetailScreen id={id} />;
}

export default function PlantPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Laster ...</div>}>
      <PlantDetailFromQuery />
    </Suspense>
  );
}
