"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, MonthPicker, NativeSelect } from "@/components/fields";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { PLANT_CATEGORIES, type CareRule, type Plant, type PlantCategory, type RuleScope } from "@/lib/types";
import { scheduleSyncSoon } from "@/lib/sync";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Låser regelen til en plante. */
  plant?: Plant;
  /** Eksisterende regel som skal redigeres. */
  rule?: CareRule;
  plants?: Plant[];
};

export function RuleForm({ open, onOpenChange, plant, rule, plants = [] }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
        {open && <RuleFormBody onOpenChange={onOpenChange} plant={plant} rule={rule} plants={plants} />}
      </SheetContent>
    </Sheet>
  );
}

function RuleFormBody({ onOpenChange, plant, rule, plants = [] }: Omit<Props, "open">) {
  const [title, setTitle] = useState(rule?.title ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [months, setMonths] = useState<number[]>(rule?.months ?? [new Date().getMonth() + 1]);
  const [scope, setScope] = useState<RuleScope>(rule?.scope ?? (plant ? "plant" : "garden"));
  const [category, setCategory] = useState<PlantCategory>(rule?.category ?? "staude");
  const [plantId, setPlantId] = useState<string>(rule?.plantId ?? plant?.id ?? plants[0]?.id ?? "");

  const valid = title.trim().length > 0 && months.length > 0 && (scope !== "plant" || plantId);

  async function save() {
    if (!valid) return;
    const base: CareRule = {
      id: rule?.id ?? newId(),
      key: rule?.key,
      title: title.trim(),
      description: description.trim() || undefined,
      months,
      scope,
      plantId: scope === "plant" ? plantId : undefined,
      category: scope === "category" ? category : undefined,
      source: rule?.source ?? "egen",
      enabled: rule?.enabled ?? true,
      createdAt: rule?.createdAt ?? Date.now(),
    };
    await db.rules.put(base);
    scheduleSyncSoon();
    onOpenChange(false);
  }

  return (
    <>
        <SheetHeader className="px-0">
          <SheetTitle className="text-lg">{rule ? "Rediger oppgave" : "Ny oppgave"}</SheetTitle>
          <SheetDescription>Oppgaven gjentas hvert år i månedene du velger, og du får varsel ved månedsstart.</SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Hva skal gjøres?" htmlFor="rule-title">
            <Input id="rule-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="F.eks. Klipp hekken" className="h-11 rounded-lg" required />
          </Field>

          <Field label="Måneder">
            <MonthPicker value={months} onChange={setMonths} />
          </Field>

          {!plant && (
            <Field label="Gjelder for" htmlFor="rule-scope">
              <NativeSelect id="rule-scope" value={scope} onChange={(e) => setScope(e.target.value as RuleScope)}>
                <option value="garden">Hele hagen</option>
                <option value="category">Alle planter i en kategori</option>
                <option value="plant" disabled={plants.length === 0}>
                  En bestemt plante
                </option>
              </NativeSelect>
            </Field>
          )}

          {scope === "category" && (
            <Field label="Kategori" htmlFor="rule-category">
              <NativeSelect id="rule-category" value={category} onChange={(e) => setCategory(e.target.value as PlantCategory)}>
                {PLANT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          {scope === "plant" && !plant && (
            <Field label="Plante" htmlFor="rule-plant">
              <NativeSelect id="rule-plant" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          <Field label="Beskrivelse" htmlFor="rule-desc">
            <Textarea id="rule-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Hvordan, og hva du bør huske på" className="resize-none rounded-lg text-base" />
          </Field>

          <Button type="submit" size="lg" className="h-12 rounded-xl text-base" disabled={!valid}>
            {rule ? "Lagre endringer" : "Legg til oppgave"}
          </Button>
        </form>
    </>
  );
}
