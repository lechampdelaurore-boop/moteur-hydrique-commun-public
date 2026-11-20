/**
 * Le bilan de la réserve d'une unité d'arrosage, jour après jour
 * (contrat fusionné § 2 à § 4 ; contrat Tlaloc § 3, § 4 ; partie OTF § 6).
 *
 * `suivre` enchaîne les pas de `pasDuJour` (MC-29) et y ajoute ce que le pas
 * ne fait pas :
 * - le sol du jour : RU = θu × zr, RAW = p × RU, p ajusté à la chaleur en
 *   option (MC-21), manque maximal Dmax = min(RU, plancher) (MC-02) ;
 * - la pluie utile (§ 5) et la part sous paillage plastique d'OTF ;
 * - les arrosages en intervalles, répartis au prorata à minuit et à l'heure
 *   d'une observation ;
 * - les observations : le manque que chaque logiciel tire de son affichage
 *   (% du plein chez OTF, MC-22), le test du poing (lu en fourchette ou au
 *   centre de sa classe, contrat Tlaloc § 7.1) et le tensiomètre (§ 7.3) ;
 *   chacune recale à son heure ; le jour ne compte qu'après la dernière
 *   (partie OTF § 6 point 1) ;
 * - l'incertitude du manque (§ 7.4, MC-07), dans les deux jeux (OTF ne
 *   l'affiche pas, MC-20), et la consommation apprise (§ 8, option) ;
 * - le changement de capacité : % du plein ou manque conservé (MC-11) ;
 * - le jour inconnu : l'état reste inconnu (MC-23, OTF) ou la consommation
 *   prend la moyenne des 3 dernières connues avant (MC-14, Tlaloc) ;
 * - le redémarrage par un jour d'apports qui remplissent l'unité ; son
 *   drainage compté depuis la capacité, borne basse, ou inconnu (MC-31, MC-32) ;
 * - les natures : estimé avant aujourd'hui, prévu ensuite, observé le jour
 *   d'une observation si le jeu le dit (partie OTF § 6 point 5).
 *
 * La projection n'est qu'un `suivre` sur des jours à venir : ils sont « prévu ».
 * Hors moteur (MC-18) : ETM, Kc, stades, sol de labo, racines, sol nu et
 * couverts, gel, matériel, ressource, décision et seuils (MC-03).
 *
 * Le jeu OTF reproduit la jauge d'OTF (`lib/domain/soil-reserve/gauge.ts`,
 * `bedSoilReserve`, planche cultivée) : même ordre des règles, même raison
 * d'un état inconnu. Convention : manque Dr en mm, 0 = sol plein.
 */

import {
  apportsDesArrosages, bornesDuJour, FUSEAU, mmCompte, pasDuJour,
  type Apport, type ApresApport, type Arrosage, type EntreePas,
} from './pas-horaire.ts';
import {
  CENTRE_CLASSE, CONSOMMATION_APPRISE, enPoints, estClassePoing, etatEnPoints, incertitudeMm, INCERTITUDE,
  kfApres, manqueDepuisPoints, poingFourchette, tensioVersDr, type ClassePoing,
} from './observations.ts';
import { pluieUtile, type PluieDuJour } from './pluie.ts';
import { verifierJeu, type JeuDeReglages } from './reglages.ts';

/* ------------------------------------------------------------------ */
/* Entrées                                                              */
/* ------------------------------------------------------------------ */

/** Le sol de l'unité ce jour-là (contrat Tlaloc § 3). */
export type SolDuJour = {
  /** Eau utile par mètre de sol (mm/m) ; chez OTF : RFU du sol ÷ part de référence (MC-01). */
  theta_u_mm_m: number;
  /** Profondeur des racines (m), déjà bornée par le plafond de sol. */
  zr_m: number;
  /** Part facile p (FAO-56, tableau 22) ; null : inconnue, la RAW l'est aussi. */
  p_tableau: number | null;
  /** Plancher (mm) : null (jeu Tlaloc) ou la capacité suivie, RFU de labo × profondeur (jeu OTF, MC-02). */
  plancher_mm: number | null;
};

export type JourDonnees = {
  /** Date locale AAAA-MM-JJ ; les jours se suivent sans trou. */
  date: string;
  /** Consommation de la journée (ETM, calculée hors moteur) ; null : inconnue. */
  etc_mm: number | null;
  /** Pourquoi la consommation est inconnue (repris tel quel dans la raison), par exemple « bloque ». */
  etc_raison?: string | null;
  /** null : sol ou profondeur inconnus ce jour-là. */
  sol: SolDuJour | null;
  /** Sous abri : pluie nulle, et pas lue. */
  abri: boolean;
  /** null : pluie inconnue. */
  pluie: PluieDuJour | null;
  /** OTF : part de la pluie sous paillage plastique, appliquée après la pluie utile ; 1 par défaut. */
  part_paillage?: number;
};

/** Un arrosage tel que reçu : début, fin, mm sur la surface de l'unité ; la nature (réalisé, planifié, proposé) passe telle quelle. */
export type ArrosageDuJour = Arrosage & { nature?: string };

/**
 * Une observation du terrain qui recale le manque (contrat Tlaloc § 7) :
 * - `manque` : chaque logiciel convertit depuis son affichage (OTF : manque =
 *   capacité suivie × (1 − % du plein), MC-22) ;
 * - `poing` : la classe d'une prise du test du poing (§ 7.1) ;
 * - `tensio` : la mesure d'un tensiomètre et ses deux seuils (§ 7.3, MC-35).
 * Chacune recale à son heure, dans l'ordre ; à instant égal, la dernière de
 * la liste l'emporte.
 */
export type Observation =
  | { instant: string; type: 'manque'; dr_mm: number }
  | { instant: string; type: 'poing'; classe: ClassePoing }
  | { instant: string; type: 'tensio'; kpa: number; bas_kpa: number; haut_kpa: number };

export type EntreeSuivi = {
  /** Aujourd'hui : les jours d'avant sont estimés, aujourd'hui et la suite prévus. */
  aujourdhui: string;
  jours: readonly JourDonnees[];
  /** Tous les arrosages de la période ; chacun compte dans le jour où il tombe. */
  arrosages?: readonly ArrosageDuJour[];
  observations?: readonly Observation[];
  /**
   * Le manque au début du premier jour, le Dmax auquel il se rapporte et son
   * incertitude (mm ; absente : 0,35 × RU du premier jour, § 7.4) ; absent : inconnu.
   */
  etat_initial?: { dr_mm: number; dmax_mm: number; incertitude_mm?: number | null } | null;
  /**
   * § 8 : la consommation apprise de l'unité (de 0,6 à 1,6) et l'instant du
   * relevé qui l'a fixée ; 1 et null par défaut. Sans effet si le jeu ne
   * l'apprend pas.
   */
  kf?: { valeur: number; depuis: string | null } | null;
  fuseau?: string;
};

/* ------------------------------------------------------------------ */
/* Sorties                                                              */
/* ------------------------------------------------------------------ */

export type CodeInconnu =
  | 'pas_commence' | 'etc_inconnue' | 'pluie_inconnue' | 'sol_inconnu' | 'apport_inconnu' | 'duree_bassinage_inconnue';

/** Pourquoi l'état est inconnu : le premier trou de données, daté, qui le rend inconnu jusqu'au redémarrage. */
export type RaisonInconnu = { code: CodeInconnu; date: string | null; detail?: string | null };

export type Ancrage = {
  /** L'heure de l'observation ; pour des prises du poing groupées, celle de la dernière. */
  instant: string;
  type: Observation['type'];
  /** Poing en fourchette : le nombre de prises groupées ; 1 sinon. */
  prises: number;
  /** Le manque retenu, borné à [0 ; Dmax] (poing en fourchette : l'a posteriori). */
  dr_observe_mm: number;
  /** Le manque calculé juste avant ; null si l'état d'avant était inconnu. */
  dr_calcule_mm: number | null;
  /** L'incertitude du calcul juste avant (mm) ; null : inconnue. */
  incertitude_avant_mm: number | null;
  /** L'incertitude juste après (mm) : § 7.1, § 7.3, MC-22. */
  incertitude_apres_mm: number;
};

export type JourSortie = {
  date: string;
  nature: 'estime' | 'prevu' | 'observe';
  connu: boolean;
  /** Manque au soir (mm) ; null : inconnu. */
  dr_mm: number | null;
  /** Manque au départ du calcul du jour : après un changement de capacité, ou observé. */
  dr_depart_mm: number | null;
  ru_mm: number | null;
  p: number | null;
  raw_mm: number | null;
  /** Manque maximal suivi : min(RU, plancher) ; c'est « le plein » d'OTF (MC-22). */
  dmax_mm: number | null;
  /** 100 × (1 − Dr / Dmax). */
  pct_plein: number | null;
  /** Eau au-delà de la capacité au champ (mm) ; null : inconnu (MC-32). */
  drainage_mm: number | null;
  /** Part du drainage due à l'arrosage et au bassinage. */
  eau_perdue_mm: number | null;
  drainage_pluie_mm: number | null;
  /** MC-31 : le drainage d'un jour de redémarrage est un minimum. */
  drainage_borne_basse: boolean;
  /** Pluie utile comptée (après l'heure d'une observation) ; null : inconnue. */
  pluie_mm: number | null;
  /** Arrosage compté (après l'heure d'une observation, part du bassinage court appliquée). */
  arrosage_mm: number;
  /** Consommation comptée (au prorata après une observation) ; null : inconnue. */
  etc_mm: number | null;
  /** MC-14 : consommation prise à la moyenne des 3 dernières connues. */
  etc_estimee: boolean;
  /** Part du jour comptée : 1, ou ce qui reste après l'heure d'une observation. */
  fraction: number;
  redemarrage: 'observation' | 'remplissage' | null;
  raison_inconnu: RaisonInconnu | null;
  /** Horaire : manque le plus bas de la journée (après une observation, à partir d'elle) ; journalier : null. */
  pic_mm: number | null;
  /** Horaire : le manque juste après chaque apport ; journalier : vide. */
  apres_apports: ApresApport[];
  /** § 7.4 : l'incertitude du manque au soir (mm, un écart-type) ; null si l'état est inconnu. */
  incertitude_mm: number | null;
  /** Journal des ancrages du jour, dans l'ordre (contrat Tlaloc § 3). */
  ancrages: Ancrage[];
  /** § 8 : la consommation apprise après un relevé de ce jour, à garder par l'appelant ; null : pas apprise ce jour. */
  kf_apres: { valeur: number; depuis: string } | null;
};

/* ------------------------------------------------------------------ */
/* Règles                                                               */
/* ------------------------------------------------------------------ */

/** MC-21, FAO-56 note du tableau 22. */
const P_CHALEUR = Object.freeze({ pente: 0.04, etc_reference_mm: 5, min: 0.1, max: 0.8 });
/** MC-14 : nombre de jours connus pris pour la moyenne. */
const JOURS_MOYENNE = 3;
const POURCENT = 100;
const MINUTE = 60_000;
const HEURE = 3_600_000;

const estNombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** MC-21 : part facile ajustée à la consommation du jour. */
export function pAjuste(p_tableau: number, etc_mm: number): number {
  return borne(p_tableau + P_CHALEUR.pente * (P_CHALEUR.etc_reference_mm - etc_mm), P_CHALEUR.min, P_CHALEUR.max);
}

/** MC-11 : le manque du début du jour quand le Dmax change. */
export function conserver(dr_mm: number, dmax_avant: number, dmax_apres: number, regle: JeuDeReglages['conservation']): number {
  if (dmax_avant === dmax_apres) return dr_mm;
  if (regle === 'manque') return Math.min(dr_mm, dmax_apres);
  const part = dmax_avant > 0 ? borne(dr_mm / dmax_avant, 0, 1) : 1;
  return part * dmax_apres;
}

function lendemain(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError('date attendue au format AAAA-MM-JJ');
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)).toISOString().slice(0, 10);
}

function verifierEntree(entree: EntreeSuivi): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entree.aujourdhui)) throw new RangeError('aujourdhui : AAAA-MM-JJ');
  entree.jours.forEach((j, i) => {
    if (i > 0 && j.date !== lendemain(entree.jours[i - 1].date)) throw new RangeError(`jours non consécutifs : ${entree.jours[i - 1].date} puis ${j.date}`);
    if (i === 0) lendemain(j.date);
    if (j.etc_mm !== null && (!estNombre(j.etc_mm) || j.etc_mm < 0)) throw new RangeError(`${j.date} : etc_mm null ou ≥ 0`);
    if (j.sol !== null) {
      const s = j.sol;
      if (!estNombre(s.theta_u_mm_m) || s.theta_u_mm_m <= 0) throw new RangeError(`${j.date} : theta_u_mm_m > 0`);
      if (!estNombre(s.zr_m) || s.zr_m <= 0) throw new RangeError(`${j.date} : zr_m > 0`);
      if (s.p_tableau !== null && (!estNombre(s.p_tableau) || s.p_tableau < 0 || s.p_tableau > 1)) throw new RangeError(`${j.date} : p_tableau null ou entre 0 et 1`);
      if (s.plancher_mm !== null && (!estNombre(s.plancher_mm) || s.plancher_mm <= 0)) throw new RangeError(`${j.date} : plancher_mm null ou > 0`);
    }
    if (typeof j.abri !== 'boolean') throw new RangeError(`${j.date} : abri vrai ou faux`);
    const paillage = j.part_paillage ?? 1;
    if (!estNombre(paillage) || paillage < 0 || paillage > 1) throw new RangeError(`${j.date} : part_paillage entre 0 et 1`);
  });
  for (const a of entree.arrosages ?? []) {
    if (a.mm !== null && (!estNombre(a.mm) || a.mm < 0)) throw new RangeError('arrosage : mm null ou ≥ 0');
    if (a.type !== undefined && a.type !== 'arrosage' && a.type !== 'bassinage') throw new RangeError('arrosage : type arrosage ou bassinage');
  }
  for (const o of entree.observations ?? []) {
    if (o.type !== 'manque' && o.type !== 'poing' && o.type !== 'tensio') throw new RangeError('observation : type manque, poing ou tensio');
    if (!Number.isFinite(Date.parse(o.instant))) throw new RangeError('observation : instant illisible');
    if (o.type === 'manque' && (!estNombre(o.dr_mm) || o.dr_mm < 0)) throw new RangeError('observation : dr_mm ≥ 0');
    if (o.type === 'poing' && !estClassePoing(o.classe)) throw new RangeError('observation : classe tres_sec, sec, correct, frais ou plein');
    if (o.type === 'tensio') {
      if (!estNombre(o.kpa)) throw new RangeError('observation : kpa attendu');
      if (!estNombre(o.bas_kpa) || o.bas_kpa <= 0 || !estNombre(o.haut_kpa) || o.haut_kpa <= o.bas_kpa) throw new RangeError('observation : 0 < bas_kpa < haut_kpa');
    }
  }
  const e = entree.etat_initial;
  if (e) {
    if (!estNombre(e.dr_mm) || e.dr_mm < 0) throw new RangeError('etat_initial.dr_mm ≥ 0');
    if (!estNombre(e.dmax_mm) || e.dmax_mm <= 0) throw new RangeError('etat_initial.dmax_mm > 0');
    if (e.incertitude_mm != null && (!estNombre(e.incertitude_mm) || e.incertitude_mm < 0)) throw new RangeError('etat_initial.incertitude_mm null ou ≥ 0');
  }
  const kf = entree.kf;
  if (kf) {
    const { kf_min, kf_max } = CONSOMMATION_APPRISE;
    if (!estNombre(kf.valeur) || kf.valeur < kf_min || kf.valeur > kf_max) throw new RangeError(`kf.valeur entre ${kf_min} et ${kf_max}`);
    if (kf.depuis != null && !Number.isFinite(Date.parse(kf.depuis))) throw new RangeError('kf.depuis : null ou un instant');
  }
}

/** La pluie utile du jour en apports : heures à leur heure, sinon à `f_sans_heure` ; × part sous paillage. */
function apportsDePluie(jour: JourDonnees, jeu: JeuDeReglages, debut: number, fin: number): { utile_mm: number; apports: Apport[] } | null {
  if (jour.abri) return { utile_mm: 0, apports: [] };
  if (jour.pluie === null) return null;
  const paillage = jour.part_paillage ?? 1;
  const p = pluieUtile(jour.pluie, jeu.pluie);
  const utile = p.utile_mm * paillage;
  if (jour.pluie.type !== 'heures') {
    return { utile_mm: utile, apports: utile > 0 ? [{ type: 'pluie', f: jeu.pluie.f_sans_heure, mm: utile }] : [] };
  }
  const coef = p.brute_mm > 0 ? p.utile_mm / p.brute_mm * paillage : 0;
  const apports: Apport[] = [];
  for (const h of jour.pluie.heures) {
    const t = Date.parse(h.instant);
    if (!Number.isFinite(t) || t < debut || t >= fin) throw new RangeError(`${jour.date} : heure de pluie hors du jour`);
    if (h.mm > 0) apports.push({ type: 'pluie', f: (t - debut) / (fin - debut), mm: h.mm * coef });
  }
  return { utile_mm: utile, apports };
}

type Morceau = { apports: Apport[]; pluie_mm: number };

/**
 * La pluie comptée sur une partie du jour [f0 ; f1[ : en journalier, la pluie
 * du jour au prorata de la durée (OTF : pluie × fraction) ; en horaire, les
 * apports de pluie placés dans cette partie.
 */
function pluieEntre(pluie: { utile_mm: number; apports: Apport[] }, jeu: JeuDeReglages, f0: number, f1: number): Morceau {
  if (jeu.pas === 'journalier') {
    const mm = pluie.utile_mm * (f1 - f0);
    return { apports: mm > 0 ? [{ type: 'pluie', f: f0, mm }] : [], pluie_mm: mm };
  }
  const dedans = pluie.apports.filter((a) => a.f >= f0 && (a.f < f1 || (f1 === 1 && a.f === 1)));
  return { apports: dedans, pluie_mm: dedans.reduce((s, a) => s + (a.mm ?? 0), 0) };
}

/** Un pas sur la partie [f0 ; f1] du jour : la consommation au prorata, les apports ramenés à cette partie (exact : la consommation est linéaire). */
function sousPas(dr: number, etc: number, sol: { ru: number; plancher: number | null }, apports: readonly Apport[], f0: number, f1: number, jeu: JeuDeReglages) {
  const largeur = f1 - f0;
  const ramenes: Apport[] = apports.map((a) => ({ ...a, f: largeur > 0 ? borne((a.f - f0) / largeur, 0, 1) : 0 }));
  const entree: EntreePas = { dr_veille: dr, etc: etc * largeur, ru: sol.ru, plancher: sol.plancher, apports: ramenes };
  const s = pasDuJour(entree, jeu);
  if (!s.connu) return s;
  return { ...s, apres_apports: s.apres_apports.map((a) => ({ ...a, f: f0 + a.f * largeur })) };
}

/* ------------------------------------------------------------------ */
/* Les observations qui recalent                                        */
/* ------------------------------------------------------------------ */

/** Une observation prête à recaler : un manque, une prise ou un groupe de prises du poing, une mesure du tensiomètre. */
type Candidat = { t: number; instant: string; rang: number } & (
  | { type: 'manque'; dr_mm: number }
  | { type: 'poing'; classes: ClassePoing[] }
  | { type: 'tensio'; kpa: number; bas_kpa: number; haut_kpa: number }
);

const parHeure = (a: { t: number; rang: number }, b: { t: number; rang: number }) => a.t - b.t || a.rang - b.rang;

/**
 * Les observations qui recalent, par heure (à heure égale, dans l'ordre de la liste) :
 * - poing en fourchette : les prises à moins de `regroupement_min` minutes de
 *   la première forment une seule observation, à l'heure de la dernière
 *   (§ 7.1) ; sans fourchette, chaque prise compte seule ;
 * - tensiomètre : seulement si le jeu le prend, et sans relevé de terrain
 *   (poing ou manque) dans les `releve_prioritaire_h` heures qui précèdent sa
 *   mesure (§ 7.3 : le relevé a le dernier mot).
 */
function candidatsDAncrage(observations: readonly Observation[], jeu: JeuDeReglages): Candidat[] {
  const candidats: Candidat[] = [];
  const prises: { t: number; rang: number; instant: string; classe: ClassePoing }[] = [];
  const terrain: number[] = [];
  observations.forEach((o, rang) => {
    const t = Date.parse(o.instant);
    if (o.type === 'manque') candidats.push({ t, instant: o.instant, rang, type: 'manque', dr_mm: o.dr_mm });
    if (o.type === 'poing') prises.push({ t, rang, instant: o.instant, classe: o.classe });
    if (o.type !== 'tensio') terrain.push(t);
  });
  prises.sort(parHeure);
  const fenetre = jeu.poing.fourchette ? jeu.poing.regroupement_min * MINUTE : 0;
  for (let i = 0; i < prises.length;) {
    let j = i;
    while (j + 1 < prises.length && prises[j + 1].t - prises[i].t < fenetre) j += 1;
    const derniere = prises[j];
    candidats.push({ t: derniere.t, instant: derniere.instant, rang: derniere.rang, type: 'poing', classes: prises.slice(i, j + 1).map((x) => x.classe) });
    i = j + 1;
  }
  if (jeu.tensiometre.actif) {
    const delai = jeu.tensiometre.releve_prioritaire_h * HEURE;
    observations.forEach((o, rang) => {
      if (o.type !== 'tensio') return;
      const t = Date.parse(o.instant);
      if (terrain.some((x) => t - x >= 0 && t - x < delai)) return;
      candidats.push({ t, instant: o.instant, rang, type: 'tensio', kpa: o.kpa, bas_kpa: o.bas_kpa, haut_kpa: o.haut_kpa });
    });
  }
  return candidats.sort(parHeure);
}

/**
 * Le manque retenu après une observation et son incertitude (mm) :
 * - manque : la valeur, bornée à Dmax ; incertitude 0,05 × RU (MC-22) ;
 * - tensiomètre : la conversion du § 7.3 ; incertitude 0,1 × RAW ;
 * - poing sans fourchette : le centre de la classe de la prise ; 0,15 × RU ;
 * - poing en fourchette : l'a posteriori du § 7.1, à partir du calcul juste
 *   avant et de son incertitude (a priori plat si l'un ou l'autre est inconnu).
 */
function valeurObservee(
  c: Candidat, drCalcule: number | null, sdAvant: number | null,
  sol: { ru: number; dmax: number; raw: number | null }, jeu: JeuDeReglages,
): { dr: number; sd: number; fourchette: boolean } {
  if (c.type === 'manque') return { dr: Math.min(sol.dmax, c.dr_mm), sd: INCERTITUDE.apres_manque_part_ru * sol.ru, fourchette: false };
  if (c.type === 'tensio') {
    const raw = sol.raw as number;
    return { dr: Math.min(sol.dmax, tensioVersDr(c.kpa, c.bas_kpa, c.haut_kpa, raw)), sd: INCERTITUDE.apres_tensio_part_raw * raw, fourchette: false };
  }
  if (!jeu.poing.fourchette) {
    const centre = CENTRE_CLASSE[c.classes[c.classes.length - 1]];
    return { dr: borne(manqueDepuisPoints(centre, sol.ru), 0, sol.dmax), sd: INCERTITUDE.apres_poing_centre_part_ru * sol.ru, fourchette: false };
  }
  const apriori = drCalcule === null || sdAvant === null ? null : { um: etatEnPoints(drCalcule, sol.ru), sdU: enPoints(sdAvant, sol.ru) };
  const r = poingFourchette(apriori, c.classes, jeu.poing.sigma_lecture);
  return { dr: borne(manqueDepuisPoints(r.mu, sol.ru), 0, sol.dmax), sd: r.sd / POURCENT * sol.ru, fourchette: apriori !== null };
}

/* ------------------------------------------------------------------ */
/* Le suivi jour par jour                                               */
/* ------------------------------------------------------------------ */

/**
 * De quoi dire l'incertitude (§ 7.4) : celle du dernier ancrage, l'erreur de
 * consommation et la consommation cumulées depuis (mm) ; `ancre` : l'état
 * descend d'un ancrage de cet appel (une observation ou un remplissage),
 * condition du § 8.
 */
type Suivi = { sdR: number | null; erreur: number; conso: number; ancre: boolean };
type Etat = { dr: number; dmax: number } & Suivi;

/** Le bilan d'une unité d'arrosage sur des jours consécutifs. */
export function suivre(entree: EntreeSuivi, jeu: JeuDeReglages): JourSortie[] {
  verifierJeu(jeu);
  verifierEntree(entree);
  const fuseau = entree.fuseau ?? FUSEAU;
  const arrosages = entree.arrosages ?? [];
  const candidats = candidatsDAncrage(entree.observations ?? [], jeu);
  const sorties: JourSortie[] = [];

  // § 8 : ETc utilisée = ETM × kf, le même kf sur tout l'appel (passé, aujourd'hui, projection).
  const apprend = jeu.consommation_apprise;
  const kf = apprend ? entree.kf?.valeur ?? 1 : 1;
  let kfAppris = kf;
  let kfDepuis = apprend ? entree.kf?.depuis ?? null : null;

  const e0 = entree.etat_initial;
  const sol0 = entree.jours[0]?.sol ?? null;
  let etat: Etat | null = e0
    ? {
      dr: borne(e0.dr_mm, 0, e0.dmax_mm), dmax: e0.dmax_mm,
      sdR: e0.incertitude_mm ?? (sol0 === null ? null : INCERTITUDE.depart_part_ru * sol0.theta_u_mm_m * sol0.zr_m),
      erreur: 0, conso: 0, ancre: false,
    }
    : null;
  let raison: RaisonInconnu = { code: 'pas_commence', date: null };
  const etcConnues: number[] = [];
  let prochain = 0;

  for (const jour of entree.jours) {
    const { debut, fin } = bornesDuJour(jour.date, fuseau);
    const duree = fin - debut;
    const nature: JourSortie['nature'] = jour.date < entree.aujourdhui ? 'estime' : 'prevu';

    // Le sol du jour.
    const ru = jour.sol ? jour.sol.theta_u_mm_m * jour.sol.zr_m : null;
    const plancher = jour.sol ? jour.sol.plancher_mm : null;
    const dmax = ru === null ? null : plancher === null ? ru : Math.min(ru, plancher);

    // La consommation : connue, moyenne des 3 dernières connues (MC-14), ou inconnue.
    let etc = jour.etc_mm === null ? null : jour.etc_mm * kf;
    let etc_estimee = false;
    if (etc === null && jeu.jour_inconnu === 'moyenne_3_jours' && etcConnues.length > 0) {
      const dernieres = etcConnues.slice(-JOURS_MOYENNE);
      etc = dernieres.reduce((s, x) => s + x, 0) / dernieres.length;
      etc_estimee = true;
    }
    if (jour.etc_mm !== null) etcConnues.push(jour.etc_mm * kf);

    const p = jour.sol?.p_tableau == null ? null : !jeu.p_ajuste_chaleur ? jour.sol.p_tableau : etc === null ? null : pAjuste(jour.sol.p_tableau, etc);
    const raw = p === null || ru === null ? null : p * ru;

    // Le départ : la veille, conservée au changement de Dmax (MC-11).
    const avantObservation = etat !== null && dmax !== null ? conserver(etat.dr, etat.dmax, dmax, jeu.conservation) : null;

    // Les observations du jour : chacune recale à son heure ; le jour ne compte qu'après la dernière.
    const duJour: Candidat[] = [];
    for (; prochain < candidats.length && candidats[prochain].t < fin; prochain += 1) {
      if (candidats[prochain].t >= debut) duJour.push(candidats[prochain]);
    }
    const ancres = dmax === null ? [] : duJour.filter((c) => c.type !== 'tensio' || raw !== null);
    const derniere = ancres.length > 0 ? ancres[ancres.length - 1] : null;
    const tCompte = derniere === null ? debut : derniere.t;
    const f0 = (tCompte - debut) / duree;
    const redemarrage: JourSortie['redemarrage'] = derniere === null ? null : 'observation';
    const fraction = 1 - f0;

    // Les apports comptés après le départ.
    const pluie = apportsDePluie(jour, jeu, debut, fin);
    const pluieComptee = pluie === null ? null : pluieEntre(pluie, jeu, f0, 1);
    const arr = apportsDesArrosages(arrosages, jour.date, fuseau, { depuis: tCompte });
    let manqueApport: RaisonInconnu | null = null;
    let arrosageConnu = 0;
    for (const a of arr) {
      const c = mmCompte(a, jeu);
      if ('raison' in c) manqueApport ??= { code: c.raison === 'duree_bassinage_inconnue' ? c.raison : 'apport_inconnu', date: jour.date };
      else arrosageConnu += c.mm;
    }

    const base = {
      date: jour.date, nature, ru_mm: ru, p, raw_mm: raw, dmax_mm: dmax,
      pluie_mm: pluieComptee === null ? null : pluieComptee.pluie_mm,
      arrosage_mm: arrosageConnu,
      etc_mm: etc === null ? null : etc * fraction,
      etc_estimee, fraction, apres_apports: [] as ApresApport[],
    };

    // Un trou de données, dans l'ordre d'OTF : consommation, pluie, sol ; puis un apport inconnu.
    const trou: RaisonInconnu | null = etc === null ? { code: 'etc_inconnue', date: jour.date, detail: jour.etc_raison ?? null }
      : pluie === null ? { code: 'pluie_inconnue', date: jour.date }
      : dmax === null ? { code: 'sol_inconnu', date: jour.date }
      : manqueApport;

    if (trou !== null || (avantObservation === null && derniere === null)) {
      // Inconnu : il repart à la fin d'un jour d'apports qui remplissent l'unité (MC-23, MC-32).
      const entrees = (pluieComptee?.pluie_mm ?? 0) + arrosageConnu;
      if (dmax !== null && entrees >= dmax) {
        const drainage = jeu.drainage_au_redemarrage === 'depuis_capacite' ? Math.max(0, entrees - dmax) : null;
        const total = (pluieComptee?.pluie_mm ?? 0) + arrosageConnu;
        const eau_perdue = drainage === null || pluieComptee === null ? null : total > 0 ? drainage * arrosageConnu / total : 0;
        sorties.push({
          ...base, connu: true, dr_mm: 0, dr_depart_mm: null, pct_plein: POURCENT,
          drainage_mm: drainage, eau_perdue_mm: eau_perdue,
          drainage_pluie_mm: drainage === null || eau_perdue === null ? null : drainage - eau_perdue,
          drainage_borne_basse: drainage !== null,
          redemarrage: 'remplissage', raison_inconnu: null, pic_mm: null,
          incertitude_mm: 0, ancrages: [], kf_apres: null,
        });
        // Plein le soir, quel que soit le départ : un ancrage sans incertitude.
        etat = { dr: 0, dmax, sdR: 0, erreur: 0, conso: 0, ancre: true };
        raison = { code: 'pas_commence', date: null };
        continue;
      }
      // Le trou se nomme dès qu'il y avait de quoi partir ; sinon la raison d'avant reste.
      const nommee = trou !== null && (etat !== null || duJour.length > 0) ? trou : raison;
      sorties.push({
        ...base, connu: false, dr_mm: null, dr_depart_mm: null, pct_plein: null,
        drainage_mm: null, eau_perdue_mm: null, drainage_pluie_mm: null, drainage_borne_basse: false,
        redemarrage: null, raison_inconnu: nommee, pic_mm: null,
        incertitude_mm: null, ancrages: [], kf_apres: null,
      });
      etat = null;
      raison = nommee;
      continue;
    }

    // Jour connu. Chaque observation recale à son heure, à partir du calcul
    // depuis la précédente (ou depuis le début du jour) : le journal des
    // ancrages, l'incertitude, la consommation apprise.
    const sol = { ru: ru as number, plancher };
    const etcDuJour = etc as number;
    const pluieDuJour = pluie as { utile_mm: number; apports: Apport[] };
    const coefErreur = etc_estimee ? INCERTITUDE.erreur_conso_estimee : INCERTITUDE.erreur_conso;
    let dr = avantObservation;
    let suivi: Suivi | null = etat === null ? null : { sdR: etat.sdR, erreur: etat.erreur, conso: etat.conso, ancre: etat.ancre };
    const ancrages: Ancrage[] = [];
    let kf_apres: JourSortie['kf_apres'] = null;
    let tPrec = debut;
    let fPrec = 0;
    for (const c of ancres) {
      const fc = (c.t - debut) / duree;
      let drCalcule: number | null = null;
      if (dr !== null) {
        const avant = sousPas(dr, etcDuJour, sol, [
          ...pluieEntre(pluieDuJour, jeu, fPrec, fc).apports,
          ...apportsDesArrosages(arrosages, jour.date, fuseau, { depuis: tPrec, jusqua: c.t }),
        ], fPrec, fc, jeu);
        drCalcule = avant.connu ? avant.dr : null;
      }
      const conso = etcDuJour * (fc - fPrec);
      suivi = drCalcule === null || suivi === null ? null : { ...suivi, erreur: suivi.erreur + coefErreur * conso, conso: suivi.conso + conso };
      const sdAvant = suivi === null || suivi.sdR === null ? null : incertitudeMm(suivi.sdR, suivi.erreur);
      const v = valeurObservee(c, drCalcule, sdAvant, { ru: sol.ru, dmax: dmax as number, raw }, jeu);

      // § 8 : un relevé en fourchette, postérieur au dernier qui a appris, avec un ancrage avant lui dans l'appel et plus de 2 mm consommés depuis.
      if (apprend && v.fourchette && suivi !== null && suivi.ancre && sdAvant !== null && drCalcule !== null
        && suivi.conso > CONSOMMATION_APPRISE.conso_min_mm && (kfDepuis === null || c.t > Date.parse(kfDepuis))) {
        kfAppris = kfApres(kfAppris, { dr_avant_mm: drCalcule, dr_apres_mm: v.dr, conso_mm: suivi.conso, sd_avant: sdAvant, sd_apres: v.sd });
        kfDepuis = c.instant;
        kf_apres = { valeur: kfAppris, depuis: c.instant };
      }

      ancrages.push({
        instant: c.instant, type: c.type, prises: c.type === 'poing' ? c.classes.length : 1,
        dr_observe_mm: v.dr, dr_calcule_mm: drCalcule, incertitude_avant_mm: sdAvant, incertitude_apres_mm: v.sd,
      });
      dr = v.dr;
      suivi = { sdR: v.sd, erreur: 0, conso: 0, ancre: true };
      tPrec = c.t;
      fPrec = fc;
    }

    // Le pas du jour, à partir du départ, sur la partie du jour qui compte.
    const depart = dr as number;
    const apports = [...(pluieComptee as Morceau).apports, ...arr];
    const s = sousPas(depart, etcDuJour, sol, apports, f0, 1, jeu);
    if (!s.connu) throw new Error('pas inconnu alors que ses entrées sont connues');
    const consoFin = etcDuJour * fraction;
    if (suivi !== null) suivi = { ...suivi, erreur: suivi.erreur + coefErreur * consoFin, conso: suivi.conso + consoFin };

    sorties.push({
      ...base,
      nature: jeu.nature_observee && redemarrage === 'observation' ? 'observe' : nature,
      connu: true, dr_mm: s.dr, dr_depart_mm: depart,
      pct_plein: dmax !== null && dmax > 0 ? (1 - s.dr / dmax) * POURCENT : null,
      drainage_mm: s.drainage, eau_perdue_mm: s.eau_perdue, drainage_pluie_mm: s.drainage_pluie, drainage_borne_basse: false,
      pluie_mm: s.compte.pluie, arrosage_mm: s.compte.arrosage,
      redemarrage, raison_inconnu: null, pic_mm: s.pic, apres_apports: s.apres_apports,
      incertitude_mm: suivi === null || suivi.sdR === null ? null : incertitudeMm(suivi.sdR, suivi.erreur),
      ancrages, kf_apres,
    });
    etat = { dr: s.dr, dmax: dmax as number, ...(suivi ?? { sdR: null, erreur: 0, conso: 0, ancre: false }) };
    raison = { code: 'pas_commence', date: null };
  }
  return sorties;
}
