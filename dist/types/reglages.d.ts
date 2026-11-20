/* Moteur hydrique commun (OTF et Tlaloc) v0.3.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */
/**
 * Les jeux de réglages complets du moteur (contrat fusionné § 3, contrat
 * Tlaloc § 9). Un jeu est un objet figé ; un logiciel qui veut changer une
 * valeur pour une ferme (par exemple la part de la pluie prévue R2 d'OTF)
 * passe une copie : `{ ...JEU_OTF, pluie: { ...JEU_OTF.pluie, part_prevue: 0.8 } }`.
 *
 * Un jeu complet contient aussi les deux réglages du pas de calcul
 * (`pas`, `bassinage`) : il se passe tel quel à `pasDuJour`.
 */
import { type Reglages } from './pas-horaire.js';
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
export type ReglagesPoing = {
    fourchette: boolean;
    sigma_lecture: number;
    regroupement_min: number;
};
export type ReglagesTensiometre = {
    actif: boolean;
    releve_prioritaire_h: number;
};
/** Jeu OTF : reproduit la jauge d'OTF à l'identique (MC-18, MC-29). */
export declare const JEU_OTF: JeuDeReglages;
/** Jeu Tlaloc (contrat Tlaloc § 9, contrat fusionné § 3). */
export declare const JEU_TLALOC: JeuDeReglages;
/** Refuse un jeu mal formé (erreur de programme, RangeError), avant tout calcul. */
export declare function verifierJeu(jeu: JeuDeReglages): void;
