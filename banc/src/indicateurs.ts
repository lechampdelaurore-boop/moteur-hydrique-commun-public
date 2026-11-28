/**
 * Indicateurs d'une parcelle rejouée par un juge (contrat du banc, § 7 bis).
 *
 * Convention de la FAO-56 : le stress commence strictement au-delà de la RAW ;
 * les comparaisons se font au centième de mm. Seuls les jours de l'année
 * (`compte`) entrent dans les comptes ; un jour sans RAW connue (aucune culture
 * en place, ou état inconnu) n'entre dans aucun compte de jours, et leurs
 * nombres sont publiés à côté.
 *
 * Pas encore ici : la stabilité des plans et l'eau non placée, qui demandent
 * l'historique des plans de chaque côté (PR « données seules » de Nicolas,
 * côté OTF du rejeu).
 */
import { pAjuste } from '../../src/moteur.ts';
import { auCentieme } from './classement.ts';
import { jourSuivant } from './dates.ts';
import type { JourJuge } from './juge.ts';

/** Un arrosage ou un bassinage du plan rejoué, sur la surface de la parcelle. */
export type ApportPlan = { date: string; mm: number; bassinage: boolean };

export type Cote = 'otf' | 'tlaloc';

/** Au-delà, le seuil d'OTF tombe à 0 et l'équivalence « Dr ≥ p × RU » ne vaut plus (§ 7 bis). */
const P_MAX_OTF = 2 / 3;
/** Le réglage « seuil » de Tlaloc : 50 % de la réserve facile. */
const PART_SEUIL_TLALOC = 0.5;
/** Le seuil commun : la moitié de la réserve facile du juge. */
const PART_SEUIL_COMMUN = 0.5;

export type IndicateursParcelle = {
  jours_comptes: number;
  jours_sans_culture: number;
  jours_etat_inconnu: number;
  eau_apportee_mm: number;
  eau_apportee_sans_bassinage_mm: number;
  eau_perdue_mm: number;
  jours_eau_perdue_inconnue: number;
  jours_seuil_propre: number;
  jours_seuil_commun: number;
  jours_stress: number;
  jours_reserve_vide: number;
  ecart_besoin_somme_mm: number;
  ecart_besoin_absolu_mm: number;
  jours_avec_arrosage: number;
  nombre_arrosages: number;
};

/**
 * Le seuil propre d'un côté, en Dr, un jour où la RAW est connue :
 *  - OTF : Dr ≥ p_tableau × RU (jauge d'OTF, mode « seuil selon la culture ») ;
 *  - Tlaloc : Dr > 0,5 × RAW du jeu Tlaloc (p ajusté à la chaleur × RU du jour).
 */
export function sousSeuilPropre(j: JourJuge, cote: Cote): boolean {
  const dr = auCentieme(j.dr_mm!);
  const ru = j.ru_mm!;
  if (cote === 'otf') {
    if (j.p_tableau > P_MAX_OTF) throw new Error(`${j.date} : p = ${j.p_tableau} > 2/3, le seuil d'OTF n'équivaut plus à Dr ≥ p × RU`);
    return dr >= auCentieme(j.p_tableau * ru);
  }
  const p = pAjuste(j.p_tableau, j.etc_mm!);
  return dr > auCentieme(PART_SEUIL_TLALOC * p * ru);
}

/** Les indicateurs d'une parcelle pour un côté et un juge. */
export function indicateurs(jours: readonly JourJuge[], apports: readonly ApportPlan[], cote: Cote): IndicateursParcelle {
  const annee = jours.filter((j) => j.compte);
  const dates = new Set(annee.map((j) => j.date));
  const duPlan = apports.filter((a) => dates.has(a.date));
  for (const a of apports) if (!(a.mm >= 0)) throw new Error(`${a.date} : apport illisible (${a.mm})`);

  const r: IndicateursParcelle = {
    jours_comptes: 0, jours_sans_culture: 0, jours_etat_inconnu: 0,
    eau_apportee_mm: duPlan.reduce((s, a) => s + a.mm, 0),
    eau_apportee_sans_bassinage_mm: duPlan.filter((a) => !a.bassinage).reduce((s, a) => s + a.mm, 0),
    eau_perdue_mm: 0, jours_eau_perdue_inconnue: 0,
    jours_seuil_propre: 0, jours_seuil_commun: 0, jours_stress: 0, jours_reserve_vide: 0,
    ecart_besoin_somme_mm: 0, ecart_besoin_absolu_mm: 0,
    jours_avec_arrosage: new Set(duPlan.map((a) => a.date)).size,
    nombre_arrosages: duPlan.length,
  };

  for (const j of annee) {
    if (j.eau_perdue_mm === null) r.jours_eau_perdue_inconnue += 1;
    else r.eau_perdue_mm += j.eau_perdue_mm;
    if (!j.raw_connue) {
      if (j.decisive === null) r.jours_sans_culture += 1;
      else r.jours_etat_inconnu += 1;
      continue;
    }
    r.jours_comptes += 1;
    const dr = auCentieme(j.dr_mm!);
    if (sousSeuilPropre(j, cote)) r.jours_seuil_propre += 1;
    if (dr > auCentieme(PART_SEUIL_COMMUN * j.raw_mm!)) r.jours_seuil_commun += 1;
    if (dr > auCentieme(j.raw_mm!)) r.jours_stress += 1;
    if (dr >= auCentieme(j.ru_mm!)) r.jours_reserve_vide += 1;
  }

  // Écart au besoin, semaine par semaine (lundi à dimanche, coupées au 1er janvier et au 31 décembre) :
  // arrosage compté par le juge − max(0, ETM − pluie utile du juge). Une semaine à un jour inconnu est sautée.
  let semaine: JourJuge[] = [];
  const fermer = () => {
    if (semaine.length > 0 && semaine.every((j) => j.etm_mm !== null && j.pluie_mm !== null)) {
      const apport = semaine.reduce((s, j) => s + j.arrosage_mm, 0);
      const besoin = Math.max(0, semaine.reduce((s, j) => s + j.etm_mm! - j.pluie_mm!, 0));
      r.ecart_besoin_somme_mm += apport - besoin;
      r.ecart_besoin_absolu_mm += Math.abs(apport - besoin);
    }
    semaine = [];
  };
  for (const j of annee) {
    semaine.push(j);
    if (new Date(`${jourSuivant(j.date)}T00:00:00Z`).getUTCDay() === 1) fermer();
  }
  fermer();

  for (const k of ['eau_apportee_mm', 'eau_apportee_sans_bassinage_mm', 'eau_perdue_mm', 'ecart_besoin_somme_mm', 'ecart_besoin_absolu_mm'] as const) {
    r[k] = auCentieme(r[k]);
  }
  return r;
}

export type IndicateursFerme = {
  surface_m2: number;
  /** Les mm pondérés par la surface : Σ(mm × m²) ÷ Σ(m²). */
  mm: Pick<IndicateursParcelle, 'eau_apportee_mm' | 'eau_apportee_sans_bassinage_mm' | 'eau_perdue_mm' | 'ecart_besoin_somme_mm' | 'ecart_besoin_absolu_mm'>;
  /** Les jours en moyenne pondérée par la surface, et le nombre de parcelles touchées (au moins un jour). */
  jours: Record<'jours_seuil_propre' | 'jours_seuil_commun' | 'jours_stress' | 'jours_reserve_vide', { moyenne: number; parcelles: number }>;
  nombre_arrosages: number;
};

/** L'échelle de la ferme (§ 7 bis) : mm et jours pondérés par la surface. */
export function indicateursFerme(parcelles: readonly { surface_m2: number; ind: IndicateursParcelle }[]): IndicateursFerme {
  const surface = parcelles.reduce((s, p) => s + p.surface_m2, 0);
  if (!(surface > 0)) throw new Error('ferme sans surface');
  const pondere = (f: (i: IndicateursParcelle) => number) => auCentieme(parcelles.reduce((s, p) => s + f(p.ind) * p.surface_m2, 0) / surface);
  const jours = (k: keyof IndicateursFerme['jours']) => ({ moyenne: pondere((i) => i[k]), parcelles: parcelles.filter((p) => p.ind[k] > 0).length });
  return {
    surface_m2: surface,
    mm: {
      eau_apportee_mm: pondere((i) => i.eau_apportee_mm),
      eau_apportee_sans_bassinage_mm: pondere((i) => i.eau_apportee_sans_bassinage_mm),
      eau_perdue_mm: pondere((i) => i.eau_perdue_mm),
      ecart_besoin_somme_mm: pondere((i) => i.ecart_besoin_somme_mm),
      ecart_besoin_absolu_mm: pondere((i) => i.ecart_besoin_absolu_mm),
    },
    jours: {
      jours_seuil_propre: jours('jours_seuil_propre'),
      jours_seuil_commun: jours('jours_seuil_commun'),
      jours_stress: jours('jours_stress'),
      jours_reserve_vide: jours('jours_reserve_vide'),
    },
    nombre_arrosages: parcelles.reduce((s, p) => s + p.ind.nombre_arrosages, 0),
  };
}
