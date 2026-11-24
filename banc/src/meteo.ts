/**
 * Météo journalière du banc : ET0 FAO-56 et pluie de la réanalyse Open-Meteo
 * (MC-33), par jour civil de Paris. Une valeur absente reste `null`, jamais 0.
 *
 * Format CSV commun aux deux côtés (demande de Nicolas du 22/11) :
 *   date,et0_mm,pluie_mm
 *   2025-07-01,5.12,0
 */
import { estDate, joursEntre } from './dates.ts';

export type JourMeteo = { date: string; et0_mm: number | null; pluie_mm: number | null };

export const ENTETE_CSV = 'date,et0_mm,pluie_mm';

/** La partie `daily` d'une réponse d'Open-Meteo, telle que le banc la demande. */
export type ReponseJournaliere = {
  daily_units?: Record<string, string>;
  daily?: { time?: unknown; precipitation_sum?: unknown; et0_fao_evapotranspiration?: unknown };
};

function nombreOuNull(v: unknown, quoi: string): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${quoi} : valeur illisible (${String(v)})`);
  if (v < 0) throw new Error(`${quoi} : valeur négative (${v})`);
  return v;
}

/** Lit la partie `daily` d'une réponse d'Open-Meteo ; refuse toute unité autre que le mm. */
export function lireJournalier(reponse: ReponseJournaliere): JourMeteo[] {
  const d = reponse.daily;
  if (!d || !Array.isArray(d.time) || !Array.isArray(d.precipitation_sum) || !Array.isArray(d.et0_fao_evapotranspiration)) {
    throw new Error('réponse Open-Meteo sans daily.time, daily.precipitation_sum et daily.et0_fao_evapotranspiration');
  }
  for (const v of ['precipitation_sum', 'et0_fao_evapotranspiration']) {
    const unite = reponse.daily_units?.[v];
    if (unite !== 'mm') throw new Error(`unité de ${v} : « ${unite} » au lieu de « mm »`);
  }
  const n = d.time.length;
  if (d.precipitation_sum.length !== n || d.et0_fao_evapotranspiration.length !== n) throw new Error('séries journalières de longueurs différentes');
  return d.time.map((date, i) => {
    if (typeof date !== 'string' || !estDate(date)) throw new Error(`date illisible : ${String(date)}`);
    return {
      date,
      et0_mm: nombreOuNull((d.et0_fao_evapotranspiration as unknown[])[i], `ET0 du ${date}`),
      pluie_mm: nombreOuNull((d.precipitation_sum as unknown[])[i], `pluie du ${date}`),
    };
  });
}

/**
 * Met bout à bout des morceaux de météo : les dates doivent se suivre sans trou
 * ni doublon (un trou ou un doublon arrête tout, il ne se corrige pas en silence).
 */
export function assembler(morceaux: JourMeteo[][]): JourMeteo[] {
  const tous = morceaux.flat();
  for (let i = 1; i < tous.length; i++) {
    const attendu = joursEntre(tous[i - 1].date, tous[i].date);
    if (attendu.length !== 2) throw new Error(`météo discontinue entre le ${tous[i - 1].date} et le ${tous[i].date}`);
  }
  return tous;
}

/** Les jours de `debut` à `fin` ; erreur si un jour manque dans la série. */
export function extraire(jours: JourMeteo[], debut: string, fin: string): JourMeteo[] {
  const parDate = new Map(jours.map((j) => [j.date, j]));
  return joursEntre(debut, fin).map((date) => {
    const j = parDate.get(date);
    if (!j) throw new Error(`le ${date} manque dans la météo`);
    return j;
  });
}

/** Vrai si chaque jour a son ET0 et sa pluie. */
export function complet(jours: JourMeteo[]): boolean {
  return jours.every((j) => j.et0_mm !== null && j.pluie_mm !== null);
}

const cellule = (v: number | null) => (v === null ? '' : String(v));

/**
 * Écrit le CSV `date,et0_mm,pluie_mm`. Avec `exigerComplet`, une valeur absente
 * arrête tout (les fichiers d'une année rejouée n'ont pas de trou) ; sinon elle
 * s'écrit en cellule vide, jamais en 0.
 */
export function ecrireCsv(jours: JourMeteo[], exigerComplet = false): string {
  if (exigerComplet) {
    const trou = jours.find((j) => j.et0_mm === null || j.pluie_mm === null);
    if (trou) throw new Error(`le ${trou.date} n'a pas son ET0 ou sa pluie`);
  }
  return [ENTETE_CSV, ...jours.map((j) => `${j.date},${cellule(j.et0_mm)},${cellule(j.pluie_mm)}`)].join('\n') + '\n';
}

/** Relit le CSV `date,et0_mm,pluie_mm` ; une cellule vide redevient `null`. */
export function lireCsv(texte: string): JourMeteo[] {
  const lignes = texte.replace(/\r\n/g, '\n').split('\n').filter((l) => l !== '');
  if (lignes[0] !== ENTETE_CSV) throw new Error(`en-tête attendu « ${ENTETE_CSV} », lu « ${lignes[0]} »`);
  const lireCellule = (c: string, quoi: string) => {
    if (c === '') return null;
    const v = Number(c);
    return nombreOuNull(Number.isNaN(v) ? c : v, quoi);
  };
  const jours = lignes.slice(1).map((l, i) => {
    const c = l.split(',');
    if (c.length !== 3 || !estDate(c[0])) throw new Error(`ligne ${i + 2} illisible : « ${l} »`);
    return { date: c[0], et0_mm: lireCellule(c[1], `ET0 du ${c[0]}`), pluie_mm: lireCellule(c[2], `pluie du ${c[0]}`) };
  });
  return assembler([jours]);
}
