/**
 * La pluie utile (contrat Tlaloc § 5, MC-05 ; partie OTF § 2 et § 6 point 6).
 *
 * Trois formes de pluie pour un jour :
 * - `heures` : mesurée heure par heure (Tlaloc) ; le ruissellement se compte
 *   heure par heure, l'interception une fois par jour, et le rapport
 *   pluie utile / pluie brute s'applique à chaque heure (§ 5.1) ;
 * - `jour` : un total du jour sans heure (pluviomètre, réanalyse, prévision
 *   enregistrée d'un jour passé chez OTF) ; il ruisselle comme une seule heure
 *   de pluie si le jeu le dit (`ruissellement_sans_heure`, comme Tlaloc),
 *   sinon seule l'interception est retirée ;
 * - `prevue` : la prévision ; part prévue (R2 chez OTF) puis interception,
 *   et la règle de la pluie sûre si le jeu l'active (§ 5.2).
 *
 * Sous abri, la pluie vaut 0 et n'est pas lue (le moteur ne la demande pas).
 * La part sous paillage plastique d'OTF multiplie la pluie utile (partie
 * OTF § 2), dans `bilan.ts`.
 */

import type { ReglagesPluie } from './reglages.ts';

export type PluieDuJour =
  | { type: 'heures'; heures: readonly { instant: string; mm: number }[]; source?: string }
  | { type: 'jour'; mm: number; source?: string }
  | { type: 'prevue'; mm: number; modeles?: readonly number[] | null; source?: string };

export type PluieUtile = {
  /** Pluie brute (mm). */
  brute_mm: number;
  ruissellement_mm: number;
  /** Interception retirée ce jour-là (mm), au plus la pluie restante. */
  interception_mm: number;
  /** Pluie qui entre dans la réserve (mm). */
  utile_mm: number;
};

/** Règle de la pluie sûre (contrat Tlaloc § 5.2) : au moins 2 modèles, chacun d'au moins 1 mm ; Pe ≥ 0,8 × le plus faible − 1. */
const PLUIE_SURE = Object.freeze({ modeles_min: 2, mm_min_par_modele: 1, part_du_plus_faible: 0.8, retrait_mm: 1 });

const estNombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function verifierMm(mm: number, quoi: string): void {
  if (!estNombre(mm) || mm < 0) throw new RangeError(`${quoi} : mm ≥ 0 attendus`);
}

function retirerInterception(brute: number, ruissellement: number, r: ReglagesPluie): PluieUtile {
  const reste = Math.max(0, brute - ruissellement);
  const interception = Math.min(r.interception_mm, reste);
  return { brute_mm: brute, ruissellement_mm: ruissellement, interception_mm: interception, utile_mm: reste - interception };
}

/** § 5.1 : pluie mesurée heure par heure. */
export function pluieUtileMesuree(heures_mm: readonly number[], r: ReglagesPluie): PluieUtile {
  for (const h of heures_mm) verifierMm(h, 'pluie horaire');
  const brute = heures_mm.reduce((s, h) => s + h, 0);
  if (brute <= 0) return { brute_mm: 0, ruissellement_mm: 0, interception_mm: 0, utile_mm: 0 };
  const seuil = r.seuil_ruissellement_mm_h;
  const ruissellement = seuil === null ? 0 : heures_mm.reduce((s, h) => s + Math.max(0, h - seuil) * r.part_ruisselee, 0);
  return retirerInterception(brute, ruissellement, r);
}

/**
 * Total du jour sans heure : comme une seule heure de pluie si le jeu le dit
 * (`ruissellement_sans_heure`, choix 1, comme Tlaloc) ; sinon pas de
 * ruissellement (il se compte heure par heure), l'interception seule.
 */
export function pluieUtileDuJour(mm: number, r: ReglagesPluie): PluieUtile {
  verifierMm(mm, 'pluie du jour');
  if (mm <= 0) return { brute_mm: 0, ruissellement_mm: 0, interception_mm: 0, utile_mm: 0 };
  if (r.ruissellement_sans_heure) return pluieUtileMesuree([mm], r);
  return retirerInterception(mm, 0, r);
}

/** § 5.2 : pluie prévue, avec la règle de la pluie sûre si le jeu l'active. */
export function pluieUtilePrevue(prevue_mm: number, modeles: readonly number[] | null | undefined, r: ReglagesPluie): PluieUtile & { sure: boolean } {
  verifierMm(prevue_mm, 'pluie prévue');
  for (const m of modeles ?? []) verifierMm(m, 'pluie d\'un modèle');
  const base = Math.max(0, prevue_mm * r.part_prevue - r.interception_mm);
  const sure = r.regle_pluie_sure && !!modeles && modeles.length >= PLUIE_SURE.modeles_min
    && modeles.every((m) => m >= PLUIE_SURE.mm_min_par_modele);
  const utile = sure ? Math.max(base, PLUIE_SURE.part_du_plus_faible * Math.min(...modeles) - PLUIE_SURE.retrait_mm) : base;
  const comptee = prevue_mm * r.part_prevue;
  return {
    brute_mm: prevue_mm,
    ruissellement_mm: 0,
    interception_mm: Math.min(r.interception_mm, comptee),
    utile_mm: utile,
    sure,
  };
}

/** La pluie utile d'un jour, quelle que soit sa forme. */
export function pluieUtile(pluie: PluieDuJour, r: ReglagesPluie): PluieUtile {
  if (pluie.type === 'heures') return pluieUtileMesuree(pluie.heures.map((h) => h.mm), r);
  if (pluie.type === 'jour') return pluieUtileDuJour(pluie.mm, r);
  if (pluie.type === 'prevue') return pluieUtilePrevue(pluie.mm, pluie.modeles, r);
  throw new RangeError('type de pluie : heures, jour ou prevue');
}
