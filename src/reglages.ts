/**
 * Les jeux de réglages complets du moteur (contrat fusionné § 3, contrat
 * Tlaloc § 9). Un jeu est un objet figé ; un logiciel qui veut changer une
 * valeur pour une ferme (par exemple la part de la pluie prévue R2 d'OTF)
 * passe une copie : `{ ...JEU_OTF, pluie: { ...JEU_OTF.pluie, part_prevue: 0.8 } }`.
 *
 * Un jeu complet contient aussi les deux réglages du pas de calcul
 * (`pas`, `bassinage`) : il se passe tel quel à `pasDuJour`.
 */

import { JEU_OTF as PAS_OTF, JEU_TLALOC as PAS_TLALOC, type Reglages } from './pas-horaire.ts';

export type ReglagesPluie = {
  /** Pluie retenue par le feuillage et la surface, une fois par jour (mm). */
  interception_mm: number;
  /** Au-delà de cette pluie horaire (mm/h), une part ruisselle ; null : aucun ruissellement. */
  seuil_ruissellement_mm_h: number | null;
  /** Part de la pluie au-delà du seuil qui ruisselle, de 0 à 1. */
  part_ruisselee: number;
  /** Part de la pluie prévue qui compte, de 0 à 1 (R2 chez OTF). */
  part_prevue: number;
  /** Règle de la pluie sûre : au moins 2 modèles, chacun d'au moins 1 mm (contrat Tlaloc § 5.2). */
  regle_pluie_sure: boolean;
  /** Fraction du jour où l'on place une pluie sans heure, en mode horaire (15 h sur 24). */
  f_sans_heure: number;
};

export type JeuDeReglages = Reglages & {
  nom: string;
  pluie: ReglagesPluie;
  /** MC-21 : p = p_tableau + 0,04 × (5 − ETc), borné de 0,1 à 0,8. */
  p_ajuste_chaleur: boolean;
  /** MC-23 (OTF) : le jour reste inconnu ; MC-14 (Tlaloc) : moyenne des 3 dernières ETc connues avant. */
  jour_inconnu: 'inconnu' | 'moyenne_3_jours';
  /** MC-32 : drainage du jour qui fait repartir une unité par remplissage ; MC-31 : c'est une borne basse. */
  drainage_au_redemarrage: 'depuis_capacite' | 'inconnu';
  /** MC-11 : au changement de capacité, garder le % du plein ou le manque en mm. */
  conservation: 'pourcent' | 'manque';
  /** Partie OTF § 6 point 5 : OTF ne dit jamais « observé » ; Tlaloc oui, le jour d'une observation. */
  nature_observee: boolean;
};

/** Pluie sans heure placée à 15 h en mode horaire (contrat Tlaloc § 4.1). */
const QUINZE_HEURES = 15 / 24;

/** Jeu OTF : reproduit la jauge d'OTF à l'identique (MC-18, MC-29). */
export const JEU_OTF: JeuDeReglages = Object.freeze({
  ...PAS_OTF,
  nom: 'OTF',
  pluie: Object.freeze({
    interception_mm: 0,
    seuil_ruissellement_mm_h: null,
    part_ruisselee: 0,
    part_prevue: 1,
    regle_pluie_sure: false,
    f_sans_heure: QUINZE_HEURES,
  }),
  p_ajuste_chaleur: false,
  jour_inconnu: 'inconnu',
  drainage_au_redemarrage: 'depuis_capacite',
  conservation: 'pourcent',
  nature_observee: false,
}) as JeuDeReglages;

/** Jeu Tlaloc (contrat Tlaloc § 9, contrat fusionné § 3). */
export const JEU_TLALOC: JeuDeReglages = Object.freeze({
  ...PAS_TLALOC,
  nom: 'Tlaloc',
  pluie: Object.freeze({
    interception_mm: 2,
    seuil_ruissellement_mm_h: 15,
    part_ruisselee: 0.5,
    part_prevue: 0.5,
    regle_pluie_sure: true,
    f_sans_heure: QUINZE_HEURES,
  }),
  p_ajuste_chaleur: true,
  jour_inconnu: 'moyenne_3_jours',
  drainage_au_redemarrage: 'inconnu',
  conservation: 'manque',
  nature_observee: true,
}) as JeuDeReglages;

const estNombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const entre = (x: unknown, a: number, b: number): boolean => estNombre(x) && x >= a && x <= b;

/** Refuse un jeu mal formé (erreur de programme, RangeError), avant tout calcul. */
export function verifierJeu(jeu: JeuDeReglages): void {
  if (jeu.pas !== 'horaire' && jeu.pas !== 'journalier') throw new RangeError('pas : horaire ou journalier');
  const b = jeu.bassinage;
  if (!b) throw new RangeError('jeu.bassinage manquant');
  if (!estNombre(b.duree_max_s) || b.duree_max_s < 0) throw new RangeError('bassinage.duree_max_s doit être ≥ 0');
  if (!entre(b.part_comptee, 0, 1)) throw new RangeError('bassinage.part_comptee entre 0 et 1');
  const p = jeu.pluie;
  if (!p) throw new RangeError('jeu.pluie manquant');
  if (!estNombre(p.interception_mm) || p.interception_mm < 0) throw new RangeError('pluie.interception_mm doit être ≥ 0');
  if (p.seuil_ruissellement_mm_h !== null && (!estNombre(p.seuil_ruissellement_mm_h) || p.seuil_ruissellement_mm_h < 0)) {
    throw new RangeError('pluie.seuil_ruissellement_mm_h : null ou ≥ 0');
  }
  if (!entre(p.part_ruisselee, 0, 1)) throw new RangeError('pluie.part_ruisselee entre 0 et 1');
  if (!entre(p.part_prevue, 0, 1)) throw new RangeError('pluie.part_prevue entre 0 et 1');
  if (typeof p.regle_pluie_sure !== 'boolean') throw new RangeError('pluie.regle_pluie_sure : vrai ou faux');
  if (!entre(p.f_sans_heure, 0, 1)) throw new RangeError('pluie.f_sans_heure entre 0 et 1');
  if (jeu.jour_inconnu !== 'inconnu' && jeu.jour_inconnu !== 'moyenne_3_jours') throw new RangeError('jour_inconnu : inconnu ou moyenne_3_jours');
  if (jeu.drainage_au_redemarrage !== 'depuis_capacite' && jeu.drainage_au_redemarrage !== 'inconnu') {
    throw new RangeError('drainage_au_redemarrage : depuis_capacite ou inconnu');
  }
  if (jeu.conservation !== 'pourcent' && jeu.conservation !== 'manque') throw new RangeError('conservation : pourcent ou manque');
  if (typeof jeu.p_ajuste_chaleur !== 'boolean') throw new RangeError('p_ajuste_chaleur : vrai ou faux');
  if (typeof jeu.nature_observee !== 'boolean') throw new RangeError('nature_observee : vrai ou faux');
}
