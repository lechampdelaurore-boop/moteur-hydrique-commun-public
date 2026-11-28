/**
 * Le juge du banc (contrat du banc, § 7 bis) : une parcelle et ses arrosages,
 * rejoués par le moteur commun (`suivre`) avec un jeu de réglages, du 15 octobre
 * de l'année d'avant (mise en route de Tlaloc) au 31 décembre de l'année.
 *
 * Chaque côté (OTF, Tlaloc) passe deux fois : avec `JEU_OTF` puis avec
 * `JEU_TLALOC`. Mêmes jours, même sol (`sol.ts`), même ETM (`etm.ts`), même
 * pluie (la réanalyse : total du jour pour un jeu journalier, heure par heure
 * pour un jeu horaire), même état de départ `{ dr_mm: 0,5 × RAW, dmax_mm: RU }`.
 * Seuls les jours du 1er janvier au 31 décembre entrent dans les comptes.
 */
import {
  bornesDuJour, pAjuste, suivre,
  type ArrosageDuJour, type JeuDeReglages, type JourDonnees, type JourSortie, type PluieDuJour,
} from '../../src/moteur.ts';
import { fenetreMeteo, jourSuivant } from './dates.ts';
import { etmSerie, type CultureEnPlace } from './etm.ts';
import type { TableKc } from './kc.ts';
import type { JourMeteo } from './meteo.ts';
import { solDuJour, type TableSol } from './sol.ts';

export type HeurePluie = { instant: string; mm: number };

/** La partie `hourly` d'une réponse d'Open-Meteo (pluie heure par heure, `timezone=Europe/Paris`). */
export type ReponseHoraire = { hourly_units?: Record<string, string>; hourly?: { time?: unknown; precipitation?: unknown } };

/**
 * Pluie heure par heure, par jour civil de Paris. Open-Meteo donne 24 heures
 * murales par jour, même les jours de changement d'heure ; la valeur d'une
 * heure est la pluie de l'heure qui la précède. Les 24 valeurs d'un jour sont
 * placées à 0/24, 1/24 … 23/24 de la vraie journée de Paris (23 ou 25 h les
 * jours de changement d'heure : un décalage d'au plus une heure ces deux
 * jours-là). Une heure absente rend la pluie du jour inconnue (null).
 */
export function pluieHoraire(reponse: ReponseHoraire): Map<string, HeurePluie[] | null> {
  const h = reponse.hourly;
  if (!h || !Array.isArray(h.time) || !Array.isArray(h.precipitation) || h.time.length !== h.precipitation.length) {
    throw new Error('réponse Open-Meteo sans hourly.time et hourly.precipitation de même longueur');
  }
  if (reponse.hourly_units?.precipitation !== 'mm') throw new Error(`unité de la pluie horaire : « ${reponse.hourly_units?.precipitation} » au lieu de « mm »`);
  const parJour = new Map<string, (number | null)[]>();
  h.time.forEach((t, i) => {
    const m = typeof t === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):00$/.exec(t) : null;
    if (!m) throw new Error(`heure illisible : ${String(t)}`);
    const v = (h.precipitation as unknown[])[i];
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) throw new Error(`pluie illisible à ${t}`);
    const heures = parJour.get(m[1]) ?? [];
    if (Number(m[2]) !== heures.length) throw new Error(`heures du ${m[1]} dans le désordre ou en double`);
    heures.push(v as number | null);
    parJour.set(m[1], heures);
  });
  const sortie = new Map<string, HeurePluie[] | null>();
  for (const [date, heures] of parJour) {
    if (heures.length !== 24) throw new Error(`le ${date} a ${heures.length} heures au lieu de 24`);
    if (heures.some((v) => v === null)) {
      sortie.set(date, null);
      continue;
    }
    const { debut, fin } = bornesDuJour(date);
    sortie.set(date, heures.map((mm, i) => ({ instant: new Date(debut + ((fin - debut) * i) / 24).toISOString(), mm: mm as number })));
  }
  return sortie;
}

export type EntreeJuge = {
  annee: number;
  serre: boolean;
  cultures: readonly CultureEnPlace[];
  /** La météo de la fenêtre de l'année (15 octobre d'avant → 31 décembre au moins). */
  meteo: readonly JourMeteo[];
  /** La pluie heure par heure, pour un jeu horaire ; absente : le total du jour. */
  heures?: ReadonlyMap<string, readonly HeurePluie[] | null>;
  arrosages: readonly ArrosageDuJour[];
  tableKc: TableKc;
  tableSol: TableSol;
};

export type JourJuge = JourSortie & {
  kc: number;
  etm_mm: number | null;
  cultures: string[];
  /** La culture qui décide du sol ; null : aucune culture en place. */
  decisive: string | null;
  /** p du tableau de la culture qui décide (avant tout ajustement à la chaleur). */
  p_tableau: number;
  /** Jour de l'année rejouée (1er janvier → 31 décembre) : il entre dans les comptes. */
  compte: boolean;
  /** RAW connue : une culture en place et l'état du jour calculé (§ 7 bis, jours non comptés). */
  raw_connue: boolean;
};

function pluieDuJour(m: JourMeteo, heures: EntreeJuge['heures'], jeu: JeuDeReglages): PluieDuJour | null {
  if (jeu.pas === 'horaire' && heures) {
    if (!heures.has(m.date)) throw new Error(`le ${m.date} manque dans la pluie horaire`);
    const h = heures.get(m.date)!;
    return h === null ? null : { type: 'heures', heures: h, source: 'reanalyse' };
  }
  return m.pluie_mm === null ? null : { type: 'jour', mm: m.pluie_mm, source: 'reanalyse' };
}

/** Rejoue une parcelle et ses arrosages avec un jeu de réglages. */
export function juger(e: EntreeJuge, jeu: JeuDeReglages): JourJuge[] {
  // Sous abri, le juge démarre le 1er janvier à Dr = ½ × RAW de ce juge, comme Tlaloc démarre une serre au seuil d'arrosage
  // (`st.Dr = serre ? thr : 0`, Nicolas, 28/11) : sans plan avant le 1er janvier, un départ le 15 octobre laisserait la serre se vider
  // sans pluie. Plein champ : départ le 15 octobre, inchangé.
  const debut = e.serre ? `${e.annee}-01-01` : fenetreMeteo(e.annee).debut;
  const fin = `${e.annee}-12-31`;
  const meteo = new Map(e.meteo.map((m) => [m.date, m]));
  const et0 = new Map(e.meteo.map((m) => [m.date, m.et0_mm]));
  const etm = etmSerie(e.cultures, e.serre, et0, debut, fin, e.tableKc);
  const sols = etm.map((j) => solDuJour(e.cultures, j.date, e.tableSol));

  const jours: JourDonnees[] = etm.map((j, i) => {
    const m = meteo.get(j.date);
    if (!m) throw new Error(`le ${j.date} manque dans la météo`);
    return { date: j.date, etc_mm: j.etm_mm, sol: sols[i].sol, abri: e.serre, pluie: e.serre ? null : pluieDuJour(m, e.heures, jeu) };
  });

  // État de départ : la moitié de la réserve facile du premier jour (§ 7 bis).
  const s0 = sols[0].sol;
  const ru0 = s0.theta_u_mm_m * s0.zr_m;
  const etm0 = etm[0].etm_mm;
  const p0 = jeu.p_ajuste_chaleur && etm0 !== null ? pAjuste(s0.p_tableau!, etm0) : s0.p_tableau!;
  const sorties = suivre(
    { aujourdhui: jourSuivant(fin), jours, arrosages: e.arrosages, etat_initial: { dr_mm: 0.5 * p0 * ru0, dmax_mm: ru0 } },
    jeu,
  );

  const premier = `${e.annee}-01-01`;
  return sorties.map((s, i) => ({
    ...s,
    kc: etm[i].kc,
    etm_mm: etm[i].etm_mm,
    cultures: etm[i].cultures,
    decisive: sols[i].decisive,
    p_tableau: sols[i].sol.p_tableau!,
    compte: s.date >= premier,
    raw_connue: sols[i].decisive !== null && s.connu && s.raw_mm !== null,
  }));
}
