/**
 * ETM des deux côtés, à la façon de Tlaloc (contrat du banc, § 4 point 3 ;
 * règle de Nicolas du 22/11), hors moteur (MC-18) :
 *  - de l'implantation au début de la récolte, le Kc monte en ligne droite du
 *    Kc ini au Kc mid ; du début de la récolte à la fin, il reste au Kc mid ;
 *  - sous serre, il est multiplié par 0,7 ;
 *  - entre deux cultures, sol nu : Kc 0,4 (× 0,7 sous serre).
 * ETM du jour = ET0 du jour × Kc du jour ; une ET0 inconnue donne une ETM
 * inconnue (D-003), jamais 0.
 *
 * Conventions de jour (à confirmer par Nicolas) : le jour de l'implantation vaut
 * Kc ini ; le jour du début de la récolte vaut Kc mid ; le jour de la fin de la
 * récolte est encore cultivé ; le lendemain est en sol nu.
 */
import { jourSuivant } from './dates.ts';
import type { TableKc } from './kc.ts';

export type CultureEnPlace = {
  culture: string;
  /** AAAA-MM-JJ */
  implantation: string;
  debut_recolte: string;
  fin_recolte: string;
};

/** Nombre de jours de `a` à `b` (positif si b est après a). */
export function joursDe(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Vérifie l'ordre des dates d'une culture et que son nom est dans la table. */
export function verifierCulture(c: CultureEnPlace, table: TableKc): void {
  if (!table.cultures.some((k) => k.culture === c.culture)) throw new Error(`culture absente de la table des Kc : ${c.culture}`);
  if (!(c.implantation < c.debut_recolte && c.debut_recolte <= c.fin_recolte)) {
    throw new Error(`${c.culture} : dates dans le désordre (${c.implantation}, ${c.debut_recolte}, ${c.fin_recolte})`);
  }
}

/** Kc d'une culture un jour où elle est en place (sans le facteur de serre). */
export function kcCulture(c: CultureEnPlace, date: string, table: TableKc): number {
  const k = table.cultures.find((x) => x.culture === c.culture);
  if (!k) throw new Error(`culture absente de la table des Kc : ${c.culture}`);
  if (date < c.implantation || date > c.fin_recolte) throw new Error(`${c.culture} n'est pas en place le ${date}`);
  if (date >= c.debut_recolte) return k.kc_mid;
  return k.kc_ini + ((k.kc_mid - k.kc_ini) * joursDe(c.implantation, date)) / joursDe(c.implantation, c.debut_recolte);
}

/**
 * Kc du jour d'une unité (parcelle ou planche) : la culture en place, sinon le
 * sol nu ; × facteur de serre sous abri. Deux cultures en place le même jour
 * sur la même unité : erreur (l'export doit les séparer).
 */
export function kcDuJour(cultures: readonly CultureEnPlace[], date: string, serre: boolean, table: TableKc): { kc: number; culture: string | null } {
  const enPlace = cultures.filter((c) => c.implantation <= date && date <= c.fin_recolte);
  if (enPlace.length > 1) throw new Error(`${date} : plusieurs cultures en place (${enPlace.map((c) => c.culture).join(', ')})`);
  const facteur = serre ? table.regle.facteur_serre : 1;
  if (enPlace.length === 0) return { kc: table.regle.kc_sol_nu * facteur, culture: null };
  return { kc: kcCulture(enPlace[0], date, table) * facteur, culture: enPlace[0].culture };
}

/** ETM de chaque jour de `debut` à `fin`, à partir de l'ET0 du jour (null : inconnue). */
export function etmSerie(
  cultures: readonly CultureEnPlace[],
  serre: boolean,
  et0: ReadonlyMap<string, number | null>,
  debut: string,
  fin: string,
  table: TableKc,
): { date: string; kc: number; culture: string | null; etm_mm: number | null }[] {
  for (const c of cultures) verifierCulture(c, table);
  const sortie: { date: string; kc: number; culture: string | null; etm_mm: number | null }[] = [];
  for (let d = debut; d <= fin; d = jourSuivant(d)) {
    const { kc, culture } = kcDuJour(cultures, d, serre, table);
    const e = et0.get(d);
    sortie.push({ date: d, kc, culture, etm_mm: e === undefined || e === null ? null : e * kc });
  }
  return sortie;
}
