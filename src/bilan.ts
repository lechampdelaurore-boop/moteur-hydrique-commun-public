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
 * - l'observation « manque » : la valeur que chaque logiciel tire de son
 *   affichage (% du plein chez OTF, MC-22) ; le jour compte à partir de son
 *   heure (partie OTF § 6 point 1) ;
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
 * Une observation du terrain qui recale le manque. Chaque logiciel convertit
 * depuis son affichage (OTF : manque = capacité suivie × (1 − % du plein), MC-22).
 * À instant égal, la dernière de la liste l'emporte.
 */
export type Observation = { instant: string; type: 'manque'; dr_mm: number };

export type EntreeSuivi = {
  /** Aujourd'hui : les jours d'avant sont estimés, aujourd'hui et la suite prévus. */
  aujourdhui: string;
  jours: readonly JourDonnees[];
  /** Tous les arrosages de la période ; chacun compte dans le jour où il tombe. */
  arrosages?: readonly ArrosageDuJour[];
  observations?: readonly Observation[];
  /** Le manque au début du premier jour et le Dmax auquel il se rapporte ; absent : inconnu. */
  etat_initial?: { dr_mm: number; dmax_mm: number } | null;
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
  instant: string;
  /** Le manque observé, borné à [0 ; Dmax]. */
  dr_observe_mm: number;
  /** Le manque calculé juste avant ; null si l'état d'avant était inconnu. */
  dr_calcule_mm: number | null;
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
  /** Journal des ancrages (contrat Tlaloc § 3). */
  ancrage: Ancrage | null;
};

/* ------------------------------------------------------------------ */
/* Règles                                                               */
/* ------------------------------------------------------------------ */

/** MC-21, FAO-56 note du tableau 22. */
const P_CHALEUR = Object.freeze({ pente: 0.04, etc_reference_mm: 5, min: 0.1, max: 0.8 });
/** MC-14 : nombre de jours connus pris pour la moyenne. */
const JOURS_MOYENNE = 3;
const POURCENT = 100;

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
    if (o.type !== 'manque') throw new RangeError('observation : type « manque » attendu');
    if (!Number.isFinite(Date.parse(o.instant))) throw new RangeError('observation : instant illisible');
    if (!estNombre(o.dr_mm) || o.dr_mm < 0) throw new RangeError('observation : dr_mm ≥ 0');
  }
  const e = entree.etat_initial;
  if (e) {
    if (!estNombre(e.dr_mm) || e.dr_mm < 0) throw new RangeError('etat_initial.dr_mm ≥ 0');
    if (!estNombre(e.dmax_mm) || e.dmax_mm <= 0) throw new RangeError('etat_initial.dmax_mm > 0');
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
/* Le suivi jour par jour                                               */
/* ------------------------------------------------------------------ */

/** Le bilan d'une unité d'arrosage sur des jours consécutifs. */
export function suivre(entree: EntreeSuivi, jeu: JeuDeReglages): JourSortie[] {
  verifierJeu(jeu);
  verifierEntree(entree);
  const fuseau = entree.fuseau ?? FUSEAU;
  const arrosages = entree.arrosages ?? [];
  const observations = entree.observations ?? [];
  const sorties: JourSortie[] = [];

  let etat: { dr: number; dmax: number } | null = entree.etat_initial
    ? { dr: borne(entree.etat_initial.dr_mm, 0, entree.etat_initial.dmax_mm), dmax: entree.etat_initial.dmax_mm }
    : null;
  let raison: RaisonInconnu = { code: 'pas_commence', date: null };
  const etcConnues: number[] = [];

  for (const jour of entree.jours) {
    const { debut, fin } = bornesDuJour(jour.date, fuseau);
    const nature: JourSortie['nature'] = jour.date < entree.aujourdhui ? 'estime' : 'prevu';

    // Le sol du jour.
    const ru = jour.sol ? jour.sol.theta_u_mm_m * jour.sol.zr_m : null;
    const plancher = jour.sol ? jour.sol.plancher_mm : null;
    const dmax = ru === null ? null : plancher === null ? ru : Math.min(ru, plancher);

    // La consommation : connue, moyenne des 3 dernières connues (MC-14), ou inconnue.
    let etc = jour.etc_mm;
    let etc_estimee = false;
    if (etc === null && jeu.jour_inconnu === 'moyenne_3_jours' && etcConnues.length > 0) {
      const dernieres = etcConnues.slice(-JOURS_MOYENNE);
      etc = dernieres.reduce((s, x) => s + x, 0) / dernieres.length;
      etc_estimee = true;
    }
    if (jour.etc_mm !== null) etcConnues.push(jour.etc_mm);

    const p = jour.sol?.p_tableau == null ? null : !jeu.p_ajuste_chaleur ? jour.sol.p_tableau : etc === null ? null : pAjuste(jour.sol.p_tableau, etc);
    const raw = p === null || ru === null ? null : p * ru;

    // Le départ : la veille, conservée au changement de Dmax (MC-11).
    const avantObservation = etat !== null && dmax !== null ? conserver(etat.dr, etat.dmax, dmax, jeu.conservation) : null;
    let depart = avantObservation;

    // L'observation du jour : la plus récente ; le jour ne compte qu'après elle.
    let obs: Observation | null = null;
    for (const o of observations) {
      const t = Date.parse(o.instant);
      if (t < debut || t >= fin) continue;
      if (obs === null || t >= Date.parse(obs.instant)) obs = o;
    }
    let f0 = 0;
    let redemarrage: JourSortie['redemarrage'] = null;
    let tCompte = debut;
    if (obs !== null && dmax !== null) {
      tCompte = Date.parse(obs.instant);
      f0 = (tCompte - debut) / (fin - debut);
      depart = Math.min(dmax, obs.dr_mm);
      redemarrage = 'observation';
    }
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

    if (trou !== null || depart === null) {
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
          redemarrage: 'remplissage', raison_inconnu: null, pic_mm: null, ancrage: null,
        });
        etat = { dr: 0, dmax };
        raison = { code: 'pas_commence', date: null };
        continue;
      }
      // Le trou se nomme dès qu'il y avait de quoi partir ; sinon la raison d'avant reste.
      const nommee = trou !== null && (depart !== null || etat !== null || obs !== null) ? trou : raison;
      sorties.push({
        ...base, connu: false, dr_mm: null, dr_depart_mm: null, pct_plein: null,
        drainage_mm: null, eau_perdue_mm: null, drainage_pluie_mm: null, drainage_borne_basse: false,
        redemarrage: null, raison_inconnu: nommee, pic_mm: null, ancrage: null,
      });
      etat = null;
      raison = nommee;
      continue;
    }

    // Jour connu : le pas, à partir du départ, sur la partie du jour qui compte.
    const sol = { ru: ru as number, plancher };
    const apports = [...(pluieComptee as Morceau).apports, ...arr];
    const s = sousPas(depart, etc as number, sol, apports, f0, 1, jeu);
    if (!s.connu) throw new Error('pas inconnu alors que ses entrées sont connues');

    let ancrage: Ancrage | null = null;
    if (redemarrage === 'observation' && obs !== null) {
      let dr_calcule: number | null = null;
      if (avantObservation !== null && f0 > 0) {
        const avant = sousPas(avantObservation, etc as number, sol, [
          ...pluieEntre(pluie as { utile_mm: number; apports: Apport[] }, jeu, 0, f0).apports,
          ...apportsDesArrosages(arrosages, jour.date, fuseau, { jusqua: tCompte }),
        ], 0, f0, jeu);
        dr_calcule = avant.connu ? avant.dr : null;
      } else if (avantObservation !== null) {
        dr_calcule = avantObservation;
      }
      ancrage = { instant: obs.instant, dr_observe_mm: depart, dr_calcule_mm: dr_calcule };
    }

    sorties.push({
      ...base,
      nature: jeu.nature_observee && redemarrage === 'observation' ? 'observe' : nature,
      connu: true, dr_mm: s.dr, dr_depart_mm: depart,
      pct_plein: dmax !== null && dmax > 0 ? (1 - s.dr / dmax) * POURCENT : null,
      drainage_mm: s.drainage, eau_perdue_mm: s.eau_perdue, drainage_pluie_mm: s.drainage_pluie, drainage_borne_basse: false,
      pluie_mm: s.compte.pluie, arrosage_mm: s.compte.arrosage,
      redemarrage, raison_inconnu: null, pic_mm: s.pic, apres_apports: s.apres_apports, ancrage,
    });
    etat = { dr: s.dr, dmax: dmax as number };
    raison = { code: 'pas_commence', date: null };
  }
  return sorties;
}
