/**
 * Classement des années et choix des 3 années rejouées (contrat du banc, § 3).
 *
 * Règle du contrat (accord de Nicolas du 21/11) : on classe les années par pluie
 * totale de l'année (1er janvier au 31 décembre), sur toute la réanalyse
 * disponible, avec l'ET0 Open-Meteo comme contrôle. Sèche : une année du quart
 * le plus sec ; humide : une année du quart le plus humide ; moyenne : l'année
 * la plus proche de la médiane.
 *
 * Précisions de la PR 1 (à relire par Nicolas), là où le contrat laisse le choix :
 *  1. Quartiles et médiane : percentiles par interpolation linéaire entre les
 *     années triées (méthode « type 7 », celle des tableurs). Le quart sec est
 *     l'ensemble des années dont la pluie est ≤ au 1er quartile ; le quart humide,
 *     ≥ au 3e quartile.
 *  2. Une année n'entre au classement que si ses 365 ou 366 jours ont pluie et
 *     ET0 ; elle ne peut être choisie que si toute sa fenêtre de météo (15 octobre
 *     d'avant au 12 janvier d'après) est complète.
 *  3. Contrôle par l'ET0 : le bilan climatique de l'année (pluie − ET0, en mm).
 *     Une année sèche doit avoir un bilan dans la moitié la plus sèche des bilans
 *     (≤ médiane) ; une année humide, dans la moitié la plus humide (≥ médiane) ;
 *     l'année moyenne, entre le 1er et le 3e quartile des bilans.
 *  4. Dans le quart sec (ou humide), on garde d'abord les années qui passent le
 *     contrôle (s'il n'y en a aucune, toutes, et le contrôle est dit « non
 *     conforme ») ; puis, s'il y en a, celles que couvre l'archive des prévisions
 *     (passe 2 possible, § 6) ; enfin l'année la plus proche du milieu du quart
 *     (percentile 12,5 pour la sèche, 87,5 pour l'humide), pour ne pas prendre un
 *     extrême isolé. À égalité, la plus récente.
 *  5. L'année moyenne suit le contrat à la lettre : la plus proche de la médiane
 *     parmi les années qui peuvent être choisies (à égalité, la plus récente) ; le
 *     contrôle par l'ET0 et la couverture de la passe 2 sont seulement dits.
 */
import { bornesAnnee, fenetreMeteo, joursEntre } from './dates.ts';
import type { JourMeteo } from './meteo.ts';

export type TotauxAnnee = { annee: number; jours: number; pluie_mm: number; et0_mm: number; bilan_mm: number };

export type Categorie = 'quart sec' | 'milieu' | 'quart humide';

export type LigneClassement = TotauxAnnee & {
  /** 1 = l'année la moins pluvieuse. */
  rang_pluie: number;
  /** 1 = le bilan (pluie − ET0) le plus bas. */
  rang_bilan: number;
  categorie: Categorie;
  /** Fenêtre de météo complète : l'année peut être rejouée. */
  eligible: boolean;
  /** Archive des prévisions complète sur l'année : passe 2 possible. */
  couverte: boolean;
};

export type Choix = {
  annee: number;
  /** Années parmi lesquelles le choix s'est fait, après chaque filtre. */
  candidats: { quart: number[]; apres_controle: number[]; apres_couverture: number[] };
  controle_et0: 'conforme' | 'non conforme';
  passe2: 'possible' | 'omise';
  cible_mm: number;
  raison: string;
};

export type Classement = {
  nombre_annees: number;
  premiere_annee: number;
  derniere_annee: number;
  pluie: { p12_5: number; q1: number; mediane: number; q3: number; p87_5: number };
  bilan: { q1: number; mediane: number; q3: number };
  tableau: LigneClassement[];
  choix: { seche: Choix; humide: Choix; moyenne: Choix };
};

/** Arrondi au centième de mm : les données d'Open-Meteo n'ont pas plus fin. */
export const auCentieme = (x: number) => Math.round(x * 100) / 100;

/**
 * Totaux de chaque année entière présente dans la série. Une année à laquelle il
 * manque un jour, une pluie ou une ET0 n'est pas classée (D-003 : un inconnu ne
 * devient pas 0).
 */
export function totauxAnnuels(jours: JourMeteo[]): TotauxAnnee[] {
  const parDate = new Map(jours.map((j) => [j.date, j]));
  const annees = [...new Set(jours.map((j) => Number(j.date.slice(0, 4))))].sort((a, b) => a - b);
  const totaux: TotauxAnnee[] = [];
  for (const annee of annees) {
    const { debut, fin } = bornesAnnee(annee);
    const dates = joursEntre(debut, fin);
    let pluie = 0;
    let et0 = 0;
    let complete = true;
    for (const d of dates) {
      const j = parDate.get(d);
      if (!j || j.pluie_mm === null || j.et0_mm === null) { complete = false; break; }
      pluie += j.pluie_mm;
      et0 += j.et0_mm;
    }
    if (!complete) continue;
    totaux.push({ annee, jours: dates.length, pluie_mm: auCentieme(pluie), et0_mm: auCentieme(et0), bilan_mm: auCentieme(pluie - et0) });
  }
  return totaux;
}

/** Percentile `p` (0 à 1) par interpolation linéaire entre valeurs triées (« type 7 »). */
export function percentile(valeurs: number[], p: number): number {
  if (valeurs.length === 0) throw new Error('percentile d\'une liste vide');
  if (p < 0 || p > 1) throw new Error(`percentile hors de 0 à 1 : ${p}`);
  const v = [...valeurs].sort((a, b) => a - b);
  const h = (v.length - 1) * p;
  const bas = Math.floor(h);
  const haut = Math.min(bas + 1, v.length - 1);
  return v[bas] + (h - bas) * (v[haut] - v[bas]);
}

/** Rangs de 1 à n selon `cle` croissante ; à égalité, l'année la plus ancienne d'abord. */
function rangs(totaux: TotauxAnnee[], cle: (t: TotauxAnnee) => number): Map<number, number> {
  const tries = [...totaux].sort((a, b) => cle(a) - cle(b) || a.annee - b.annee);
  return new Map(tries.map((t, i) => [t.annee, i + 1]));
}

/** L'année la plus proche de `cible` ; à égalité, la plus récente. */
function plusProche(lignes: LigneClassement[], cible: number): LigneClassement {
  return [...lignes].sort((a, b) => Math.abs(a.pluie_mm - cible) - Math.abs(b.pluie_mm - cible) || b.annee - a.annee)[0];
}

/** Un nombre de mm à une décimale, à la française (virgule). */
const fr = (x: number) => x.toFixed(1).replace('.', ',');
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

const annees = (l: LigneClassement[]) => l.map((x) => x.annee).sort((a, b) => a - b);

export function classer(totaux: TotauxAnnee[], eligibles: ReadonlySet<number>, couvertes: ReadonlySet<number>): Classement {
  if (totaux.length < 4) throw new Error(`il faut au moins 4 années complètes pour former des quarts (${totaux.length})`);
  const pluies = totaux.map((t) => t.pluie_mm);
  const bilans = totaux.map((t) => t.bilan_mm);
  const pluie = {
    p12_5: percentile(pluies, 0.125), q1: percentile(pluies, 0.25), mediane: percentile(pluies, 0.5),
    q3: percentile(pluies, 0.75), p87_5: percentile(pluies, 0.875),
  };
  const bilan = { q1: percentile(bilans, 0.25), mediane: percentile(bilans, 0.5), q3: percentile(bilans, 0.75) };
  const rangPluie = rangs(totaux, (t) => t.pluie_mm);
  const rangBilan = rangs(totaux, (t) => t.bilan_mm);

  const tableau: LigneClassement[] = totaux
    .map((t) => ({
      ...t,
      rang_pluie: rangPluie.get(t.annee)!,
      rang_bilan: rangBilan.get(t.annee)!,
      categorie: (t.pluie_mm <= pluie.q1 ? 'quart sec' : t.pluie_mm >= pluie.q3 ? 'quart humide' : 'milieu') as Categorie,
      eligible: eligibles.has(t.annee),
      couverte: couvertes.has(t.annee),
    }))
    .sort((a, b) => a.rang_pluie - b.rang_pluie);

  const controle = {
    seche: (l: LigneClassement) => l.bilan_mm <= bilan.mediane,
    humide: (l: LigneClassement) => l.bilan_mm >= bilan.mediane,
    moyenne: (l: LigneClassement) => l.bilan_mm >= bilan.q1 && l.bilan_mm <= bilan.q3,
  };

  const choisirDansLeQuart = (sens: 'seche' | 'humide'): Choix => {
    const nom = sens === 'seche' ? 'quart sec' : 'quart humide';
    const cible = sens === 'seche' ? pluie.p12_5 : pluie.p87_5;
    const quart = tableau.filter((l) => l.categorie === nom && l.eligible);
    if (quart.length === 0) throw new Error(`aucune année du ${nom} ne peut être rejouée (fenêtre de météo incomplète)`);
    const passent = quart.filter(controle[sens]);
    const apresControle = passent.length > 0 ? passent : quart;
    const couvertesDuQuart = apresControle.filter((l) => l.couverte);
    const apresCouverture = couvertesDuQuart.length > 0 ? couvertesDuQuart : apresControle;
    const retenue = plusProche(apresCouverture, cible);
    const etapes = [
      quart.length > 1 ? `${quart.length} années du ${nom} peuvent être rejouées` : `1 année du ${nom} peut être rejouée`,
      passent.length > 0
        ? `${pluriel(passent.length, 'passe', 'passent')} le contrôle par l'ET0 (bilan ${sens === 'seche' ? '≤' : '≥'} médiane des bilans, ${fr(bilan.mediane)} mm)`
        : `aucune ne passe le contrôle par l'ET0 : toutes sont gardées, contrôle non conforme`,
      couvertesDuQuart.length > 0
        ? `${pluriel(couvertesDuQuart.length, 'est couverte', 'sont couvertes')} par l'archive des prévisions`
        : `aucune n'est couverte par l'archive des prévisions : passe 2 omise`,
      `la plus proche du milieu du quart (percentile ${sens === 'seche' ? '12,5' : '87,5'}, ${fr(cible)} mm) est ${retenue.annee} (${fr(retenue.pluie_mm)} mm)`,
    ];
    return {
      annee: retenue.annee,
      candidats: { quart: annees(quart), apres_controle: annees(apresControle), apres_couverture: annees(apresCouverture) },
      controle_et0: controle[sens](retenue) ? 'conforme' : 'non conforme',
      passe2: retenue.couverte ? 'possible' : 'omise',
      cible_mm: cible,
      raison: etapes.join(' ; ') + '.',
    };
  };

  const choisirMoyenne = (): Choix => {
    const possibles = tableau.filter((l) => l.eligible);
    if (possibles.length === 0) throw new Error('aucune année ne peut être rejouée');
    const retenue = plusProche(possibles, pluie.mediane);
    const ok = controle.moyenne(retenue);
    return {
      annee: retenue.annee,
      candidats: { quart: annees(possibles), apres_controle: annees(possibles), apres_couverture: annees(possibles) },
      controle_et0: ok ? 'conforme' : 'non conforme',
      passe2: retenue.couverte ? 'possible' : 'omise',
      cible_mm: pluie.mediane,
      raison:
        `la plus proche de la médiane (${fr(pluie.mediane)} mm) parmi ${possibles.length} années qui peuvent être rejouées est ` +
        `${retenue.annee} (${fr(retenue.pluie_mm)} mm) ; contrôle par l'ET0 ${ok ? 'conforme' : 'non conforme'} ` +
        `(bilan ${fr(retenue.bilan_mm)} mm, entre ${fr(bilan.q1)} et ${fr(bilan.q3)} mm attendu) ; ` +
        `passe 2 ${retenue.couverte ? 'possible' : 'omise'}.`,
    };
  };

  const choix = { seche: choisirDansLeQuart('seche'), humide: choisirDansLeQuart('humide'), moyenne: choisirMoyenne() };
  const retenues = new Set([choix.seche.annee, choix.humide.annee, choix.moyenne.annee]);
  if (retenues.size !== 3) throw new Error(`les 3 années choisies ne sont pas distinctes : ${[...retenues].join(', ')}`);

  return {
    nombre_annees: totaux.length,
    premiere_annee: Math.min(...totaux.map((t) => t.annee)),
    derniere_annee: Math.max(...totaux.map((t) => t.annee)),
    pluie,
    bilan,
    tableau,
    choix,
  };
}

/** Années dont toute la fenêtre de météo (15 octobre d'avant au 12 janvier d'après) a pluie et ET0. */
export function anneesEligibles(jours: JourMeteo[], annees: number[]): Set<number> {
  const parDate = new Map(jours.map((j) => [j.date, j]));
  return new Set(
    annees.filter((annee) => {
      const { debut, fin } = fenetreMeteo(annee);
      return joursEntre(debut, fin).every((d) => {
        const j = parDate.get(d);
        return j !== undefined && j.pluie_mm !== null && j.et0_mm !== null;
      });
    }),
  );
}
