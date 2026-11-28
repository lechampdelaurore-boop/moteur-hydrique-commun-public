/**
 * Sol du juge, celui de la démonstration de Tlaloc (contrat du banc, § 7 bis ;
 * réponse de Nicolas du 24/11, Tlaloc v700) :
 *  - RU = eau utile de la texture (160 mm/m pour « limoneux ») × profondeur des
 *    racines du jour ;
 *  - les racines vont de 10 cm (semis) ou 15 cm (plant) à la profondeur maxi de
 *    la culture (bornée à 60 cm), en ligne droite entre l'implantation et le
 *    début de la récolte, puis restent à la profondeur maxi jusqu'à la fin ;
 *  - sur une parcelle, la culture la moins enracinée décide de la profondeur et
 *    du p (à profondeur égale, le p le plus bas) ;
 *  - sans culture en place : 30 cm et p = 0,4, pour suivre l'eau d'un jour à
 *    l'autre ; ces jours restent « sans RAW connue » dans les comptes de jours.
 * Le juge ne passe aucun plancher (Dmax = RU).
 */
import type { SolDuJour } from '../../src/moteur.ts';
import { joursDe, type CultureEnPlace } from './etm.ts';

export type CultureSol = {
  culture: string;
  /** p de la FAO-56 (tableau 22) retenu pour le juge commun (§ 7 bis). */
  p: number;
  /** Profondeur maxi des racines (m). */
  racines_max_m: number;
};

export type TableSol = {
  source: string;
  /** Eau utile de la texture (mm/m). */
  theta_u_mm_m: number;
  racines_depart_m: { semis: number; plant: number };
  /** Borne de la profondeur des racines (m). */
  racines_borne_m: number;
  sans_culture: { zr_m: number; p: number };
  cultures: CultureSol[];
};

/** Vérifie la table du sol : valeurs positives, p entre 0 et 1, chaque culture une seule fois. */
export function lireTableSol(brut: unknown): TableSol {
  const t = brut as Partial<TableSol>;
  if (!t || typeof t.source !== 'string' || !Array.isArray(t.cultures) || !t.racines_depart_m || !t.sans_culture) throw new Error('table du sol illisible');
  const positif = (x: unknown, quoi: string) => {
    if (typeof x !== 'number' || !(x > 0)) throw new Error(`${quoi} : nombre > 0 attendu (${String(x)})`);
  };
  const partFacile = (x: unknown, quoi: string) => {
    if (typeof x !== 'number' || !(x > 0 && x < 1)) throw new Error(`${quoi} : p entre 0 et 1 attendu (${String(x)})`);
  };
  positif(t.theta_u_mm_m, 'theta_u_mm_m');
  positif(t.racines_depart_m.semis, 'racines au semis');
  positif(t.racines_depart_m.plant, 'racines à la plantation');
  positif(t.racines_borne_m, 'borne des racines');
  positif(t.sans_culture.zr_m, 'profondeur sans culture');
  partFacile(t.sans_culture.p, 'p sans culture');
  const vues = new Set<string>();
  for (const c of t.cultures) {
    if (typeof c.culture !== 'string' || c.culture === '' || vues.has(c.culture)) throw new Error(`culture vide ou en double : ${String(c.culture)}`);
    vues.add(c.culture);
    partFacile(c.p, `p de ${c.culture}`);
    positif(c.racines_max_m, `racines de ${c.culture}`);
  }
  return t as TableSol;
}

/** Profondeur des racines d'une culture en place ce jour-là (m) ; null si elle n'est pas en place. */
export function racinesDuJour(c: CultureEnPlace, date: string, table: TableSol): number | null {
  if (date < c.implantation || date > c.fin_recolte) return null;
  const s = table.cultures.find((x) => x.culture === c.culture);
  if (!s) throw new Error(`culture absente de la table du sol : ${c.culture}`);
  if (c.plant === undefined) throw new Error(`${c.culture} : plant ou semis inconnu`);
  const max = Math.min(s.racines_max_m, table.racines_borne_m);
  const depart = Math.min(c.plant ? table.racines_depart_m.plant : table.racines_depart_m.semis, max);
  if (date >= c.debut_recolte) return max;
  return depart + ((max - depart) * joursDe(c.implantation, date)) / joursDe(c.implantation, c.debut_recolte);
}

export type SolBanc = {
  sol: SolDuJour;
  /** La culture qui décide de la profondeur et du p ; null : aucune culture en place. */
  decisive: string | null;
};

/** Le sol d'une parcelle ce jour-là : la culture la moins enracinée décide (à égalité, le p le plus bas). */
export function solDuJour(cultures: readonly CultureEnPlace[], date: string, table: TableSol): SolBanc {
  let choix: { zr: number; p: number; culture: string } | null = null;
  for (const c of cultures) {
    const zr = racinesDuJour(c, date, table);
    if (zr === null) continue;
    const p = table.cultures.find((x) => x.culture === c.culture)!.p;
    if (choix === null || zr < choix.zr || (zr === choix.zr && p < choix.p)) choix = { zr, p, culture: c.culture };
  }
  if (choix === null) {
    return { sol: { theta_u_mm_m: table.theta_u_mm_m, zr_m: table.sans_culture.zr_m, p_tableau: table.sans_culture.p, plancher_mm: null }, decisive: null };
  }
  return { sol: { theta_u_mm_m: table.theta_u_mm_m, zr_m: choix.zr, p_tableau: choix.p, plancher_mm: null }, decisive: choix.culture };
}
