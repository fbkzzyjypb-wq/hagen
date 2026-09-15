"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, NativeSelect } from "@/components/fields";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { PLANT_CATEGORIES, type Plant, type PlantCategory } from "@/lib/types";
import { findProfile, rulesFromProfile, searchProfiles, type PlantProfile } from "@/lib/care-rules";
import { scheduleSyncSoon } from "@/lib/sync";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plant?: Plant;
  onSaved?: (plant: Plant) => void;
};

export function PlantForm({ open, onOpenChange, plant, onSaved }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
        {open && <PlantFormBody plant={plant} onSaved={onSaved} onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  );
}

function PlantFormBody({ plant, onSaved, onOpenChange }: Omit<Props, "open">) {
  const [name, setName] = useState(plant?.name ?? "");
  const [latinName, setLatinName] = useState(plant?.latinName ?? "");
  const [variety, setVariety] = useState(plant?.variety ?? "");
  const [category, setCategory] = useState<PlantCategory>(plant?.category ?? "staude");
  const [plantedYear, setPlantedYear] = useState(plant?.plantedYear ? String(plant.plantedYear) : "");
  const [notes, setNotes] = useState(plant?.notes ?? "");
  const [profileKey, setProfileKey] = useState<string | undefined>(plant?.profileKey);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => (showSuggestions && !plant ? searchProfiles(name) : []), [name, showSuggestions, plant]);

  function applyProfile(p: PlantProfile) {
    setName(p.name);
    setLatinName(p.latinName);
    setCategory(p.category);
    setProfileKey(p.key);
    setShowSuggestions(false);
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const now = Date.now();
    try {
      if (plant) {
        const updated: Plant = {
          ...plant,
          name: name.trim(),
          latinName: latinName.trim() || undefined,
          variety: variety.trim() || undefined,
          category,
          plantedYear: plantedYear ? Number(plantedYear) : undefined,
          notes: notes.trim() || undefined,
          updatedAt: now,
        };
        await db.plants.put(updated);
        onSaved?.(updated);
      } else {
        const created: Plant = {
          id: newId(),
          name: name.trim(),
          latinName: latinName.trim() || undefined,
          variety: variety.trim() || undefined,
          category,
          plantedYear: plantedYear ? Number(plantedYear) : undefined,
          notes: notes.trim() || undefined,
          profileKey,
          createdAt: now,
          updatedAt: now,
        };
        const profile = findProfile(profileKey);
        await db.transaction("rw", [db.plants, db.rules], async () => {
          await db.plants.add(created);
          if (profile && profile.category === category) {
            await db.rules.bulkAdd(rulesFromProfile(profile, created.id, now, newId));
          }
        });
        onSaved?.(created);
      }
      scheduleSyncSoon();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <SheetHeader className="px-0">
          <SheetTitle className="text-lg">{plant ? "Rediger plante" : "Ny plante"}</SheetTitle>
          <SheetDescription>
            {plant ? "Oppdater informasjonen om planten." : "Begynn å skrive navnet, så foreslår vi kjente planter med ferdig stell-kalender."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Navn" htmlFor="plant-name">
            <div className="relative">
              <Input
                id="plant-name"
                value={name}
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                  if (profileKey) setProfileKey(undefined);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="F.eks. Bøkehekk"
                className="h-11 rounded-lg"
                required
              />
              {suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => applyProfile(s)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground italic">{s.latinName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori" htmlFor="plant-category">
              <NativeSelect id="plant-category" value={category} onChange={(e) => setCategory(e.target.value as PlantCategory)}>
                {PLANT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Plantet år" htmlFor="plant-year">
              <Input
                id="plant-year"
                inputMode="numeric"
                value={plantedYear}
                onChange={(e) => setPlantedYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={String(new Date().getFullYear())}
                className="h-11 rounded-lg"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latinsk navn" htmlFor="plant-latin">
              <Input id="plant-latin" value={latinName} onChange={(e) => setLatinName(e.target.value)} placeholder="Valgfritt" className="h-11 rounded-lg" />
            </Field>
            <Field label="Sort" htmlFor="plant-variety">
              <Input id="plant-variety" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="F.eks. 'Aroma'" className="h-11 rounded-lg" />
            </Field>
          </div>

          <Field label="Notater" htmlFor="plant-notes">
            <Textarea id="plant-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Hvor kjøpt, spesielle hensyn ..." className="resize-none rounded-lg text-base" />
          </Field>

          {profileKey && !plant && (
            <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
              Stell-kalender for {findProfile(profileKey)?.name} legges inn automatisk.
            </p>
          )}

          <Button type="submit" size="lg" className="h-12 rounded-xl text-base" disabled={!name.trim() || saving}>
            {plant ? "Lagre endringer" : "Legg til plante"}
          </Button>
        </form>
    </>
  );
}
