/**
 * Lecture de l'export de la démonstration de Tlaloc (`outils/banc/exporter-demo.mjs`,
 * format « banc-opuntia-demo », version 1 ; décrit par Nicolas le 24/11 sur la
 * PR n° 17). On en tire, pour chaque parcelle, ses cultures avec leur surface,
 * prêtes pour l'ETM (`etm.ts`).
 *
 * Surface d'une culture : `ou.surface_m2`, ou ses planches × longueur × largeur.
 * `ou.planches` est lu comme une **plage** [première, dernière] de numéros de
 * planches : dans l'exemple de Nicolas (serre de 7 planches), la mâche est sur
 * [1, 5] et la laitue sur [6, 7], soit 5 + 2 = 7 planches. À confirmer par Nicolas.
 */
import { estDate } from './dates.ts';
import type { CultureEnPlace } from './etm.ts';
import type { TableKc } from './kc.ts';

export type CultureExport = {
  cycle: number;
  culture: string;
  ou: { planches: number[] } | { surface_m2: number };
  implantation: string;
  debut_recolte: string;
  fin: string;
  plant?: boolean;
  kc_catalogue?: unknown;
};

export type ParcelleExport = {
  id: string;
  nom?: string;
  categorie: 'serre' | 'jardin' | 'pepiniere';
  surface_m2: number;
  sol?: string;
  planches: { nombre: number; longueur_m: number; largeur_m: number } | null;
  seuil_bas_pct_RFU?: number;
  haut_de_bande_pct_RFU?: number;
  cultures: CultureExport[];
};

export type ExportDemo = { format: 'banc-opuntia-demo'; version: 1; annee: number; parcelles: ParcelleExport[] };

export type ParcelleBanc = { id: string; categorie: ParcelleExport['categorie']; serre: boolean; surface_m2: number; cultures: CultureEnPlace[] };

/** Surface d'une culture sur sa parcelle (m²). */
export function surfaceCulture(p: ParcelleExport, c: CultureExport): number {
  if ('surface_m2' in c.ou) {
    if (!(c.ou.surface_m2 > 0 && c.ou.surface_m2 <= p.surface_m2)) throw new Error(`${p.id}, ${c.culture} : surface ${c.ou.surface_m2} m² hors de la parcelle`);
    return c.ou.surface_m2;
  }
  if (!p.planches) throw new Error(`${p.id}, ${c.culture} : des planches sur une parcelle sans planches`);
  const pl = c.ou.planches;
  if (pl.length !== 2 || !Number.isInteger(pl[0]) || !Number.isInteger(pl[1]) || pl[0] < 1 || pl[1] < pl[0] || pl[1] > p.planches.nombre) {
    throw new Error(`${p.id}, ${c.culture} : planches illisibles (${JSON.stringify(pl)})`);
  }
  return (pl[1] - pl[0] + 1) * p.planches.longueur_m * p.planches.largeur_m;
}

/**
 * Vérifie l'export et rend les parcelles du banc. Une culture inconnue de la
 * table des Kc, des dates dans le désordre, un identifiant en double, un format
 * ou une version inattendus arrêtent tout.
 */
export function lireExportDemo(brut: unknown, table: TableKc): { annee: number; parcelles: ParcelleBanc[] } {
  const e = brut as Partial<ExportDemo>;
  if (e?.format !== 'banc-opuntia-demo' || e.version !== 1) throw new Error(`format d'export inattendu : ${String(e?.format)} v${String(e?.version)}`);
  if (!Number.isInteger(e.annee) || !Array.isArray(e.parcelles)) throw new Error('export sans année ou sans parcelles');
  const noms = new Set(table.cultures.map((c) => c.culture));
  const ids = new Set<string>();
  const parcelles = e.parcelles.map((p) => {
    if (typeof p.id !== 'string' || p.id === '' || ids.has(p.id)) throw new Error(`identifiant de parcelle vide ou en double : ${String(p.id)}`);
    ids.add(p.id);
    if (!['serre', 'jardin', 'pepiniere'].includes(p.categorie)) throw new Error(`${p.id} : catégorie inconnue « ${String(p.categorie)} »`);
    if (!(p.surface_m2 > 0)) throw new Error(`${p.id} : surface illisible`);
    const cultures = (p.cultures ?? []).map((c): CultureEnPlace => {
      if (!noms.has(c.culture)) throw new Error(`${p.id} : culture absente de la table des Kc : ${c.culture}`);
      for (const d of [c.implantation, c.debut_recolte, c.fin]) if (typeof d !== 'string' || !estDate(d)) throw new Error(`${p.id}, ${c.culture} : date illisible ${String(d)}`);
      if (!(c.implantation < c.debut_recolte && c.debut_recolte <= c.fin)) throw new Error(`${p.id}, ${c.culture} : dates dans le désordre`);
      return { culture: c.culture, implantation: c.implantation, debut_recolte: c.debut_recolte, fin_recolte: c.fin, surface_m2: surfaceCulture(p, c) };
    });
    return { id: p.id, categorie: p.categorie, serre: p.categorie === 'serre', surface_m2: p.surface_m2, cultures };
  });
  return { annee: e.annee!, parcelles };
}
