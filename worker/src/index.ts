/**
 * Varselserver for Hagen (Cloudflare Worker).
 *
 * Appen laster opp en liste med datoer og tekster. Hver hele time sjekker denne
 * workeren om klokka har passert ønsket tidspunkt i brukerens tidssone, og sender
 * dagens varsler som web push.
 */
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

export interface Env {
  SCHEDULES: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  APP_SECRET?: string;
}

type ScheduleItem = { date: string; title: string; body: string; url?: string };

type Stored = {
  subscription: PushSubscription;
  timezone: string;
  hour: number;
  items: ScheduleItem[];
  sent: Record<string, number>;
  updatedAt: number;
};

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-hagen-key",
  "access-control-max-age": "86400",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS } });
}

async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sub:${hex}`;
}

function authorized(req: Request, env: Env): boolean {
  if (!env.APP_SECRET) return true;
  return req.headers.get("x-hagen-key") === env.APP_SECRET;
}

function isSubscription(x: unknown): x is PushSubscription {
  const s = x as PushSubscription | undefined;
  return !!s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && !!s.keys?.auth && !!s.keys?.p256dh;
}

/** Lokal dato (YYYY-MM-DD) og time i en tidssone. */
function localNow(timezone: string, now = new Date()): { date: string; hour: number } {
  let tz = timezone;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    tz = "Europe/Oslo";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

type PushData = Record<string, string>;

function compact(data: Record<string, string | undefined>): PushData {
  const out: PushData = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) out[k] = v;
  return out;
}

async function send(env: Env, subscription: PushSubscription, data: Record<string, string | undefined>): Promise<Response> {
  const payload = await buildPushPayload(
    { data: compact(data), options: { ttl: 6 * 3600, urgency: "normal" } },
    subscription,
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
  );
  return fetch(subscription.endpoint, payload);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);

    if (!authorized(req, env)) return json({ error: "Ugyldig nøkkel" }, 401);

    if (req.method === "GET" && url.pathname === "/vapid-public-key") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (req.method === "POST" && url.pathname === "/schedule") {
      const body = (await req.json().catch(() => null)) as Partial<Stored> | null;
      if (!body || !isSubscription(body.subscription) || !Array.isArray(body.items)) return json({ error: "Ugyldig innhold" }, 400);
      const items = (body.items as ScheduleItem[])
        .filter((i) => i && /^\d{4}-\d{2}-\d{2}$/.test(i.date) && typeof i.title === "string")
        .slice(0, 200)
        .map((i) => ({ date: i.date, title: String(i.title).slice(0, 120), body: String(i.body ?? "").slice(0, 400), url: typeof i.url === "string" ? i.url : undefined }));
      const key = await keyFor(body.subscription.endpoint);
      const previous = (await env.SCHEDULES.get<Stored>(key, "json")) ?? undefined;
      const stored: Stored = {
        subscription: body.subscription,
        timezone: typeof body.timezone === "string" ? body.timezone : "Europe/Oslo",
        hour: Number.isInteger(body.hour) ? Math.min(23, Math.max(0, Number(body.hour))) : 8,
        items,
        sent: previous?.sent ?? {},
        updatedAt: Date.now(),
      };
      await env.SCHEDULES.put(key, JSON.stringify(stored));
      return json({ ok: true, items: items.length });
    }

    if (req.method === "DELETE" && url.pathname === "/schedule") {
      const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
      if (!body?.endpoint) return json({ error: "Mangler endpoint" }, 400);
      await env.SCHEDULES.delete(await keyFor(body.endpoint));
      return json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/test") {
      const body = (await req.json().catch(() => null)) as { subscription?: unknown } | null;
      if (!body || !isSubscription(body.subscription)) return json({ error: "Ugyldig abonnement" }, 400);
      const res = await send(env, body.subscription, {
        title: "Hagen",
        body: "Varsler virker. Du får beskjed ved starten av hver måned.",
        tag: "hagen-test",
        url: "/",
      });
      return json({ ok: res.ok, status: res.status }, res.ok ? 200 : 502);
    }

    return json({ error: "Ikke funnet" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDue(env));
  },
} satisfies ExportedHandler<Env>;

async function runDue(env: Env): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.SCHEDULES.list({ prefix: "sub:", cursor });
    for (const { name } of page.keys) {
      const stored = await env.SCHEDULES.get<Stored>(name, "json");
      if (!stored) continue;
      const { date, hour } = localNow(stored.timezone);
      if (hour < stored.hour) continue;

      // Send alt som skulle ha gått i dag (eller tidligere) og som ikke er sendt.
      const due = stored.items.filter((i) => i.date <= date && !stored.sent[`${i.date}|${i.title}`]);
      if (due.length === 0) continue;

      let gone = false;
      for (const item of due) {
        const res = await send(env, stored.subscription, { title: item.title, body: item.body, url: item.url, date: item.date, tag: `hagen-${item.date}` });
        if (res.status === 404 || res.status === 410) {
          gone = true;
          break;
        }
        stored.sent[`${item.date}|${item.title}`] = Date.now();
      }

      if (gone) {
        await env.SCHEDULES.delete(name);
        continue;
      }
      // Rydd bort gamle kvitteringer.
      const cutoff = Date.now() - 120 * 86_400_000;
      for (const [k, t] of Object.entries(stored.sent)) if (typeof t === "number" && t < cutoff) delete stored.sent[k];
      await env.SCHEDULES.put(name, JSON.stringify(stored));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}
