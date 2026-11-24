/**
 * Couverture de l'archive des prévisions (passe 2, contrat § 6) : une année est
 * couverte si, pour chaque heure du 1er janvier au 4 janvier de l'année d'après
 * (J+4 du 31 décembre), les prévisions faites 1, 2, 3 et 4 jours plus tôt ont
 * leur pluie et leur ET0. La mise en route de Tlaloc avant le 1er janvier se
 * fait sur la réanalyse.
 */

export type ResultatCouverture = {
  complete: boolean;
  /** Première valeur absente, s'il y en a une. */
  premier_manque: { variable: string; heure: string } | null;
  /** Erreur rendue par Open-Meteo (modèle ou variable inconnus, dates hors archive…). */
  erreur: string | null;
};

export function bornesCouverture(annee: number): { debut: string; fin: string } {
  return { debut: `${annee}-01-01`, fin: `${annee + 1}-01-04` };
}

export function analyserCouverture(json: Record<string, unknown>, variables: string[]): ResultatCouverture {
  if (json.error === true) return { complete: false, premier_manque: null, erreur: String(json.reason ?? 'erreur sans raison') };
  const h = json.hourly as Record<string, unknown> | undefined;
  if (!h || !Array.isArray(h.time) || h.time.length === 0) return { complete: false, premier_manque: null, erreur: 'réponse sans hourly.time' };
  const heures = h.time as string[];
  for (const v of variables) {
    const serie = h[v];
    if (!Array.isArray(serie) || serie.length !== heures.length) return { complete: false, premier_manque: null, erreur: `variable absente de la réponse : ${v}` };
    const i = serie.findIndex((x) => typeof x !== 'number' || !Number.isFinite(x));
    if (i >= 0) return { complete: false, premier_manque: { variable: v, heure: heures[i] }, erreur: null };
  }
  return { complete: true, premier_manque: null, erreur: null };
}
