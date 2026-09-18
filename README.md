# Hagen

Egen hage-app for iPhone: oversikt over planter og bed, bilder gjennom årene, valgfritt hagekart og en stell-kalender som varsler deg om hva som bør gjøres måned for måned. Bygget som web-app (PWA) med Next.js, og installeres fra nettleseren uten App Store eller TestFlight.

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

## Bed og kart

Plantene grupperes i **bed**: navngitte grupper som «Eplehekken» eller «Bedet ved terrassen», med type (blomsterbed, kjøkkenhage, hekk, potter ...). Bed lages i planteskjemaet eller fra plantelisten, og samme plante kan stå i flere bed med antall per bed. Plantelisten viser bedene som seksjoner, plantesiden viser hvilke bed planten står i, og KI-assistenten får bedene som kontekst.

Hagekartet er skjult som standard og slås på under **Innstillinger → Hagen → Vis hagekartet**. Der kan bedene få en figur på kartet og plantene plasseres. Ingenting krever kartet.

## Staudefakta og deling

[src/data/stauder.json](src/data/stauder.json) er en liste over vanlige hagestauder med herdighet, lysforhold, jord, størrelse, vanning, tørketoleranse, giftighet og formering: om rotdeling er anbefalt, hvor ofte og når, eller om stiklinger eller frø er bedre. Giftigheten følger Giftinformasjonens inndeling (ufarlig, lite giftig, giftig, meget giftig) og gjelder både mennesker og kjæledyr. Verdiene er veiledende. Planter slås opp på latinsk navn (art, så slekt) og deretter norsk navn, og faktaene vises under **Info** på plantesiden. Nye stauder legges til ved å kopiere en oppføring i filen. Feltene er beskrevet i `PlantFacts` i `src/lib/types.ts`.

Stauder som ikke står i listen slås opp hos KI-leverandøren når de legges til (og ved oppstart for stauder som ikke er sjekket ennå). Svaret har samme felter og lagres på planten.

Faktaene styrer også delingen. Fellesregelen «Del og flytt stauder» kommer hvert tredje år ut fra plantens alder (plantingsår, ellers året planten ble lagt inn). Når en staude er slått opp, får den sin egen deleregel i stedet: asters hvert 3. år, hosta hvert 5., og pion, julerose og andre som bør stå i fred får regelen slått av med en forklaring. Regelen kan slås av og på per plante under **Stell**.

## Bilder

Egne bilder tas eller lastes opp fra plantesiden (**Ta bilde**) og i planteskjemaet. Alle beholdes med dato, slik at fanen **Bilder** blir en tidslinje over hvordan planten utvikler seg.

I tillegg får hver plante automatisk et **illustrasjonsbilde** fra [Wikipedia](https://www.wikipedia.org) (gratis, uten nøkkel), slått opp på latinsk navn og deretter norsk navn. Det lagres på telefonen med fotograf, lisens og lenke til kilden, vises på plantesiden under dine egne bilder, og kan fjernes der hvis det er feil. Listene bruker pixel-ikonene (eller ditt eget bilde), ikke illustrasjonsbildet.

## Varsler

Push-varsler må sendes fra en server. `worker/` inneholder en liten Cloudflare Worker (gratis) som gjør jobben. Se [worker/README.md](worker/README.md) for oppsett. Deretter limer du inn adressen under **Innstillinger → Varsler** i appen og slår på.

## KI-assistent

Fanen **Assistent** er en chat om hagen. Alle plantene dine (med sort, plantingsår og notater), stedet, klimasonen og månedens oppgaver sendes med som kontekst, så du kan spørre direkte om «rosen» eller «epletreet». Knappene **Spør ...** på Hjem og på hver plante åpner den samme fanen, med planten i fokus.

**Planteforslag:** i skjemaet for ny plante slås navn som ikke finnes i den innebygde listen opp mens du skriver. Først i [Artsdatabanken](https://artsdatabanken.no) (gratis, uten nøkkel), som gir riktig latinsk navn for norske artsnavn som «kryptimian» og «prydkattehale». Treffene sendes så til KI-leverandøren, som legger til kategori, sort og en kort beskrivelse, og som også kjenner hagenavn og sorter Artsdatabanken ikke har, som «hengehjertetre» (Cercidiphyllum japonicum 'Pendulum'). Uten KI-leverandør vises treffene fra Artsdatabanken direkte.

**Identifiser (egen side, snarvei på Hjem):** ta bilde av en plante og få artsforslag som kan legges rett inn i hagen med bildet, eller velg «Hva feiler den?» og få en vurdering av sykdom eller skade fra KI-leverandøren (krever en modell som tåler bilder, som Gemini Flash), med mulighet for å lagre bildet og vurderingen på planten. Kameraknappen ved navnefeltet i «Ny plante» sender bildet til [Pl@ntNet](https://my.plantnet.org) (gratis nøkkel for privat bruk, legges inn under **Innstillinger → Planteidentifikasjon**). Hos Pl@ntNet må «expose my API key» være på, med appens adresse inkludert protokoll under Authorized domains, f.eks. `https://<brukernavn>.github.io` og `http://localhost:3000` for utvikling. Du får artsforslag med sikkerhet i prosent, norsk navn fra Artsdatabanken og kategori fra KI-leverandøren hvis den er satt opp. Bildet lagres som første bilde på planten.

Samtaler lagres i bolker som i ChatGPT: spørsmål som kommer innen en time samles i én samtale, og etter en times pause starter neste spørsmål en ny. Historikken (klokke-ikonet) viser hver samtale med en KI-laget tittel og et sammendrag. Du kan fortsette en gammel samtale derfra, eller starte en helt ny uten kontekst (penn-ikonet). Historikken ligger bare på telefonen.

- **Gratis leverandør (anbefalt):** Google Gemini, Groq og OpenRouter har gratisnivåer uten kort. Lag en nøkkel hos dem, velg leverandør under **Innstillinger → KI-assistent**, lim inn nøkkelen og trykk «Hent modeller». Chatten i appen bruker da den modellen, med strømmede svar og historikk lagret lokalt. Alle med OpenAI-kompatibelt API kan brukes via «Annen». Nøkkelen lagres bare på telefonen, og kallene går rett fra appen til leverandøren.
- **Uten oppsett:** spørsmålet åpnes i Claude-appen din (claude.ai) med konteksten ferdig utfylt. Svaret kommer der.

## Sikkerhetskopi

Alt ligger lokalt på telefonen. Under **Innstillinger → Data** kan du eksportere alt (inkludert bilder) til en fil du lagrer i Filer/iCloud, og importere den igjen på en ny telefon.

## Struktur

- `src/app/` – sider (Hjem, Planter, Plante, Kart, Oppgaver, Assistent, Identifiser, Innstillinger)
- `src/components/screens/` – skjermene
- `src/lib/care-rules.ts` – standard stell-kalender og planteprofiler for norsk klima
- `src/lib/tasks.ts` – utleder månedens oppgaver og varselplan
- `src/lib/db.ts` – lokal database (Dexie/IndexedDB)
- `src/lib/llm-client.ts` – strømming fra OpenAI-kompatible KI-leverandører
- `src/lib/chat.ts` og `src/lib/chat-sessions.ts` – samtaler, bolker på én time, titler og sammendrag
- `public/sw.js` – service worker for offline og push
- `worker/` – varselserver (Cloudflare Worker)

## Kjøre på iPhone via Xcode

`ios/` er et [Capacitor](https://capacitorjs.com)-skall rundt den samme web-appen. Med en gratis Apple-ID kan den installeres på egen iPhone fra Xcode, uten App Store eller TestFlight.

```bash
npm run ios   # bygger web-appen, kopierer den inn i ios/ og åpner Xcode
```

Første gang i Xcode:

1. **Xcode → Settings → Accounts**: legg til Apple-ID-en din.
2. Velg prosjektet **App** i venstremenyen, så målet **App → Signing & Capabilities**. Huk av **Automatically manage signing** og velg **Team: (Personal Team)**. Er `io.github.fbkzzyjypbwq.hagen` opptatt, endre **Bundle Identifier** til noe eget.
3. Koble til iPhonen med kabel, lås opp og trykk **Stol på**. Slå på **Innstillinger → Personvern og sikkerhet → Utviklermodus** på telefonen (dukker opp etter første tilkobling, krever omstart).
4. Velg telefonen som mål øverst i Xcode og trykk ▶︎.
5. Første gang må du godkjenne deg selv på telefonen: **Innstillinger → Generelt → VPN og enhetsadministrering → Utviklerapp → Stol på**.

Begrensninger med gratis Apple-ID: appen slutter å starte etter 7 dager. Kjør ▶︎ fra Xcode igjen, så fornyes den. Dataene beholdes så lenge du ikke sletter appen (ta en eksport for sikkerhets skyld). Push-varsler virker ikke i denne varianten, de krever web-appen på Hjem-skjermen eller betalt utviklerkonto. Pl@ntNet godkjenner heller ikke forespørsler fra appens interne adresse (`capacitor://localhost`).

Etter endringer i koden: `npm run ios` og ▶︎ på nytt. Capacitor 7 brukes fordi Capacitor 8 krever Xcode 26.

## Pakke som TestFlight-app senere

Samme Xcode-prosjekt kan lastes opp til TestFlight, men det krever Apple Developer Program (ca. 1000 kr/år).
