/**
 * Le pas de calcul du bilan d'eau, une unité, un jour (MC-29).
 *
 * Module autonome, sans dépendance : ses types sont tirés du contrat
 * (`docs/contrat-moteur.md` § 3 et § 4, contrat fusionné § 3 et § 4).
 * Il sera branché ensuite à l'adaptateur OTF (réponse de François sur la
 * PR n° 6, 17/11/2026).
 *
 * Deux modes, choisis par le jeu de réglages (MC-19) :
 * - `horaire` (jeu Tlaloc, contrat Tlaloc § 4.1) : la consommation est
 *   continue entre deux apports ; à chaque apport, l'excès part sous les
 *   racines ;
 * - `journalier` (jeu OTF, contrat Tlaloc § 4.2) : tous les flux du jour
 *   additionnés, puis bornés une seule fois. Défini exactement comme la
 *   jauge d'OTF (`lib/domain/soil-reserve/gauge.ts`, `computeDay`, branche
 *   d'une planche cultivée) : le jeu journalier ne change aucun résultat
 *   d'OTF (MC-18, MC-29, critère 0,01 mm).
 *
 * Hors de ce module : la pluie utile (§ 5), les observations (§ 7),
 * l'enchaînement des jours (jour inconnu MC-14 / MC-23, redémarrage
 * MC-32, changement de capacité MC-11) et la projection. Le pas dit
 * seulement « inconnu » quand une entrée manque, jamais 0 (MC-09).
 *
 * Convention : manque Dr en mm, 0 = sol à la capacité au champ.
 */

export type Mode = 'horaire' | 'journalier';

export type TypeApport = 'pluie' | 'arrosage' | 'bassinage';

/**
 * Un apport de la journée, placé par sa fraction de journée f (0 = minuit
 * au début du jour, 1 = minuit à la fin ; contrat § 2).
 * - `pluie` : pluie utile, déjà réduite (§ 5) ;
 * - `arrosage` : mm sur la surface de l'unité ;
 * - `bassinage` : comme un arrosage, mais un bassinage court ne compte
 *   qu'en partie (MC-34). `duree_s` est sa durée.
 * `mm` nul (null) : apport inconnu.
 */
export type Apport = {
  type: TypeApport;
  f: number;
  mm: number | null;
  duree_s?: number | null;
};

export type Reglages = {
  pas: Mode;
  /** MC-34 : un bassinage de `duree_max_s` ou moins compte pour `part_comptee` de ses mm. */
  bassinage: { duree_max_s: number; part_comptee: number };
};

/** Jeu OTF : journalier, bassinage compté en entier (aucun résultat OTF ne change). */
export const JEU_OTF: Reglages = Object.freeze({
  pas: 'journalier',
  bassinage: Object.freeze({ duree_max_s: 600, part_comptee: 1 }),
}) as Reglages;

/** Jeu Tlaloc : horaire, bassinage de 10 min ou moins compté à 25 %. */
export const JEU_TLALOC: Reglages = Object.freeze({
  pas: 'horaire',
  bassinage: Object.freeze({ duree_max_s: 600, part_comptee: 0.25 }),
}) as Reglages;

export type EntreePas = {
  /** Manque à minuit au début du jour (mm) ; null : inconnu. */
  dr_veille: number | null;
  /** Consommation de la culture sur toute la journée (mm) ; null : inconnue. */
  etc: number | null;
  /** Réserve utile du jour (mm). */
  ru: number;
  /** Plancher (mm) : aucun (null, jeu Tlaloc) ou capacité suivie (jeu OTF), MC-02. */
  plancher: number | null;
  apports: readonly Apport[];
};

export type ApresApport = { f: number; type: TypeApport; mm_compte: number; dr: number };

export type RaisonInconnu = 'dr_veille_inconnu' | 'etc_inconnue' | 'apport_inconnu' | 'duree_bassinage_inconnue';

export type SortiePas =
  | {
      connu: true;
      mode: Mode;
      /** Manque au soir (mm). */
      dr: number;
      /** Horaire : le manque juste après chaque apport, dans l'ordre du jour. Journalier : vide. */
      apres_apports: ApresApport[];
      /** Horaire : manque minimal de la journée, minuit compris. Journalier : null (non défini). */
      pic: number | null;
      /** Eau au-delà de la capacité au champ (mm) : eau perdue + drainage de pluie. */
      drainage: number;
      /** Part du drainage due à l'arrosage et au bassinage (mm). La pluie seule n'en produit jamais. */
      eau_perdue: number;
      /** Part du drainage due à la pluie (mm). */
      drainage_pluie: number;
      /** Les mm qui entrent dans le calcul, après la part comptée du bassinage. */
      compte: { pluie: number; arrosage: number };
    }
  | { connu: false; mode: Mode; dr: null; raison: RaisonInconnu };

const estNombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function verifier(entree: EntreePas, reglages: Reglages): void {
  if (reglages.pas !== 'horaire' && reglages.pas !== 'journalier') throw new RangeError('pas : horaire ou journalier');
  const b = reglages.bassinage;
  if (!estNombre(b.duree_max_s) || b.duree_max_s < 0) throw new RangeError('bassinage.duree_max_s doit être ≥ 0');
  if (!estNombre(b.part_comptee) || b.part_comptee < 0 || b.part_comptee > 1) throw new RangeError('bassinage.part_comptee entre 0 et 1');
  if (!estNombre(entree.ru) || entree.ru <= 0) throw new RangeError('ru doit être > 0 mm');
  if (entree.plancher !== null && (!estNombre(entree.plancher) || entree.plancher <= 0)) throw new RangeError('plancher : null ou > 0 mm');
  if (entree.dr_veille !== null && (!estNombre(entree.dr_veille) || entree.dr_veille < 0)) throw new RangeError('dr_veille : null ou ≥ 0 mm');
  if (entree.etc !== null && (!estNombre(entree.etc) || entree.etc < 0)) throw new RangeError('etc : null ou ≥ 0 mm');
  for (const a of entree.apports) {
    if (a.type !== 'pluie' && a.type !== 'arrosage' && a.type !== 'bassinage') throw new RangeError('type d\'apport inconnu');
    if (!estNombre(a.f) || a.f < 0 || a.f > 1) throw new RangeError('f doit être entre 0 et 1');
    if (a.mm !== null && (!estNombre(a.mm) || a.mm < 0)) throw new RangeError('mm : null ou ≥ 0');
    if (a.duree_s != null && (!estNombre(a.duree_s) || a.duree_s < 0)) throw new RangeError('duree_s : null ou ≥ 0');
  }
}

/** Les mm d'un apport qui entrent dans le calcul ; null : inconnu. */
function mmCompte(a: Apport, reglages: Reglages): { mm: number } | { raison: RaisonInconnu } {
  if (a.mm === null) return { raison: 'apport_inconnu' };
  if (a.type !== 'bassinage') return { mm: a.mm };
  const { duree_max_s, part_comptee } = reglages.bassinage;
  if (part_comptee === 1) return { mm: a.mm };
  if (a.duree_s == null) return { raison: 'duree_bassinage_inconnue' };
  // MC-34 : la part non comptée n'entre pas dans la réserve, ni en drainage, ni en eau perdue.
  return { mm: a.duree_s <= duree_max_s ? a.mm * part_comptee : a.mm };
}

/** Le pas d'un jour pour une unité d'arrosage. */
export function pasDuJour(entree: EntreePas, reglages: Reglages): SortiePas {
  verifier(entree, reglages);
  const mode = reglages.pas;
  if (entree.dr_veille === null) return { connu: false, mode, dr: null, raison: 'dr_veille_inconnu' };
  if (entree.etc === null) return { connu: false, mode, dr: null, raison: 'etc_inconnue' };

  // Les apports comptés, dans l'ordre du jour ; à f égal, l'ordre reçu (tri stable).
  const apports: { f: number; type: TypeApport; mm: number }[] = [];
  for (const a of entree.apports) {
    const c = mmCompte(a, reglages);
    if ('raison' in c) return { connu: false, mode, dr: null, raison: c.raison };
    apports.push({ f: a.f, type: a.type, mm: c.mm });
  }
  apports.sort((x, y) => x.f - y.f);

  const dmax = entree.plancher === null ? entree.ru : Math.min(entree.ru, entree.plancher);
  const etc = entree.etc;
  const pluie = apports.filter((a) => a.type === 'pluie').reduce((s, a) => s + a.mm, 0);
  const arrosage = apports.filter((a) => a.type !== 'pluie').reduce((s, a) => s + a.mm, 0);

  if (mode === 'journalier') {
    // Contrat Tlaloc § 4.2 ; identique à la jauge d'OTF : état = capacité − Dr,
    // bilan = état + apports − consommation, borné à [0 ; capacité].
    const brut = entree.dr_veille + etc - pluie - arrosage;
    const drainage = Math.max(0, -brut);
    const dr = Math.min(dmax, Math.max(0, brut));
    const total = pluie + arrosage;
    const eau_perdue = total > 0 ? drainage * arrosage / total : 0;
    return {
      connu: true, mode, dr, apres_apports: [], pic: null,
      drainage, eau_perdue, drainage_pluie: drainage - eau_perdue,
      compte: { pluie, arrosage },
    };
  }

  // Contrat Tlaloc § 4.1 : consommation continue, excès à chaque apport.
  let dr = entree.dr_veille, f0 = 0, eau_perdue = 0, drainage_pluie = 0, pic = dr;
  const apres_apports: ApresApport[] = [];
  for (const a of apports) {
    dr = Math.min(dmax, dr + etc * (a.f - f0));
    f0 = a.f;
    const exces = Math.max(0, a.mm - dr);
    if (a.type === 'pluie') drainage_pluie += exces; else eau_perdue += exces;
    dr = Math.max(0, dr - a.mm);
    pic = Math.min(pic, dr);
    apres_apports.push({ f: a.f, type: a.type, mm_compte: a.mm, dr });
  }
  dr = Math.min(dmax, dr + etc * (1 - f0));
  pic = Math.min(pic, dr);
  return {
    connu: true, mode, dr, apres_apports, pic,
    drainage: eau_perdue + drainage_pluie, eau_perdue, drainage_pluie,
    compte: { pluie, arrosage },
  };
}

/* ------------------------------------------------------------------ */
/* Temps : journée civile locale de 23, 24 ou 25 h (contrat § 2).       */
/* ------------------------------------------------------------------ */

export const FUSEAU = 'Europe/Paris';

const formats = new Map<string, Intl.DateTimeFormat>();

/** L'heure murale locale d'un instant, comptée comme si elle était en UTC (ms). */
function murale(ms: number, fuseau: string): number {
  let fmt = formats.get(fuseau);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formats.set(fuseau, fmt);
  }
  const p: Record<string, number> = {};
  for (const x of fmt.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) + (ms % 1000 + 1000) % 1000;
}

function minuitLocal(date: string, fuseau: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError('date attendue au format AAAA-MM-JJ');
  const voulu = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  let t = voulu - (murale(voulu, fuseau) - voulu);
  t = voulu - (murale(t, fuseau) - t);
  return t;
}

/** Début et fin d'une journée locale, en ms depuis 1970 (UTC). */
export function bornesDuJour(date: string, fuseau: string = FUSEAU): { debut: number; fin: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError('date attendue au format AAAA-MM-JJ');
  const lendemain = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)).toISOString().slice(0, 10);
  return { debut: minuitLocal(date, fuseau), fin: minuitLocal(lendemain, fuseau) };
}

/** Fraction de journée d'un instant (ISO 8601 avec décalage), bornée à [0 ; 1]. */
export function fractionDuJour(instant: string, date: string, fuseau: string = FUSEAU): number {
  const t = Date.parse(instant);
  if (!Number.isFinite(t)) throw new RangeError('instant illisible');
  const { debut, fin } = bornesDuJour(date, fuseau);
  return Math.min(1, Math.max(0, (t - debut) / (fin - debut)));
}

/** Un arrosage tel que les logiciels le reçoivent (contrat § 3 ; OTF `IrrigationInterval`). */
export type Arrosage = { debut: string; fin: string | null; mm: number | null; type?: 'arrosage' | 'bassinage' };

/**
 * Les apports d'un jour tirés d'une liste d'arrosages.
 * - Un arrosage qui chevauche minuit est réparti au prorata de sa durée
 *   (contrat § 3 ; même règle qu'OTF `irrigationBetween`).
 * - Sa part du jour est placée à son début dans le jour (Tlaloc : l'apport
 *   compte à l'heure de début du bloc), ou à minuit s'il a commencé la veille.
 * - Sans fin, ou fin avant le début : tout l'apport à son début.
 * La durée (s) est transmise pour la règle du bassinage court (MC-34).
 */
export function apportsDesArrosages(arrosages: readonly Arrosage[], date: string, fuseau: string = FUSEAU): Apport[] {
  const { debut, fin } = bornesDuJour(date, fuseau);
  const duree = fin - debut;
  const sortie: Apport[] = [];
  for (const a of arrosages) {
    const t0 = Date.parse(a.debut);
    if (!Number.isFinite(t0)) throw new RangeError('début d\'arrosage illisible');
    const t1 = a.fin === null ? NaN : Date.parse(a.fin);
    const type = a.type ?? 'arrosage';
    if (!Number.isFinite(t1) || t1 <= t0) {
      if (t0 >= debut && t0 < fin) sortie.push({ type, f: (t0 - debut) / duree, mm: a.mm, duree_s: null });
      continue;
    }
    const recouvre = Math.min(t1, fin) - Math.max(t0, debut);
    if (recouvre <= 0) continue;
    sortie.push({
      type,
      f: (Math.max(t0, debut) - debut) / duree,
      mm: a.mm === null ? null : a.mm * recouvre / (t1 - t0),
      duree_s: (t1 - t0) / 1000,
    });
  }
  return sortie;
}
