import { db } from "./db";
import { saveSettings } from "./settings";
import { buildNotificationSchedule } from "./tasks";
import { asset, BASE_PATH } from "./base-path";
import type { Settings } from "./types";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS krever at appen er lagt til på Hjem-skjermen for at varsler skal virke. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function headers(settings: Settings): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (settings.pushServerKey) h["x-hagen-key"] = settings.pushServerKey;
  return h;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(`${BASE_PATH}/`);
  if (existing) return existing;
  return navigator.serviceWorker.register(asset("/sw.js"), { scope: `${BASE_PATH}/` });
}

/** Slår på varsler: ber om tillatelse, abonnerer og sender første plan til varselserveren. */
export async function enablePush(settings: Settings): Promise<void> {
  if (!pushSupported()) throw new Error("Nettleseren støtter ikke push-varsler.");
  if (!settings.pushServerUrl) throw new Error("Legg inn adressen til varselserveren først.");
  const base = settings.pushServerUrl.replace(/\/$/, "");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Du må tillate varsler i innstillingene på telefonen.");

  const keyRes = await fetch(`${base}/vapid-public-key`, { headers: headers(settings) });
  if (!keyRes.ok) throw new Error("Fikk ikke kontakt med varselserveren.");
  const { publicKey } = (await keyRes.json()) as { publicKey: string };

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  }

  await saveSettings({ pushSubscription: sub.toJSON() });
  await syncSchedule({ ...settings, pushSubscription: sub.toJSON() });
}

export async function disablePush(settings: Settings): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(`${BASE_PATH}/`);
    const sub = await reg?.pushManager.getSubscription();
    if (sub && settings.pushServerUrl) {
      await fetch(`${settings.pushServerUrl.replace(/\/$/, "")}/schedule`, {
        method: "DELETE",
        headers: headers(settings),
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } finally {
    await saveSettings({ pushSubscription: undefined, pushLastSync: undefined });
  }
}

/** Sender oppdatert varselplan til serveren. Kalles ved oppstart og når oppgaver endres. */
export async function syncSchedule(settings: Settings): Promise<void> {
  if (!settings.pushServerUrl || !settings.pushSubscription) return;
  const [rules, plants, completions] = await Promise.all([db.rules.toArray(), db.plants.toArray(), db.completions.toArray()]);
  const items = buildNotificationSchedule(rules, plants, completions, settings);

  const res = await fetch(`${settings.pushServerUrl.replace(/\/$/, "")}/schedule`, {
    method: "POST",
    headers: headers(settings),
    body: JSON.stringify({
      subscription: settings.pushSubscription,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Oslo",
      hour: settings.notifyHour,
      items,
    }),
  });
  if (!res.ok) throw new Error(`Varselserveren svarte ${res.status}`);
  await saveSettings({ pushLastSync: Date.now() });
}

export async function sendTestNotification(settings: Settings): Promise<void> {
  if (!settings.pushServerUrl || !settings.pushSubscription) throw new Error("Varsler er ikke slått på.");
  const res = await fetch(`${settings.pushServerUrl.replace(/\/$/, "")}/test`, {
    method: "POST",
    headers: headers(settings),
    body: JSON.stringify({ subscription: settings.pushSubscription }),
  });
  if (!res.ok) throw new Error(`Varselserveren svarte ${res.status}`);
}
