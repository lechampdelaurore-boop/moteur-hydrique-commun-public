/**
 * Classement des années et choix des 3 années rejouées (contrat du banc, § 3).
 *
 * Règle du contrat (accord de Nicolas du 21/11) : on classe les années par pluie
 * totale de l'année (1er janvier au 31 décembre), sur toute la réanalyse
 * disponible, avec l'ET0 Open-Meteo comme contrôle. Sèche : une année du quart
 * le plus sec ; humide : une année du quart le plus humide ; moyenne : l'année
 * la plus proche de la médiane.
 *
 * Précisions de la PR 1 (à relire par Nicolas), là où le contrat laisse le choix ;
 * numérotées comme au § 3 bis du contrat (le point 1, la réanalyse, est dans
 * `open-meteo.ts`). Les comparaisons (quartiles, contrôle, distances à la cible)
 * se font au centième de mm, la précision des données : une égalité au bruit de
 * calcul près est une égalité.
 *  2. Quartiles et médiane : percentiles par interpolation linéaire entre les
 *     années triées (méthode « type 7 », celle des tableurs). Le quart sec est
 *     l'ensemble des années dont la pluie est ≤ au 1er quartile ; le quart humide,
 *     ≥ au 3e quartile.
 *  3. Une année n'entre au classement que si ses 365 ou 366 jours ont pluie et
 *     ET0 ; elle ne peut être choisie que si toute sa fenêtre de météo (15 octobre
 *     d'avant au 12 janvier d'après) est complète.
 *  4. Contrôle par l'ET0 : le bilan climatique de l'année (pluie − ET0, en mm).
 *     Une année sèche doit avoir un bilan dans la moitié la plus sèche des bilans
 *     (≤ médiane) ; une année humide, dans la moitié la plus humide (≥ médiane) ;
 *     l'année moyenne, entre le 1er et le 3e quartile des bilans.
 *  5. Années récentes d'abord : le classement et ses quarts portent sur toutes
 *     les années, mais le choix se fait d'abord parmi les 30 dernières années
 *     classées (les 30 plus récentes du classement, une normale climatique), s'il
 *     y en a. Sur ce lieu, l'ET0 moyenne
 *     des 30 dernières années dépasse d'environ 10 % celle de 1950 à 1978, et la
 *     réanalyse d'avant 1979 (sans satellites) est moins sûre : une année ancienne
 *     rejouerait un climat qui n'est plus celui des fermes d'aujourd'hui.
 *  6. Dans le quart sec (ou humide), on garde d'abord les années qui passent le
 *     contrôle (s'il n'y en a aucune, toutes, et le contrôle est dit « non
 *     conforme ») ; puis les années récentes (point 5) ; puis, s'il y en a,
 *     celles que couvre l'archive des prévisions (passe 2 possible, § 6) ; enfin
 *     l'année la plus proche du milieu du quart (percentile 12,5 pour la sèche,
 *     87,5 pour l'humide), pour ne pas prendre un extrême isolé. À égalité, la
 *     plus récente.
 *  7. L'année moyenne : la plus proche de la médiane de toutes les années, prise
 *     parmi les années récentes qui peuvent être choisies (à égalité, la plus
 *     récente) ; le contrôle par l'ET0 et la couverture de la passe 2 sont
 *     seulement dits.
 */
import { bornesAnnee, fenetreMeteo, joursEntre } from './dates.ts';
import type { JourMeteo } from './meteo.ts';

/** Le choix se fait d'abord parmi les 30 dernières années classées (point 5). */
export const ANNEES_RECENTES = 30;

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
  /** Parmi les 30 dernières années classées (point 5). */
  recente: boolean;
};

export type Choix = {
  annee: number;
  /** Années parmi lesquelles le choix s'est fait, après chaque filtre. */
  candidats: { quart: number[]; apres_controle: number[]; apres_recence: number[]; apres_couverture: number[] };
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
  const distance = (l: LigneClassement) => auCentieme(Math.abs(l.pluie_mm - cible));
  return [...lignes].sort((a, b) => distance(a) - distance(b) || b.annee - a.annee)[0];
}

/** Un nombre de mm à une décimale, à la française (virgule). */
const fr = (x: number) => x.toFixed(1).replace('.', ',');
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

const annees = (l: LigneClassement[]) => l.map((x) => x.annee).sort((a, b) => a - b);

/** `nombreRecentes` : 30 au banc (point 5) ; un autre nombre ne sert qu'aux tests. */
export function classer(
  totaux: TotauxAnnee[],
  eligibles: ReadonlySet<number>,
  couvertes: ReadonlySet<number>,
  nombreRecentes: number = ANNEES_RECENTES,
): Classement {
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
  const derniere = Math.max(...totaux.map((t) => t.annee));
  // Les 30 années les plus récentes du classement (une année incomplète n'y est pas, donc n'en prend pas la place).
  const anneesRecentes = new Set([...totaux].sort((a, b) => b.annee - a.annee).slice(0, nombreRecentes).map((t) => t.annee));
  const premiereRecente = Math.min(...anneesRecentes);
  // Comparaisons au centième (voir en tête).
  const c = { q1: auCentieme(pluie.q1), q3: auCentieme(pluie.q3), bMed: auCentieme(bilan.mediane), bQ1: auCentieme(bilan.q1), bQ3: auCentieme(bilan.q3) };

  const tableau: LigneClassement[] = totaux
    .map((t) => ({
      ...t,
      rang_pluie: rangPluie.get(t.annee)!,
      rang_bilan: rangBilan.get(t.annee)!,
      categorie: (auCentieme(t.pluie_mm) <= c.q1 ? 'quart sec' : auCentieme(t.pluie_mm) >= c.q3 ? 'quart humide' : 'milieu') as Categorie,
      eligible: eligibles.has(t.annee),
      couverte: couvertes.has(t.annee),
      recente: anneesRecentes.has(t.annee),
    }))
    .sort((a, b) => a.rang_pluie - b.rang_pluie);

  const controle = {
    seche: (l: LigneClassement) => auCentieme(l.bilan_mm) <= c.bMed,
    humide: (l: LigneClassement) => auCentieme(l.bilan_mm) >= c.bMed,
    moyenne: (l: LigneClassement) => auCentieme(l.bilan_mm) >= c.bQ1 && auCentieme(l.bilan_mm) <= c.bQ3,
  };

  const depuis = `${premiereRecente} à ${derniere}`;

  const choisirDansLeQuart = (sens: 'seche' | 'humide'): Choix => {
    const nom = sens === 'seche' ? 'quart sec' : 'quart humide';
    const cible = sens === 'seche' ? pluie.p12_5 : pluie.p87_5;
    const quart = tableau.filter((l) => l.categorie === nom && l.eligible);
    if (quart.length === 0) throw new Error(`aucune année du ${nom} ne peut être rejouée (fenêtre de météo incomplète)`);
    const passent = quart.filter(controle[sens]);
    const apresControle = passent.length > 0 ? passent : quart;
    const recentes = apresControle.filter((l) => l.recente);
    const apresRecence = recentes.length > 0 ? recentes : apresControle;
    const couvertesDuQuart = apresRecence.filter((l) => l.couverte);
    const apresCouverture = couvertesDuQuart.length > 0 ? couvertesDuQuart : apresRecence;
    const retenue = plusProche(apresCouverture, cible);
    const etapes = [
      quart.length > 1 ? `${quart.length} années du ${nom} peuvent être rejouées` : `1 année du ${nom} peut être rejouée`,
      passent.length > 0
        ? `${pluriel(passent.length, 'passe', 'passent')} le contrôle par l'ET0 (bilan ${sens === 'seche' ? '≤' : '≥'} médiane des bilans, ${fr(bilan.mediane)} mm)`
        : `aucune ne passe le contrôle par l'ET0 : toutes sont gardées, contrôle non conforme`,
      recentes.length > 0
        ? `${pluriel(recentes.length, 'est', 'sont')} des ${nombreRecentes} dernières années classées (${depuis})`
        : `aucune n'est des ${nombreRecentes} dernières années classées : toutes sont gardées`,
      couvertesDuQuart.length > 0
        ? `${pluriel(couvertesDuQuart.length, 'est couverte', 'sont couvertes')} par l'archive des prévisions`
        : `aucune n'est couverte par l'archive des prévisions : passe 2 omise`,
      `la plus proche du milieu du quart (percentile ${sens === 'seche' ? '12,5' : '87,5'}, ${fr(cible)} mm) est ${retenue.annee} (${fr(retenue.pluie_mm)} mm)`,
    ];
    return {
      annee: retenue.annee,
      candidats: { quart: annees(quart), apres_controle: annees(apresControle), apres_recence: annees(apresRecence), apres_couverture: annees(apresCouverture) },
      controle_et0: controle[sens](retenue) ? 'conforme' : 'non conforme',
      passe2: retenue.couverte ? 'possible' : 'omise',
      cible_mm: cible,
      raison: etapes.join(' ; ') + '.',
    };
  };

  const choisirMoyenne = (): Choix => {
    const possibles = tableau.filter((l) => l.eligible);
    if (possibles.length === 0) throw new Error('aucune année ne peut être rejouée');
    const recentes = possibles.filter((l) => l.recente);
    const parmi = recentes.length > 0 ? recentes : possibles;
    const retenue = plusProche(parmi, pluie.mediane);
    const ok = controle.moyenne(retenue);
    return {
      annee: retenue.annee,
      candidats: { quart: annees(possibles), apres_controle: annees(possibles), apres_recence: annees(parmi), apres_couverture: annees(parmi) },
      controle_et0: ok ? 'conforme' : 'non conforme',
      passe2: retenue.couverte ? 'possible' : 'omise',
      cible_mm: pluie.mediane,
      raison:
        `la plus proche de la médiane de toutes les années (${fr(pluie.mediane)} mm), parmi ${parmi.length} années ` +
        `${recentes.length > 0 ? `récentes (${depuis}) ` : ''}qui peuvent être rejouées, est ` +
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
