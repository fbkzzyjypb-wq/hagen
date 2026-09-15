# Hagen – varselserver

En liten Cloudflare Worker som sender push-varsler til appen. Gratis-kvoten til Cloudflare holder i massevis for én bruker.

## Oppsett (én gang)

1. Lag en gratis konto på [cloudflare.com](https://dash.cloudflare.com/sign-up) (ingen kort nødvendig).
2. Installer avhengigheter og logg inn:
   ```bash
   cd worker
   npm install
   npx wrangler login
   ```
3. Lag lagringsplass for varselplanen og lim inn id-en i `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create SCHEDULES
   ```
4. Lag nøkler for web push:
   ```bash
   npm run vapid
   ```
   Lim den offentlige nøkkelen inn som `VAPID_PUBLIC_KEY` i `wrangler.jsonc`, og sett `VAPID_SUBJECT` til `mailto:` + din e-post.
   Den private nøkkelen legges inn som secret:
   ```bash
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```
5. (Valgfritt, anbefalt) Sett et passord så bare din app kan bruke serveren:
   ```bash
   npx wrangler secret put APP_SECRET
   ```
6. Publiser:
   ```bash
   npm run deploy
   ```
   Du får en adresse som `https://hagen-varsler.<ditt-navn>.workers.dev`. Lim den inn under Innstillinger → Varsler i appen (og passordet fra punkt 5 i feltet Nøkkel).

## Slik virker det

- Appen sender en liste med datoer og tekster (`POST /schedule`) hver gang du åpner den og noe har endret seg.
- Hver hele time sjekker workeren om klokka har passert ønsket tidspunkt i din tidssone, og sender dagens varsler.
- `POST /test` sender et testvarsel med én gang.
