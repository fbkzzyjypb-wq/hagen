"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Cloud, CloudOff, Copy, Download, ExternalLink, Loader2, LogOut, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/page";
import { db } from "@/lib/db";
import { formatDate, formatRelative } from "@/lib/dates";
import { GOOGLE_LOGIN_AVAILABLE, requestDeviceCode, waitForDeviceApproval, type DeviceCode } from "@/lib/google-auth";
import { finishLogin, logout, requestSync, resolveChoice, useCloudStatus } from "@/lib/cloud-sync";

/**
 * «Konto» i innstillingene: innlogging hos Google med kode, og tilstanden til synkroniseringen mot Google Disk. Koden
 * skrives inn på google.com/device, i nettleseren på telefonen eller på en annen enhet; appen venter imens.
 */
export function AccountSection() {
  const status = useCloudStatus();
  const account = useLiveQuery(() => db.cloud.get("google"), []);
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function login() {
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const fresh = await requestDeviceCode(ac.signal);
      setCode(fresh);
      const tokens = await waitForDeviceApproval(fresh, ac.signal);
      setCode(null);
      await finishLogin(tokens);
    } catch (err) {
      setCode(null);
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : "Innloggingen feilet.");
    }
  }

  function cancelLogin() {
    abortRef.current?.abort();
    setCode(null);
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignorer
    }
  }

  return (
    <Section title="Konto">
      <Card className="gap-3 px-4">
        {!GOOGLE_LOGIN_AVAILABLE ? (
          <p className="text-sm text-muted-foreground">Google-innlogging er ikke satt opp i dette bygget.</p>
        ) : code ? (
          <>
            <p className="text-sm">
              Gå til{" "}
              <a href={code.verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                google.com/device <ExternalLink className="size-3.5" />
              </a>{" "}
              (her, eller på en PC), logg inn med Google-kontoen din og skriv inn denne koden:
            </p>
            <div className="flex items-center gap-2">
              <p className="flex-1 rounded-xl bg-muted px-4 py-3 text-center font-mono text-2xl font-semibold tracking-widest">{code.userCode}</p>
              <Button type="button" variant="outline" size="icon-lg" className="size-11 shrink-0 rounded-lg" aria-label="Kopier koden" onClick={copyCode}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Venter på at du godkjenner …
            </p>
            <Button variant="outline" className="h-11 rounded-xl bg-card" onClick={cancelLogin}>
              Avbryt
            </Button>
          </>
        ) : account ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Cloud className="size-4 text-primary" /> Logget inn som {account.email ?? "Google-kontoen din"}
            </p>
            <StatusLine status={status} lastSyncAt={account.lastSyncAt} onLogin={login} />
            {status.phase === "choose" && status.choice && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm">
                  Det ligger alt en sikkerhetskopi i Google Disk
                  {status.choice.remoteSavedAt ? ` (sist oppdatert ${formatDate(status.choice.remoteSavedAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })})` : ""}, og denne telefonen har{" "}
                  {status.choice.localPlants === 1 ? "1 plante" : `${status.choice.localPlants} planter`} og {status.choice.localPhotos === 1 ? "1 bilde" : `${status.choice.localPhotos} bilder`}. Hva skal gjelde?
                </p>
                <Button className="h-11 rounded-xl" onClick={() => resolveChoice("pull")}>
                  <Download data-icon="inline-start" /> Hent fra Google Disk (erstatter det som er her)
                </Button>
                <Button variant="outline" className="h-11 rounded-xl bg-card" onClick={() => resolveChoice("push")}>
                  <Upload data-icon="inline-start" /> Last opp herfra (erstatter det i Disk)
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" disabled={status.phase === "syncing" || status.phase === "choose"} onClick={() => requestSync()}>
                <RefreshCw data-icon="inline-start" /> Synkroniser nå
              </Button>
              <Button variant="outline" className="h-11 rounded-xl bg-card" onClick={() => logout()}>
                <LogOut data-icon="inline-start" /> Logg ut
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Alt i appen speiles til mappen «Hagen» i Google Disk, også nøklene dine, og hentes ned igjen når du logger inn på en annen telefon. Appen ser bare filer den selv har laget.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <CloudOff className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Alt ligger bare på denne telefonen. Logg inn med Google, så lagres en kopi i din Google Disk som holdes oppdatert, og som en ny telefon kan hente ned.
              </p>
            </div>
            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button className="h-11 rounded-xl" onClick={login}>
              <Cloud data-icon="inline-start" /> Logg inn med Google
            </Button>
          </>
        )}
      </Card>
    </Section>
  );
}

function StatusLine({ status, lastSyncAt, onLogin }: { status: ReturnType<typeof useCloudStatus>; lastSyncAt?: number; onLogin: () => void }) {
  if (status.phase === "syncing") {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {status.progress ? `${status.progress.what}: ${status.progress.done + 1} av ${status.progress.total}` : (status.message ?? "Synkroniserer …")}
      </p>
    );
  }
  if (status.phase === "needs-login") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2">
        <p className="text-sm text-destructive">{status.message}</p>
        <Button variant="outline" size="sm" className="shrink-0 rounded-lg bg-card" onClick={onLogin}>
          Logg inn på nytt
        </Button>
      </div>
    );
  }
  if (status.phase === "error" || status.phase === "offline") {
    return <p className={`text-sm ${status.phase === "error" ? "text-destructive" : "text-muted-foreground"}`}>{status.message}</p>;
  }
  if (status.phase === "choose") return null;
  return <p className="text-sm text-muted-foreground">{lastSyncAt ? `Sist synkronisert ${formatRelative(lastSyncAt)}.` : "Ikke synkronisert ennå."}</p>;
}
