# Hagen

Egen hage-app for iPhone: oversikt over planter og hvor de står, bilder gjennom årene, valgfritt hagekart og en KI-assistent som kjenner hagen din. Bygget som web-app (PWA) med Next.js, og installeres fra nettleseren uten App Store eller TestFlight.

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
3. Åpne appen fra Hjem-skjermen. Da kjører den i fullskjerm og virker offline.

## Plassering og kart

Plantene grupperes etter **plassering**: navngitte steder som «Drivhuset», «Eplehekken» eller «Bedet ved terrassen», med type (blomsterbed, kjøkkenhage, hekk, potter ...). Plasseringer lages i planteskjemaet eller fra plantelisten, og samme plante kan stå flere steder med antall per plassering. Plantelisten viser plasseringene som seksjoner, plantesiden viser hvor planten står, og KI-assistenten får plasseringene som kontekst. I koden heter en plassering fortsatt `bed`.

Hagekartet er skjult som standard og slås på under **Innstillinger → Hagen → Vis hagekartet**. Der kan plasseringene få en figur på kartet og plantene settes inn. Ingenting krever kartet.

## Plantefakta

[src/data/stauder.json](src/data/stauder.json) er en liste over vanlige hagestauder med herdighet, lysforhold, jord, størrelse, vanning, tørketoleranse, giftighet og formering: om rotdeling er anbefalt, hvor ofte og når, eller om stiklinger eller frø er bedre. Giftigheten følger Giftinformasjonens inndeling (ufarlig, lite giftig, giftig, meget giftig) og gjelder både mennesker og kjæledyr. Verdiene er veiledende. Planter slås opp på latinsk navn (art, så slekt) og deretter norsk navn, og faktaene vises under **Info** på plantesiden. Nye stauder legges til ved å kopiere en oppføring i filen. Feltene er beskrevet i `PlantFacts` i `src/lib/types.ts`.

Alle planter, uansett kategori, slås i tillegg opp hos KI-leverandøren når de legges til (og ved oppstart for planter som ikke er slått opp ennå). Svaret lagres på planten og har de samme feltene pluss beskrivelse, type, plantefamilie, opprinnelse, gjødsling, blomstring, beskjæring, såing og planting, høsting, overvintring, sykdommer og skadedyr, verdi for dyrelivet, spiselighet og annet verdt å vite. Felt som ikke er relevante for planten utelates. For stauder i listen går verdiene fra listen foran KI-svaret. Oppslagene går ett om gangen med en kort pause, så gratisnivåene hos leverandørene holder, og uten KI-leverandør vises bare stauder fra listen.

## Bilder

Egne bilder tas eller lastes opp fra plantesiden (**Ta bilde**) og i planteskjemaet. Alle beholdes med dato, slik at fanen **Bilder** blir en tidslinje over hvordan planten utvikler seg.

## KI-assistent

Fanen **Assistent** er en chat om hagen. Alle plantene dine (med sort, plantingsår og notater), stedet og klimasonen sendes med som kontekst, så du kan spørre direkte om «rosen» eller «epletreet». Knappene **Spør ...** på Hjem og på hver plante åpner den samme fanen, med planten i fokus.

**Planteforslag:** i skjemaet for ny plante slås navnet opp mens du skriver. Først i [Artsdatabanken](https://artsdatabanken.no) (gratis, uten nøkkel), som gir riktig latinsk navn for norske artsnavn som «kryptimian» og «prydkattehale». Treffene sendes så til KI-leverandøren, som legger til kategori, sort og en kort beskrivelse, og som også kjenner hagenavn og sorter Artsdatabanken ikke har, som «hengehjertetre» (Cercidiphyllum japonicum 'Pendulum'). Uten KI-leverandør vises treffene fra Artsdatabanken direkte.

**Identifiser (egen fane):** legg til opptil fem bilder av samme plante, velg hva hvert bilde viser (blad, blomst, frukt eller bark, eller la Pl@ntNet avgjøre det selv) og trykk **Identifiser**. Ingenting sendes før du trykker, og alle bildene går i ett kall til Pl@ntNet. Hvert forslag vises med sikkerhet i prosent, referansebilder av arten fra Pl@ntNet, norsk navn fra Artsdatabanken og, med KI-leverandør, kategori, giftighet, herdighetssone og livsløp (ettårig, toårig eller flerårig). Herdigheten sammenlignes med klimasonen under **Innstillinger → Hagen**, så du ser med en gang om planten overvintrer hos deg. **Hent info** på et forslag henter de fulle plantefaktaene (samme som på en plante i hagen) rett i kortet, uten å lagre noe; lagrer du forslaget etterpå, følger de med. Stauder i appens liste får verdiene derfra. Trykk **Lagre** på forslaget du tror stemmer, så havner identifiseringen i historikken på fanen med bildet og forslaget, og kan åpnes igjen som egen side eller slettes senere; historikken følger med i sikkerhetskopien. En lagret identifisering får de samme plantefaktaene som en plante i hagen, slått opp hos KI-leverandøren i bakgrunnen. Et forslag kan også legges rett inn i hagen med det første bildet, og da lagres identifiseringen samtidig og peker på planten. Eller velg «Hva feiler den?» og få en vurdering av sykdom eller skade fra KI-leverandøren (krever en modell som tåler bilder, som Gemini Flash), med mulighet for å lagre bildet og vurderingen på planten. Kameraknappen ved navnefeltet i «Ny plante» sender bildet til [Pl@ntNet](https://my.plantnet.org) (gratis nøkkel for privat bruk, legges inn under **Innstillinger → Planteidentifikasjon**). Hos Pl@ntNet må «expose my API key» være på, med appens adresse inkludert protokoll under Authorized domains, f.eks. `https://<brukernavn>.github.io` og `http://localhost:3000` for utvikling. Du får artsforslag med sikkerhet i prosent, norsk navn fra Artsdatabanken og kategori fra KI-leverandøren hvis den er satt opp. Bildet lagres som første bilde på planten.

Samtaler lagres i bolker som i ChatGPT: spørsmål som kommer innen en time samles i én samtale, og etter en times pause starter neste spørsmål en ny. Historikken (klokke-ikonet) viser hver samtale med en KI-laget tittel og et sammendrag. Du kan fortsette en gammel samtale derfra, eller starte en helt ny uten kontekst (penn-ikonet). Historikken ligger bare på telefonen.

- **Gratis leverandør (anbefalt):** Google Gemini, Groq og OpenRouter har gratisnivåer uten kort. Lag en nøkkel hos dem, velg leverandør under **Innstillinger → KI-assistent**, lim inn nøkkelen og trykk «Hent modeller». Chatten i appen bruker da den modellen, med strømmede svar og historikk lagret lokalt. Alle med OpenAI-kompatibelt API kan brukes via «Annen». Nøkkelen lagres bare på telefonen, og kallene går rett fra appen til leverandøren.
- **Uten oppsett:** spørsmålet åpnes i Claude-appen din (claude.ai) med konteksten ferdig utfylt. Svaret kommer der.

## Sikkerhetskopi

Alt ligger lokalt på telefonen. Under **Innstillinger → Data** kan du eksportere alt (inkludert bilder) til en fil du lagrer i Filer/iCloud, og importere den igjen på en ny telefon.

## Struktur

- `src/app/` – sider (Hjem, Planter, Plante, Kart, Assistent, Identifiser, Identifisering, Innstillinger)
- `src/components/screens/` – skjermene
- `src/lib/db.ts` – lokal database (Dexie/IndexedDB)
- `src/lib/llm-client.ts` – strømming fra OpenAI-kompatible KI-leverandører
- `src/lib/chat.ts` og `src/lib/chat-sessions.ts` – samtaler, bolker på én time, titler og sammendrag
- `public/sw.js` – service worker for offline

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

Begrensninger med gratis Apple-ID: appen slutter å starte etter 7 dager. Kjør ▶︎ fra Xcode igjen, så fornyes den. Dataene beholdes så lenge du ikke sletter appen (ta en eksport for sikkerhets skyld). Pl@ntNet godkjenner heller ikke forespørsler fra appens interne adresse (`capacitor://localhost`).

Etter endringer i koden: `npm run ios` og ▶︎ på nytt. Capacitor 7 brukes fordi Capacitor 8 krever Xcode 26.

## Pakke som TestFlight-app senere

Samme Xcode-prosjekt kan lastes opp til TestFlight, men det krever Apple Developer Program (ca. 1000 kr/år).
