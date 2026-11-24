/**
 * Kc et durées de stade de Nicolas (contrat du banc, § 4 point 3), rangés dans
 * `banc/donnees/kc-stades-tlaloc.json`. Ce module les lit et les vérifie ; le
 * calcul de l'ETM jour par jour (hors moteur, MC-18) vient avec le rejeu (PR 2).
 */

export type CultureKc = {
  culture: string;
  kc_ini: number;
  kc_mid: number;
  source: string;
  implantation_a_debut_recolte_j: number[];
  recolte_j: number[];
};

export type TableKc = {
  source: string;
  regle: { facteur_serre: number; kc_sol_nu: number };
  cultures: CultureKc[];
};

const KC_MAX = 1.5;

function dureesValides(v: unknown): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => Number.isInteger(x) && x > 0);
}

/** Vérifie la table : un Kc entre 0 et 1,5, le Kc mid au moins égal au Kc ini, des durées en jours entiers, chaque culture une seule fois. */
export function lireTableKc(brut: unknown): TableKc {
  const t = brut as Partial<TableKc>;
  if (!t || typeof t.source !== 'string' || !t.regle || !Array.isArray(t.cultures)) throw new Error('table des Kc illisible');
  const { facteur_serre, kc_sol_nu } = t.regle;
  if (!(facteur_serre > 0 && facteur_serre <= 1)) throw new Error(`facteur serre hors de ]0 ; 1] : ${facteur_serre}`);
  if (!(kc_sol_nu > 0 && kc_sol_nu <= KC_MAX)) throw new Error(`Kc du sol nu hors bornes : ${kc_sol_nu}`);
  const vues = new Set<string>();
  for (const c of t.cultures) {
    if (typeof c.culture !== 'string' || c.culture === '') throw new Error('culture sans nom');
    if (vues.has(c.culture)) throw new Error(`culture en double : ${c.culture}`);
    vues.add(c.culture);
    for (const [k, v] of [['kc_ini', c.kc_ini], ['kc_mid', c.kc_mid]] as const) {
      if (typeof v !== 'number' || !(v > 0 && v <= KC_MAX)) throw new Error(`${c.culture} : ${k} hors de ]0 ; ${KC_MAX}] (${v})`);
    }
    if (c.kc_mid < c.kc_ini) throw new Error(`${c.culture} : Kc mid inférieur au Kc ini`);
    if (!dureesValides(c.implantation_a_debut_recolte_j) || !dureesValides(c.recolte_j)) throw new Error(`${c.culture} : durées illisibles`);
  }
  return t as TableKc;
}
