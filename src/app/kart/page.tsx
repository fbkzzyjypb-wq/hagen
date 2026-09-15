"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MapScreen } from "@/components/screens/map";

function MapFromQuery() {
  const params = useSearchParams();
  return <MapScreen placePlantId={params.get("plasser") ?? undefined} focusPlantId={params.get("plante") ?? undefined} />;
}

export default function MapPage() {
  return (
    <Suspense fallback={null}>
      <MapFromQuery />
    </Suspense>
  );
}
