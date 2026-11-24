/**
 * Lecture du plan de Tlaloc rejoué (contrat du banc, § 4 point 4 ; format donné
 * par Nicolas le 22/11) : une ligne par jour et par parcelle, en mm sur la
 * surface de la parcelle. Le rejeu et les indicateurs viennent avec la PR 2 ;
 * cette lecture vérifie seulement le fichier.
 */
import { estDate } from './dates.ts';

export const COLONNES_PLAN = [
  'date', 'parcelle', 'mm', 'mm_sol', 'mm_fond', 'mm_complement', 'mm_bassinage', 'mm_autre',
  'reserve_facile_pct_opuntia', 'rfu_mm_opuntia', 'kc_opuntia',
] as const;

export type LignePlan = {
  date: string;
  parcelle: string;
  /** Toute l'eau apportée. */
  mm: number;
  /** La part que Tlaloc compte dans la réserve du sol. */
  mm_sol: number;
  mm_fond: number;
  mm_complement: number;
  mm_bassinage: number;
  mm_autre: number;
  /** Ce que Tlaloc voit le matin : pour comparer, pas pour juger. */
  reserve_facile_pct_opuntia: number | null;
  rfu_mm_opuntia: number | null;
  kc_opuntia: number | null;
};

/** Écart admis entre `mm` et la somme des quatre origines : cinq nombres arrondis au centième dans le fichier. */
const ECART_ORIGINES_MM = 0.03;

export function lirePlanTlaloc(texte: string): LignePlan[] {
  const lignes = texte.replace(/\r\n/g, '\n').split('\n').filter((l) => l !== '');
  if (lignes[0] !== COLONNES_PLAN.join(',')) throw new Error(`en-tête du plan inattendu : « ${lignes[0]} »`);
  const vues = new Set<string>();
  return lignes.slice(1).map((l, i) => {
    const c = l.split(',');
    const ou = `ligne ${i + 2}`;
    if (c.length !== COLONNES_PLAN.length) throw new Error(`${ou} : ${c.length} colonnes au lieu de ${COLONNES_PLAN.length}`);
    if (!estDate(c[0])) throw new Error(`${ou} : date illisible « ${c[0]} »`);
    if (c[1] === '') throw new Error(`${ou} : parcelle vide`);
    const cle = `${c[0]} ${c[1]}`;
    if (vues.has(cle)) throw new Error(`${ou} : le ${c[0]} est en double pour la parcelle ${c[1]}`);
    vues.add(cle);
    const mm = (k: number) => {
      const v = Number(c[k]);
      if (c[k] === '' || !Number.isFinite(v) || v < 0) throw new Error(`${ou} : ${COLONNES_PLAN[k]} illisible « ${c[k]} »`);
      return v;
    };
    const facultatif = (k: number) => {
      if (c[k] === '') return null;
      const v = Number(c[k]);
      if (!Number.isFinite(v)) throw new Error(`${ou} : ${COLONNES_PLAN[k]} illisible « ${c[k]} »`);
      return v;
    };
    const ligne: LignePlan = {
      date: c[0], parcelle: c[1], mm: mm(2), mm_sol: mm(3), mm_fond: mm(4), mm_complement: mm(5), mm_bassinage: mm(6), mm_autre: mm(7),
      reserve_facile_pct_opuntia: facultatif(8), rfu_mm_opuntia: facultatif(9), kc_opuntia: facultatif(10),
    };
    const origines = ligne.mm_fond + ligne.mm_complement + ligne.mm_bassinage + ligne.mm_autre;
    if (Math.abs(origines - ligne.mm) > ECART_ORIGINES_MM) throw new Error(`${ou} : mm (${ligne.mm}) ≠ somme des origines (${origines.toFixed(2)})`);
    if (ligne.mm_sol > ligne.mm + ECART_ORIGINES_MM) throw new Error(`${ou} : mm_sol (${ligne.mm_sol}) dépasse mm (${ligne.mm})`);
    return ligne;
  });
}
