"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Bell, BellOff, Download, Upload, Loader2, Share, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { Page, Section } from "@/components/page";
import { Field, NativeSelect } from "@/components/fields";
import { db } from "@/lib/db";
import { saveSettings } from "@/lib/settings";
import { useClientValue } from "@/lib/hooks";
import { CLIMATE_ZONES, DEFAULT_SETTINGS, type Settings } from "@/lib/types";
import { disablePush, enablePush, isStandalone, pushSupported, sendTestNotification, syncSchedule } from "@/lib/push";
import { exportAll, importAll, shareOrDownload } from "@/lib/export";
import { formatDate } from "@/lib/dates";

export function SettingsScreen() {
  const settings = useLiveQuery(async () => (await db.settings.get("settings")) ?? DEFAULT_SETTINGS, []);
  if (!settings) return null;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const counts = useLiveQuery(async () => ({
    plants: await db.plants.count(),
    photos: await db.photos.count(),
    rules: await db.rules.count(),
  }), []);

  const [gardenName, setGardenName] = useState(settings.gardenName);
  const [location, setLocation] = useState(settings.location ?? "");
  const [mapWidth, setMapWidth] = useState(String(settings.mapWidth));
  const [mapHeight, setMapHeight] = useState(String(settings.mapHeight));
  const [pushUrl, setPushUrl] = useState(settings.pushServerUrl ?? "");
  const [pushKey, setPushKey] = useState(settings.pushServerKey ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const standalone = useClientValue(isStandalone, true);
  const supported = useClientValue(pushSupported, true);

  function flash(kind: "ok" | "error", text: string) {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function run(name: string, fn: () => Promise<void>, okText?: string) {
    setBusy(name);
    try {
      await fn();
      if (okText) flash("ok", okText);
    } catch (e) {
      flash("error", (e as Error).message || "Noe gikk galt");
    } finally {
      setBusy(null);
    }
  }

  async function togglePush(on: boolean) {
    const current = { ...settings, pushServerUrl: pushUrl.trim() || undefined, pushServerKey: pushKey.trim() || undefined };
    await saveSettings({ pushServerUrl: current.pushServerUrl, pushServerKey: current.pushServerKey });
    if (on) await run("push", () => enablePush(current), "Varsler er slått på.");
    else await run("push", () => disablePush(current), "Varsler er slått av.");
  }

  const pushOn = !!settings.pushSubscription;

  return (
    <>
      <PageHeader
        title="Innstillinger"
        leading={
          <Button variant="ghost" size="icon-lg" className="-ml-2 rounded-full" nativeButton={false} render={<Link href="/" aria-label="Tilbake" />}>
            <ArrowLeft className="size-5" />
          </Button>
        }
      />
      <Page>
        {message && (
          <div
            className={`mb-3 rounded-xl px-4 py-2.5 text-sm ${message.kind === "ok" ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive"}`}
            role="status"
          >
            {message.text}
          </div>
        )}

        <Section title="Hagen" className="mt-2">
          <Card className="gap-4 px-4">
            <Field label="Navn på hagen" htmlFor="garden-name">
              <Input
                id="garden-name"
                value={gardenName}
                onChange={(e) => setGardenName(e.target.value)}
                onBlur={() => gardenName.trim() && saveSettings({ gardenName: gardenName.trim() })}
                className="h-11 rounded-lg"
              />
            </Field>
            <Field label="Sted" htmlFor="garden-location" hint="Brukes når du spør Claude, så svarene passer klimaet ditt.">
              <Input
                id="garden-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => saveSettings({ location: location.trim() || undefined })}
                placeholder="F.eks. Stavanger"
                className="h-11 rounded-lg"
              />
            </Field>
            <Field label="Klimasone" htmlFor="garden-zone" hint="H1 er mildest (kysten i sør), H8 er kaldest.">
              <NativeSelect id="garden-zone" value={settings.climateZone ?? "H3"} onChange={(e) => saveSettings({ climateZone: e.target.value })}>
                {CLIMATE_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kart, bredde (m)" htmlFor="map-w">
                <Input
                  id="map-w"
                  inputMode="numeric"
                  value={mapWidth}
                  onChange={(e) => setMapWidth(e.target.value.replace(/\D/g, ""))}
                  onBlur={() => Number(mapWidth) > 0 && saveSettings({ mapWidth: Number(mapWidth) })}
                  className="h-11 rounded-lg"
                />
              </Field>
              <Field label="Kart, dybde (m)" htmlFor="map-h">
                <Input
                  id="map-h"
                  inputMode="numeric"
                  value={mapHeight}
                  onChange={(e) => setMapHeight(e.target.value.replace(/\D/g, ""))}
                  onBlur={() => Number(mapHeight) > 0 && saveSettings({ mapHeight: Number(mapHeight) })}
                  className="h-11 rounded-lg"
                />
              </Field>
            </div>
          </Card>
        </Section>

        <Section title="Varsler">
          <Card className="gap-4 px-4">
            {!supported && (
              <Notice icon={<Info className="size-4" />}>
                Denne nettleseren støtter ikke push-varsler. På iPhone må appen legges til på Hjem-skjermen først.
              </Notice>
            )}
            {supported && !standalone && (
              <Notice icon={<Share className="size-4" />}>
                Legg appen til på Hjem-skjermen (Del-knappen → «Legg til på Hjem-skjerm») og åpne den derfra for å kunne slå på varsler.
              </Notice>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex size-10 items-center justify-center rounded-full ${pushOn ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                  {pushOn ? <Bell className="size-5" /> : <BellOff className="size-5" />}
                </span>
                <div>
                  <p className="text-sm font-medium">Månedlige påminnelser</p>
                  <p className="text-xs text-muted-foreground">
                    {pushOn ? `På · sist oppdatert ${settings.pushLastSync ? formatDate(settings.pushLastSync, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "aldri"}` : "Av"}
                  </p>
                </div>
              </div>
              {busy === "push" ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <Switch checked={pushOn} onCheckedChange={(v) => togglePush(v)} disabled={!supported || (!pushOn && !pushUrl.trim())} />
              )}
            </div>

            <Field label="Varselserver" htmlFor="push-url" hint="Adressen til Cloudflare Worker-en du satte opp (se README i prosjektet).">
              <Input
                id="push-url"
                value={pushUrl}
                onChange={(e) => setPushUrl(e.target.value)}
                onBlur={() => saveSettings({ pushServerUrl: pushUrl.trim() || undefined })}
                placeholder="https://hagen-varsler.dittnavn.workers.dev"
                inputMode="url"
                autoCapitalize="none"
                className="h-11 rounded-lg"
              />
            </Field>
            <Field label="Nøkkel (valgfritt)" htmlFor="push-key" hint="Samme verdi som APP_SECRET på serveren.">
              <Input
                id="push-key"
                value={pushKey}
                onChange={(e) => setPushKey(e.target.value)}
                onBlur={() => saveSettings({ pushServerKey: pushKey.trim() || undefined })}
                type="password"
                autoCapitalize="none"
                className="h-11 rounded-lg"
              />
            </Field>
            <Field label="Tidspunkt" htmlFor="push-hour">
              <NativeSelect
                id="push-hour"
                value={settings.notifyHour}
                onChange={async (e) => {
                  await saveSettings({ notifyHour: Number(e.target.value) });
                  const s = await db.settings.get("settings");
                  if (s?.pushSubscription) syncSchedule(s).catch(() => undefined);
                }}
              >
                {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                  <option key={h} value={h}>
                    kl. {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {pushOn && (
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" disabled={busy !== null} onClick={() => run("sync", () => syncSchedule(settings), "Varselplanen er oppdatert.")}>
                  Oppdater plan
                </Button>
                <Button variant="outline" className="h-11 flex-1 rounded-xl" disabled={busy !== null} onClick={() => run("test", () => sendTestNotification(settings), "Testvarsel sendt.")}>
                  Send testvarsel
                </Button>
              </div>
            )}
          </Card>
        </Section>

        <Section title="Data">
          <Card className="gap-3 px-4">
            <p className="text-sm text-muted-foreground">
              Alt lagres lokalt på denne telefonen{counts ? `: ${counts.plants} planter, ${counts.photos} bilder og ${counts.rules} oppgaveregler` : ""}. Ta en sikkerhetskopi av og til, og lagre den i Filer eller iCloud.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={busy !== null}
                onClick={() =>
                  run("export", async () => {
                    const blob = await exportAll();
                    await shareOrDownload(blob, `hagen-backup-${new Date().toISOString().slice(0, 10)}.json`);
                  })
                }
              >
                {busy === "export" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                Eksporter
              </Button>
              <Button variant="outline" className="h-11 flex-1 rounded-xl" disabled={busy !== null} onClick={() => importRef.current?.click()}>
                {busy === "import" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                Importer
              </Button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!confirm("Importen erstatter alt som ligger i appen nå. Fortsette?")) return;
                  run(
                    "import",
                    async () => {
                      const r = await importAll(f);
                      flash("ok", `Importerte ${r.plants} planter og ${r.photos} bilder.`);
                    }
                  );
                  e.target.value = "";
                }}
              />
            </div>
          </Card>
        </Section>

        <Section title="Om appen">
          <Card className="gap-2 px-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="size-4 text-primary" /> Hagen, versjon 0.1
            </p>
            <p>Stell-kalenderen er laget for norsk klima og er et utgangspunkt. Juster oppgaver og måneder så de passer hagen din.</p>
            <p>Bilder og data forlater aldri telefonen, bortsett fra varselplanen (oppgavetitler og datoer) som sendes til din egen varselserver.</p>
          </Card>
        </Section>
      </Page>
    </>
  );
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
