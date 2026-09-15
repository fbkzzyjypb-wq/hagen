// Lager et VAPID-nøkkelpar for web push. Kjør: npm run vapid
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;
const keys = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicRaw = new Uint8Array(await subtle.exportKey("raw", keys.publicKey));
const privateJwk = await subtle.exportKey("jwk", keys.privateKey);

const b64url = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

console.log("\nOffentlig nøkkel (VAPID_PUBLIC_KEY, legges i wrangler.jsonc):\n");
console.log(b64url(publicRaw));
console.log("\nPrivat nøkkel (VAPID_PRIVATE_KEY, legges inn med `npx wrangler secret put VAPID_PRIVATE_KEY`):\n");
console.log(privateJwk.d);
console.log("");
