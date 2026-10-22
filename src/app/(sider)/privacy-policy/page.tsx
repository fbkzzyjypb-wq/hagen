import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Page } from "@/components/page";

export const metadata: Metadata = {
  title: "Personvernerklæring – Hagen",
  description: "Hvilke opplysninger Hagen behandler, hvor de lagres og hvilke tjenester de sendes til.",
};

const UPDATED = "21. oktober 2026";
const REPO_URL = "https://github.com/fbkzzyjypb-wq/hagen";

/**
 * Personvernerklæringen for appen. Den beskriver det koden faktisk gjør: alt lagres på enheten, appen har ingen egen
 * server, og opplysninger sendes bare til tjenester brukeren selv har koblet til (KI-leverandør, Pl@ntNet,
 * Artsdatabanken, claude.ai og Google Disk). Ligger på /privacy-policy, så den kan oppgis til Google for
 * OAuth-klienten. Oppdater datoen øverst når innholdet endres.
 */
export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHeader
        title="Personvernerklæring"
        subtitle={`Sist oppdatert ${UPDATED}`}
        leading={
          <Link href="/" aria-label="Tilbake" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "-ml-2 rounded-full")}>
            <ArrowLeft className="size-5" />
          </Link>
        }
      />
      <Page className="pb-6 text-[15px] leading-relaxed">
        <p className="mt-2 text-muted-foreground">
          Hagen er en app for én hobbygartner: planter, plasseringer, bilder, et valgfritt hagekart og en KI-assistent som kjenner hagen din. Den
          lages som et åpent hobbyprosjekt uten firma bak, og koden ligger på{" "}
          <Ext href={REPO_URL}>GitHub</Ext>. Denne erklæringen forklarer hvilke opplysninger appen behandler, hvor de lagres og hvem de sendes til.
        </p>

        <Summary>
          Kort fortalt: alt du legger inn ligger på din egen telefon. Appen har ingen egen server, ingen brukerkontoer, ingen sporing og ingen annonser.
          Opplysninger forlater telefonen bare når du selv bruker en tjeneste du har koblet til, og da går de rett fra appen til den tjenesten.
        </Summary>

        <H2>Ingen egen server, ingen sporing</H2>
        <P>
          Appen består av statiske filer som leveres fra GitHub Pages. Det finnes ingen egen server bak den, og ingen database utenfor telefonen din. Appen
          bruker ikke informasjonskapsler, analyseverktøy eller annonsenettverk, og den leser ikke posisjonen til telefonen.
        </P>
        <P>
          Når appen lastes, ser GitHub IP-adressen din og hvilke filer nettleseren henter, som enhver nettside. Det er beskrevet i{" "}
          <Ext href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">GitHubs personvernerklæring</Ext>. En
          service worker mellomlagrer appens egne filer på telefonen, så den virker uten nett.
        </P>

        <H2>Det som lagres på telefonen</H2>
        <P>Alt du legger inn lagres i nettleserens database (IndexedDB) på enheten, eller i appens eget lager når den kjører som iOS-app:</P>
        <Ul>
          <li>Planter med navn, sort, kategori, plantingsår, notater og plantefakta, og plasseringene de står i.</li>
          <li>Bilder du tar eller velger, med dato og eventuelt notat, og et valgfritt kartbilde.</li>
          <li>Identifiseringer: bildet du identifiserte, forslagene og fakta om dem.</li>
          <li>Samtaler med KI-assistenten, med titler og sammendrag.</li>
          <li>Innstillinger: navn på hagen, sted (fritekst du skriver selv), klimasone, og API-nøklene du eventuelt legger inn.</li>
          <li>Er du logget inn med Google: e-postadressen din, innloggingsnøklene fra Google og hvilke filer appen har i Google Disk.</li>
        </Ul>
        <P>
          Bilder skaleres ned og lagres på nytt i appen. Da følger ikke skjult informasjon i bildefilen med, som posisjonen kameraet la inn. Ingenting av
          dette sendes noe sted uten at du gjør noe av det som er beskrevet nedenfor.
        </P>

        <H2>Kamera og bilder</H2>
        <P>
          Kameraet brukes bare når du åpner søkeren og trykker på utløseren, og bildebiblioteket bare når du velger et bilde derfra. Bildene lagres
          på telefonen. Et bilde sendes ut av appen bare når du identifiserer det eller ber om en vurdering av sykdom eller skade, og da til tjenesten du har
          valgt for det.
        </P>

        <H2>Tjenester du kan koble til</H2>
        <P>
          Ingen av tjenestene under er påkrevd, og ingen brukes før du har satt dem opp eller selv trykker på en knapp som bruker dem. Kallene går direkte fra
          appen til tjenesten, og hva tjenesten gjør med det den mottar, styres av dens egne vilkår.
        </P>

        <H3>KI-leverandør (Google Gemini, Groq, OpenRouter eller en annen OpenAI-kompatibel tjeneste)</H3>
        <P>
          Du velger leverandør selv og legger inn din egen nøkkel. Når du bruker assistenten, sendes spørsmålet ditt sammen med kontekst om hagen: sted og
          klimasone, listen over plantene dine med sort, plantingsår og notater, og plasseringene de står i. Når du legger til en plante eller slår opp
          plantefakta, sendes plantenavnet og sted og klimasone. Ber du om identifisering eller vurdering av sykdom med KI, sendes bildet. Titler og
          sammendrag av samtaler lages ved at samtalen sendes til leverandøren. Nøkkelen din følger med i hvert kall som bevis på at det er deg.
        </P>
        <P>
          Les leverandørens vilkår før du velger: <Ext href="https://ai.google.dev/gemini-api/terms">Gemini API</Ext>,{" "}
          <Ext href="https://groq.com/privacy-policy/">Groq</Ext> og <Ext href="https://openrouter.ai/privacy">OpenRouter</Ext>. Gratisnivåene kan bruke
          det du sender til å forbedre modellene.
        </P>

        <H3>Claude (claude.ai)</H3>
        <P>
          Har du ikke satt opp en KI-leverandør, åpner assistenten spørsmålet ditt i claude.ai i nettleseren, med den samme konteksten om hagen lagt inn i
          adressen. Det som skjer derfra, styres av <Ext href="https://www.anthropic.com/privacy">Anthropics personvernerklæring</Ext> og din egen
          Claude-konto.
        </P>

        <H3>Pl@ntNet</H3>
        <P>
          Med en Pl@ntNet-nøkkel sendes bildene du identifiserer, nedskalert, til <Ext href="https://plantnet.org/">Pl@ntNet</Ext> sammen med nøkkelen
          din. Referansebildene som vises på forslagene, hentes derfra.
        </P>

        <H3>Artsdatabanken</H3>
        <P>
          Plantenavn du skriver inn, og latinske navn fra identifiseringer, slås opp i <Ext href="https://www.artsdatabanken.no/">Artsdatabankens</Ext>{" "}
          åpne navnebase for å finne norsk og gyldig latinsk navn. Det krever ingen nøkkel, og bare søketeksten sendes.
        </P>

        <H2>Google-konto og Google Disk</H2>
        <P>
          Du kan logge inn med Google for å speile alt i appen til din egen Google Disk, så en annen telefon kan hente det ned. Innloggingen skjer hos Google
          med en kode du skriver inn på google.com/device. Appen ser aldri passordet ditt.
        </P>
        <P>Appen ber om tilgangen «drive.file». Det betyr at den bare kan se og endre filer den selv har laget, ikke resten av Disken din. Den bruker tilgangen til:</P>
        <Ul>
          <li>å hente e-postadressen og navnet på kontoen, så innstillingene kan vise hvem som er logget inn (bare e-postadressen lagres),</li>
          <li>å lage mappen «Hagen» i Disken din og holde den oppdatert med filen hagen.json og bildene dine som egne filer,</li>
          <li>å hente det samme ned igjen på en annen telefon der du logger inn.</li>
        </Ul>
        <P>
          Filen hagen.json inneholder alt appen vet: planter, plasseringer, identifiseringer, samtaler og innstillingene dine, også API-nøklene du har lagt
          inn. Innloggingsnøklene fra Google lagres bare på telefonen og brukes bare mot Googles egne tjenester. Når du logger ut, slettes de fra
          telefonen og trekkes tilbake hos Google. Dataene i Disk blir liggende til du sletter mappen «Hagen» selv.
        </P>
        <P>
          Opplysninger appen får fra Google-API-er brukes bare til å synkronisere dine egne data mellom dine egne enheter. De deles ikke med andre, selges
          ikke, brukes ikke til annonser og brukes ikke til å trene KI-modeller. Appens bruk av informasjon fra Google-API-er følger{" "}
          <Ext href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</Ext>, inkludert kravene om
          begrenset bruk (Limited Use). Du kan når som helst trekke tilbake tilgangen under{" "}
          <Ext href="https://myaccount.google.com/permissions">Tilkoblinger til tredjepartsapper</Ext> i Google-kontoen din. Googles egen behandling er
          beskrevet i <Ext href="https://policies.google.com/privacy">Googles personvernerklæring</Ext>.
        </P>

        <H2>Sikkerhetskopi</H2>
        <P>
          Under Innstillinger → Data kan du eksportere alt til en fil og importere den igjen. Filen inneholder alt i appen, også bilder og API-nøkler, og du
          bestemmer selv hvor den lagres. Appen sender den ikke noe sted.
        </P>

        <H2>Sletting</H2>
        <Ul>
          <li>Enkeltplanter, bilder, identifiseringer og samtaler slettes i appen.</li>
          <li>Alt på telefonen forsvinner når du sletter appen fra Hjem-skjermen, eller sletter nettstedsdataene for appens adresse i nettleseren.</li>
          <li>Det i Google Disk slettes ved å slette mappen «Hagen» der. Logg ut i appen for å fjerne innloggingen.</li>
          <li>Det som er sendt til en KI-leverandør, Pl@ntNet eller claude.ai, slettes etter deres regler og eventuelt i din konto hos dem.</li>
        </Ul>

        <H2>Endringer og kontakt</H2>
        <P>
          Erklæringen oppdateres når appen endrer hva den gjør med opplysninger, og datoen øverst viser siste endring. Spørsmål stilles som sak i{" "}
          <Ext href={`${REPO_URL}/issues`}>prosjektet på GitHub</Ext>.
        </P>
      </Page>
    </>
  );
}

function Summary({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-accent px-4 py-3 text-accent-foreground">{children}</p>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-2 font-heading text-lg font-semibold tracking-tight">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-1 font-semibold">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-2">{children}</p>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1.5 pl-5">{children}</ul>;
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
      {children}
    </a>
  );
}
