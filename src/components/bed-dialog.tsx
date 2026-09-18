"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/fields";
import { db } from "@/lib/db";
import { BED_KINDS, createBed, deleteBed } from "@/lib/beds";
import { areaInfo, type Area, type AreaKind } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Bedet som redigeres. Tomt for nytt bed. */
  bed?: Area | null;
  onSaved?: (bed: Area) => void;
  onDeleted?: (bed: Area) => void;
};

export function BedDialog({ open, onOpenChange, bed, onSaved, onDeleted }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <BedDialogBody bed={bed} onOpenChange={onOpenChange} onSaved={onSaved} onDeleted={onDeleted} />}</DialogContent>
    </Dialog>
  );
}

function BedDialogBody({ bed, onOpenChange, onSaved, onDeleted }: Omit<Props, "open">) {
  const [name, setName] = useState(bed?.name ?? "");
  const [kind, setKind] = useState<AreaKind>(bed?.kind ?? "bed");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (bed) {
      await db.areas.update(bed.id, { name: trimmed, kind });
      onSaved?.({ ...bed, name: trimmed, kind });
    } else {
      // Ikke inni onSaved?.(...): argumentene evalueres ikke når onSaved mangler, og da blir bedet aldri opprettet.
      const created = await createBed(trimmed, kind);
      onSaved?.(created);
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!bed) return;
    await deleteBed(bed.id);
    onDeleted?.(bed);
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{bed ? "Endre bed" : "Nytt bed"}</DialogTitle>
        <DialogDescription>
          {bed ? "Plantene beholdes. Bare navnet og typen endres." : "Et bed er en gruppe planter, for eksempel «Eplehekken» eller «Bedet ved terrassen»."}
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Navn" htmlFor="bed-name">
          <Input id="bed-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Eplehekken" className="h-11 rounded-lg" autoFocus />
        </Field>
        <Field label="Type" htmlFor="bed-kind">
          <NativeSelect id="bed-kind" value={kind} onChange={(e) => setKind(e.target.value as AreaKind)}>
            {BED_KINDS.map((k) => (
              <option key={k} value={k}>
                {areaInfo(k).label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </form>
      <DialogFooter>
        {bed &&
          (confirmDelete ? (
            <Button variant="destructive" onClick={remove}>
              Slett bedet
            </Button>
          ) : (
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              Slett
            </Button>
          ))}
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Avbryt
        </Button>
        <Button onClick={save} disabled={!name.trim()}>
          {bed ? "Lagre" : "Opprett"}
        </Button>
      </DialogFooter>
    </>
  );
}
