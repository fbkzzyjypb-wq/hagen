import type { CareRule, PlantCategory } from "./types";

type RuleTemplate = {
  key: string;
  title: string;
  description?: string;
  months: number[];
  /** Se `CareRule.everyYears`. */
  everyYears?: number;
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
      description:
        "Kommer hvert tredje år ut fra plantens alder. Del hvis planten er hul i midten, blomstrer dårligere eller velter. Sommer- og høstblomstrende deles om våren når skuddene er et par cm, vårblomstrende på sensommeren. Asters, floks, rudbeckia og dagliljer trenger det oftere. Pion, julerose, stormhatt, bregner og akeleie bør stå i fred.",
      months: [4, 5, 9],
      everyYears: 3,
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

/**
 * Oppgaver som gjelder hele hagen, uavhengig av planter. Månedsoversikten er tilpasset et mildt, vindutsatt kystklima:
 * våren kommer tidlig og høsten varer lenge, men vind, regn og sen nattefrost i mai er typiske utfordringer.
 */
export const GARDEN_RULES: RuleTemplate[] = [
  // Januar
  { key: "planlegg", title: "Planlegg årets hage", description: "Bestill frø, sjekk hva som må erstattes, og lag en såplan.", months: [1] },
  { key: "redskap", title: "Rens og slip redskap", description: "Sekatør, spade og gressklipperkniv.", months: [1] },
  { key: "rist-sno", title: "Rist tung snø av busker og hekker", description: "Tung, våt snø kan knekke greiner.", months: [1] },
  {
    key: "sjekk-etter-storm",
    title: "Sjekk støtter og bindinger etter storm",
    description: "Se at vintersikring, støtter på unge trær og drivhuset har holdt seg.",
    months: [1, 12],
  },
  // Februar
  {
    key: "beskjar-eple-paere",
    title: "Beskjær eple og pære",
    description: "På frostfrie dager. Unngå plomme og kirsebær nå, de beskjæres om sommeren.",
    months: [2],
  },
  { key: "beskjar-baerbusker", title: "Beskjær bærbusker", description: "Solbær, stikkelsbær og andre bærbusker.", months: [2] },
  {
    key: "forkultiver-tidlig",
    title: "Start forkultivering inne",
    description: "Planter som trenger lang tid, som paprika, chili og selleri.",
    months: [2],
  },
  { key: "vask-drivhus-var", title: "Vask drivhuset og vinduene", description: "Slipper inn mest mulig lys.", months: [2] },
  // Mars
  { key: "sa-tomater", title: "Så tomater og drivhusplanter inne", description: "Fra midten til slutten av måneden.", months: [3] },
  { key: "klipp-ned-fjoraret", title: "Klipp ned fjorårets stauder og prydgress", months: [3] },
  { key: "rak-vinterrester", title: "Rak ut løv og vinterrester", description: "Fra bed og plen.", months: [3] },
  { key: "gjodsle-busker-var", title: "Gjødsle busker, hekker og bærbusker", description: "Når jorda begynner å tine.", months: [3] },
  { key: "vinterskader", title: "Sjekk vinterskader", description: "Se etter brekkskader, museskader og frostsprekker.", months: [3] },
  // April
  {
    key: "plant-barrot",
    title: "Plant barrotstrær, busker og hekk",
    description: "Om våren mens plantene fortsatt er i dvale, og om høsten, som går fint i den milde kysthøsten.",
    months: [4, 10],
  },
  { key: "sa-hardfore", title: "Så hardføre grønnsaker ute", description: "Erter, reddik, spinat, salat og gulrot.", months: [4] },
  { key: "settepoteter", title: "Sett ut settepoteter", description: "Mot slutten av måneden.", months: [4] },
  { key: "forste-plenklipp", title: "Første plenklipp", description: "Fjern eventuelt mose, og kalk og gjødsle plenen.", months: [4] },
  { key: "del-flytt-stauder", title: "Del og flytt stauder", description: "De som har blitt for store.", months: [4] },
  { key: "fjern-vinterdekke", title: "Fjern vinterdekke", months: [4] },
  {
    key: "kompost-var",
    title: "Legg kompost i bedene",
    description: "Et lag på 3–5 cm moden kompost rundt plantene gir næring og holder på fukten.",
    months: [4],
  },
  // Mai
  { key: "plant-tomater", title: "Plant tomater i drivhuset", description: "Når nettene holder seg over ca. 10 °C inne.", months: [5] },
  {
    key: "herd-smaplanter",
    title: "Herd av småplanter",
    description: "Gradvis før utplanting. Vent med frostømfintlige planter til etter midten av måneden.",
    months: [5],
  },
  { key: "luk", title: "Luk jevnlig", description: "Det lønner seg mens ugresset er lite.", months: [5] },
  { key: "beskjar-varblomstrende", title: "Beskjær vårblomstrende busker", description: "F.eks. forsythia, rett etter blomstring.", months: [5] },
  { key: "stotter-stauder", title: "Sett opp støtter for høye stauder", description: "Før de blir store og vinden tar dem.", months: [5] },
  // Juni
  { key: "vann-torke", title: "Vann i tørkeperioder", description: "Vann sjelden og grundig, helst morgen eller kveld.", months: [6, 7, 8] },
  { key: "tjuv-tomater", title: "Tjuv og bind opp tomater", description: "Luft drivhuset godt på varme dager.", months: [6] },
  { key: "klipp-hekk-forste", title: "Klipp hekken første gang", description: "Når vårskuddene har vokst ferdig.", months: [6] },
  { key: "dekk-jorda", title: "Dekk jorda med gressklipp eller kompost", description: "Holder på fuktigheten.", months: [6] },
  { key: "skadedyr", title: "Hold øye med skadedyr", description: "Snegler, bladlus og kålsommerfugl.", months: [6] },
  // Juli
  { key: "host-jevnlig", title: "Høst jevnlig", description: "Det gir mer avling: bær, salat, erter og squash.", months: [7] },
  { key: "beskjar-steinfrukt", title: "Beskjær plomme- og kirsebærtrær", description: "Etter høsting.", months: [7] },
  { key: "klipp-avblomstret", title: "Klipp av avblomstrede blomster", description: "Forlenger blomstringen.", months: [7] },
  { key: "sa-nye-runder", title: "Så nye runder", description: "Salat, reddik og spinat.", months: [7] },
  { key: "gjodsle-potter", title: "Gjødsle tomater og potteplanter", description: "Jevnlig, også andre planter i potter og drivhus.", months: [7] },
  // August
  { key: "ta-vare-pa-avling", title: "Høst og ta vare på avlingen", description: "Syltetøy, safting og frysing.", months: [8] },
  { key: "klipp-hekk-siste", title: "Klipp hekken en siste gang", months: [8] },
  { key: "sa-plen", title: "Så eller reparer plenen", description: "August–september er et godt tidspunkt.", months: [8] },
  { key: "stiklinger", title: "Ta stiklinger", description: "F.eks. av rips, solbær og stauder.", months: [8] },
  { key: "topp-tomater", title: "Topp tomatplantene", description: "Mot slutten av måneden, så de rekker å modne det som henger.", months: [8] },
  // September
  { key: "host-frukt-rot", title: "Høst epler, pærer og rotgrønnsaker", months: [9] },
  { key: "plant-varlok-hage", title: "Plant vårløk", description: "Tulipaner, påskeliljer og krokus.", months: [9] },
  { key: "plant-eviggronne", title: "Plant eviggrønne busker og stauder", description: "Jorda er fortsatt varm.", months: [9] },
  { key: "rydd-drivhus", title: "Rydd drivhuset", description: "Når tomatsesongen er over. Ta ut syke planterester.", months: [9] },
  { key: "fyll-kompost", title: "Start eller fyll opp kompostbingen", description: "Med løv og planterester.", months: [9] },
  { key: "tom-kompost", title: "Vend komposten", months: [5, 9] },
  // Oktober
  { key: "rak-lov", title: "Rak løv", description: "Bruk det til kompost eller som dekke i bed.", months: [10] },
  { key: "siste-plenklipp", title: "Siste plenklipp og høstgjødsling", description: "Høstgjødsle plenen med kaliumrik gjødsel.", months: [10] },
  { key: "krukker-inn", title: "Ta inn eller beskytt krukker", description: "Gjelder også andre ømfintlige planter.", months: [10] },
  {
    key: "tom-slanger",
    title: "Tøm regntønner og slanger",
    description: "Tøm og rengjør før frosten kommer, og steng utekranene.",
    months: [10],
  },
  // November
  { key: "sikre-unge-traer", title: "Stake opp og sikre unge trær", description: "Mot vinterstormer.", months: [11] },
  { key: "kompost-host", title: "Dekk bedene med løv, kompost eller bark", description: "Beskytter jord og røtter.", months: [11] },
  { key: "vask-drivhus-host", title: "Vask og desinfiser drivhuset", description: "Grundig før vinteren.", months: [11] },
  { key: "vinterlagre-redskap", title: "Rengjør og vinterlagre redskap", description: "Også gressklipperen.", months: [11] },
  { key: "vinterdekk", title: "Vinterdekk frostømfintlige planter", description: "Dekk med granbar eller fiberduk når kulda setter inn.", months: [11] },
  // Desember
  { key: "mat-fuglene", title: "Mat fuglene", description: "De hjelper deg med skadedyr til våren.", months: [12] },
  { key: "hvil-og-drom", title: "Hvil og drøm", description: "Bla i frøkataloger og noter hva som gikk bra og dårlig i år.", months: [12] },
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
    everyYears: t.everyYears,
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
        everyYears: t.everyYears,
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
