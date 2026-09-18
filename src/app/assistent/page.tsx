"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AssistantScreen } from "@/components/screens/assistant";

function AssistantFromQuery() {
  const params = useSearchParams();
  const plantId = params.get("plante") ?? undefined;
  const question = params.get("q") ?? undefined;
  // Ny nøkkel når man kommer fra en plante, så skjermen starter på nytt med riktig fokus.
  return <AssistantScreen key={`${plantId ?? ""}|${question ?? ""}`} focusPlantId={plantId} initialQuestion={question} />;
}

export default function AssistantPage() {
  return (
    <Suspense fallback={null}>
      <AssistantFromQuery />
    </Suspense>
  );
}
