/* Moteur hydrique commun (OTF et Tlaloc) v0.3.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */
/**
 * Moteur hydrique commun (OTF et Tlaloc) : point d'entrée.
 *
 * Une seule source, deux fichiers construits (MC-28) :
 * - `dist/moteur-hydrique.mjs` : module ES (`import … from`), pour OTF ;
 * - `dist/moteur-hydrique.js` : script classique qui pose la variable
 *   globale `MoteurHydrique`, pour une page ouverte en fichier local (Tlaloc).
 *
 * Chaque logiciel fige la version qu'il utilise (contrat § 2, MC-26 :
 * semver, un résultat qui change = version majeure).
 */
export declare const VERSION_MOTEUR = "0.3.0";
export { suivre, pAjuste, conserver } from './bilan.js';
export type { EntreeSuivi, JourDonnees, SolDuJour, ArrosageDuJour, Observation, JourSortie, RaisonInconnu, CodeInconnu, Ancrage, } from './bilan.js';
export { pluieUtile, pluieUtileMesuree, pluieUtileDuJour, pluieUtilePrevue } from './pluie.js';
export type { PluieDuJour, PluieUtile } from './pluie.js';
export { JEU_OTF, JEU_TLALOC, verifierJeu } from './reglages.js';
export type { JeuDeReglages, ReglagesPluie, ReglagesPoing, ReglagesTensiometre } from './reglages.js';
export { poingFourchette, kfApres, tensioVersDr, incertitudeMm, enPoints, etatEnPoints, manqueDepuisPoints, CLASSES_POING, CENTRE_CLASSE, INCERTITUDE, CONSOMMATION_APPRISE, } from './observations.js';
export type { ClassePoing } from './observations.js';
export { pasDuJour, apportsDesArrosages, bornesDuJour, fractionDuJour, FUSEAU } from './pas-horaire.js';
export type { Apport, EntreePas, SortiePas, Mode, TypeApport, Arrosage, ApresApport } from './pas-horaire.js';
