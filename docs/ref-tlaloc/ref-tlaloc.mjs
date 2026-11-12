// Implémentation de référence des apports de Tlaloc au moteur hydrique commun (ébauche de contrat v0.1).
// Sert uniquement à calculer les sorties attendues des cas de test. Formules de Tlaloc v184 réécrites en fonctions autonomes ; entre parenthèses, où elles se trouvent dans Tlaloc : cutValve, cutEffective, peFc, rlbFuse, kf.
// Convention : manque Dr en mm (0 = sol à la capacité au champ), RU = TAW (mm), RAW = p × RU, RFU de labo = part de référence × RU (vocabulaire de contrat-moteur-partie-otf.md, § 1).

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* Une journée : consommation continue, apports horodatés (fraction du jour 0..1), bornée entre 0 et le plancher */
export function jourHoraire({ Dr0, etc, taw, plancher = null, apports = [] }) {
  const Dmax = plancher == null ? taw : Math.min(taw, plancher);
  let Dr = Dr0, cur = 0, perte = 0, drainPluie = 0;
  const E = apports.slice().sort((a, b) => a.f - b.f);
  for (const e of E) {
    Dr = Math.min(Dmax, Dr + etc * (e.f - cur)); cur = e.f;
    const exces = Math.max(0, e.mm - Dr);
    if (e.type === 'irrigation') perte += exces; else drainPluie += exces;
    Dr = Math.max(0, Dr - e.mm);
  }
  Dr = Math.min(Dmax, Dr + etc * (1 - cur));
  return { Dr, perteIrrigation: perte, drainagePluie: drainPluie };
}

/* Mode journalier (OTF) : tous les flux du jour additionnés puis bornés une seule fois ; drainage partagé au prorata */
export function jourJournalier({ Dr0, etc, taw, plancher = null, pluie = 0, irrigation = 0 }) {
  const Dmax = plancher == null ? taw : Math.min(taw, plancher);
  const brut = Dr0 + etc - pluie - irrigation, drainage = Math.max(0, -brut), Dr = clamp(brut, 0, Dmax);
  const apports = pluie + irrigation;
  return { Dr, drainage, perteIrrigation: apports > 0 ? drainage * irrigation / apports : 0 };
}

/* Pluie utile mesurée (heures [mm]) : ruissellement au-delà d'un seuil horaire, puis interception une fois par jour */
export function pluieUtileMesuree(heures, { interception = 2, seuilRuiss = 15, partRuiss = 0.5 } = {}) {
  const P = heures.reduce((a, h) => a + h, 0); if (P <= 0) return { P: 0, ruissellement: 0, Pe: 0 };
  const ro = heures.reduce((a, h) => a + Math.max(0, h - seuilRuiss) * partRuiss, 0);
  return { P, ruissellement: ro, Pe: Math.max(0, P - ro - interception) };
}

/* Pluie utile prévue : part comptée moins l'interception ; pluie sûre (tous les modèles ≥ 1 mm, au moins 2) : max(règle, 0,8 × plus faible − 1) */
export function pluieUtilePrevue(prevue, modeles, { partPrevue = 0.5, interception = 2, regleSure = true } = {}) {
  const base = Math.max(0, prevue * partPrevue - interception);
  const sure = regleSure && modeles && modeles.length >= 2 && modeles.every(m => m >= 1);
  return { Pe: sure ? Math.max(base, 0.8 * Math.min(...modeles) - 1) : base, sure: !!sure };
}

/* Part facile p ajustée à la chaleur (FAO-56, note du tableau 22) */
export const pAjuste = (pTab, etc) => clamp(pTab + 0.04 * (5 - etc), 0.1, 0.8);

/* Test du poing lu en fourchette : a priori gaussien sur la réserve utile (%), vraisemblance = produit des P(classe | u) avec une erreur de lecture */
export const CLASSES = { tres_sec: [-1e9, 25], sec: [25, 50], correct: [50, 75], frais: [75, 95], plein: [95, 1e9] };
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
export function poingFourchette(um, sdU, niveaux, sigLecture = 8) {
  let w0 = 0, m1 = 0, m2 = 0;
  for (let u = 0; u <= 100; u += 0.5) {
    let w = Math.exp(-0.5 * Math.pow((u - um) / Math.max(1, sdU), 2));
    for (const L of niveaux) { const z = CLASSES[L]; w *= Math.max(1e-12, Phi((z[1] - u) / sigLecture) - Phi((z[0] - u) / sigLecture)); }
    w0 += w; m1 += w * u; m2 += w * u * u;
  }
  const mu = m1 / w0; return { mu, sd: Math.sqrt(Math.max(0.25, m2 / w0 - mu * mu)) };
}

/* Incertitude du calcul au moment d'un relevé (points de réserve utile) */
export const sdAuRelevé = (sdR_mm, consoDepuisAncrage, taw, q = 0.2) => Math.sqrt(sdR_mm * sdR_mm + Math.pow(q * consoDepuisAncrage, 2)) / taw * 100;

/* Consommation apprise : facteur multiplicatif sur ETP × Kc après un relevé qui corrige le calcul */
export function kfApres(kf, { DrAvant, DrApres, consoDepuisAncrage, sdAvant, sdApres, cal = 0.3 }) {
  if (!(consoDepuisAncrage > 2)) return kf;
  const gain = cal * Math.max(0, 1 - Math.pow(sdApres / sdAvant, 2));
  return clamp(kf * clamp(1 + gain * (DrApres - DrAvant) / consoDepuisAncrage, 0.85, 1.18), 0.6, 1.6);
}

/* Tensiomètre (kPa) → manque Dr (mm), entre son seuil bas (sol frais) et son seuil haut (à arroser) */
export function tensioVersDr(T, bas, haut, raw) {
  if (T < bas) return 0.2 * raw * Math.max(0, T) / bas;
  if (T <= haut) return 0.2 * raw + 0.8 * raw * (T - bas) / (haut - bas);
  return 1.05 * raw;
}
