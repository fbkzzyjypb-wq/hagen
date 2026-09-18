"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download, Upload, Loader2, CheckCircle2, Sparkles, Camera, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { Page, Section } from "@/components/page";
import { Field, NativeSelect } from "@/components/fields";
import { db } from "@/lib/db";
import { saveSettings } from "@/lib/settings";
import { CLIMATE_ZONES, DEFAULT_SETTINGS, type Settings } from "@/lib/types";
import { exportAll, importAll, shareOrDownload } from "@/lib/export";
import { listModels, LLM_PRESETS } from "@/lib/llm-client";
import { PLANTNET_SITE_URL } from "@/lib/plant-id";

export function SettingsScreen() {
  const settings = useLiveQuery(async () => (await db.settings.get("settings")) ?? DEFAULT_SETTINGS, []);
  if (!settings) return null;
  return <SettingsForm settings={settings} />;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignorer
    }
  }

  return (
    <Button type="button" variant="outline" size="icon-lg" className="size-11 shrink-0 rounded-lg" aria-label="Kopier nøkkel" disabled={!value} onClick={copy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
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
  const [llmPreset, setLlmPreset] = useState(() => LLM_PRESETS.find((p) => p.baseUrl === settings.llmBaseUrl)?.id ?? (settings.llmBaseUrl ? "custom" : "gemini"));
  const [llmBaseUrl, setLlmBaseUrl] = useState(settings.llmBaseUrl ?? LLM_PRESETS[0].baseUrl);
  const [llmApiKey, setLlmApiKey] = useState(settings.llmApiKey ?? "");
  const [llmModel, setLlmModel] = useState(settings.llmModel ?? "");
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [plantNetKey, setPlantNetKey] = useState(settings.plantNetApiKey ?? "");

  function pickDefaultModel(ids: string[]): string {
    const prefer = ["gemini-.*flash(?!-lite)", "gemini-.*flash", "llama-3\\.3-70b", "llama.*70b", ":free$"];
    for (const re of prefer) {
      const hit = ids.find((id) => new RegExp(re, "i").test(id));
      if (hit) return hit;
    }
    return ids[0] ?? "";
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

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
            <Field label="Sted" htmlFor="garden-location" hint="Brukes når du spør KI-assistenten, så svarene passer klimaet ditt.">
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Vis hagekartet</p>
                <p className="text-xs text-muted-foreground">Kartfanen der du tegner områder og plasserer planter. Skjult som standard. Bed fungerer uten kartet.</p>
              </div>
              <Switch checked={!!settings.showMap} onCheckedChange={(v) => saveSettings({ showMap: v })} />
            </div>
            {settings.showMap && (
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
            )}
          </Card>
        </Section>

        <Section title="KI-assistent">
          <Card className="gap-4 px-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Med en gratis KI-leverandør får du svar rett i appen, med plantene dine som kontekst. Uten oppsett åpnes spørsmålet i Claude-appen din i stedet.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Gratis leverandør</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  settings.llmApiKey && settings.llmBaseUrl && settings.llmModel ? "bg-primary text-primary-foreground" : settings.llmApiKey ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"
                }`}
              >
                {settings.llmApiKey && settings.llmBaseUrl && settings.llmModel ? `Klar · ${settings.llmModel}` : settings.llmApiKey ? "Mangler modell" : "Ikke satt opp"}
              </span>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              Flere leverandører gir gratis bruk mot at du lager en nøkkel hos dem. Ingen kort.
              {settings.llmApiKey && !settings.llmModel ? " Trykk «Hent modeller» for å fullføre." : ""}
            </p>

            <Field label="Leverandør" htmlFor="llm-preset">
              <NativeSelect
                id="llm-preset"
                value={llmPreset}
                onChange={(e) => {
                  const id = e.target.value;
                  setLlmPreset(id);
                  const preset = LLM_PRESETS.find((p) => p.id === id);
                  if (preset) {
                    setLlmBaseUrl(preset.baseUrl);
                    setLlmModels([]);
                    setLlmModel("");
                    saveSettings({ llmBaseUrl: preset.baseUrl, llmModel: undefined });
                  }
                }}
              >
                {LLM_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Annen (OpenAI-kompatibel)</option>
              </NativeSelect>
            </Field>
            {llmPreset === "custom" ? (
              <Field label="Adresse (base URL)" htmlFor="llm-url">
                <Input
                  id="llm-url"
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  onBlur={() => saveSettings({ llmBaseUrl: llmBaseUrl.trim() || undefined })}
                  placeholder="https://.../v1"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="h-11 rounded-lg"
                />
              </Field>
            ) : (
              <p className="text-xs text-muted-foreground">
                {LLM_PRESETS.find((p) => p.id === llmPreset)?.hint}{" "}
                <a href={LLM_PRESETS.find((p) => p.id === llmPreset)?.keyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
                  Lag nøkkel her
                </a>
              </p>
            )}
            <Field label="API-nøkkel" htmlFor="llm-key" hint="Lagres bare på denne enheten.">
              <div className="flex gap-2">
                <Input
                  id="llm-key"
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  onBlur={() => saveSettings({ llmApiKey: llmApiKey.trim() || undefined, llmBaseUrl: llmBaseUrl.trim() || undefined })}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 rounded-lg"
                />
                <CopyButton value={llmApiKey.trim()} />
              </div>
            </Field>
            <Field label="Modell" htmlFor="llm-model" hint={llmModels.length === 0 ? "Trykk «Hent modeller» for å se hva nøkkelen gir tilgang til." : undefined}>
              {llmModels.length > 0 ? (
                <NativeSelect
                  id="llm-model"
                  value={llmModel}
                  onChange={(e) => {
                    setLlmModel(e.target.value);
                    saveSettings({ llmModel: e.target.value || undefined });
                  }}
                >
                  <option value="">Velg modell ...</option>
                  {llmModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  id="llm-model"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  onBlur={() => saveSettings({ llmModel: llmModel.trim() || undefined, llmBaseUrl: llmBaseUrl.trim() || undefined })}
                  placeholder="f.eks. gemini-3.8-flash"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="h-11 rounded-lg"
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={busy !== null || !llmApiKey.trim() || !llmBaseUrl.trim()}
                onClick={() =>
                  run("llm", async () => {
                    const baseUrl = llmBaseUrl.trim();
                    const key = llmApiKey.trim();
                    await saveSettings({ llmBaseUrl: baseUrl, llmApiKey: key });
                    const ids = await listModels(baseUrl, key);
                    setLlmModels(ids);
                    const chosen = ids.includes(llmModel) ? llmModel : pickDefaultModel(ids);
                    setLlmModel(chosen);
                    await saveSettings({ llmModel: chosen || undefined });
                    flash("ok", `Nøkkelen virker. ${ids.length} modeller tilgjengelig${chosen ? `, valgt ${chosen}` : ""}.`);
                  })
                }
              >
                {busy === "llm" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                Hent modeller
              </Button>
              {settings.llmApiKey && (
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  disabled={busy !== null}
                  onClick={async () => {
                    setLlmApiKey("");
                    setLlmModel("");
                    setLlmModels([]);
                    await saveSettings({ llmApiKey: undefined, llmModel: undefined });
                    flash("ok", "Leverandøren er koblet fra.");
                  }}
                >
                  Fjern
                </Button>
              )}
            </div>
          </Card>
        </Section>

        <Section title="Planteidentifikasjon">
          <Card className="gap-4 px-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Camera className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Ta bilde av en plante i «Ny plante» og få artsforslag fra Pl@ntNet, som er trent på millioner av artsbestemte bilder. Norsk navn hentes fra Artsdatabanken.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Pl@ntNet</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${settings.plantNetApiKey ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {settings.plantNetApiKey ? "Klar" : "Ikke satt opp"}
              </span>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              Gratis for privat bruk, med et begrenset antall oppslag per dag. Lag konto på{" "}
              <a href={PLANTNET_SITE_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
                my.plantnet.org
              </a>
              , gå til «My API» og kopier nøkkelen. Slå på «expose my API key» der, og legg inn adressen appen kjører fra under Authorized domains, med protokoll, f.eks. https://fbkzzyjypb-wq.github.io.
            </p>
            <Field label="API-nøkkel" htmlFor="plantnet-key" hint="Lagres bare på denne enheten.">
              <div className="flex gap-2">
                <Input
                  id="plantnet-key"
                  type="password"
                  value={plantNetKey}
                  onChange={(e) => setPlantNetKey(e.target.value)}
                  onBlur={() => saveSettings({ plantNetApiKey: plantNetKey.trim() || undefined })}
                  placeholder="2b10..."
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 rounded-lg"
                />
                <CopyButton value={plantNetKey.trim()} />
              </div>
            </Field>
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
            <p>Bilder og data lagres på telefonen. Har du satt opp KI-leverandør eller Pl@ntNet, sendes planteopplysninger, spørsmål og bildene du identifiserer dit.</p>
          </Card>
        </Section>
      </Page>
    </>
  );
}
