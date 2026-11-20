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
export const CLASSES_POING: Readonly<Record<ClassePoing, readonly [number, number]>> = Object.freeze({
  tres_sec: Object.freeze([-Infinity, 25] as const),
  sec: Object.freeze([25, 50] as const),
  correct: Object.freeze([50, 75] as const),
  frais: Object.freeze([75, 95] as const),
  plein: Object.freeze([95, Infinity] as const),
});

/** § 7.1 : sans l'option « fourchette », le relevé remplace le calcul par le centre de sa classe. */
export const CENTRE_CLASSE: Readonly<Record<ClassePoing, number>> = Object.freeze({
  tres_sec: 12.5, sec: 37.5, correct: 62.5, frais: 87.5, plein: 100,
});

export const estClassePoing = (x: unknown): x is ClassePoing => typeof x === 'string' && Object.hasOwn(CLASSES_POING, x);

/** § 7.4 : les constantes de l'incertitude (écarts-types). */
export const INCERTITUDE = Object.freeze({
  /** Au départ du calcul, sans incertitude donnée : 0,35 × RU. */
  depart_part_ru: 0.35,
  /** Erreur de consommation typique (erreur de Kc de ± 20 %), par mm consommé depuis le dernier ancrage. */
  erreur_conso: 0.2,
  /** Un jour dont la consommation est estimée (MC-14) : l'incertitude grandit de 0,5 × cette consommation (§ 4.4). */
  erreur_conso_estimee: 0.5,
  /** Après une observation « manque » (le % du plein d'OTF, MC-22) : 0,05 × RU. */
  apres_manque_part_ru: 0.05,
  /** Après un poing sans fourchette : 0,15 × RU. */
  apres_poing_centre_part_ru: 0.15,
  /** Après un tensiomètre : 0,1 × RAW. */
  apres_tensio_part_raw: 0.1,
});

/** § 8 : les constantes de la consommation apprise. */
export const CONSOMMATION_APPRISE = Object.freeze({
  gain: 0.3,
  /** Jusqu'à cette consommation depuis l'ancrage précédent (mm), le relevé n'apprend rien. */
  conso_min_mm: 2,
  facteur_releve_min: 0.85,
  facteur_releve_max: 1.18,
  kf_min: 0.6,
  kf_max: 1.6,
});

const GRILLE_PAS = 0.5;
const GRILLE_POINTS = 200; // de 0 à 100 % par pas de 0,5
const SD_PRIOR_MIN = 1;
const VARIANCE_MIN = 0.25;
const VRAISEMBLANCE_MIN = 1e-12;
const POURCENT = 100;

const estNombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** erf, approximation d'Abramowitz et Stegun 7.1.26 (erreur inférieure à 1,5e-7), la même que la référence de Tlaloc. */
function erf(x: number): number {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * § 7.1 : le test du poing lu en fourchette. L'a priori est le calcul (état
 * `um` en points, incertitude `sdU` en points) ; `null` : calcul inconnu,
 * a priori plat. Chaque prise d'une même observation multiplie la
 * vraisemblance de sa classe, avec une erreur de lecture `sigma` (points).
 * Rend l'état a posteriori μ et son écart-type sd, en points de RU (grille
 * de 0 à 100 par pas de 0,5).
 */
export function poingFourchette(
  apriori: { um: number; sdU: number } | null,
  classes: readonly ClassePoing[],
  sigma: number,
): { mu: number; sd: number } {
  if (apriori !== null && (!estNombre(apriori.um) || !estNombre(apriori.sdU) || apriori.sdU < 0)) {
    throw new RangeError('poing : état et incertitude du calcul attendus (ou null)');
  }
  if (!estNombre(sigma) || sigma <= 0) throw new RangeError('poing : erreur de lecture > 0 attendue');
  if (classes.length === 0 || !classes.every(estClassePoing)) throw new RangeError('poing : au moins une classe connue attendue');
  // En logarithmes, pour qu'un grand nombre de prises ne fasse pas tomber les poids à 0.
  const logs: number[] = [];
  let max = -Infinity;
  for (let i = 0; i <= GRILLE_POINTS; i += 1) {
    const u = i * GRILLE_PAS;
    let l = apriori === null ? 0 : -0.5 * ((u - apriori.um) / Math.max(SD_PRIOR_MIN, apriori.sdU)) ** 2;
    for (const c of classes) {
      const [a, b] = CLASSES_POING[c];
      l += Math.log(Math.max(VRAISEMBLANCE_MIN, phi((b - u) / sigma) - phi((a - u) / sigma)));
    }
    logs.push(l);
    max = Math.max(max, l);
  }
  let w0 = 0, m1 = 0, m2 = 0;
  logs.forEach((l, i) => {
    const u = i * GRILLE_PAS;
    const w = Math.exp(l - max);
    w0 += w; m1 += w * u; m2 += w * u * u;
  });
  const mu = m1 / w0;
  return { mu, sd: Math.sqrt(Math.max(VARIANCE_MIN, m2 / w0 - mu * mu)) };
}

/** § 7.4 : l'incertitude (mm) : √(sdR² + E²), sdR celle du dernier ancrage, E l'erreur de consommation accumulée depuis. */
export function incertitudeMm(sdR_mm: number, erreur_mm: number): number {
  return Math.sqrt(sdR_mm * sdR_mm + erreur_mm * erreur_mm);
}

/** Un manque ou une incertitude (mm) en points de RU, un manque en état (points), et l'inverse. */
export const enPoints = (mm: number, ru: number) => mm / ru * POURCENT;
export const etatEnPoints = (dr_mm: number, ru: number) => POURCENT * (1 - dr_mm / ru);
export const manqueDepuisPoints = (points: number, ru: number) => (1 - points / POURCENT) * ru;

/**
 * § 8 : la consommation apprise après un relevé en fourchette. `sd_avant`
 * et `sd_apres` en points (ou tous deux en mm) ; manques et consommation
 * depuis l'ancrage précédent en mm. Jusqu'à 2 mm consommés, rien n'est
 * appris ; sans incertitude avant, le gain est nul.
 */
export function kfApres(kf: number, r: { dr_avant_mm: number; dr_apres_mm: number; conso_mm: number; sd_avant: number; sd_apres: number }): number {
  const k = CONSOMMATION_APPRISE;
  if (!(r.conso_mm > k.conso_min_mm)) return kf;
  const gain = r.sd_avant > 0 ? k.gain * Math.max(0, 1 - (r.sd_apres / r.sd_avant) ** 2) : 0;
  const facteur = borne(1 + gain * (r.dr_apres_mm - r.dr_avant_mm) / r.conso_mm, k.facteur_releve_min, k.facteur_releve_max);
  return borne(kf * facteur, k.kf_min, k.kf_max);
}

/** § 7.3 : un tensiomètre (kPa) en manque (mm), entre son seuil bas (sol frais) et son seuil haut (à arroser). À caler (MC-35). */
export function tensioVersDr(kpa: number, bas_kpa: number, haut_kpa: number, raw_mm: number): number {
  if (!estNombre(kpa) || !estNombre(raw_mm) || raw_mm < 0) throw new RangeError('tensiomètre : mesure et RAW attendues');
  if (!estNombre(bas_kpa) || bas_kpa <= 0 || !estNombre(haut_kpa) || haut_kpa <= bas_kpa) throw new RangeError('tensiomètre : 0 < seuil bas < seuil haut');
  if (kpa < bas_kpa) return 0.2 * raw_mm * Math.max(0, kpa) / bas_kpa;
  if (kpa <= haut_kpa) return 0.2 * raw_mm + 0.8 * raw_mm * (kpa - bas_kpa) / (haut_kpa - bas_kpa);
  return 1.05 * raw_mm;
}
