/* Moteur hydrique commun (OTF et Tlaloc) v0.3.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */
/**
 * Les observations de terrain de Tlaloc, l'incertitude et la consommation
 * apprise (contrat Tlaloc § 7 et § 8 ; MC-07, MC-20, MC-22, MC-35) : les
 * formules seules. Leur place dans le suivi jour par jour est dans
 * `bilan.ts`.
 *
 * Unités : un état ou une incertitude « en points » est un % de la RU
 * (0 = point de flétrissement, 100 = capacité au champ) ; en mm sinon.
 */
export type ClassePoing = 'tres_sec' | 'sec' | 'correct' | 'frais' | 'plein';
/** § 7.1 : la part de la RU (%) de chaque classe du test du poing. */
export declare const CLASSES_POING: Readonly<Record<ClassePoing, readonly [number, number]>>;
/** § 7.1 : sans l'option « fourchette », le relevé remplace le calcul par le centre de sa classe. */
export declare const CENTRE_CLASSE: Readonly<Record<ClassePoing, number>>;
export declare const estClassePoing: (x: unknown) => x is ClassePoing;
/** § 7.4 : les constantes de l'incertitude (écarts-types). */
export declare const INCERTITUDE: Readonly<{
    /** Au départ du calcul, sans incertitude donnée : 0,35 × RU. */
    depart_part_ru: 0.35;
    /** Erreur de consommation typique (erreur de Kc de ± 20 %), par mm consommé depuis le dernier ancrage. */
    erreur_conso: 0.2;
    /** Un jour dont la consommation est estimée (MC-14) : l'incertitude grandit de 0,5 × cette consommation (§ 4.4). */
    erreur_conso_estimee: 0.5;
    /** Après une observation « manque » (le % du plein d'OTF, MC-22) : 0,05 × RU. */
    apres_manque_part_ru: 0.05;
    /** Après un poing sans fourchette : 0,15 × RU. */
    apres_poing_centre_part_ru: 0.15;
    /** Après un tensiomètre : 0,1 × RAW. */
    apres_tensio_part_raw: 0.1;
}>;
/** § 8 : les constantes de la consommation apprise. */
export declare const CONSOMMATION_APPRISE: Readonly<{
    gain: 0.3;
    /** Jusqu'à cette consommation depuis l'ancrage précédent (mm), le relevé n'apprend rien. */
    conso_min_mm: 2;
    facteur_releve_min: 0.85;
    facteur_releve_max: 1.18;
    kf_min: 0.6;
    kf_max: 1.6;
}>;
/**
 * § 7.1 : le test du poing lu en fourchette. L'a priori est le calcul (état
 * `um` en points, incertitude `sdU` en points) ; `null` : calcul inconnu,
 * a priori plat. Chaque prise d'une même observation multiplie la
 * vraisemblance de sa classe, avec une erreur de lecture `sigma` (points).
 * Rend l'état a posteriori μ et son écart-type sd, en points de RU (grille
 * de 0 à 100 par pas de 0,5).
 */
export declare function poingFourchette(apriori: {
    um: number;
    sdU: number;
} | null, classes: readonly ClassePoing[], sigma: number): {
    mu: number;
    sd: number;
};
/** § 7.4 : l'incertitude (mm) : √(sdR² + E²), sdR celle du dernier ancrage, E l'erreur de consommation accumulée depuis. */
export declare function incertitudeMm(sdR_mm: number, erreur_mm: number): number;
/** Un manque ou une incertitude (mm) en points de RU, un manque en état (points), et l'inverse. */
export declare const enPoints: (mm: number, ru: number) => number;
export declare const etatEnPoints: (dr_mm: number, ru: number) => number;
export declare const manqueDepuisPoints: (points: number, ru: number) => number;
/**
 * § 8 : la consommation apprise après un relevé en fourchette. `sd_avant`
 * et `sd_apres` en points (ou tous deux en mm) ; manques et consommation
 * depuis l'ancrage précédent en mm. Jusqu'à 2 mm consommés, rien n'est
 * appris ; sans incertitude avant, le gain est nul.
 */
export declare function kfApres(kf: number, r: {
    dr_avant_mm: number;
    dr_apres_mm: number;
    conso_mm: number;
    sd_avant: number;
    sd_apres: number;
}): number;
/** § 7.3 : un tensiomètre (kPa) en manque (mm), entre son seuil bas (sol frais) et son seuil haut (à arroser). À caler (MC-35). */
export declare function tensioVersDr(kpa: number, bas_kpa: number, haut_kpa: number, raw_mm: number): number;
