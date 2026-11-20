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

export const VERSION_MOTEUR = '0.2.0';

export { suivre, pAjuste, conserver } from './bilan.ts';
export type {
  EntreeSuivi, JourDonnees, SolDuJour, ArrosageDuJour, Observation,
  JourSortie, RaisonInconnu, CodeInconnu, Ancrage,
} from './bilan.ts';

export { pluieUtile, pluieUtileMesuree, pluieUtileDuJour, pluieUtilePrevue } from './pluie.ts';
export type { PluieDuJour, PluieUtile } from './pluie.ts';

export { JEU_OTF, JEU_TLALOC, verifierJeu } from './reglages.ts';
export type { JeuDeReglages, ReglagesPluie, ReglagesPoing, ReglagesTensiometre } from './reglages.ts';

// Les observations de Tlaloc, l'incertitude et la consommation apprise : les
// formules seules (contrat Tlaloc § 7 et § 8), aussi utiles à l'affichage.
export {
  poingFourchette, kfApres, tensioVersDr, incertitudeMm, enPoints, etatEnPoints, manqueDepuisPoints,
  CLASSES_POING, CENTRE_CLASSE, INCERTITUDE, CONSOMMATION_APPRISE,
} from './observations.ts';
export type { ClassePoing } from './observations.ts';

// Le pas d'un jour (MC-29) et les aides pour le temps : ses jeux réduits
// (pas et bassinage) sont contenus dans les jeux complets ci-dessus.
export { pasDuJour, apportsDesArrosages, bornesDuJour, fractionDuJour, FUSEAU } from './pas-horaire.ts';
export type { Apport, EntreePas, SortiePas, Mode, TypeApport, Arrosage, ApresApport } from './pas-horaire.ts';
