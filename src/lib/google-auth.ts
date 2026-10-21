/**
 * Innlogging hos Google med kode, slik TV-apper gjør det («OAuth 2.0 for TV and Limited-Input Devices»). Appen viser en
 * kort kode, brukeren skriver den inn på google.com/device og godkjenner, og appen får nøkler den kan fornye selv.
 * Ingen popup og ingen omdirigering, så det virker også fra Hjem-skjermen på iPhone. Klienten (id og «hemmelighet»,
 * som Google ikke regner som fortrolig for denne klienttypen) stemples inn ved bygging.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || "";
/** Appen får bare se filer den selv har laget i Disk. */
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEVICE_URL = "https://oauth2.googleapis.com/device/code";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Sant når bygget har en Google-klient å logge inn med. */
export const GOOGLE_LOGIN_AVAILABLE = CLIENT_ID.length > 0 && CLIENT_SECRET.length > 0;

export type DeviceCode = {
  deviceCode: string;
  /** Koden brukeren skriver inn, f.eks. «ABCD-EFGH». */
  userCode: string;
  /** Der koden skrives inn, normalt https://www.google.com/device. */
  verificationUrl: string;
  expiresAt: number;
  /** Sekunder mellom hver gang vi spør om koden er godkjent. */
  interval: number;
};

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

/** Innloggingen hos Google gjelder ikke lenger (trukket tilbake eller utløpt). Brukeren må logge inn på nytt. */
export class AuthError extends Error {}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

async function post(url: string, params: Record<string, string>, signal?: AbortSignal): Promise<{ ok: boolean; status: number; data: TokenResponse }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params), signal });
  let data: TokenResponse = {};
  try {
    data = (await res.json()) as TokenResponse;
  } catch {
    // Tomt eller uleselig svar: feilen beskrives med statuskoden.
  }
  return { ok: res.ok, status: res.status, data };
}

function describe(data: TokenResponse, status: number): string {
  return data.error_description || data.error || `Google svarte ${status}.`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Avbrutt", "AbortError"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Avbrutt", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Første steg: en kode brukeren skal skrive inn hos Google. */
export async function requestDeviceCode(signal?: AbortSignal): Promise<DeviceCode> {
  if (!GOOGLE_LOGIN_AVAILABLE) throw new Error("Google-innlogging er ikke satt opp i dette bygget.");
  const { ok, status, data } = await post(DEVICE_URL, { client_id: CLIENT_ID, scope: SCOPE }, signal);
  const d = data as TokenResponse & { device_code?: string; user_code?: string; verification_url?: string; interval?: number };
  if (!ok || !d.device_code || !d.user_code) throw new Error(describe(data, status));
  return {
    deviceCode: d.device_code,
    userCode: d.user_code,
    verificationUrl: d.verification_url || "https://www.google.com/device",
    expiresAt: Date.now() + (d.expires_in ?? 1800) * 1000,
    interval: Math.max(1, d.interval ?? 5),
  };
}

/** Andre steg: venter til brukeren har godkjent koden. Kaster ved avslag, utløpt kode eller avbrudd. */
export async function waitForDeviceApproval(code: DeviceCode, signal?: AbortSignal): Promise<Tokens> {
  let interval = code.interval;
  while (Date.now() < code.expiresAt) {
    await sleep(interval * 1000, signal);
    const { ok, status, data } = await post(
      TOKEN_URL,
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, device_code: code.deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" },
      signal
    );
    if (ok && data.access_token && data.refresh_token) {
      return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    }
    if (data.error === "authorization_pending") continue;
    if (data.error === "slow_down") {
      interval += 5;
      continue;
    }
    if (data.error === "access_denied") throw new Error("Du avviste tilgangen hos Google.");
    if (data.error === "expired_token") break;
    throw new Error(describe(data, status));
  }
  throw new Error("Koden gikk ut før den ble godkjent. Prøv igjen.");
}

/** Ny tilgangsnøkkel fra fornyelsesnøkkelen. `AuthError` når Google ikke godtar den lenger. */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const { ok, status, data } = await post(TOKEN_URL, { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" });
  if (ok && data.access_token) return { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  if (data.error === "invalid_grant" || status === 400 || status === 401) throw new AuthError("Innloggingen hos Google gjelder ikke lenger. Logg inn på nytt.");
  throw new Error(describe(data, status));
}

/** Trekker tilbake tilgangen hos Google. Feil ignoreres: nøklene slettes lokalt uansett. */
export async function revokeToken(token: string): Promise<void> {
  await post(REVOKE_URL, { token }).catch(() => undefined);
}
