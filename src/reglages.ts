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
  /**
   * Une pluie sans heure (un total du jour) ruisselle comme une seule heure de
   * pluie, celle de `f_sans_heure`, comme Tlaloc aujourd'hui (choix 1, tranché
   * par Nicolas sur la PR n° 11) ; sinon, pas de ruissellement, l'interception
   * seule.
   */
  ruissellement_sans_heure: boolean;
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
  /**
   * Contrat Tlaloc § 7.1 : le test du poing lu en fourchette (σ, erreur de
   * lecture en points de RU ; prises à moins de `regroupement_min` minutes de
   * la première, groupées) ; sans fourchette, le centre de la classe.
   */
  poing: ReglagesPoing;
  /** § 7.3 (MC-35) : le tensiomètre recale l'état, sauf s'il y a un relevé de terrain depuis moins de `releve_prioritaire_h` heures. */
  tensiometre: ReglagesTensiometre;
  /** § 8 : la consommation apprise (kf). */
  consommation_apprise: boolean;
};

export type ReglagesPoing = { fourchette: boolean; sigma_lecture: number; regroupement_min: number };
export type ReglagesTensiometre = { actif: boolean; releve_prioritaire_h: number };

/** Pluie sans heure placée à 15 h en mode horaire (contrat Tlaloc § 4.1). */
const QUINZE_HEURES = 15 / 24;
/** § 7.1 : erreur de lecture du poing (points de RU) et regroupement des prises (minutes). */
const SIGMA_POING = 8;
const PRISES_MIN = 60;
/** § 7.3 : le relevé de terrain a le dernier mot pendant 48 h. */
const RELEVE_PRIORITAIRE_H = 48;

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
    // Sans effet : aucun ruissellement chez OTF.
    ruissellement_sans_heure: false,
  }),
  p_ajuste_chaleur: false,
  jour_inconnu: 'inconnu',
  drainage_au_redemarrage: 'depuis_capacite',
  conservation: 'pourcent',
  nature_observee: false,
  // MC-20 : aucune option de Tlaloc chez OTF.
  poing: Object.freeze({ fourchette: false, sigma_lecture: SIGMA_POING, regroupement_min: PRISES_MIN }),
  tensiometre: Object.freeze({ actif: false, releve_prioritaire_h: RELEVE_PRIORITAIRE_H }),
  consommation_apprise: false,
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
    ruissellement_sans_heure: true,
  }),
  p_ajuste_chaleur: true,
  jour_inconnu: 'moyenne_3_jours',
  drainage_au_redemarrage: 'inconnu',
  conservation: 'manque',
  nature_observee: true,
  poing: Object.freeze({ fourchette: true, sigma_lecture: SIGMA_POING, regroupement_min: PRISES_MIN }),
  tensiometre: Object.freeze({ actif: true, releve_prioritaire_h: RELEVE_PRIORITAIRE_H }),
  consommation_apprise: true,
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
  if (typeof p.ruissellement_sans_heure !== 'boolean') throw new RangeError('pluie.ruissellement_sans_heure : vrai ou faux');
  if (jeu.jour_inconnu !== 'inconnu' && jeu.jour_inconnu !== 'moyenne_3_jours') throw new RangeError('jour_inconnu : inconnu ou moyenne_3_jours');
  if (jeu.drainage_au_redemarrage !== 'depuis_capacite' && jeu.drainage_au_redemarrage !== 'inconnu') {
    throw new RangeError('drainage_au_redemarrage : depuis_capacite ou inconnu');
  }
  if (jeu.conservation !== 'pourcent' && jeu.conservation !== 'manque') throw new RangeError('conservation : pourcent ou manque');
  if (typeof jeu.p_ajuste_chaleur !== 'boolean') throw new RangeError('p_ajuste_chaleur : vrai ou faux');
  if (typeof jeu.nature_observee !== 'boolean') throw new RangeError('nature_observee : vrai ou faux');
  const q = jeu.poing;
  if (!q) throw new RangeError('jeu.poing manquant');
  if (typeof q.fourchette !== 'boolean') throw new RangeError('poing.fourchette : vrai ou faux');
  if (!estNombre(q.sigma_lecture) || q.sigma_lecture <= 0) throw new RangeError('poing.sigma_lecture doit être > 0');
  if (!estNombre(q.regroupement_min) || q.regroupement_min < 0) throw new RangeError('poing.regroupement_min doit être ≥ 0');
  const t = jeu.tensiometre;
  if (!t) throw new RangeError('jeu.tensiometre manquant');
  if (typeof t.actif !== 'boolean') throw new RangeError('tensiometre.actif : vrai ou faux');
  if (!estNombre(t.releve_prioritaire_h) || t.releve_prioritaire_h < 0) throw new RangeError('tensiometre.releve_prioritaire_h doit être ≥ 0');
  if (typeof jeu.consommation_apprise !== 'boolean') throw new RangeError('consommation_apprise : vrai ou faux');
}
