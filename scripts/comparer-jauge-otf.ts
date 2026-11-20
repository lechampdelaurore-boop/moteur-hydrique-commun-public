/**
 * Comparaison du jeu OTF du moteur avec le vrai code de la jauge d'OTF
 * (`lib/domain/soil-reserve/gauge.ts`, `bedSoilReserve`, planche cultivée),
 * sur des suites de jours tirées au hasard : le jeu OTF ne doit changer aucun
 * résultat d'OTF (MC-18, MC-29 ; critère 0,01 mm, MC-30).
 *
 * À lancer depuis une copie du module d'OTF (dépôt public
 * `module-irrigation-otf-public`), dont il lit le code sans rien modifier :
 *
 *   cd module-irrigation-otf-public
 *   node --experimental-strip-types --no-warnings --import ./tests/support/register.mjs \
 *     ../moteur-hydrique-commun-public/scripts/comparer-jauge-otf.ts [graine] [suites]
 *
 * Variable `MOTEUR` (facultative) : un autre fichier du moteur à comparer,
 * par exemple `dist/moteur-hydrique.mjs`.
 *
 * Le script joue l'adaptateur d'OTF. Ce qui est hors moteur (MC-18) vient
 * d'OTF tel quel : l'ETM du jour, la capacité, la profondeur et p de la
 * planche, la pluie du jour et sa nature, R2, la part sous paillage, les
 * observations de la planche (converties en manque : capacité × (1 − %)).
 * Les jours sans sol de la planche (« no-soil ») restent à l'adaptateur :
 * le suivi repart de zéro après eux, comme chez OTF.
 *
 * Comparé, jour par jour : l'état, le départ, la capacité, le drainage,
 * l'eau arrosée en trop du jour (règle de `water-surplus.ts`), la pluie,
 * l'arrosage et la consommation comptés, la fraction du jour, le
 * redémarrage, la raison d'un état inconnu, la nature et le % du plein.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Le code d'OTF est chargé à l'exécution, depuis la copie du module : ses types ne sont pas connus ici. */
type Quelconque = any;

const TOLERANCE_MM = 1e-6;
const ECARTS_AFFICHES = 20;
const MINUTE_MS = 60_000;
const MINUTES_PAR_JOUR = 1440;
const DEMI_JOURNEE_MIN = 720;
const POURCENT = 100;
/** Les changements d'heure de 2026 et 2027 en Europe/Paris : des journées de 23 et 25 h. */
const CHANGEMENTS_D_HEURE = ['2026-03-29', '2026-10-25', '2027-03-28', '2027-10-31'];

const racineOtf = process.cwd();
const charger = (fichier: string): Promise<Quelconque> => import(pathToFileURL(path.join(racineOtf, fichier)).href);
const cheminMoteur = process.env.MOTEUR
  ? path.resolve(process.env.MOTEUR)
  : fileURLToPath(new URL('../src/moteur.ts', import.meta.url));

const M: typeof import('../src/moteur.ts') = await import(pathToFileURL(cheminMoteur).href);
const jauge = await charger('lib/domain/soil-reserve/gauge.ts');
const etm = await charger('lib/domain/crop-water/etm.ts');
const sols = await charger('lib/domain/soil-reserve/soil.ts');
const temps = await charger('lib/domain/water-management.ts');
const fx = await charger('tests/support/soil-reserve-fixtures.ts');

/* ------------------------------------------------------------------ */
/* Tirage                                                               */
/* ------------------------------------------------------------------ */

/** Générateur pseudo-aléatoire à graine (mulberry32) : une graine redonne les mêmes suites. */
function generateur(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tirage = {
  reel: (a: number, b: number) => number;
  entier: (a: number, b: number) => number;
  piece: (p: number) => boolean;
  choix: <T>(liste: readonly T[]) => T;
};

function tirage(r: () => number): Tirage {
  const entier = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  return {
    reel: (a, b) => a + (b - a) * r(),
    entier,
    piece: (p) => r() < p,
    choix: (liste) => liste[entier(0, liste.length - 1)],
  };
}

const plus = (date: string, jours: number): string => temps.addDaysToDateKey(date, jours);

/** Un instant tiré à la minute, de 12 h avant le premier jour à 12 h après le dernier. */
function instant(t: Tirage, premier: string, nbJours: number): number {
  const debut = jauge.dayBounds(premier).from as number;
  return debut + t.entier(-DEMI_JOURNEE_MIN, nbJours * MINUTES_PAR_JOUR + DEMI_JOURNEE_MIN) * MINUTE_MS;
}

function premierJour(t: Tirage): string {
  if (t.piece(0.35)) return plus(t.choix(CHANGEMENTS_D_HEURE), -t.entier(0, 6));
  return plus('2026-01-05', t.entier(0, 690));
}

function stades(t: Tirage): Quelconque[] {
  const profondeurs = [0.2, 0.3, 0.4, 0.5, 0.8];
  const lignes: Quelconque[] = [];
  for (const rang of [1, 2, 3]) {
    if (t.piece(0.15)) continue; // pas de ligne : celle de tous les stades, ou 30 cm proposés
    lignes.push(t.piece(0.3)
      ? fx.progressive(rang, t.choix(profondeurs), t.choix(profondeurs), t.entier(1, 20))
      : fx.fixed(rang, t.choix(profondeurs)));
  }
  if (t.piece(0.3)) lignes.push(fx.fixed(null, t.choix(profondeurs)));
  return lignes;
}

/** Une planche cultivée sur des jours consécutifs, avec tout ce qui fait varier la jauge d'OTF. */
function tirerSuite(t: Tirage): { entree: Quelconque; r2: number } {
  const premier = premierJour(t);
  const nbJours = t.entier(4, 40);
  const jours: string[] = fx.dates(premier, nbJours);
  const dernier = jours[nbJours - 1];
  const today = t.choix([premier, jours[t.entier(0, nbJours - 1)], jours[t.entier(0, nbJours - 1)], plus(dernier, 1), plus(premier, -1)]);
  const abri = t.piece(0.2);
  const bed = abri ? fx.SHELTER_BED : fx.BED;

  // Le sol : une à trois révisions ; parfois rien les premiers jours (« no-soil »).
  const soilRecords: Quelconque[] = [];
  const nbSols = t.entier(1, 3);
  for (let k = 0; k < nbSols; k += 1) {
    const effectiveFrom = k === 0
      ? (t.piece(0.15) && nbJours > 2 ? jours[t.entier(1, Math.min(5, nbJours - 1))] : plus(premier, -t.entier(0, 30)))
      : jours[t.entier(0, nbJours - 1)];
    soilRecords.push(fx.soilRecord({
      plotId: t.piece(0.25) ? bed.plotId : null,
      labRfuMmPerMeter: t.entier(20, 160),
      stoneSharePercent: t.choix([0, 0, null, t.entier(0, 50)]),
      referenceShare: t.choix([sols.SOIL_DEFAULTS.referenceShare, t.reel(0.4, 0.95)]),
      soilDepthCeilingM: t.choix([null, null, t.choix([0.2, 0.25, 0.35, 0.6, 1])]),
      effectiveFrom,
      recordedAt: `${effectiveFrom}T0${k}:00:00.000Z`,
    }));
  }

  // Les profils racinaires de deux cultures de référence, parfois révisés en cours de route.
  const profils: Quelconque[] = [];
  for (const id of ['a', 'b']) {
    profils.push(fx.profile(id, t.choix([null, 0.4, t.reel(0.2, 0.7)]), stades(t)));
    if (t.piece(0.2)) {
      const effectiveFrom = jours[t.entier(0, nbJours - 1)];
      profils.push({ ...fx.profile(id, t.choix([null, t.reel(0.2, 0.7)]), stades(t)), effectiveFrom, recordedAt: `${effectiveFrom}T09:00:00.000Z` });
    }
  }

  // Une ou deux cultures, dont le stade change à des jours tirés (la profondeur, donc la capacité, change).
  const cultures = (t.piece(0.3) ? ['a', 'b'] : [t.choix(['a', 'b'])]).map((id) => ({
    id,
    rang: t.entier(1, 3),
    debutStade: plus(premier, -t.entier(0, 25)),
    changements: new Set(Array.from({ length: t.entier(0, 2) }, () => jours[t.entier(0, nbJours - 1)])),
  }));
  // Des suites sans trou de données, d'autres avec peu ou beaucoup : des états suivis longtemps et des redémarrages.
  const trous = t.choix([0, 0.25, 1]);
  const waterDays: Quelconque[] = [];
  for (const date of jours) {
    const crops = cultures.map((c) => {
      if (c.changements.has(date)) {
        c.rang = Math.min(3, c.rang + 1);
        c.debutStade = date;
      }
      const u = t.reel(0, 1);
      if (u < 0.04 * trous) return fx.cropWithoutKc(`sans-kc-${c.id}`);
      const etmMm = u < 0.11 * trous ? null : t.choix([0, Math.round(t.reel(0, 8) * 100) / 100, t.reel(0, 12)]);
      return fx.crop({ referenceCropId: c.id, stage: fx.staged(c.rang, c.debutStade), etmMm });
    });
    const jour = fx.cropDay(date, crops);
    waterDays.push(t.piece(0.03 * trous) ? { ...jour, status: 'blocked', etmMm: null, problems: ['ET0 hors bornes'] } : jour);
  }

  // Des valeurs qui remplissent tout juste une planche : apports = capacité, l'égalité qui fait repartir.
  const pleins = soilRecords.flatMap((s) => [0.2, 0.3, 0.4, 0.5].map((d) => sols.soilRfuMmPerMeter(s.labRfuMmPerMeter, s.stoneSharePercent) * d));
  const mm = (max: number) => t.choix([0, t.reel(0, max), Math.round(t.reel(0, max) * 10) / 10, t.choix(pleins)]);

  const rain = new Map<string, Quelconque>();
  for (const date of jours) {
    if (t.piece(0.08 * trous)) continue; // pluie inconnue
    rain.set(date, { mm: t.piece(0.5) ? 0 : mm(40), nature: t.choix(['gauge', 'reanalysis', 'estimated', 'forecast']) });
  }

  const observations: Quelconque[] = [];
  for (let k = t.choix([0, 0, 1, 1, 2, 4]); k > 0; k -= 1) {
    const vers = t.piece(0.1) ? jauge.dayBounds(jours[t.entier(0, nbJours - 1)]).from as number : instant(t, premier, nbJours);
    const observedAt = new Date(vers).toISOString();
    const plotId = t.choix([bed.plotId, bed.plotId, bed.plotId, bed.plotId, bed.plotId, bed.plotId, null, null, 'autre-jardin']);
    const zoneId = t.piece(0.05) ? 'autre-parcelle' : bed.zoneId;
    const percent = t.choix([0, POURCENT, t.entier(0, POURCENT), t.reel(0, POURCENT)]);
    const recordedAt = new Date(vers + t.choix([0, 0, t.entier(1, 600)]) * MINUTE_MS).toISOString();
    observations.push({ ...fx.observation(percent, observedAt, plotId, zoneId), recordedAt });
    if (t.piece(0.15)) observations.push({ ...fx.observation(t.entier(0, POURCENT), observedAt, plotId, zoneId), recordedAt: t.choix([recordedAt, new Date(vers + t.entier(1, 600) * MINUTE_MS).toISOString()]) });
  }

  // Les arrosages : parfois exactement à l'heure d'une observation ou à minuit, les bornes du prorata.
  const reperes = [...observations.map((o) => Date.parse(o.observedAt)), ...jours.map((date) => jauge.dayBounds(date).from as number)];
  const irrigations: Quelconque[] = [];
  for (let k = t.entier(0, 8); k > 0; k -= 1) {
    const debut = t.piece(0.2) ? t.choix(reperes) : instant(t, premier, nbJours);
    const forme = t.entier(0, 9);
    const fin = forme === 0 ? debut : forme === 1 ? debut - t.entier(1, 120) * MINUTE_MS
      : debut + (forme < 6 ? t.entier(1, 120) : t.entier(2, 30) * 30) * MINUTE_MS;
    irrigations.push(fx.irrigation(new Date(debut).toISOString(), new Date(fin).toISOString(), mm(35), t.choix(['actual', 'planned', 'proposed'])));
  }

  const settings: Quelconque[] = [];
  for (let k = t.choix([0, 0, 1, 2]); k > 0; k -= 1) {
    const effectiveFrom = t.choix([plus(premier, -1), jours[t.entier(0, nbJours - 1)]]);
    settings.push({ ...fx.farmThreshold(50), plasticMulchRainShare: t.choix([1, 0.5, 0, t.reel(0, 1)]), effectiveFrom, recordedAt: `${effectiveFrom}T10:0${k}:00.000Z` });
  }
  const saison = Number(premier.slice(0, 4));
  const waterSettings = {
    bedId: bed.id, shelterId: null, shelterFactors: [],
    mulch: t.piece(0.4) ? [{ bedId: bed.id, season: t.choix([saison, saison + 1]), plasticMulch: true }] : [],
  };
  const r2 = t.choix([1, 1, 0.8, 0.5, 0, t.reel(0, 1)]);

  const entree = fx.soilInput({
    bed, today, waterDays, rain, irrigations, soilRecords, rootingProfiles: profils,
    observations, settings, waterSettings, forecastRainShare: r2,
  });
  return { entree, r2 };
}

/* ------------------------------------------------------------------ */
/* L'adaptateur d'OTF joué par le script                                */
/* ------------------------------------------------------------------ */

const RAISON_ETM: Record<string, string> = { unknown: 'missing-et0', blocked: 'blocked' };

/** Les observations de la planche (règle d'OTF `latestObservation`), triées pour qu'à instant égal la dernière enregistrée l'emporte. */
function observationsDeLaPlanche(entree: Quelconque, capaciteDuJour: Map<string, number | null>): import('../src/moteur.ts').Observation[] {
  return entree.observations
    .filter((o: Quelconque) => o.zoneId === entree.bed.zoneId && (o.plotId === null ? !entree.bed.sheltered : o.plotId === entree.bed.plotId))
    .map((o: Quelconque, rang: number) => ({ o, rang }))
    .sort((x: Quelconque, y: Quelconque) => (x.o.observedAt < y.o.observedAt ? -1 : x.o.observedAt > y.o.observedAt ? 1
      : x.o.recordedAt < y.o.recordedAt ? -1 : x.o.recordedAt > y.o.recordedAt ? 1 : x.rang - y.rang))
    .map(({ o }: Quelconque) => {
      const capacite = capaciteDuJour.get(temps.dateKeyInTimeZone(o.observedAt, temps.FARM_TIME_ZONE)) ?? null;
      const part = Math.min(1, Math.max(0, o.percent / POURCENT));
      // Sans capacité ce jour-là, l'observation ne recale rien, mais elle nomme un trou de données (règle d'OTF).
      return { instant: o.observedAt, type: 'manque' as const, dr_mm: capacite === null ? 0 : capacite * (1 - part) };
    });
}

function joursDuMoteur(entree: Quelconque, otf: Quelconque[]): (import('../src/moteur.ts').JourDonnees | null)[] {
  return entree.waterDays.map((water: Quelconque, i: number) => {
    const date: string = water.date;
    const sol = sols.resolveBedSoil(entree.soilRecords, entree.bed, date);
    if (sol === null) return null; // « no-soil » : à l'adaptateur
    const jour = otf[i];
    const capacite: number | null = jour.capacityMm;
    const pluie = entree.rain.get(date);
    const paillage = etm.plasticMulchOn(entree.waterSettings, date) ? sols.soilSettingsOn(entree.settings, date).plasticMulchRainShare : 1;
    return {
      date,
      etc_mm: water.status === 'computed' ? water.etmMm : null,
      etc_raison: water.status === 'computed' ? null : RAISON_ETM[water.status] ?? 'crop-without-etm',
      sol: capacite === null ? null : {
        theta_u_mm_m: capacite / jour.depthM / sol.record.referenceShare,
        zr_m: jour.depthM,
        p_tableau: jour.p,
        plancher_mm: capacite,
      },
      abri: entree.bed.sheltered,
      pluie: entree.bed.sheltered || !pluie ? null : pluie.nature === 'forecast' ? { type: 'prevue', mm: pluie.mm } : { type: 'jour', mm: pluie.mm },
      part_paillage: paillage,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Comparaison                                                          */
/* ------------------------------------------------------------------ */

type Ecart = { suite: number; date: string; grandeur: string; otf: unknown; moteur: unknown };

const ecarts: Ecart[] = [];
const plusGrandEcart = new Map<string, number>();
const compte = { suites: 0, jours: 0, connus: 0, inconnus: 0, remplissages: 0, observations: 0, sansSol: 0, abri: 0, prevus: 0 };

function noter(suite: number, date: string, grandeur: string, otf: unknown, moteur: unknown): void {
  ecarts.push({ suite, date, grandeur, otf, moteur });
}

function nombre(suite: number, date: string, grandeur: string, otf: number | null, moteur: number | null): void {
  if (otf === null || moteur === null) {
    if (otf !== moteur) noter(suite, date, grandeur, otf, moteur);
    return;
  }
  const ecart = Math.abs(otf - moteur);
  plusGrandEcart.set(grandeur, Math.max(plusGrandEcart.get(grandeur) ?? 0, ecart));
  if (!(ecart <= TOLERANCE_MM)) noter(suite, date, grandeur, otf, moteur);
}

function pareil(suite: number, date: string, grandeur: string, otf: unknown, moteur: unknown): void {
  if (otf !== moteur) noter(suite, date, grandeur, otf, moteur);
}

/** L'eau arrosée en trop d'un jour, comme `water-surplus.ts` la lit dans la jauge ; null : la planche est « à part ». */
function eauPerdueOtf(jour: Quelconque): number | null {
  if (jour.stateMm === null || jour.rainMm === null) return null;
  const apports = jour.rainMm + jour.irrigationMm;
  if (!(jour.drainageMm > 0) || !(jour.irrigationMm > 0) || !(apports > 0)) return 0;
  return jour.drainageMm * jour.irrigationMm / apports;
}

const RAISON_OTF: Record<string, string> = { pas_commence: 'not-started', pluie_inconnue: 'missing-rain', sol_inconnu: 'crop-without-etm' };

function comparerJour(suite: number, o: Quelconque, e: import('../src/moteur.ts').JourSortie): void {
  const d = o.date;
  pareil(suite, d, 'mode', o.mode, 'crop');
  const cap: number | null = o.capacityMm;
  nombre(suite, d, 'capacité', cap, e.dmax_mm);
  nombre(suite, d, 'état', o.stateMm, e.dr_mm === null || cap === null ? null : cap - e.dr_mm);
  nombre(suite, d, 'départ', o.startMm, e.dr_depart_mm === null || cap === null ? null : cap - e.dr_depart_mm);
  // Un jour inconnu, OTF garde un drainage de 0 ; le moteur dit « inconnu » (MC-09) et l'adaptateur rend 0.
  if (!e.connu) pareil(suite, d, 'drainage d\'un jour inconnu', e.drainage_mm, null);
  nombre(suite, d, 'drainage', o.drainageMm, e.connu ? e.drainage_mm : 0);
  nombre(suite, d, 'eau arrosée en trop', eauPerdueOtf(o), e.eau_perdue_mm);
  pareil(suite, d, 'borne basse', o.restart === 'inflow', e.drainage_borne_basse);
  nombre(suite, d, 'pluie comptée', o.rainMm, e.pluie_mm);
  nombre(suite, d, 'arrosage compté', o.irrigationMm, e.arrosage_mm);
  nombre(suite, d, 'consommation comptée', o.consumptionMm, e.etc_mm);
  nombre(suite, d, 'fraction', o.fraction, e.fraction);
  pareil(suite, d, 'redémarrage', o.restart, e.redemarrage === 'remplissage' ? 'inflow' : e.redemarrage);
  const raison = e.raison_inconnu;
  const kindMoteur = raison === null ? null : raison.code === 'etc_inconnue' ? raison.detail : RAISON_OTF[raison.code] ?? raison.code;
  pareil(suite, d, 'raison', o.unknown?.kind ?? null, kindMoteur);
  pareil(suite, d, 'date de la raison', o.unknown?.date ?? null, raison?.date ?? null);
  pareil(suite, d, 'nature', o.nature, e.nature === 'estime' ? 'estimated' : e.nature === 'prevu' ? 'forecast' : e.nature);
  nombre(suite, d, '% du plein', o.percent, e.pct_plein);
}

const graine = Number(process.argv[2] ?? 1);
const nbSuites = Number(process.argv[3] ?? 2000);
const t = tirage(generateur(graine));

for (let suite = 0; suite < nbSuites; suite += 1) {
  const { entree, r2 } = tirerSuite(t);
  const otf: Quelconque[] = jauge.bedSoilReserve(entree);
  const capaciteDuJour = new Map<string, number | null>(otf.map((j: Quelconque) => [j.date, j.capacityMm]));
  const jours = joursDuMoteur(entree, otf);
  const jeu = { ...M.JEU_OTF, pluie: { ...M.JEU_OTF.pluie, part_prevue: r2 } };
  const arrosages = entree.irrigations.map((a: Quelconque) => ({ debut: a.startAt, fin: a.endAt, mm: a.mm, nature: a.nature }));
  const observations = observationsDeLaPlanche(entree, capaciteDuJour);
  compte.suites += 1;
  if (entree.bed.sheltered) compte.abri += 1;

  // Le suivi repart de zéro après des jours sans sol, comme chez OTF : une suite par tronçon de jours avec sol.
  let i = 0;
  while (i < jours.length) {
    if (jours[i] === null) {
      pareil(suite, otf[i].date, 'jour sans sol', otf[i].unknown?.kind ?? null, 'no-soil');
      compte.sansSol += 1;
      i += 1;
      continue;
    }
    let j = i;
    while (j < jours.length && jours[j] !== null) j += 1;
    const sorties = M.suivre({
      aujourdhui: entree.today,
      jours: jours.slice(i, j) as import('../src/moteur.ts').JourDonnees[],
      arrosages,
      observations,
      etat_initial: null,
    }, jeu);
    sorties.forEach((e, k) => {
      comparerJour(suite, otf[i + k], e);
      compte.jours += 1;
      if (e.connu) compte.connus += 1; else compte.inconnus += 1;
      if (e.redemarrage === 'remplissage') compte.remplissages += 1;
      if (e.redemarrage === 'observation') compte.observations += 1;
      if (e.nature === 'prevu') compte.prevus += 1;
    });
    i = j;
  }
}

const fr = new Intl.NumberFormat('fr-FR');
console.log('Jeu OTF du moteur contre la jauge d\'OTF (bedSoilReserve, planche cultivée)');
console.log(`Moteur : ${path.relative(fileURLToPath(new URL('..', import.meta.url)), cheminMoteur)} (version ${M.VERSION_MOTEUR})`);
console.log(`Graine ${graine}, ${fr.format(compte.suites)} suites (dont ${fr.format(compte.abri)} sous abri), ${fr.format(compte.jours)} jours comparés :`
  + ` ${fr.format(compte.connus)} connus, ${fr.format(compte.inconnus)} inconnus, ${fr.format(compte.remplissages)} redémarrages par remplissage,`
  + ` ${fr.format(compte.observations)} jours d'observation, ${fr.format(compte.prevus)} jours prévus ; ${fr.format(compte.sansSol)} jours sans sol (adaptateur).`);
console.log('Plus grand écart par grandeur (mm, ou part du jour pour la fraction, % pour le % du plein) :');
for (const [grandeur, ecart] of plusGrandEcart) console.log(`  ${grandeur} : ${ecart.toExponential(1)}`);
if (ecarts.length === 0) {
  console.log(`Aucun écart (tolérance ${TOLERANCE_MM} mm, critère du contrat 0,01 mm).`);
} else {
  console.log(`${fr.format(ecarts.length)} écarts ; les ${Math.min(ECARTS_AFFICHES, ecarts.length)} premiers :`);
  for (const e of ecarts.slice(0, ECARTS_AFFICHES)) console.log(`  suite ${e.suite}, ${e.date}, ${e.grandeur} : OTF ${JSON.stringify(e.otf)}, moteur ${JSON.stringify(e.moteur)}`);
  process.exitCode = 1;
}
