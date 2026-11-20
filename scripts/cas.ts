/**
 * Exécute les cas de test partagés (cas/cas-otf.json, cas/cas-tlaloc.json)
 * sur le moteur commun et compare aux valeurs écrites, à 0,01 mm près (MC-30).
 *
 *   node --experimental-strip-types scripts/cas.ts          (moteur de src/)
 *   node --experimental-strip-types scripts/cas.ts --dist   (les deux fichiers construits, comparés à src/)
 *
 * Chaque valeur reçoit un verdict : « conforme », « écart », « hors moteur »
 * (ETM, sol de labo, seuils, pénurie, sol nu : MC-03, MC-16, MC-18) ou
 * « à venir » (options de Tlaloc : poing en fourchette, consommation apprise,
 * tensiomètre, PR suivante). Une valeur fausse se corrige dans le contrat
 * ou dans le moteur après discussion, jamais en touchant le cas en silence.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import * as SRC from '../src/moteur.ts';
import type { EntreeSuivi, JeuDeReglages, JourDonnees, JourSortie, SolDuJour } from '../src/moteur.ts';

export type Moteur = typeof SRC;
type Verdict = 'conforme' | 'écart' | 'hors moteur' | 'à venir';
export type Valeur = { cle: string; attendu: unknown; obtenu: unknown; verdict: Verdict; note?: string };
export type ResultatCas = { id: string; titre: string; fichier: string; valeurs: Valeur[] };

const TOLERANCE = 0.01;
const lire = (chemin: string) => JSON.parse(readFileSync(new URL(chemin, import.meta.url), 'utf8'));

/** Lundi 1er juin 2026 : des jours de 24 h (UTC+2). */
const D1 = '2026-06-01';
const PLUS_TARD = '2026-12-31';
const PART_REFERENCE_OTF = 2 / 3;

/** Les mots des cas pour les raisons et départs du moteur. */
const MOTS: Record<string, string> = { pluie_inconnue: 'pluie manquante', remplissage: 'apport', bloque: 'bloqué', prevu: 'prévu', estime: 'estimé' };

function comparer(attendu: unknown, obtenu: unknown): Verdict {
  if (typeof attendu === 'number' && typeof obtenu === 'number') return Math.abs(attendu - obtenu) <= TOLERANCE ? 'conforme' : 'écart';
  return attendu === obtenu ? 'conforme' : 'écart';
}

/* ---------- Constructions communes ---------- */

function jourSuivant(date: string, n: number): string {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

function outils(M: Moteur) {
  const a = (date: string, heures: number) => new Date(M.bornesDuJour(date).debut + heures * 3_600_000).toISOString();
  /** Sol d'OTF : RFU du sol (mm/m) et profondeur ; θu = RFU ÷ part de référence (MC-01), plancher = capacité (MC-02). */
  const solOTF = (rfu: number, zr: number, p: number | null = 0.5): SolDuJour => ({ theta_u_mm_m: rfu / PART_REFERENCE_OTF, zr_m: zr, p_tableau: p, plancher_mm: rfu * zr });
  /** Sol d'OTF d'une capacité donnée, à 30 cm. */
  const solCapacite = (capacite: number): SolDuJour => solOTF(capacite / 0.3, 0.3);
  /** Sol de Tlaloc : la RU directement (zr = 1 m), sans plancher. */
  const solRU = (ru: number, plancher: number | null = null, p: number | null = null): SolDuJour => ({ theta_u_mm_m: ru, zr_m: 1, p_tableau: p, plancher_mm: plancher });
  const jour = (i: number, j: Partial<JourDonnees> & Pick<JourDonnees, 'sol'>): JourDonnees => ({
    date: jourSuivant(D1, i), etc_mm: 0, abri: false, pluie: { type: 'jour', mm: 0 }, ...j,
  });
  const suivre = (e: Partial<EntreeSuivi> & Pick<EntreeSuivi, 'jours'>, jeu: JeuDeReglages): JourSortie[] =>
    M.suivre({ aujourdhui: PLUS_TARD, ...e }, jeu);
  /** Pluie déjà utile (le cas la donne réduite) : jeu sans interception ni ruissellement. */
  const neutre = (jeu: JeuDeReglages): JeuDeReglages => ({ ...jeu, pluie: { ...jeu.pluie, interception_mm: 0, seuil_ruissellement_mm_h: null } });
  return { a, solOTF, solCapacite, solRU, jour, suivre, neutre };
}

const etat = (s: JourSortie) => (s.dr_mm === null || s.dmax_mm === null ? null : s.dmax_mm - s.dr_mm);
const depart = (s: JourSortie) => (s.dr_depart_mm === null || s.dmax_mm === null ? null : s.dmax_mm - s.dr_depart_mm);

/* ---------- Les cas ---------- */

type Mesures = Record<string, unknown | { horsMoteur: string } | { aVenir: string }>;
const hors = (raison: string) => ({ horsMoteur: raison });
const aVenir = (raison: string) => ({ aVenir: raison });

function casOTF(M: Moteur): Record<string, (e: any) => Mesures> {
  const { a, solOTF, solCapacite, jour, suivre } = outils(M);
  const OTF = M.JEU_OTF;
  const obsPlein = (pct: number, cap: number, instant: string) => ({ instant, type: 'manque' as const, dr_mm: cap * (1 - pct / 100) });
  return {
    O01: () => ({ plein_champ: hors('ETM, MC-18'), sous_abri: hors('ETM, MC-18'), sous_abri_paillage: hors('ETM, MC-18'), sous_abri_paillage_ombrage: hors('ETM, MC-18') }),
    O02: () => ({ rfu_sol_mm_par_m: hors('sol de labo, MC-18') }),
    O03: (e) => {
      const [s] = suivre({ jours: [jour(0, { sol: solOTF(e.rfu_sol, e.profondeur_m, e.p) })] }, OTF);
      return {
        capacite_mm: s.dmax_mm, RU_mm: s.ru_mm, RAW_mm: s.raw_mm,
        seuil_selon_culture_mm: hors('seuil, MC-03'), seuil_ferme_mm: hors('seuil, MC-03'),
      };
    },
    O04: (e) => {
      const cap = e.capacite, sol = solCapacite(cap);
      const s = suivre({
        etat_initial: { dr_mm: cap - e.jour1.etat_veille, dmax_mm: sol.plancher_mm as number },
        jours: [jour(0, { sol, etc_mm: e.jour1.conso, pluie: { type: 'jour', mm: e.jour1.pluie } }), jour(1, { sol, etc_mm: e.jour2.conso, pluie: { type: 'jour', mm: e.jour2.pluie } })],
      }, OTF);
      return {
        etat_fin_jour1: etat(s[0]), etat_fin_jour2: etat(s[1]),
        'attendu_en_manque_Dr.Dr_veille': s[0].dr_depart_mm, 'attendu_en_manque_Dr.Dr_fin_jour1': s[0].dr_mm, 'attendu_en_manque_Dr.Dr_fin_jour2': s[1].dr_mm,
      };
    },
    O05: (e) => {
      const cap = e.capacite, [h, m] = String(e.heure).split(':').map(Number);
      const b = M.bornesDuJour(D1);
      if ((b.fin - b.debut) / 3_600_000 !== e.duree_jour_h) throw new Error('O05 : durée du jour d\'essai');
      const [s] = suivre({
        jours: [jour(0, { sol: solCapacite(cap), etc_mm: e.conso, pluie: { type: 'jour', mm: e.pluie } })],
        observations: [obsPlein(e.observation_pct, cap, a(D1, h + m / 60))],
      }, OTF);
      return { etat_apres_observation: depart(s), fraction: s.fraction, etat_fin: etat(s) };
    },
    O06: (e) => {
      const avant = solCapacite(e.capacite_avant), apres = solCapacite(e.capacite_apres);
      const jours = [jour(0, { sol: avant }), jour(1, { sol: apres })];
      const observations = [obsPlein(e.etat / e.capacite_avant * 100, e.capacite_avant, a(D1, 0))];
      const pourcent = suivre({ jours, observations }, OTF)[1];
      const manque = suivre({ jours, observations }, { ...OTF, conservation: 'manque' })[1];
      return {
        etat_apres: depart(pourcent), etat_apres_conservation_pourcent: depart(pourcent),
        etat_apres_conservation_manque: depart(manque),
        pourcent_du_plein_apres_conservation_manque: manque.pct_plein,
      };
    },
    O07: (e) => {
      const sol = solCapacite(e.capacite);
      const s = suivre({ jours: [jour(0, { sol, etc_mm: null }), jour(1, { sol, etc_mm: 0, pluie: { type: 'jour', mm: e.jour2.apports } })] }, OTF);
      return { etat_jour1: etat(s[0]), etat_jour2: etat(s[1]), drainage_jour2: s[1].drainage_mm };
    },
    O08: () => ({ B: hors('pénurie, décision (MC-03)'), A: hors('pénurie, décision (MC-03)') }),
    O09: () => ({ Kr: hors('sol nu, MC-18'), E_mm: hors('sol nu, MC-18') }),
    O10: (e) => {
      const cap = 15.3;
      const [s] = suivre({
        jours: [jour(0, { sol: solCapacite(cap), etc_mm: e.pluie + e.irrigation - e.drainage, pluie: { type: 'jour', mm: e.pluie } })],
        observations: [obsPlein(100, cap, a(D1, 0))],
        arrosages: [{ debut: a(D1, 6), fin: a(D1, 7), mm: e.irrigation }],
      }, OTF);
      if (Math.abs((s.drainage_mm ?? NaN) - e.drainage) > 1e-9) throw new Error('O10 : drainage du jour d\'essai');
      return { eau_perdue: s.eau_perdue_mm };
    },
    L1: (e) => {
      const sol = solCapacite(15.3);
      const s = suivre({
        jours: ['jour1', 'jour2', 'jour3', 'jour4'].map((k, i) => jour(i, { sol, etc_mm: e[k].etm, pluie: e[k].pluie === null ? null : { type: 'jour', mm: e[k].pluie } })),
        observations: [obsPlein(e.jour1.observation_pct, 15.3, a(D1, 0))],
      }, OTF);
      const raison = (x: JourSortie) => (x.raison_inconnu ? MOTS[x.raison_inconnu.code] ?? x.raison_inconnu.code : null);
      return {
        jour1_etat: etat(s[0]), jour2_etat: etat(s[1]), jour2_raison: raison(s[1]), jour3_etat: etat(s[2]), jour3_raison: raison(s[2]),
        jour4_etat: etat(s[3]), jour4_depart: s[3].redemarrage ? MOTS[s[3].redemarrage] : null,
      };
    },
    L2: (e) => {
      const [s] = suivre({
        jours: [jour(0, { sol: solCapacite(15.3), etc_mm: e.etm, pluie: { type: 'jour', mm: e.pluie } })],
        observations: [obsPlein(e.observation_pct, 15.3, a(D1, 12))],
        arrosages: e.arrosages.map((x: any) => ({ debut: a(D1, +x.de.slice(0, 2)), fin: a(D1, +x.a.slice(0, 2)), mm: x.mm })),
      }, OTF);
      return { fraction: s.fraction, depart: depart(s), irrigation_comptee: s.arrosage_mm, etat_fin: etat(s) };
    },
    L3: (e) => {
      const s = suivre({
        jours: [jour(0, { sol: solOTF(51, e.jour1.profondeur_m), etc_mm: e.jour1.etm }), jour(1, { sol: solOTF(51, e.jour2.profondeur_m), etc_mm: e.jour2.etm })],
        observations: [obsPlein(e.jour1.observation_pct, 51 * e.jour1.profondeur_m, a(D1, 0))],
      }, OTF);
      return { jour1_etat: etat(s[0]), jour2_capacite: s[1].dmax_mm, jour2_depart: depart(s[1]), jour2_etat: etat(s[1]) };
    },
    'L3 bis': (e) => {
      const s = suivre({
        jours: [jour(0, { sol: solOTF(51, e.jour1.profondeur_m), etc_mm: e.jour1.etm }), jour(1, { sol: solOTF(51, e.jour2.profondeur_m), etc_mm: e.jour2.etm })],
        observations: [obsPlein(e.jour1.observation_pct, 51 * e.jour1.profondeur_m, a(D1, 0))],
      }, OTF);
      return { jour1_etat: etat(s[0]), jour2_depart: depart(s[1]) };
    },
    L4: (e) => {
      const heures = [[6, 7], [20, 21]];
      const [s] = suivre({
        aujourdhui: D1,
        jours: [jour(0, { sol: solCapacite(15.3), etc_mm: e.etm, pluie: { type: 'jour', mm: e.pluie } })],
        observations: [obsPlein(e.observation_pct, 15.3, a(D1, 0))],
        arrosages: e.arrosages.map((x: any, i: number) => ({ debut: a(D1, heures[i][0]), fin: a(D1, heures[i][1]), mm: x.mm, nature: x.nature })),
      }, OTF);
      return { nature: MOTS[s.nature], irrigation: s.arrosage_mm, etat_fin: etat(s), drainage: s.drainage_mm };
    },
    L5: (e) => {
      const sol = solCapacite(15.3);
      const s = suivre({
        jours: [jour(0, { sol, abri: true, etc_mm: e.jour1.etm, pluie: { type: 'jour', mm: e.jour1.pluie_pluviometre } }), jour(1, { sol, abri: true, etc_mm: e.jour2.etm, pluie: null })],
        observations: [obsPlein(e.jour1.observation_pct, 15.3, a(D1, 0))],
      }, OTF);
      return { jour1_pluie_comptee: s[0].pluie_mm, jour1_etat: etat(s[0]), jour2_etat: etat(s[1]), jour2_raison: s[1].raison_inconnu?.code ?? null };
    },
    L6: () => {
      const [s] = suivre({
        jours: [jour(0, { sol: solCapacite(15.3), etc_mm: null, etc_raison: 'bloque' })],
        observations: [obsPlein(100, 15.3, a(D1, 0))],
      }, OTF);
      const et0 = hors('ET0 et ETM, MC-16 (bornes de MC-37 appliquées par chaque logiciel à son ETM)');
      return {
        et0_11_9: et0, et0_12_1: et0, et0_14_9: et0, et0_15_1: et0, et0_moins_0_1: et0,
        jauge_etat: etat(s), jauge_raison: s.raison_inconnu?.detail ? MOTS[s.raison_inconnu.detail] : null,
      };
    },
    L7: (e) => {
      const sol = solCapacite(15.3);
      const s = suivre({
        etat_initial: { dr_mm: 15.3 - e.jour0_etat, dmax_mm: sol.plancher_mm as number },
        jours: ['jour1', 'jour2', 'jour3'].map((k, i) => jour(i, { sol, etc_mm: e[k].etm, pluie: { type: 'jour', mm: e[k].pluie } })),
      }, OTF);
      return { jour1_etat: etat(s[0]), jour2_etat: etat(s[1]), jour3_etat: etat(s[2]) };
    },
  };
}

function casTlaloc(M: Moteur): Record<string, (e: any) => Mesures> {
  const { a, solRU, jour, suivre, neutre } = outils(M);
  const T = M.JEU_TLALOC, O = M.JEU_OTF;
  const unJour = (e: { Dr0: number; etc: number; taw: number }, jeu: JeuDeReglages, extra: Partial<EntreeSuivi> = {}, j: Partial<JourDonnees> = {}) =>
    suivre({ etat_initial: { dr_mm: e.Dr0, dmax_mm: e.taw }, jours: [jour(0, { sol: solRU(e.taw), etc_mm: e.etc, ...j })], ...extra }, jeu)[0];
  const option = aVenir('option de Tlaloc, PR suivante');
  return {
    T01: (e) => {
      const s = unJour(e, T);
      return { Dr: s.dr_mm, perteIrrigation: s.eau_perdue_mm, drainagePluie: s.drainage_pluie_mm };
    },
    T02: (e) => {
      const arrosages = e.apports.map((x: any) => ({ debut: a(D1, x.f * 24), fin: null, mm: x.mm }));
      const h = unJour(e, T, { arrosages }), j = unJour(e, O, { arrosages });
      return { Dr_horaire: h.dr_mm, perte_horaire: h.eau_perdue_mm, Dr_journalier: j.dr_mm, perte_journalier: j.eau_perdue_mm };
    },
    T03: (e) => {
      const heures = e.apports.map((x: any) => ({ instant: a(D1, x.f * 24), mm: x.mm }));
      const s = unJour(e, neutre(T), {}, { pluie: { type: 'heures', heures } });
      return { Dr: s.dr_mm, perteIrrigation: s.eau_perdue_mm, drainagePluie: s.drainage_pluie_mm };
    },
    T04: (e) => {
      const t = M.pluieUtileMesuree(e.heures, T.pluie), o = M.pluieUtileMesuree(e.heures, O.pluie);
      return { Pe_jeuTlaloc: t.utile_mm, ruissellement_jeuTlaloc: t.ruissellement_mm, Pe_jeuOTF: o.utile_mm };
    },
    T05: (e) => ({
      Pe_desaccord_Tlaloc: M.pluieUtilePrevue(e.prevue, e.modeles_desaccord, T.pluie).utile_mm,
      Pe_sure_Tlaloc: M.pluieUtilePrevue(e.prevue, e.modeles_accord, T.pluie).utile_mm,
      Pe_OTF: M.pluieUtilePrevue(e.prevue, e.modeles_accord, O.pluie).utile_mm,
    }),
    T06: (e) => {
      const serie = (jeu: JeuDeReglages, plancher: number | null) => {
        const sol = solRU(e.taw, plancher);
        const jours = Array.from({ length: 7 }, (_, i) => jour(i, { sol, etc_mm: i < 6 ? e.etc : 0 }));
        jours[6] = { ...jours[6], pluie: { type: 'heures', heures: [{ instant: a(jours[6].date, 12), mm: 15 }] } };
        return suivre({ etat_initial: { dr_mm: e.Dr0, dmax_mm: plancher ?? e.taw }, jours }, neutre(jeu));
      };
      const t = serie(T, null), o = serie(O, e.plancher_OTF);
      return { Dr_secTlaloc: t[5].dr_mm, Dr_secOTF: o[5].dr_mm, Dr_apresPluieTlaloc: t[6].dr_mm, Dr_apresPluieOTF: o[6].dr_mm };
    },
    T07: (e) => {
      const p = (etc: number) => unJour({ Dr0: 0, etc, taw: 60 }, T, {}, { sol: solRU(60, null, e.pTab) }).p;
      return { p_etc2: p(2), p_etc5: p(5), p_etc7: p(7), p_etc12: p(12) };
    },
    T08: () => ({ mu_si_calcul40: option, sd_si_calcul40: option, mu_si_calcul60: option, sd_si_calcul60: option }),
    T09: () => ({ mu: option, sd: option }),
    T10: () => ({ kf: option }),
    T11: () => ({ Dr: option, Dr_5kPa: option, Dr_80kPa: option }),
    T12: (e) => {
      const arrosages = [{ debut: a(D1, 6), fin: null, mm: e.irrigation }];
      const pluie = { type: 'heures' as const, heures: [{ instant: a(D1, 0.6 * 24), mm: e.pluie }] };
      const base = { Dr0: e.Dr0, etc: e.etc, taw: 60 };
      return {
        Dr_horaire: unJour(base, neutre(T), { arrosages }, { pluie }).dr_mm,
        Dr_journalier: unJour(base, neutre(O), { arrosages }, { pluie }).dr_mm,
      };
    },
  };
}

/** Les valeurs attendues d'un cas : `attendu`, et les blocs `attendu_…`, préfixés. */
function attendus(c: any): [string, unknown][] {
  const l: [string, unknown][] = Object.entries(c.attendu ?? {});
  for (const [bloc, v] of Object.entries(c)) {
    if (bloc.startsWith('attendu_') && v && typeof v === 'object') for (const [k, x] of Object.entries(v)) l.push([`${bloc}.${k}`, x]);
  }
  return l;
}

/** Tous les cas des deux fichiers, sur un moteur (src/ ou un fichier construit). */
export function executerCas(M: Moteur): ResultatCas[] {
  const fichiers: [string, any[], Record<string, (e: any) => Mesures>][] = [];
  const otf = lire('../cas/cas-otf.json');
  fichiers.push(['cas-otf.json', [...otf.cas, ...otf.cas_limites], casOTF(M)]);
  fichiers.push(['cas-tlaloc.json', lire('../cas/cas-tlaloc.json').cas, casTlaloc(M)]);
  const resultats: ResultatCas[] = [];
  for (const [fichier, cas, executants] of fichiers) {
    for (const c of cas) {
      const executant = executants[c.id];
      const mesures = executant ? executant(c.entrees) : {};
      const valeurs = attendus(c).map(([cle, attendu]): Valeur => {
        if (!(cle in mesures)) return { cle, attendu, obtenu: undefined, verdict: 'écart', note: 'valeur non mesurée par le script' };
        const m = mesures[cle] as any;
        if (m && typeof m === 'object' && 'horsMoteur' in m) return { cle, attendu, obtenu: undefined, verdict: 'hors moteur', note: m.horsMoteur };
        if (m && typeof m === 'object' && 'aVenir' in m) return { cle, attendu, obtenu: undefined, verdict: 'à venir', note: m.aVenir };
        return { cle, attendu, obtenu: m ?? null, verdict: comparer(attendu, m ?? null) };
      });
      resultats.push({ id: c.id, titre: c.titre, fichier, valeurs });
    }
  }
  return resultats;
}

/** Charge les deux fichiers construits : le module ES et le script classique (variable globale MoteurHydrique). */
export async function chargerDist(): Promise<{ mjs: Moteur; iife: Moteur }> {
  const mjs = await import(new URL('../dist/moteur-hydrique.mjs', import.meta.url).href) as Moteur;
  const contexte: Record<string, unknown> = {};
  createContext(contexte);
  runInContext(readFileSync(new URL('../dist/moteur-hydrique.js', import.meta.url), 'utf8'), contexte);
  return { mjs, iife: contexte.MoteurHydrique as Moteur };
}

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
const montrer = (x: unknown) => (x === undefined ? '—' : x === null ? 'inconnu (null)' : typeof x === 'number' ? nombre.format(x) : String(x));

export function rapport(resultats: ResultatCas[], titre: string): string {
  const lignes = [titre, ''];
  const parVerdict: Record<Verdict, number> = { conforme: 0, 'écart': 0, 'hors moteur': 0, 'à venir': 0 };
  for (const r of resultats) {
    const verdicts = new Set(r.valeurs.map((v) => v.verdict));
    const v: Verdict = verdicts.has('écart') ? 'écart' : verdicts.has('conforme') ? 'conforme' : verdicts.has('à venir') ? 'à venir' : 'hors moteur';
    lignes.push(`${r.id} (${r.fichier}) — ${r.titre} : ${v}`);
    for (const x of r.valeurs) {
      parVerdict[x.verdict]++;
      lignes.push(`  ${x.cle} : attendu ${montrer(x.attendu)} ; moteur ${montrer(x.obtenu)} ; ${x.verdict}${x.note ? ` (${x.note})` : ''}`);
    }
  }
  lignes.push('', `Bilan des valeurs : ${parVerdict.conforme} conformes, ${parVerdict['écart']} en écart, ${parVerdict['hors moteur']} hors moteur, ${parVerdict['à venir']} à venir.`);
  return lignes.join('\n');
}

async function principal(): Promise<void> {
  const src = executerCas(SRC);
  console.log(rapport(src, `Cas de test sur le moteur commun v${SRC.VERSION_MOTEUR} (src/), tolérance ${TOLERANCE} mm`));
  if (process.argv.includes('--dist')) {
    const { mjs, iife } = await chargerDist();
    const ref = JSON.stringify(src);
    for (const [nom, M] of [['dist/moteur-hydrique.mjs', mjs], ['dist/moteur-hydrique.js (MoteurHydrique)', iife]] as const) {
      const pareil = JSON.stringify(executerCas(M)) === ref;
      console.log(`${nom} : ${pareil ? 'mêmes résultats que src/ sur tous les cas' : 'RÉSULTATS DIFFÉRENTS de src/'}`);
      if (!pareil) process.exitCode = 1;
    }
  }
  if (src.some((r) => r.valeurs.some((v) => v.verdict === 'écart'))) process.exitCode = 1;
}

// Lancé directement (pas importé par un test) : affiche le rapport.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await principal();
