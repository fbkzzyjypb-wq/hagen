"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlantsScreen } from "@/components/screens/plants";

/** Én plassering som egen side. Hele plantelisten ligger på forsiden, til venstre for kameraet. */
function PlantsFromQuery() {
  const router = useRouter();
  const params = useSearchParams();
  const bedId = params.get("bed") ?? undefined;
  useEffect(() => {
    if (!bedId) router.replace("/?vis=planter");
  }, [bedId, router]);
  if (!bedId) return null;
  return <PlantsScreen key={bedId} bedId={bedId} />;
}

export default function PlantsPage() {
  return (
    <Suspense fallback={null}>
      <PlantsFromQuery />
    </Suspense>
  );
}
