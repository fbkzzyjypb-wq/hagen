import type { CareRule, PlantCategory } from "./types";

type RuleTemplate = {
  key: string;
  title: string;
  description?: string;
  months: number[];
};

/** Generelle oppgaver per plantekategori, tilpasset norsk klima (sone H3–H4, juster etter behov). */
export const CATEGORY_RULES: Record<PlantCategory, RuleTemplate[]> = {
  hekk: [
    {
      key: "klipp-hekk",
      title: "Klipp hekken",
      description:
        "Første klipp i juni etter at fuglene har forlatt reirene, andre klipp i august. Klipp smalere i toppen enn i bunnen så lyset når ned.",
      months: [6, 8],
    },
    { key: "gjodsle-hekk", title: "Gjødsle hekken", description: "Gi hekken gjødsel når veksten starter i mai.", months: [5] },
    { key: "vann-hekk", title: "Vann hekken i tørke", description: "Nyplantede hekker trenger vann jevnlig de to første årene.", months: [6, 7] },
  ],
  frukttre: [
    {
      key: "beskjar-frukttre",
      title: "Beskjær frukttreet",
      description:
        "Eple og pære beskjæres i mars–april før knoppene bryter. Plomme og kirsebær venter til juli–august for å unngå sølvglans.",
      months: [3, 4],
    },
    { key: "gjodsle-frukttre", title: "Gjødsle frukttreet", description: "Spre kompost eller hagegjødsel rundt stammen i april.", months: [4] },
    { key: "tynn-frukt", title: "Tynn frukten", description: "Tynn etter junifallet så treet får store, sunne frukter.", months: [7] },
    { key: "host-frukt", title: "Høst frukt", description: "Sjekk om frukten løsner lett når du vrir forsiktig.", months: [9, 10] },
    { key: "fallfrukt", title: "Rak opp fallfrukt og blad", description: "Reduserer skurv og skadedyr neste år.", months: [10] },
  ],
  tre: [
    {
      key: "beskjar-tre",
      title: "Formbeskjær treet",
      description: "Beskjær løvtrær i hvileperioden. Bjørk og lønn blør, og tas heller sent på sommeren.",
      months: [3],
    },
    { key: "vann-tre", title: "Vann nyplantede trær", description: "Trær plantet de siste to årene trenger rikelig vann i tørre perioder.", months: [6, 7, 8] },
  ],
  busk: [
    {
      key: "beskjar-busk-var",
      title: "Beskjær sommerblomstrende busker",
      description: "Busker som blomstrer på årets skudd (f.eks. spirea, sommerfuglbusk) beskjæres før veksten starter.",
      months: [3, 4],
    },
    {
      key: "beskjar-busk-etter",
      title: "Beskjær vårblomstrende busker etter blomstring",
      description: "Syrin, forsythia og lignende beskjæres rett etter at de har blomstret av.",
      months: [6],
    },
    { key: "gjodsle-busk", title: "Gjødsle buskene", months: [5] },
    {
      key: "stiklinger-busk",
      title: "Ta stiklinger",
      description: "Halvmodne stiklinger av årets skudd i juli–august. Sett i fuktig sandblandet jord under plast.",
      months: [7, 8],
    },
  ],
  baerbusk: [
    {
      key: "beskjar-baerbusk",
      title: "Beskjær bærbuskene",
      description: "Fjern de eldste greinene (3–4 år) på solbær, rips og stikkelsbær så busken fornyer seg.",
      months: [3],
    },
    { key: "gjodsle-baerbusk", title: "Gjødsle bærbuskene", months: [4] },
    { key: "fuglenett", title: "Dekk bærene mot fugler", months: [6, 7] },
    { key: "host-baer", title: "Høst bær", months: [7, 8] },
  ],
  staude: [
    {
      key: "klipp-ned-stauder",
      title: "Klipp ned fjorårets stauder",
      description: "La gjerne stenglene stå over vinteren som skjul for insekter, og klipp ned i april.",
      months: [4],
    },
    {
      key: "del-stauder",
      title: "Del og flytt stauder",
      description: "Del store stauder når skuddene er et par cm, eller på sensommeren.",
      months: [4, 5, 9],
    },
    { key: "stotte-stauder", title: "Sett opp støtte", description: "Høye stauder trenger støtte før de faller.", months: [5] },
    { key: "avblomstret-stauder", title: "Fjern avblomstret", description: "Gir gjerne ny blomstring og hindrer frøsetting der du ikke vil ha det.", months: [7, 8] },
    {
      key: "samle-fro",
      title: "Samle frø",
      description: "Høst frøkapsler en tørr dag når de er brune. Tørk i papirpose og merk med navn og år.",
      months: [8, 9],
    },
  ],
  lok: [
    { key: "plant-varlok", title: "Plant vårløk", description: "Tulipan, narsiss og krokus settes i september–oktober, dobbelt så dypt som løken er høy.", months: [9, 10] },
    { key: "gjodsle-lok", title: "Gjødsle løk etter blomstring", description: "La bladene stå til de gulner, det gir kraft til neste år.", months: [5, 6] },
    { key: "sett-ut-knoller", title: "Sett ut dahlia og gladiolus", description: "Etter siste frost, gjerne forkultivert inne fra april.", months: [5, 6] },
    { key: "ta-opp-knoller", title: "Ta opp frostømfintlige knoller", description: "Dahlia og gladiolus tas opp etter første frostnatt og lagres tørt og kjølig.", months: [10] },
  ],
  sommerblomst: [
    { key: "sa-inne", title: "Så sommerblomster inne", months: [3, 4] },
    { key: "plant-ut", title: "Plant ut etter siste frost", description: "Vent til nattefrosten er over, vanligvis slutten av mai.", months: [5, 6] },
    { key: "gjodsle-sommerblomst", title: "Gjødsle og vann sommerblomster", description: "Flytende gjødsel annenhver uke gir blomstring hele sommeren.", months: [6, 7, 8] },
    { key: "samle-fro-sommer", title: "Samle frø", months: [9] },
  ],
  gronnsak: [
    { key: "sa-gronnsak-inne", title: "Så grønnsaker inne", months: [3, 4] },
    { key: "sa-gronnsak-ute", title: "Så og plant ut grønnsaker", months: [5, 6] },
    { key: "luk-vann", title: "Luk og vann", months: [6, 7, 8] },
    { key: "host-gronnsak", title: "Høst grønnsaker", months: [7, 8, 9, 10] },
    { key: "rydd-bed", title: "Rydd og dekk grønnsaksbedet", description: "Legg kompost og dekk med løv eller halm over vinteren.", months: [10, 11] },
  ],
  urt: [
    { key: "sa-urter", title: "Så urter", months: [4, 5] },
    { key: "host-urter", title: "Høst og tørk urter", description: "Høst før blomstring for best smak. Tørk luftig i skyggen.", months: [7, 8] },
  ],
  klatreplante: [
    {
      key: "beskjar-klatre",
      title: "Beskjær klatreplanten",
      description: "Klematis i gruppe 3 klippes ned til 30–50 cm. Gruppe 2 tynnes lett. Gruppe 1 beskjæres bare etter blomstring.",
      months: [3, 4],
    },
    { key: "bind-opp", title: "Bind opp nye skudd", months: [6, 7] },
  ],
  plen: [
    { key: "rak-plen", title: "Rak og luft plenen", description: "Fjern mose og dødt gress når jorda er tørr nok til å gå på.", months: [4] },
    { key: "gjodsle-plen", title: "Gjødsle plenen", months: [5, 8] },
    { key: "kalk-plen", title: "Kalk plenen", description: "Kalk ved behov, gjerne på våren eller høsten.", months: [3, 10] },
    { key: "siste-klipp", title: "Siste klipp før vinteren", description: "Klipp litt kortere enn vanlig og rak bort løv.", months: [10] },
  ],
  annet: [],
};

/** Oppgaver som gjelder hele hagen, uavhengig av planter. */
export const GARDEN_RULES: RuleTemplate[] = [
  { key: "planlegg", title: "Planlegg sesongen og bestill frø", months: [1, 2] },
  { key: "redskap", title: "Sjekk og slip redskap", months: [2] },
  { key: "vinterskader", title: "Sjekk vinterskader", description: "Se etter brekkskader, museskader og frostsprekker.", months: [3] },
  { key: "fjern-vinterdekke", title: "Fjern vinterdekke", months: [4] },
  {
    key: "kompost-var",
    title: "Legg kompost i bedene",
    description: "Et lag på 3–5 cm moden kompost rundt plantene gir næring og holder på fukten.",
    months: [4],
  },
  { key: "vann-torke", title: "Vann i tørkeperioder", description: "Vann sjelden og grundig, helst om morgenen.", months: [6, 7, 8] },
  { key: "tom-kompost", title: "Vend komposten", months: [5, 9] },
  { key: "rak-lov", title: "Rak løv og fyll på komposten", months: [10] },
  { key: "kompost-host", title: "Dekk bedene med kompost eller løv", months: [10, 11] },
  { key: "vinterdekk", title: "Vinterdekk frostømfintlige planter", description: "Dekk med granbar eller fiberduk når kulda setter inn.", months: [11] },
  { key: "tom-slanger", title: "Tøm slanger og steng utekraner", months: [10, 11] },
];

export type PlantProfile = {
  key: string;
  name: string;
  latinName: string;
  category: PlantCategory;
  rules: RuleTemplate[];
};

/** Kjente planter med egne stell-oppgaver. Overstyrer kategoriregler med samme nøkkel. */
export const PLANT_PROFILES: PlantProfile[] = [
  {
    key: "bokehekk",
    name: "Bøkehekk",
    latinName: "Fagus sylvatica",
    category: "hekk",
    rules: [
      {
        key: "klipp-hekk",
        title: "Klipp bøkehekken",
        description:
          "Bøk klippes én gang, i slutten av juli eller august, når skuddene har modnet. Da holder den fasongen til neste sommer. Ikke klipp i frost.",
        months: [7, 8],
      },
      { key: "gjodsle-hekk", title: "Gjødsle bøkehekken", description: "Kompost eller hagegjødsel langs hekken i mai.", months: [5] },
    ],
  },
  {
    key: "agnbok",
    name: "Agnbøkhekk",
    latinName: "Carpinus betulus",
    category: "hekk",
    rules: [{ key: "klipp-hekk", title: "Klipp agnbøkhekken", description: "Tåler to klipp, i juni og august.", months: [6, 8] }],
  },
  {
    key: "thuja",
    name: "Thujahekk",
    latinName: "Thuja occidentalis",
    category: "hekk",
    rules: [
      {
        key: "klipp-hekk",
        title: "Klipp thujahekken",
        description: "Klipp bare i grønne skudd. Thuja skyter ikke igjen fra gammel ved.",
        months: [6, 8],
      },
    ],
  },
  {
    key: "rose",
    name: "Rose",
    latinName: "Rosa",
    category: "busk",
    rules: [
      {
        key: "beskjar-busk-var",
        title: "Beskjær rosene",
        description: "Når bjørka får museører. Klipp ned til friskt vev, fjern døde og kryssende greiner.",
        months: [4],
      },
      { key: "gjodsle-busk", title: "Gjødsle rosene", description: "Rosegjødsel i mai og igjen etter første blomstring i juli.", months: [5, 7] },
      { key: "beskjar-busk-etter", title: "Fjern avblomstret og villskudd", months: [7, 8] },
      { key: "vinterdekk-rose", title: "Vinterdekk rosene", description: "Hyppe opp jord rundt podestedet og dekk med granbar.", months: [11] },
    ],
  },
  {
    key: "epletre",
    name: "Epletre",
    latinName: "Malus domestica",
    category: "frukttre",
    rules: [
      { key: "beskjar-frukttre", title: "Beskjær epletreet", description: "Mars–april før knoppbryting. Åpne kronen så lys slipper inn.", months: [3, 4] },
      { key: "tynn-frukt", title: "Tynn eplene", description: "Ett eple per blomsterklase, ca. 10 cm avstand.", months: [7] },
      { key: "host-frukt", title: "Høst epler", months: [9, 10] },
    ],
  },
  {
    key: "paeretre",
    name: "Pæretre",
    latinName: "Pyrus communis",
    category: "frukttre",
    rules: [{ key: "beskjar-frukttre", title: "Beskjær pæretreet", months: [3, 4] }],
  },
  {
    key: "plommetre",
    name: "Plommetre",
    latinName: "Prunus domestica",
    category: "frukttre",
    rules: [
      {
        key: "beskjar-frukttre",
        title: "Beskjær plommetreet",
        description: "Beskjær i juli–august, aldri om vinteren. Reduserer risiko for sølvglans.",
        months: [7, 8],
      },
      { key: "host-frukt", title: "Høst plommer", months: [8, 9] },
    ],
  },
  {
    key: "kirsebaer",
    name: "Kirsebærtre",
    latinName: "Prunus avium",
    category: "frukttre",
    rules: [
      { key: "beskjar-frukttre", title: "Beskjær kirsebærtreet", description: "Beskjær etter høsting i juli–august.", months: [7, 8] },
      { key: "host-frukt", title: "Høst kirsebær", months: [7, 8] },
    ],
  },
  {
    key: "solbaer",
    name: "Solbær",
    latinName: "Ribes nigrum",
    category: "baerbusk",
    rules: [
      { key: "beskjar-baerbusk", title: "Beskjær solbæren", description: "Fjern en tredel av de eldste greinene helt nede ved bakken.", months: [3] },
    ],
  },
  { key: "rips", name: "Rips", latinName: "Ribes rubrum", category: "baerbusk", rules: [] },
  { key: "stikkelsbaer", name: "Stikkelsbær", latinName: "Ribes uva-crispa", category: "baerbusk", rules: [] },
  {
    key: "bringebaer",
    name: "Bringebær",
    latinName: "Rubus idaeus",
    category: "baerbusk",
    rules: [
      { key: "beskjar-baerbusk", title: "Klipp ned avbårne bringebærskudd", description: "Skudd som har båret klippes helt ned etter høsting.", months: [9] },
      { key: "tynn-bringebaer", title: "Tynn nye bringebærskudd", description: "Behold 8–10 kraftige skudd per meter.", months: [5] },
    ],
  },
  {
    key: "jordbaer",
    name: "Jordbær",
    latinName: "Fragaria × ananassa",
    category: "staude",
    rules: [
      { key: "klipp-ned-stauder", title: "Rens jordbærbedet", description: "Fjern døde blad og gjødsle lett.", months: [4] },
      { key: "halm", title: "Legg halm under jordbærene", months: [5] },
      { key: "host-jordbaer", title: "Høst jordbær", months: [6, 7] },
      { key: "utlopere", title: "Ta utløpere til nye planter", description: "Bytt ut plantene hvert tredje år.", months: [7, 8] },
    ],
  },
  {
    key: "rhododendron",
    name: "Rhododendron",
    latinName: "Rhododendron",
    category: "busk",
    rules: [
      { key: "gjodsle-busk", title: "Gjødsle rhododendron", description: "Bruk surjordsgjødsel.", months: [5] },
      { key: "beskjar-busk-etter", title: "Knip av avblomstret", description: "Knip forsiktig så du ikke skader nye knopper.", months: [6] },
      { key: "beskjar-busk-var", title: "Vann rhododendron godt før frost", description: "Eviggrønne tørker lett ut om vinteren.", months: [10] },
    ],
  },
  {
    key: "hortensia",
    name: "Hortensia",
    latinName: "Hydrangea",
    category: "busk",
    rules: [
      {
        key: "beskjar-busk-var",
        title: "Beskjær hortensia",
        description: "Hagehortensia: fjern bare fjorårets blomster. Syrinhortensia: klipp ned til 2–3 knopper.",
        months: [4],
      },
    ],
  },
  {
    key: "syrin",
    name: "Syrin",
    latinName: "Syringa vulgaris",
    category: "busk",
    rules: [{ key: "beskjar-busk-var", title: "Beskjær syrin etter blomstring", description: "Fjern avblomstret og tynn gamle greiner i juni.", months: [6] }],
  },
  {
    key: "lavendel",
    name: "Lavendel",
    latinName: "Lavandula angustifolia",
    category: "urt",
    rules: [
      {
        key: "klipp-lavendel",
        title: "Klipp lavendelen",
        description: "Klipp en tredel i april og formklipp etter blomstring. Ikke klipp i gammel ved.",
        months: [4, 8],
      },
    ],
  },
  {
    key: "klematis",
    name: "Klematis",
    latinName: "Clematis",
    category: "klatreplante",
    rules: [],
  },
  {
    key: "pion",
    name: "Pion",
    latinName: "Paeonia",
    category: "staude",
    rules: [{ key: "stotte-stauder", title: "Sett støtte til pionene", months: [5] }],
  },
  {
    key: "hosta",
    name: "Hosta",
    latinName: "Hosta",
    category: "staude",
    rules: [{ key: "snegler", title: "Beskytt hosta mot snegler", months: [5, 6] }],
  },
  {
    key: "tulipan",
    name: "Tulipan",
    latinName: "Tulipa",
    category: "lok",
    rules: [{ key: "gjodsle-lok", title: "Fjern tulipanblomster, la bladene stå", months: [5, 6] }],
  },
  { key: "narsiss", name: "Narsiss", latinName: "Narcissus", category: "lok", rules: [] },
  {
    key: "dahlia",
    name: "Dahlia",
    latinName: "Dahlia",
    category: "lok",
    rules: [
      { key: "plant-varlok", title: "Forkultiver dahlia inne", description: "Sett knollene i potter i april.", months: [4] },
    ],
  },
  {
    key: "tomat",
    name: "Tomat",
    latinName: "Solanum lycopersicum",
    category: "gronnsak",
    rules: [
      { key: "sa-gronnsak-inne", title: "Så tomat inne", months: [3] },
      { key: "pinser", title: "Pinsér og bind opp tomatene", months: [6, 7, 8] },
    ],
  },
  {
    key: "potet",
    name: "Potet",
    latinName: "Solanum tuberosum",
    category: "gronnsak",
    rules: [
      { key: "sa-gronnsak-ute", title: "Legg poteter", months: [5] },
      { key: "host-gronnsak", title: "Ta opp poteter", months: [8, 9] },
    ],
  },
  { key: "bjork", name: "Bjørk", latinName: "Betula", category: "tre", rules: [{ key: "beskjar-tre", title: "Beskjær bjørka", description: "Bjørk blør kraftig om våren. Beskjær i august.", months: [8] }] },
  { key: "lonn", name: "Lønn", latinName: "Acer", category: "tre", rules: [{ key: "beskjar-tre", title: "Beskjær lønna", description: "Beskjær sent på sommeren, ikke om våren.", months: [8] }] },
  { key: "plen", name: "Plen", latinName: "", category: "plen", rules: [] },
];

export function findProfile(key?: string) {
  return key ? PLANT_PROFILES.find((p) => p.key === key) : undefined;
}

export function searchProfiles(query: string): PlantProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PLANT_PROFILES.filter((p) => p.name.toLowerCase().includes(q) || p.latinName.toLowerCase().includes(q)).slice(0, 6);
}

/** Bygger stell-regler for en ny plante fra profilen. */
export function rulesFromProfile(profile: PlantProfile, plantId: string, now: number, newId: () => string): CareRule[] {
  return profile.rules.map((t) => ({
    id: newId(),
    key: t.key,
    title: t.title,
    description: t.description,
    months: t.months,
    scope: "plant",
    plantId,
    source: "standard",
    enabled: true,
    createdAt: now,
  }));
}

/** Nøkkel som identifiserer en standardregel uavhengig av id. */
export function standardRuleKey(r: Pick<CareRule, "scope" | "category" | "key">): string {
  return `${r.scope}|${r.category ?? ""}|${r.key ?? ""}`;
}

/** Standardregler for kategorier og hage. Id-ene er faste, så samme regel aldri legges inn to ganger. */
export function buildStandardRules(now: number): CareRule[] {
  const rules: CareRule[] = [];
  for (const [category, templates] of Object.entries(CATEGORY_RULES) as [PlantCategory, RuleTemplate[]][]) {
    for (const t of templates) {
      rules.push({
        id: `std-${category}-${t.key}`,
        key: t.key,
        title: t.title,
        description: t.description,
        months: t.months,
        scope: "category",
        category,
        source: "standard",
        enabled: true,
        createdAt: now,
      });
    }
  }
  for (const t of GARDEN_RULES) {
    rules.push({
      id: `std-garden-${t.key}`,
      key: t.key,
      title: t.title,
      description: t.description,
      months: t.months,
      scope: "garden",
      source: "standard",
      enabled: true,
      createdAt: now,
    });
  }
  return rules;
}
