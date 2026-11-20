/* Moteur hydrique commun (OTF et Tlaloc) v0.2.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */
/**
 * La pluie utile (contrat Tlaloc § 5, MC-05 ; partie OTF § 2 et § 6 point 6).
 *
 * Trois formes de pluie pour un jour :
 * - `heures` : mesurée heure par heure (Tlaloc) ; le ruissellement se compte
 *   heure par heure, l'interception une fois par jour, et le rapport
 *   pluie utile / pluie brute s'applique à chaque heure (§ 5.1) ;
 * - `jour` : un total du jour sans heure (pluviomètre, réanalyse, prévision
 *   enregistrée d'un jour passé chez OTF) ; sans heures, pas de
 *   ruissellement : seule l'interception est retirée ;
 * - `prevue` : la prévision ; part prévue (R2 chez OTF) puis interception,
 *   et la règle de la pluie sûre si le jeu l'active (§ 5.2).
 *
 * Sous abri, la pluie vaut 0 et n'est pas lue (le moteur ne la demande pas).
 * La part sous paillage plastique d'OTF multiplie la pluie utile (partie
 * OTF § 2), dans `bilan.ts`.
 */
import type { ReglagesPluie } from './reglages.js';
export type PluieDuJour = {
    type: 'heures';
    heures: readonly {
        instant: string;
        mm: number;
    }[];
    source?: string;
} | {
    type: 'jour';
    mm: number;
    source?: string;
} | {
    type: 'prevue';
    mm: number;
    modeles?: readonly number[] | null;
    source?: string;
};
export type PluieUtile = {
    /** Pluie brute (mm). */
    brute_mm: number;
    ruissellement_mm: number;
    /** Interception retirée ce jour-là (mm), au plus la pluie restante. */
    interception_mm: number;
    /** Pluie qui entre dans la réserve (mm). */
    utile_mm: number;
};
/** § 5.1 : pluie mesurée heure par heure. */
export declare function pluieUtileMesuree(heures_mm: readonly number[], r: ReglagesPluie): PluieUtile;
/** Total du jour sans heure : pas de ruissellement (il se compte heure par heure), l'interception seule. */
export declare function pluieUtileDuJour(mm: number, r: ReglagesPluie): PluieUtile;
/** § 5.2 : pluie prévue, avec la règle de la pluie sûre si le jeu l'active. */
export declare function pluieUtilePrevue(prevue_mm: number, modeles: readonly number[] | null | undefined, r: ReglagesPluie): PluieUtile & {
    sure: boolean;
};
/** La pluie utile d'un jour, quelle que soit sa forme. */
export declare function pluieUtile(pluie: PluieDuJour, r: ReglagesPluie): PluieUtile;
