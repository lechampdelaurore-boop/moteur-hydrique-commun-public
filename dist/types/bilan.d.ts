/* Moteur hydrique commun (OTF et Tlaloc) v0.2.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */
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
import { type ApresApport, type Arrosage } from './pas-horaire.js';
import { type ClassePoing } from './observations.js';
import { type PluieDuJour } from './pluie.js';
import { type JeuDeReglages } from './reglages.js';
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
export type ArrosageDuJour = Arrosage & {
    nature?: string;
};
/**
 * Une observation du terrain qui recale le manque (contrat Tlaloc § 7) :
 * - `manque` : chaque logiciel convertit depuis son affichage (OTF : manque =
 *   capacité suivie × (1 − % du plein), MC-22) ;
 * - `poing` : la classe d'une prise du test du poing (§ 7.1) ;
 * - `tensio` : la mesure d'un tensiomètre et ses deux seuils (§ 7.3, MC-35).
 * Chacune recale à son heure, dans l'ordre ; à instant égal, la dernière de
 * la liste l'emporte.
 */
export type Observation = {
    instant: string;
    type: 'manque';
    dr_mm: number;
} | {
    instant: string;
    type: 'poing';
    classe: ClassePoing;
} | {
    instant: string;
    type: 'tensio';
    kpa: number;
    bas_kpa: number;
    haut_kpa: number;
};
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
    etat_initial?: {
        dr_mm: number;
        dmax_mm: number;
        incertitude_mm?: number | null;
    } | null;
    /**
     * § 8 : la consommation apprise de l'unité (de 0,6 à 1,6) et l'instant du
     * relevé qui l'a fixée ; 1 et null par défaut. Elle vaut jusqu'au jour d'un
     * relevé de l'appel qui apprend ; le kf appris sert dès le lendemain. Sans
     * effet si le jeu ne l'apprend pas.
     */
    kf?: {
        valeur: number;
        depuis: string | null;
    } | null;
    fuseau?: string;
};
export type CodeInconnu = 'pas_commence' | 'etc_inconnue' | 'pluie_inconnue' | 'sol_inconnu' | 'apport_inconnu' | 'duree_bassinage_inconnue';
/** Pourquoi l'état est inconnu : le premier trou de données, daté, qui le rend inconnu jusqu'au redémarrage. */
export type RaisonInconnu = {
    code: CodeInconnu;
    date: string | null;
    detail?: string | null;
};
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
    /** § 8 : la consommation apprise après un relevé de ce jour, qui sert dès le lendemain dans l'appel, à garder par l'appelant ; null : pas apprise ce jour. */
    kf_apres: {
        valeur: number;
        depuis: string;
    } | null;
};
/** MC-21 : part facile ajustée à la consommation du jour. */
export declare function pAjuste(p_tableau: number, etc_mm: number): number;
/** MC-11 : le manque du début du jour quand le Dmax change. */
export declare function conserver(dr_mm: number, dmax_avant: number, dmax_apres: number, regle: JeuDeReglages['conservation']): number;
/** Le bilan d'une unité d'arrosage sur des jours consécutifs. */
export declare function suivre(entree: EntreeSuivi, jeu: JeuDeReglages): JourSortie[];
