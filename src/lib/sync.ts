import { db } from "./db";
import { syncSchedule } from "./push";

let timer: ReturnType<typeof setTimeout> | undefined;

/** Synker varselplanen litt etter siste endring, slik at flere endringer på rad bare gir én forespørsel. */
export function scheduleSyncSoon(delayMs = 4000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = undefined;
    const settings = await db.settings.get("settings");
    if (settings?.pushSubscription && settings.pushServerUrl) {
      syncSchedule(settings).catch(() => undefined);
    }
  }, delayMs);
}
