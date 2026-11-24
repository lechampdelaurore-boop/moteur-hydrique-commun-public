/**
 * Seul module du banc qui va sur le réseau : la réanalyse et l'archive des
 * prévisions d'Open-Meteo (offre gratuite, sans clé). Les appels sont espacés
 * et reprennent après un refus pour trop d'appels (429) : la limite gratuite
 * compte une requête de plus de 14 jours comme plusieurs.
 */

/** Lieu du banc (contrat, § 3) : les Jardins Pentus, arrondis à 0,05° (environ 5 km). */
export const LIEU = { latitude: 45.5, longitude: 5.75 } as const;

/**
 * Réanalyse homogène sur toute la période classée : ERA5-Land (0,1°) complété
 * par ERA5 (0,25°), depuis 1950. Un seul modèle pour toutes les années, pour
 * que le classement compare des années calculées de la même façon.
 */
export const MODELE_REANALYSE = 'era5_seamless';
export const PREMIERE_ANNEE = 1950;

export const URL_REANALYSE = 'https://archive-api.open-meteo.com/v1/archive';
export const URL_PREVISIONS_PRECEDENTES = 'https://previous-runs-api.open-meteo.com/v1/forecast';

/** Modèles essayés pour l'archive des prévisions (passe 2), dans l'ordre. */
export const MODELES_PREVISIONS = ['best_match', 'ecmwf_ifs025'] as const;
/** Passe 2 : prévisions J+1 à J+4 (contrat, § 6). */
export const ECHEANCES_JOURS = [1, 2, 3, 4] as const;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function urlReanalyse(debut: string, fin: string, horaire: boolean): string {
  const p = new URLSearchParams({
    latitude: String(LIEU.latitude),
    longitude: String(LIEU.longitude),
    start_date: debut,
    end_date: fin,
    daily: 'et0_fao_evapotranspiration,precipitation_sum',
    timezone: 'Europe/Paris',
    models: MODELE_REANALYSE,
  });
  if (horaire) p.set('hourly', 'precipitation');
  return `${URL_REANALYSE}?${p}`;
}

export function variablesPrevisions(): string[] {
  return ECHEANCES_JOURS.flatMap((n) => [`precipitation_previous_day${n}`, `et0_fao_evapotranspiration_previous_day${n}`]);
}

export function urlPrevisionsPrecedentes(debut: string, fin: string, modele: string): string {
  const p = new URLSearchParams({
    latitude: String(LIEU.latitude),
    longitude: String(LIEU.longitude),
    start_date: debut,
    end_date: fin,
    hourly: variablesPrevisions().join(','),
    timezone: 'Europe/Paris',
  });
  if (modele !== 'best_match') p.set('models', modele);
  return `${URL_PREVISIONS_PRECEDENTES}?${p}`;
}

export type Reponse = { texte: string; json: Record<string, unknown> };

/**
 * GET avec reprises : 429 → on attend (Retry-After, sinon 65 s) ; erreur du
 * serveur ou du réseau → on attend un peu plus à chaque fois. Une réponse
 * d'erreur d'Open-Meteo (`error: true`) est rendue telle quelle à l'appelant.
 */
export async function obtenir(url: string, pauseApresMs: number, essais = 6): Promise<Reponse> {
  let derniere = '';
  for (let essai = 1; essai <= essais; essai++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'banc-moteur-hydrique-commun' } });
      const texte = await r.text();
      if (r.status === 429) {
        const apres = Number(r.headers.get('retry-after'));
        derniere = `429 ${texte.slice(0, 200)}`;
        console.log(`  trop d'appels (429), nouvel essai dans ${Number.isFinite(apres) && apres > 0 ? apres : 65} s`);
        await attendre((Number.isFinite(apres) && apres > 0 ? apres : 65) * 1000);
        continue;
      }
      if (r.status >= 500) {
        derniere = `${r.status} ${texte.slice(0, 200)}`;
        await attendre(10_000 * essai);
        continue;
      }
      const json = JSON.parse(texte) as Record<string, unknown>;
      await attendre(pauseApresMs);
      return { texte, json };
    } catch (e) {
      derniere = String(e);
      await attendre(10_000 * essai);
    }
  }
  throw new Error(`échec après ${essais} essais : ${url}\n${derniere}`);
}
