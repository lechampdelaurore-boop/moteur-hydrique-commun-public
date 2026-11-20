/* Moteur hydrique commun (OTF et Tlaloc) v0.3.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */
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
    bassinage: {
        duree_max_s: number;
        part_comptee: number;
    };
};
/** Jeu OTF : journalier, bassinage compté en entier (aucun résultat OTF ne change). */
export declare const JEU_OTF: Reglages;
/** Jeu Tlaloc : horaire, bassinage de 10 min ou moins compté à 25 %. */
export declare const JEU_TLALOC: Reglages;
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
export type ApresApport = {
    f: number;
    type: TypeApport;
    mm_compte: number;
    dr: number;
};
export type RaisonInconnu = 'dr_veille_inconnu' | 'etc_inconnue' | 'apport_inconnu' | 'duree_bassinage_inconnue';
export type SortiePas = {
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
    compte: {
        pluie: number;
        arrosage: number;
    };
} | {
    connu: false;
    mode: Mode;
    dr: null;
    raison: RaisonInconnu;
};
/** Les mm d'un apport qui entrent dans le calcul ; null : inconnu. */
export declare function mmCompte(a: Apport, reglages: Reglages): {
    mm: number;
} | {
    raison: RaisonInconnu;
};
/** Le pas d'un jour pour une unité d'arrosage. */
export declare function pasDuJour(entree: EntreePas, reglages: Reglages): SortiePas;
export declare const FUSEAU = "Europe/Paris";
/** Début et fin d'une journée locale, en ms depuis 1970 (UTC). */
export declare function bornesDuJour(date: string, fuseau?: string): {
    debut: number;
    fin: number;
};
/** Fraction de journée d'un instant (ISO 8601 avec décalage), bornée à [0 ; 1]. */
export declare function fractionDuJour(instant: string, date: string, fuseau?: string): number;
/** Un arrosage tel que les logiciels le reçoivent (contrat § 3 ; OTF `IrrigationInterval`). */
export type Arrosage = {
    debut: string;
    fin: string | null;
    mm: number | null;
    type?: 'arrosage' | 'bassinage';
};
/**
 * Les apports d'un jour tirés d'une liste d'arrosages.
 * - Un arrosage qui chevauche minuit est réparti au prorata de sa durée
 *   (contrat § 3 ; même règle qu'OTF `irrigationBetween`).
 * - Sa part du jour est placée à son début dans le jour (Tlaloc : l'apport
 *   compte à l'heure de début du bloc), ou à minuit s'il a commencé la veille.
 * - Sans fin, ou fin avant le début : tout l'apport à son début.
 * La durée (s) est transmise pour la règle du bassinage court (MC-34).
 *
 * `entre` (instants en ms, facultatif) restreint la part comptée à une
 * partie du jour, par exemple après l'heure d'une observation (partie OTF
 * § 6 point 1 ; OTF `irrigationBetween(…, heure d'observation, fin du jour)`) :
 * même prorata, part placée à son début ou à `depuis`.
 */
export declare function apportsDesArrosages(arrosages: readonly Arrosage[], date: string, fuseau?: string, entre?: {
    depuis?: number;
    jusqua?: number;
}): Apport[];
