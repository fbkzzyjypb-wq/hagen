# Hagen

Egen hage-app for iPhone: oversikt over planter, hagekart, bilder gjennom årene og en stell-kalender som varsler deg om hva som bør gjøres måned for måned. Bygget som web-app (PWA) med Next.js, og installeres fra nettleseren uten App Store eller TestFlight.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne http://localhost:3000. Alt lagres lokalt i nettleseren (IndexedDB), så data i utviklingsmodus er uavhengig av det som ligger på telefonen.

## Publisere gratis på GitHub Pages

1. Lag et privat eller offentlig repo på GitHub og push koden til `main`.
2. Gå til **Settings → Pages** i repoet og velg **Source: GitHub Actions**.
3. Arbeidsflyten i `.github/workflows/deploy.yml` bygger og publiserer automatisk ved hver push. Adressen blir `https://<brukernavn>.github.io/<repo-navn>/`.

Merk: Private repoer krever GitHub Pro for Pages. Med gratis konto må repoet være offentlig. Det er bare koden som ligger der, aldri dataene dine.

## Installere på iPhone

1. Åpne adressen i Safari, Chrome, Edge eller Firefox på telefonen.
2. Trykk **Del** og velg **Legg til på Hjem-skjerm**.
3. Åpne appen fra Hjem-skjermen. Da kjører den i fullskjerm, virker offline og kan motta varsler.

Varsler krever iOS 16.4 eller nyere og at appen er åpnet fra Hjem-skjermen.

## Varsler

Push-varsler må sendes fra en server. `worker/` inneholder en liten Cloudflare Worker (gratis) som gjør jobben. Se [worker/README.md](worker/README.md) for oppsett. Deretter limer du inn adressen under **Innstillinger → Varsler** i appen og slår på.

## Spørre Claude

Knappen **Spør Claude** bygger et spørsmål med plantelisten, stedet og dagens dato, og åpner det i Claude-appen din. Ingen API-nøkkel eller ekstra kostnad.

## Sikkerhetskopi

Alt ligger lokalt på telefonen. Under **Innstillinger → Data** kan du eksportere alt (inkludert bilder) til en fil du lagrer i Filer/iCloud, og importere den igjen på en ny telefon.

## Struktur

- `src/app/` – sider (Hjem, Planter, Plante, Kart, Oppgaver, Innstillinger)
- `src/components/screens/` – skjermene
- `src/lib/care-rules.ts` – standard stell-kalender og planteprofiler for norsk klima
- `src/lib/tasks.ts` – utleder månedens oppgaver og varselplan
- `src/lib/db.ts` – lokal database (Dexie/IndexedDB)
- `public/sw.js` – service worker for offline og push
- `worker/` – varselserver (Cloudflare Worker)

## Pakke som TestFlight-app senere

Koden er den samme. Med [Capacitor](https://capacitorjs.com) kan `out/`-mappen pakkes i et iOS-skall, men det krever Apple Developer Program (ca. 1000 kr/år).
