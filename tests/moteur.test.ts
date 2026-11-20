// Tests des règles du bilan (`suivre`), de la pluie utile et des réglages.
// Lancer : node --test --experimental-strip-types tests/moteur.test.ts
// Les valeurs attendues sont calculées à la main dans les commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/moteur.ts';
import type { ArrosageDuJour, ClassePoing, EntreeSuivi, JeuDeReglages, JourDonnees, JourSortie, Observation, SolDuJour } from '../src/moteur.ts';
// @ts-expect-error : implémentation de référence en JavaScript, sans types
import * as REF from '../docs/ref-tlaloc/ref-tlaloc.mjs';

const TOL = 1e-9;
const HEURE_MS = 3_600_000;
const OTF = M.JEU_OTF;
const TLALOC = M.JEU_TLALOC;

/** Juin 2026 : des journées de 24 h (UTC+2). */
const date = (i: number) => `2026-06-${String(1 + i).padStart(2, '0')}`;
const D0 = date(0);
const a = (jour: string, heures: number) => new Date(M.bornesDuJour(jour).debut + heures * HEURE_MS).toISOString();
/** Sol à la façon d'OTF : RU = 1,5 × capacité, plancher = capacité, donc Dmax = capacité. */
const sol = (capacite: number, p: number | null = 0.5): SolDuJour => ({ theta_u_mm_m: capacite * 1.5, zr_m: 1, p_tableau: p, plancher_mm: capacite });
/** Sol à la façon de Tlaloc : la RU, sans plancher. */
const solRU = (ru: number, p: number | null = null): SolDuJour => ({ theta_u_mm_m: ru, zr_m: 1, p_tableau: p, plancher_mm: null });
const jour = (i: number, j: Partial<JourDonnees> = {}): JourDonnees => ({
  date: date(i), etc_mm: 0, sol: sol(30), abri: false, pluie: { type: 'jour', mm: 0 }, ...j,
});
const suivre = (e: Partial<EntreeSuivi> & Pick<EntreeSuivi, 'jours'>, jeu: JeuDeReglages): JourSortie[] =>
  M.suivre({ aujourdhui: '2026-12-31', ...e }, jeu);
const m = (jour: string, minutes: number) => new Date(M.bornesDuJour(jour).debut + minutes * 60_000).toISOString();
const manque = (instant: string, dr_mm: number): Observation => ({ instant, type: 'manque', dr_mm });
const poing = (instant: string, classe: ClassePoing): Observation => ({ instant, type: 'poing', classe });
const tensio = (instant: string, kpa: number, bas_kpa = 10, haut_kpa = 60): Observation => ({ instant, type: 'tensio', kpa, bas_kpa, haut_kpa });
const arrosage = (debut: string, fin: string | null, mm: number | null, extra: Partial<ArrosageDuJour> = {}): ArrosageDuJour => ({ debut, fin, mm, ...extra });

const proche = (x: number | null | undefined, attendu: number, quoi: string) => {
  assert.ok(x !== null && x !== undefined, `${quoi} : inconnu`);
  assert.ok(Math.abs(x - attendu) <= TOL, `${quoi} : ${x} au lieu de ${attendu}`);
};
const inconnu = (s: JourSortie, code: string, jourDuTrou: string | null) => {
  assert.equal(s.connu, false, `${s.date} : connu`);
  assert.equal(s.dr_mm, null);
  assert.equal(s.pct_plein, null);
  assert.equal(s.dr_depart_mm, null);
  assert.equal(s.drainage_mm, null, 'drainage d\'un jour inconnu : inconnu, jamais 0 (MC-09)');
  assert.equal(s.eau_perdue_mm, null);
  assert.equal(s.drainage_pluie_mm, null);
  assert.equal(s.raison_inconnu?.code, code);
  assert.equal(s.raison_inconnu?.date, jourDuTrou);
};

/* ------------------------------------------------------------------ */
/* Jour inconnu (MC-09, MC-23, MC-14)                                   */
/* ------------------------------------------------------------------ */

test('Jeu OTF : un trou de données rend l\'état inconnu jusqu\'au redémarrage, jamais 0 (MC-09, MC-23)', () => {
  const s = suivre({
    etat_initial: { dr_mm: 10, dmax_mm: 30 },
    jours: [
      jour(0, { etc_mm: 4, pluie: { type: 'jour', mm: 2 } }), // 10 + 4 − 2 = 12
      jour(1, { etc_mm: null, etc_raison: 'missing-et0' }),
      jour(2, { etc_mm: 3, pluie: { type: 'jour', mm: 5 } }), // 5 mm ne remplissent pas 30 mm : toujours inconnu
    ],
  }, OTF);
  proche(s[0].dr_mm, 12, 'jour 0');
  inconnu(s[1], 'etc_inconnue', date(1));
  assert.equal(s[1].raison_inconnu?.detail, 'missing-et0');
  assert.equal(s[1].etc_mm, null);
  inconnu(s[2], 'etc_inconnue', date(1));
  // Les flux connus d'un jour inconnu restent dits.
  proche(s[2].pluie_mm, 5, 'pluie comptée un jour inconnu');
  proche(s[2].etc_mm, 3, 'consommation un jour inconnu');
});

test('Ordre des trous de données : consommation, pluie, sol, puis apport (ordre d\'OTF)', () => {
  const unJour = (j: Partial<JourDonnees>, arrosages: ArrosageDuJour[] = [], jeu = OTF) =>
    suivre({ etat_initial: { dr_mm: 10, dmax_mm: 30 }, jours: [jour(0, j)], arrosages }, jeu)[0];
  inconnu(unJour({ etc_mm: null, pluie: null, sol: null }), 'etc_inconnue', D0);
  inconnu(unJour({ pluie: null, sol: null }), 'pluie_inconnue', D0);
  const sansSol = unJour({ sol: null });
  inconnu(sansSol, 'sol_inconnu', D0);
  assert.equal(sansSol.dmax_mm, null);
  assert.equal(sansSol.ru_mm, null);
  inconnu(unJour({}, [arrosage(a(D0, 8), a(D0, 9), null)]), 'apport_inconnu', D0);
  inconnu(unJour({ sol: solRU(30) }, [arrosage(a(D0, 8), null, 2, { type: 'bassinage' })], TLALOC), 'duree_bassinage_inconnue', D0);
});

test('Rien pour partir : « pas commencé », et un trou ne se nomme que s\'il y avait de quoi partir (règle d\'OTF)', () => {
  const s = suivre({ jours: [jour(0, { etc_mm: 2 }), jour(1, { etc_mm: null })] }, OTF);
  inconnu(s[0], 'pas_commence', null);
  inconnu(s[1], 'pas_commence', null);
  // Une observation du jour, même inutilisable faute de consommation, fait nommer le trou.
  const o = suivre({ jours: [jour(0, { etc_mm: null })], observations: [manque(a(D0, 9), 4)] }, OTF);
  inconnu(o[0], 'etc_inconnue', D0);
});

test('Redémarrage par remplissage, jeu OTF : drainage depuis la capacité, borne basse (O07, MC-31, MC-32)', () => {
  const s = suivre({
    jours: [jour(0, { etc_mm: 4, pluie: { type: 'jour', mm: 10 } }), jour(1, { etc_mm: 5 })],
    arrosages: [arrosage(a(D0, 8), a(D0, 9), 40)],
  }, OTF);
  // Apports 10 + 40 = 50 ≥ 30 : plein le soir ; drainage 50 − 30 = 20, dont 20 × 40 / 50 = 16 d'arrosage.
  assert.equal(s[0].connu, true);
  assert.equal(s[0].redemarrage, 'remplissage');
  proche(s[0].dr_mm, 0, 'manque');
  proche(s[0].pct_plein, 100, '% du plein');
  proche(s[0].drainage_mm, 20, 'drainage');
  assert.equal(s[0].drainage_borne_basse, true);
  proche(s[0].eau_perdue_mm, 16, 'eau perdue');
  proche(s[0].drainage_pluie_mm, 4, 'drainage de pluie');
  assert.equal(s[0].dr_depart_mm, null);
  assert.equal(s[0].raison_inconnu, null);
  proche(s[1].dr_mm, 5, 'le lendemain');
  assert.equal(s[1].redemarrage, null);
});

test('Redémarrage : l\'égalité suffit, juste en dessous non ; pluie inconnue : drainage d\'arrosage seul, eau perdue inconnue', () => {
  const pile = suivre({ jours: [jour(0)], arrosages: [arrosage(a(D0, 8), null, 30)] }, OTF)[0];
  assert.equal(pile.redemarrage, 'remplissage');
  proche(pile.drainage_mm, 0, 'drainage');
  inconnu(suivre({ jours: [jour(0)], arrosages: [arrosage(a(D0, 8), null, 29.99)] }, OTF)[0], 'pas_commence', null);
  const sansPluie = suivre({ jours: [jour(0, { pluie: null })], arrosages: [arrosage(a(D0, 8), null, 35)] }, OTF)[0];
  assert.equal(sansPluie.redemarrage, 'remplissage');
  assert.equal(sansPluie.pluie_mm, null);
  proche(sansPluie.drainage_mm, 5, 'drainage, minimum');
  assert.equal(sansPluie.eau_perdue_mm, null);
  assert.equal(sansPluie.drainage_pluie_mm, null);
});

test('Redémarrage par remplissage, jeu Tlaloc : drainage inconnu (MC-32)', () => {
  const [s] = suivre({
    jours: [jour(0, { sol: solRU(30), etc_mm: 4, pluie: { type: 'jour', mm: 10 } })],
    arrosages: [arrosage(a(D0, 8), a(D0, 9), 40)],
  }, TLALOC);
  // Pluie utile 10 − 2 (interception) = 8 ; 8 + 40 ≥ 30.
  assert.equal(s.redemarrage, 'remplissage');
  proche(s.dr_mm, 0, 'manque');
  proche(s.pluie_mm, 8, 'pluie utile');
  assert.equal(s.drainage_mm, null);
  assert.equal(s.eau_perdue_mm, null);
  assert.equal(s.drainage_pluie_mm, null);
  assert.equal(s.drainage_borne_basse, false);
});

test('Jeu Tlaloc : consommation d\'un jour inconnu = moyenne des 3 dernières connues avant, jamais après (MC-14)', () => {
  const etcs = [1, 2, 3, 4, null, null, 9, null];
  const s = suivre({
    etat_initial: { dr_mm: 0, dmax_mm: 100 },
    jours: etcs.map((etc_mm, i) => jour(i, { sol: solRU(100, 0.4), etc_mm })),
  }, TLALOC);
  // 1 + 2 + 3 + 4 = 10 ; puis moyenne(2, 3, 4) = 3 deux fois (une estimation ne compte pas) ; 9 ; moyenne(3, 4, 9) = 16/3.
  proche(s[3].dr_mm, 10, 'jour 3');
  proche(s[4].etc_mm, 3, 'jour 4, estimée');
  assert.equal(s[4].etc_estimee, true);
  assert.equal(s[4].connu, true);
  proche(s[4].p, 0.48, 'p ajusté à l\'ETc estimée (0,4 + 0,04 × 2)');
  proche(s[5].etc_mm, 3, 'jour 5, toujours sur les jours connus');
  proche(s[6].dr_mm, 25, 'jour 6');
  assert.equal(s[6].etc_estimee, false);
  proche(s[7].etc_mm, 16 / 3, 'jour 7');
  proche(s[7].dr_mm, 25 + 16 / 3, 'jour 7');
  // Moins de trois jours connus : ceux qu'il y a ; aucun : inconnu.
  const peu = suivre({ etat_initial: { dr_mm: 0, dmax_mm: 100 }, jours: [jour(0, { sol: solRU(100), etc_mm: 2 }), jour(1, { sol: solRU(100), etc_mm: null })] }, TLALOC);
  proche(peu[1].etc_mm, 2, 'un seul jour connu');
  const rien = suivre({ etat_initial: { dr_mm: 0, dmax_mm: 100 }, jours: [jour(0, { sol: solRU(100), etc_mm: null })] }, TLALOC);
  inconnu(rien[0], 'etc_inconnue', D0);
  // Le jeu OTF, lui, garde l'état inconnu (MC-23).
  inconnu(suivre({ etat_initial: { dr_mm: 0, dmax_mm: 100 }, jours: etcs.map((etc_mm, i) => jour(i, { sol: sol(100), etc_mm })) }, OTF)[4], 'etc_inconnue', date(4));
});

test('Pluie inconnue dans le jeu Tlaloc : le jour est inconnu (choix à relire)', () => {
  const [s] = suivre({ etat_initial: { dr_mm: 10, dmax_mm: 50 }, jours: [jour(0, { sol: solRU(50), etc_mm: 3, pluie: null })] }, TLALOC);
  inconnu(s, 'pluie_inconnue', D0);
});

/* ------------------------------------------------------------------ */
/* Changement de capacité (MC-11)                                       */
/* ------------------------------------------------------------------ */

test('conserver : % du plein ou manque gardé au changement de capacité (MC-11)', () => {
  proche(M.conserver(10, 20, 40, 'pourcent'), 20, 'pourcent, capacité qui double');
  proche(M.conserver(10, 20, 40, 'manque'), 10, 'manque, capacité qui double');
  proche(M.conserver(30, 40, 20, 'pourcent'), 15, 'pourcent, capacité qui baisse');
  proche(M.conserver(30, 40, 20, 'manque'), 20, 'manque, borné à la nouvelle capacité');
  proche(M.conserver(7, 20, 20, 'pourcent'), 7, 'capacité inchangée');
  proche(M.conserver(7, 20, 20, 'manque'), 7, 'capacité inchangée');
});

test('Changement de capacité dans le suivi : jeu OTF en %, variante « manque » en mm', () => {
  const jours = [jour(0, { sol: sol(20) }), jour(1, { sol: sol(40) })];
  const pourcent = suivre({ etat_initial: { dr_mm: 5, dmax_mm: 20 }, jours }, OTF);
  proche(pourcent[1].dr_depart_mm, 10, 'pourcent : 25 % de manque gardé');
  const enMm = suivre({ etat_initial: { dr_mm: 5, dmax_mm: 20 }, jours }, { ...OTF, conservation: 'manque' });
  proche(enMm[1].dr_depart_mm, 5, 'manque gardé');
  // L'état initial se rapporte à son propre Dmax, et un manque au-delà est borné.
  proche(suivre({ etat_initial: { dr_mm: 5, dmax_mm: 10 }, jours: [jour(0, { sol: sol(30) })] }, OTF)[0].dr_depart_mm, 15, 'état initial converti');
  proche(suivre({ etat_initial: { dr_mm: 50, dmax_mm: 30 }, jours: [jour(0)] }, OTF)[0].dr_depart_mm, 30, 'état initial borné');
});

/* ------------------------------------------------------------------ */
/* Observations (partie OTF § 6 point 1, contrat Tlaloc § 3 et § 7.2)   */
/* ------------------------------------------------------------------ */

test('Observation, jeu OTF : le jour ne compte qu\'après son heure, les arrosages aussi, au prorata', () => {
  const [s] = suivre({
    etat_initial: { dr_mm: 12, dmax_mm: 30 },
    jours: [jour(0, { etc_mm: 4, pluie: { type: 'jour', mm: 6 } })],
    observations: [manque(a(D0, 12), 5)],
    arrosages: [
      arrosage(a(D0, 6), a(D0, 7), 3), // avant : ne compte pas
      arrosage(a(D0, 11), a(D0, 13), 4), // à cheval : 2 après
      arrosage(a(D0, 14), a(D0, 16), 8), // après
    ],
  }, OTF);
  // Après 12 h : 5 + 4 × 0,5 − 6 × 0,5 − (2 + 8) = −6 → plein, drainage 6, dont 6 × 10 / 13 d'arrosage.
  proche(s.fraction, 0.5, 'fraction');
  proche(s.dr_depart_mm, 5, 'départ observé');
  proche(s.etc_mm, 2, 'consommation comptée');
  proche(s.pluie_mm, 3, 'pluie comptée');
  proche(s.arrosage_mm, 10, 'arrosage compté');
  proche(s.dr_mm, 0, 'manque');
  proche(s.drainage_mm, 6, 'drainage');
  proche(s.eau_perdue_mm, 60 / 13, 'eau perdue');
  proche(s.drainage_pluie_mm, 18 / 13, 'drainage de pluie');
  assert.equal(s.redemarrage, 'observation');
  assert.equal(s.nature, 'estime', 'OTF ne dit jamais « observé »');
  // Journal des ancrages : avant 12 h, 12 + 2 − 3 − (3 + 2) = 6 calculés, 5 observés.
  assert.equal(s.ancrages[0]?.instant, a(D0, 12));
  proche(s.ancrages[0]?.dr_observe_mm, 5, 'ancrage observé');
  proche(s.ancrages[0]?.dr_calcule_mm, 6, 'ancrage calculé');
});

test('Observation : bornée à Dmax ; la plus récente du jour l\'emporte ; à instant égal, la dernière de la liste', () => {
  const unJour = (observations: Observation[]) => suivre({ etat_initial: { dr_mm: 10, dmax_mm: 30 }, jours: [jour(0)], observations }, OTF)[0];
  proche(unJour([manque(a(D0, 8), 50)]).dr_depart_mm, 30, 'bornée');
  proche(unJour([manque(a(D0, 15), 3), manque(a(D0, 10), 8)]).dr_depart_mm, 3, 'la plus récente');
  proche(unJour([manque(a(D0, 10), 8), manque(a(D0, 10), 4)]).dr_depart_mm, 4, 'la dernière de la liste');
  // Une observation d'un autre jour n'agit pas ce jour-là.
  assert.equal(unJour([manque(a(date(1), 10), 8)]).redemarrage, null);
});

test('Observation : redémarre un état inconnu ; à minuit, l\'ancrage compare au manque de la veille ; sans état d\'avant, rien à comparer', () => {
  const s = suivre({
    etat_initial: { dr_mm: 7, dmax_mm: 30 },
    jours: [jour(0, { etc_mm: null }), jour(1, { etc_mm: 2 }), jour(2, { etc_mm: 1 })],
    observations: [manque(a(date(1), 15), 9), manque(a(date(2), 0), 4)],
  }, OTF);
  inconnu(s[0], 'etc_inconnue', D0);
  // Jour 1 : 9 + 2 × 9/24 = 9,75 ; ancrage sans calcul (état d'avant inconnu).
  proche(s[1].dr_mm, 9.75, 'jour 1');
  assert.equal(s[1].ancrages[0]?.dr_calcule_mm, null);
  // Jour 2 à minuit : fraction 1, ancrage calculé = manque de la veille, 9,75.
  proche(s[2].fraction, 1, 'fraction');
  proche(s[2].ancrages[0]?.dr_calcule_mm, 9.75, 'ancrage à minuit');
  proche(s[2].dr_mm, 5, 'jour 2');
});

test('Observation sans capacité ce jour-là : elle ne recale rien, mais nomme le trou (règle d\'OTF)', () => {
  const [s] = suivre({ jours: [jour(0, { sol: null })], observations: [manque(a(D0, 9), 4)] }, OTF);
  inconnu(s, 'sol_inconnu', D0);
  assert.equal(s.redemarrage, null);
  proche(s.fraction, 1, 'fraction');
});

test('Nature : estimé avant aujourd\'hui, prévu ensuite ; « observé » le jour d\'une observation dans le jeu Tlaloc seulement', () => {
  const jours = [0, 1, 2].map((i) => jour(i, { sol: solRU(30) }));
  const observations = [manque(a(D0, 10), 5)];
  const t = suivre({ aujourdhui: date(1), etat_initial: { dr_mm: 5, dmax_mm: 30 }, jours, observations }, TLALOC);
  assert.deepEqual(t.map((s) => s.nature), ['observe', 'prevu', 'prevu']);
  const o = suivre({ aujourdhui: date(1), etat_initial: { dr_mm: 5, dmax_mm: 30 }, jours, observations }, OTF);
  assert.deepEqual(o.map((s) => s.nature), ['estime', 'prevu', 'prevu']);
});

test('Plusieurs observations un même jour : chacune recale à son heure, le journal les garde toutes ; le jour ne compte qu\'après la dernière', () => {
  const entree = { etat_initial: { dr_mm: 10, dmax_mm: 30 }, jours: [jour(0, { etc_mm: 4.8 })], arrosages: [arrosage(m(D0, 600), null, 3)] };
  const [deux] = suivre({ ...entree, observations: [manque(m(D0, 360), 12), manque(m(D0, 720), 8)] }, OTF);
  const [une] = suivre({ ...entree, observations: [manque(m(D0, 720), 8)] }, OTF);
  for (const k of ['dr_mm', 'dr_depart_mm', 'fraction', 'etc_mm', 'pluie_mm', 'arrosage_mm', 'drainage_mm', 'eau_perdue_mm'] as const) {
    assert.equal(deux[k], une[k], `${k} : seule la dernière observation compte pour le jour (règle d'OTF)`);
  }
  assert.deepEqual(deux.ancrages.map((x) => x.instant), [m(D0, 360), m(D0, 720)]);
  // Avant 6 h : 10 + 4,8 × 0,25 = 11,2. De 6 h à midi, depuis 12 : 12 + 1,2 − 3 (à 10 h) = 10,2.
  proche(deux.ancrages[0].dr_calcule_mm, 11.2, 'calcul à 6 h');
  proche(deux.ancrages[1].dr_calcule_mm, 10.2, 'calcul à midi, depuis l\'observation de 6 h');
  // Seule, l'observation de midi compare au calcul depuis minuit : 10 + 2,4 − 3 = 9,4.
  proche(une.ancrages[0].dr_calcule_mm, 9.4, 'calcul à midi, depuis minuit');
  // Incertitude après un manque observé : 0,05 × RU (MC-22), RU = 45 ; puis + 0,2 × 2,4.
  proche(deux.ancrages[1].incertitude_apres_mm, 2.25, '0,05 × RU');
  proche(deux.incertitude_mm, Math.hypot(2.25, 0.48), 'le soir');
});

/* ------------------------------------------------------------------ */
/* Options de Tlaloc : poing, tensiomètre, incertitude, kf (§ 7, § 8)   */
/* ------------------------------------------------------------------ */

test('Poing en fourchette (§ 7.1) : l\'a posteriori du calcul juste avant et de la classe ; T08 et T09 par le suivi, comparés à la référence de Tlaloc', () => {
  const cas: [number, ClassePoing[]][] = [[40, ['correct']], [60, ['correct']], [40, ['correct', 'correct', 'sec']]];
  for (const [calcul, classes] of cas) {
    const [s] = suivre({
      etat_initial: { dr_mm: (1 - calcul / 100) * 60, dmax_mm: 60, incertitude_mm: 9 }, // 15 points de RU
      jours: [jour(0, { sol: solRU(60) })],
      observations: classes.map((c, i) => poing(m(D0, 20 * i), c)),
    }, TLALOC);
    const ref = REF.poingFourchette(calcul, 15, classes);
    assert.equal(s.ancrages.length, 1, 'les prises de l\'heure : une seule observation');
    const x = s.ancrages[0];
    assert.equal(x.type, 'poing');
    assert.equal(x.prises, classes.length);
    proche(x.dr_calcule_mm, (1 - calcul / 100) * 60, 'calcul juste avant');
    proche(x.incertitude_avant_mm, 9, 'incertitude juste avant');
    proche(100 * (1 - x.dr_observe_mm / 60), ref.mu, `μ, calcul à ${calcul} %, ${classes.length} prise(s)`);
    proche(x.incertitude_apres_mm / 60 * 100, ref.sd, `sd, calcul à ${calcul} %, ${classes.length} prise(s)`);
    proche(s.dr_depart_mm, x.dr_observe_mm, 'le départ du jour');
    proche(s.incertitude_mm, x.incertitude_apres_mm, 'rien consommé ensuite');
  }
});

test('Poing en fourchette au milieu du jour : l\'a priori est le calcul à son heure, et l\'incertitude repart de l\'a posteriori', () => {
  const [s] = suivre({
    etat_initial: { dr_mm: 36, dmax_mm: 60, incertitude_mm: 9 },
    jours: [jour(0, { sol: solRU(60), etc_mm: 4.8 })],
    observations: [poing(m(D0, 720), 'frais')],
  }, TLALOC);
  // À midi : 36 + 2,4 = 38,4 ; incertitude √(9² + (0,2 × 2,4)²).
  const x = s.ancrages[0];
  const sdAvant = Math.hypot(9, 0.48);
  proche(x.dr_calcule_mm, 38.4, 'calcul à midi');
  proche(x.incertitude_avant_mm, sdAvant, 'incertitude à midi');
  const post = M.poingFourchette({ um: 100 * (1 - 38.4 / 60), sdU: sdAvant / 60 * 100 }, ['frais'], 8);
  proche(x.dr_observe_mm, (1 - post.mu / 100) * 60, 'a posteriori');
  proche(x.incertitude_apres_mm, post.sd * 0.6, 'son incertitude');
  // Le soir : + 2,4 ; incertitude √(sd² + 0,48²).
  proche(s.dr_mm, x.dr_observe_mm + 2.4, 'manque au soir');
  proche(s.incertitude_mm, Math.hypot(x.incertitude_apres_mm, 0.48), 'incertitude au soir');
  proche(s.fraction, 0.5, 'le jour compte après le relevé');
  assert.equal(s.nature, 'observe');
});

test('Poing en fourchette : les prises à moins de 60 min de la première comptent ensemble, à l\'heure de la dernière', () => {
  const groupes = (minutes: number[]) => suivre({
    etat_initial: { dr_mm: 36, dmax_mm: 60 },
    jours: [jour(0, { sol: solRU(60) }), jour(1, { sol: solRU(60) })],
    observations: minutes.map((x) => poing(m(D0, x), 'correct')),
  }, TLALOC).flatMap((j) => j.ancrages.map((x) => `${x.prises} à ${x.instant}`));
  assert.deepEqual(groupes([480, 500, 539]), [`3 à ${m(D0, 539)}`]);
  assert.deepEqual(groupes([480, 540]), [`1 à ${m(D0, 480)}`, `1 à ${m(D0, 540)}`], '60 min pile : deux observations');
  assert.deepEqual(groupes([480, 520, 560]), [`2 à ${m(D0, 520)}`, `1 à ${m(D0, 560)}`], 'la fenêtre part de la première prise');
  assert.deepEqual(groupes([500, 480]), [`2 à ${m(D0, 500)}`], 'notées dans le désordre');
  assert.deepEqual(groupes([1430, 1450]), [`2 à ${m(D0, 1450)}`], 'à cheval sur minuit : le jour de la dernière prise');
});

test('Poing sans fourchette (option coupée, jeu OTF) : le centre de la classe, incertitude 0,15 × RU ; chaque prise compte seule', () => {
  const sansFourchette: JeuDeReglages = { ...TLALOC, poing: { ...TLALOC.poing, fourchette: false } };
  const [s] = suivre({
    etat_initial: { dr_mm: 36, dmax_mm: 60 },
    jours: [jour(0, { sol: solRU(60) })],
    observations: [poing(m(D0, 480), 'sec'), poing(m(D0, 500), 'frais')],
  }, sansFourchette);
  assert.deepEqual(s.ancrages.map((x) => x.prises), [1, 1]);
  proche(s.ancrages[0].dr_observe_mm, 37.5, 'centre de « sec » : 37,5 % de 60');
  proche(s.ancrages[1].dr_observe_mm, 7.5, 'centre de « frais » : 87,5 % de 60');
  proche(s.dr_mm, 7.5, 'la dernière l\'emporte');
  proche(s.incertitude_mm, 9, '0,15 × RU');
  // Jeu OTF, plancher 30 (RU 45) : le centre de « très sec » (12,5 %) est borné à Dmax.
  const [o] = suivre({ etat_initial: { dr_mm: 5, dmax_mm: 30 }, jours: [jour(0)], observations: [poing(m(D0, 480), 'tres_sec')] }, OTF);
  proche(o.dr_depart_mm, 30, 'borné à Dmax');
  proche(o.incertitude_mm, 6.75, '0,15 × 45');
  assert.equal(o.kf_apres, null);
});

test('Poing en fourchette sur un état inconnu : a priori plat, rien à comparer', () => {
  const [s] = suivre({ jours: [jour(0, { sol: solRU(60) })], observations: [poing(m(D0, 480), 'correct'), poing(m(D0, 490), 'frais')] }, TLALOC);
  const plat = M.poingFourchette(null, ['correct', 'frais'], 8);
  const x = s.ancrages[0];
  assert.equal(x.dr_calcule_mm, null);
  assert.equal(x.incertitude_avant_mm, null);
  proche(x.dr_observe_mm, (1 - plat.mu / 100) * 60, 'a posteriori plat');
  proche(x.incertitude_apres_mm, plat.sd * 0.6, 'son incertitude');
  assert.equal(s.redemarrage, 'observation');
  assert.ok(Math.abs(plat.mu - 75) < 1, `entre les deux classes, près de leur limite de 75 % : ${plat.mu}`);
});

test('Tensiomètre (§ 7.3, MC-35) : recale par la conversion de Tlaloc, incertitude 0,1 × RAW ; ignoré sans RAW, après un relevé de terrain de moins de 48 h, et dans le jeu OTF', () => {
  // RU 40, p 0,5 (ETc 5 : p ajusté inchangé, MC-21), donc RAW 20.
  const jours = [0, 1, 2, 3].map((i) => jour(i, { sol: solRU(40, 0.5), etc_mm: 5 }));
  const t = (observations: Observation[], jeu = TLALOC) => suivre({ etat_initial: { dr_mm: 0, dmax_mm: 40 }, jours, observations }, jeu);
  const [s] = t([tensio(m(D0, 360), 30)]);
  // À 6 h : 30 kPa entre 10 et 60 → 0,2 × 20 + 0,8 × 20 × 20/50 = 10,4 ; calculé 0 + 5 × 0,25 = 1,25.
  const x = s.ancrages[0];
  assert.equal(x.type, 'tensio');
  proche(x.dr_calcule_mm, 1.25, 'calcul à 6 h');
  proche(x.dr_observe_mm, 10.4, 'tensiomètre');
  proche(x.incertitude_apres_mm, 2, '0,1 × RAW');
  proche(s.dr_mm, 10.4 + 3.75, 'le soir');
  proche(s.incertitude_mm, Math.hypot(2, 0.75), 'incertitude le soir');
  assert.deepEqual(t([tensio(m(D0, 360), 30)], OTF)[0].ancrages, [], 'jeu OTF : pas de tensiomètre (MC-20)');
  // Un poing la veille à 20 h (10 h avant) : ignoré ; 48 h pile après le poing : il compte.
  const r = t([poing(m(D0, 1200), 'correct'), tensio(m(date(1), 360), 30), tensio(m(date(2), 1200), 30)]);
  assert.deepEqual(r.map((j) => j.ancrages.map((y) => y.type)), [['poing'], [], ['tensio'], []]);
  assert.deepEqual(t([manque(m(D0, 1200), 5), tensio(m(date(1), 360), 30)])[1].ancrages, [], 'un manque observé est aussi un relevé de terrain');
  const sansP = suivre({ etat_initial: { dr_mm: 0, dmax_mm: 40 }, jours: [jour(0, { sol: solRU(40), etc_mm: 5 })], observations: [tensio(m(D0, 360), 30)] }, TLALOC)[0];
  assert.deepEqual(sansP.ancrages, [], 'RAW inconnue : rien à convertir');
  assert.equal(sansP.redemarrage, null);
});

test('Incertitude (§ 7.4) : 0,35 × RU au départ, + 0,2 × la consommation depuis le dernier ancrage, + 0,5 × un jour estimé (MC-14) ; 0,05 × RU après un manque observé (MC-22)', () => {
  const s = suivre({
    etat_initial: { dr_mm: 10, dmax_mm: 50 },
    jours: [
      jour(0, { sol: solRU(50), etc_mm: 5 }), // sdR = 0,35 × 50 = 17,5 ; E = 1
      jour(1, { sol: solRU(50), etc_mm: null }), // estimée 5 (MC-14) : E = 1 + 2,5
      jour(2, { sol: solRU(50), etc_mm: 4 }), // E = 3,5 + 0,8
      jour(3, { sol: solRU(50), etc_mm: 3 }), // manque observé à minuit : sdR = 2,5 ; E = 0,6
    ],
    observations: [manque(m(date(3), 0), 20)],
  }, TLALOC);
  proche(s[0].incertitude_mm, Math.hypot(17.5, 1), 'jour 0');
  proche(s[1].incertitude_mm, Math.hypot(17.5, 3.5), 'jour 1, consommation estimée');
  proche(s[2].incertitude_mm, Math.hypot(17.5, 4.3), 'jour 2');
  proche(s[3].ancrages[0].incertitude_avant_mm, Math.hypot(17.5, 4.3), 'juste avant l\'observation');
  proche(s[3].ancrages[0].incertitude_apres_mm, 2.5, '0,05 × RU');
  proche(s[3].incertitude_mm, Math.hypot(2.5, 0.6), 'jour 3');
  const donnee = suivre({ etat_initial: { dr_mm: 10, dmax_mm: 50, incertitude_mm: 3 }, jours: [jour(0, { sol: solRU(50), etc_mm: 5 })] }, TLALOC);
  proche(donnee[0].incertitude_mm, Math.hypot(3, 1), 'donnée au départ');
});

test('Incertitude, jeu OTF (MC-20 : calculée, pas affichée) : nulle après un remplissage, inconnue avec l\'état', () => {
  const s = suivre({
    jours: [jour(0, { etc_mm: 2 }), jour(1, { etc_mm: 2, pluie: { type: 'jour', mm: 40 } }), jour(2, { etc_mm: 3 }), jour(3, { etc_mm: null })],
  }, OTF);
  assert.equal(s[0].incertitude_mm, null, 'pas commencé');
  assert.equal(s[1].redemarrage, 'remplissage');
  assert.equal(s[1].incertitude_mm, 0, 'plein le soir, quel que soit le départ');
  proche(s[2].incertitude_mm, 0.6, '0,2 × 3');
  assert.equal(s[3].incertitude_mm, null, 'inconnue avec l\'état');
  // Au départ : 0,35 × RU (45), pas × Dmax (30).
  const [d] = suivre({ etat_initial: { dr_mm: 10, dmax_mm: 30 }, jours: [jour(0, { etc_mm: 5 })] }, OTF);
  proche(d.incertitude_mm, Math.hypot(0.35 * 45, 1), 'départ');
});

test('Consommation apprise (§ 8) : ETc = ETM × kf ; un relevé en fourchette ajuste kf s\'il suit un ancrage de l\'appel, plus de 2 mm consommés depuis, et le dernier relevé qui a appris', () => {
  // Manque observé 16 à minuit (incertitude 0,05 × 60 = 3), 4 jours à 5 mm : 36 au soir du jour 3 ; poing « correct » le jour 4 à minuit.
  const jours = [0, 1, 2, 3, 4].map((i) => jour(i, { sol: solRU(60), etc_mm: 5 }));
  const observations = [manque(m(date(0), 0), 16), poing(m(date(4), 0), 'correct')];
  const s = suivre({ jours, observations }, TLALOC);
  const x = s[4].ancrages[0];
  proche(x.dr_calcule_mm, 36, 'calcul au relevé');
  proche(x.incertitude_avant_mm, 5, '√(3² + (0,2 × 20)²)');
  const kf = M.kfApres(1, { dr_avant_mm: 36, dr_apres_mm: x.dr_observe_mm, conso_mm: 20, sd_avant: 5, sd_apres: x.incertitude_apres_mm });
  assert.ok(kf < 1, 'le relevé dit plus humide que le calcul : la consommation baisse');
  assert.deepEqual(s[4].kf_apres, { valeur: kf, depuis: m(date(4), 0) });
  assert.deepEqual(s.slice(0, 4).map((j) => j.kf_apres), [null, null, null, null]);
  // ETc = ETM × kf reçu, jusqu'au jour du relevé qui apprend.
  const k = suivre({ jours, observations, kf: { valeur: 0.8, depuis: null } }, TLALOC);
  proche(k[1].etc_mm, 4, 'ETM 5 × 0,8');
  proche(k[3].dr_mm, 32, '16 + 4 × 4');
  assert.equal(suivre({ jours, observations, kf: { valeur: 1, depuis: m(date(4), 0) } }, TLALOC)[4].kf_apres, null, 'relevé déjà appris');
  assert.equal(suivre({ etat_initial: { dr_mm: 16, dmax_mm: 60 }, jours, observations: [observations[1]] }, TLALOC)[4].kf_apres, null, 'aucun ancrage avant lui dans l\'appel');
  assert.equal(suivre({ jours, observations: [manque(m(date(0), 0), 16), poing(m(date(0), 570), 'correct')] }, TLALOC)[0].kf_apres, null, '2 mm ou moins consommés');
  // Deux relevés dans l'appel : le second part du kf appris au premier.
  const deux = suivre({ jours, observations: [...observations, poing(m(date(4), 720), 'sec')] }, TLALOC);
  const y = deux[4].ancrages[1];
  const kf2 = M.kfApres(kf, { dr_avant_mm: y.dr_calcule_mm as number, dr_apres_mm: y.dr_observe_mm, conso_mm: 2.5, sd_avant: y.incertitude_avant_mm as number, sd_apres: y.incertitude_apres_mm });
  assert.deepEqual(deux[4].kf_apres, { valeur: kf2, depuis: m(date(4), 720) });
  // Jeu OTF : ni kf, ni apprentissage (MC-20).
  const o = suivre({ jours, observations, kf: { valeur: 0.8, depuis: null } }, OTF);
  proche(o[1].etc_mm, 5, 'kf sans effet');
  assert.ok(o.every((j) => j.kf_apres === null));
});

test('Consommation apprise (§ 8) : le kf appris à un relevé sert dès le lendemain, jour inconnu (MC-14) et projection compris, comme Tlaloc', () => {
  // Manque observé 16 le jour 0 à minuit, ETM 5 mm/j, ETM inconnue le jour 7 ; poing « correct » le jour 5 à midi ; projection à partir du jour 10.
  const jours = Array.from({ length: 15 }, (_, i) => jour(i, { sol: solRU(60), etc_mm: i === 7 ? null : 5 }));
  const observations = [manque(m(date(0), 0), 16), poing(m(date(5), 720), 'correct')];
  for (const recu of [1, 0.8]) {
    const s = suivre({ aujourdhui: date(10), jours, observations, kf: { valeur: recu, depuis: null } }, TLALOC);
    const appris = s[5].kf_apres;
    assert.ok(appris !== null && appris.valeur !== recu, `kf ${recu} : le relevé du jour 5 apprend`);
    const kf = appris.valeur;
    for (let i = 1; i < 5; i += 1) proche(s[i].etc_mm, 5 * recu, `kf ${recu}, jour ${i} : le kf reçu`);
    proche(s[5].etc_mm, 5 * recu * 0.5, `kf ${recu}, jour du relevé : le kf reçu, calculé au début du jour, après midi`);
    proche(s[6].etc_mm, 5 * kf, `kf ${recu}, lendemain du relevé : le kf appris`);
    proche(s[6].dr_mm, Math.min(60, (s[5].dr_mm as number) + 5 * kf), `kf ${recu}, manque du lendemain`);
    assert.equal(s[7].etc_estimee, true);
    proche(s[7].etc_mm, 5 * kf, `kf ${recu}, jour inconnu : moyenne des 3 dernières ETM × le kf appris`);
    for (let i = 10; i < 15; i += 1) {
      assert.equal(s[i].nature, 'prevu');
      proche(s[i].etc_mm, 5 * kf, `kf ${recu}, projection, jour ${i}`);
    }
    assert.ok(s.every((j, i) => i === 5 || j.kf_apres === null), 'un seul relevé appris');
  }
});

/* ------------------------------------------------------------------ */
/* Mode horaire (contrat Tlaloc § 4.1)                                  */
/* ------------------------------------------------------------------ */

test('Horaire avec observation : la pluie avant l\'observation ne compte pas, celle d\'après à son heure', () => {
  const [s] = suivre({
    etat_initial: { dr_mm: 20, dmax_mm: 50 },
    jours: [jour(0, { sol: solRU(50), etc_mm: 4.8, pluie: { type: 'heures', heures: [{ instant: a(D0, 8), mm: 5 }, { instant: a(D0, 15), mm: 3 }] } })],
    observations: [manque(a(D0, 12), 10)],
  }, TLALOC);
  // Pluie 8 mm, interception 2 une fois : Pe = 6, 75 % de chaque heure (3,75 à 8 h, 2,25 à 15 h).
  // Après 12 h : 10 + 0,2 × 3 = 10,6 ; − 2,25 = 8,35 ; + 0,2 × 9 = 10,15.
  proche(s.dr_mm, 10.15, 'manque au soir');
  proche(s.pluie_mm, 2.25, 'pluie comptée');
  proche(s.etc_mm, 2.4, 'consommation comptée');
  proche(s.pic_mm, 8.35, 'pic');
  assert.equal(s.apres_apports.length, 1);
  proche(s.apres_apports[0].f, 15 / 24, 'heure de l\'apport');
  proche(s.apres_apports[0].dr, 8.35, 'manque après l\'apport');
  assert.equal(s.nature, 'observe');
  // Avant 12 h : 20 + 0,2 × 8 = 21,6 ; − 3,75 = 17,85 ; + 0,2 × 4 = 18,65.
  proche(s.ancrages[0]?.dr_calcule_mm, 18.65, 'ancrage calculé');
});

test('Horaire : une pluie sans heure tombe à 15 h (contrat Tlaloc § 4.1)', () => {
  const [s] = suivre({
    etat_initial: { dr_mm: 10, dmax_mm: 50 },
    jours: [jour(0, { sol: solRU(50), etc_mm: 2.4, pluie: { type: 'jour', mm: 12 } })],
  }, TLALOC);
  // Pe = 12 − 2 = 10 à 15 h : 10 + 0,1 × 15 = 11,5 ; − 10 = 1,5 ; + 0,1 × 9 = 2,4.
  proche(s.apres_apports[0].f, 15 / 24, 'à 15 h');
  proche(s.apres_apports[0].mm_compte, 10, 'pluie utile');
  proche(s.pic_mm, 1.5, 'pic');
  proche(s.dr_mm, 2.4, 'manque au soir');
});

test('Pluie prévue dans le bilan : pluie sûre (Tlaloc) et R2 (OTF)', () => {
  const prevue = { type: 'prevue' as const, mm: 8, modeles: [5, 6] };
  const t = suivre({ aujourdhui: D0, etat_initial: { dr_mm: 20, dmax_mm: 50 }, jours: [jour(0, { sol: solRU(50), pluie: prevue })] }, TLALOC)[0];
  // base 8 × 0,5 − 2 = 2 ; sûre : 0,8 × 5 − 1 = 3.
  proche(t.pluie_mm, 3, 'Tlaloc');
  proche(t.dr_mm, 17, 'Tlaloc');
  const r2 = { ...OTF, pluie: { ...OTF.pluie, part_prevue: 0.8 } };
  const o = suivre({ aujourdhui: D0, etat_initial: { dr_mm: 20, dmax_mm: 30 }, jours: [jour(0, { pluie: prevue })] }, r2)[0];
  proche(o.pluie_mm, 6.4, 'OTF, R2 = 0,8');
  assert.equal(o.nature, 'prevu');
});

test('Sous abri, la pluie vaut 0 et n\'est pas lue ; sous paillage, elle est multipliée par sa part', () => {
  const abri = suivre({ etat_initial: { dr_mm: 10, dmax_mm: 30 }, jours: [jour(0, { abri: true, pluie: null })] }, OTF)[0];
  assert.equal(abri.connu, true);
  proche(abri.pluie_mm, 0, 'sous abri');
  const paille = suivre({ etat_initial: { dr_mm: 20, dmax_mm: 30 }, jours: [jour(0, { pluie: { type: 'jour', mm: 10 }, part_paillage: 0.5 })] }, OTF)[0];
  proche(paille.pluie_mm, 5, 'OTF, paillage');
  const heures = [10, 11, 12].map((h, i) => ({ instant: a(D0, h), mm: [2, 30, 3][i] }));
  const t = suivre({ etat_initial: { dr_mm: 40, dmax_mm: 60 }, jours: [jour(0, { sol: solRU(60), pluie: { type: 'heures', heures }, part_paillage: 0.5 })] }, TLALOC)[0];
  // T04 : Pe 25,5 ; × 0,5 = 12,75.
  proche(t.pluie_mm, 12.75, 'Tlaloc, paillage');
  proche(t.dr_mm, 27.25, 'Tlaloc, paillage');
});

/* ------------------------------------------------------------------ */
/* Arrosages (contrat § 3, MC-34)                                       */
/* ------------------------------------------------------------------ */

test('Un arrosage à cheval sur minuit compte au prorata dans chaque jour ; sans fin, tout à son début', () => {
  const s = suivre({
    etat_initial: { dr_mm: 20, dmax_mm: 30 },
    jours: [jour(0), jour(1)],
    arrosages: [arrosage(a(D0, 22), a(date(1), 2), 8), arrosage(a(date(1), 10), null, 5)],
  }, OTF);
  proche(s[0].arrosage_mm, 4, 'jour 0');
  proche(s[1].arrosage_mm, 9, 'jour 1');
  proche(s[1].dr_mm, 7, 'jour 1');
});

test('apportsDesArrosages : la part comptée après ou avant un instant, au prorata', () => {
  const { debut } = M.bornesDuJour(D0);
  const midi = debut + 12 * HEURE_MS;
  const arr = [arrosage(a(D0, 11), a(D0, 13), 4), arrosage(a(D0, 12), null, 3), arrosage(a(D0, 6), a(D0, 7), 2)];
  const apres = M.apportsDesArrosages(arr, D0, M.FUSEAU, { depuis: midi });
  const avant = M.apportsDesArrosages(arr, D0, M.FUSEAU, { jusqua: midi });
  assert.deepEqual(apres.map((x) => x.mm), [2, 3], 'après midi : la moitié du premier, le ponctuel de midi');
  proche(apres[0].f, 0.5, 'placé à midi');
  assert.deepEqual(avant.map((x) => x.mm), [2, 2], 'avant midi');
  const total = M.apportsDesArrosages(arr, D0).reduce((t, x) => t + (x.mm ?? 0), 0);
  proche(total, 9, 'le jour entier');
});

test('Bassinage court (MC-34) : 25 % dans le jeu Tlaloc s\'il dure 10 min ou moins, en entier dans le jeu OTF', () => {
  const un = (minutes: number, jeu: JeuDeReglages) => suivre({
    etat_initial: { dr_mm: 10, dmax_mm: 50 },
    jours: [jour(0, { sol: solRU(50) })],
    arrosages: [arrosage(a(D0, 13), a(D0, 13 + minutes / 60), 4, { type: 'bassinage' })],
  }, jeu)[0];
  proche(un(10, TLALOC).arrosage_mm, 1, '10 min, Tlaloc');
  proche(un(10, TLALOC).dr_mm, 9, '10 min, Tlaloc');
  proche(un(11, TLALOC).arrosage_mm, 4, '11 min, Tlaloc');
  proche(un(10, OTF).arrosage_mm, 4, '10 min, OTF');
});

/* ------------------------------------------------------------------ */
/* Temps, sol, réglages                                                 */
/* ------------------------------------------------------------------ */

test('Journées de 23 et 25 h : la fraction d\'une observation à midi (heure locale)', () => {
  const unJour = (d: string, midi: string) => M.suivre({
    aujourdhui: '2026-12-31',
    etat_initial: { dr_mm: 10, dmax_mm: 30 },
    jours: [{ date: d, etc_mm: 2.3, sol: sol(30), abri: false, pluie: { type: 'jour', mm: 0 } }],
    observations: [manque(midi, 10)],
  }, OTF)[0];
  const printemps = unJour('2026-03-29', '2026-03-29T12:00:00+02:00');
  proche(printemps.fraction, 12 / 23, '29 mars, 23 h');
  proche(printemps.etc_mm, 2.3 * 12 / 23, 'consommation au prorata');
  proche(unJour('2026-10-25', '2026-10-25T12:00:00+01:00').fraction, 12 / 25, '25 octobre, 25 h');
});

test('Sol du jour : RU = θu × zr, Dmax = min(RU, plancher), RAW = p × RU (p ajusté dans le jeu Tlaloc, MC-21)', () => {
  const sOTF = suivre({ jours: [jour(0, { sol: { theta_u_mm_m: 93, zr_m: 0.4, p_tableau: 0.4, plancher_mm: 24.8 }, etc_mm: 2 })] }, OTF)[0];
  proche(sOTF.ru_mm, 37.2, 'RU');
  proche(sOTF.dmax_mm, 24.8, 'Dmax = plancher');
  proche(sOTF.p, 0.4, 'p du tableau');
  proche(sOTF.raw_mm, 14.88, 'RAW');
  const sT = suivre({ jours: [jour(0, { sol: solRU(60, 0.4), etc_mm: 2 })] }, TLALOC)[0];
  proche(sT.p, 0.52, 'p ajusté (T07)');
  proche(sT.raw_mm, 31.2, 'RAW');
  const sansEtc = suivre({ jours: [jour(0, { sol: solRU(60, 0.4), etc_mm: null })] }, TLALOC)[0];
  assert.equal(sansEtc.p, null);
  assert.equal(sansEtc.raw_mm, null);
  assert.equal(suivre({ jours: [jour(0, { sol: { ...solRU(60), p_tableau: null } })] }, TLALOC)[0].raw_mm, null);
});

test('pAjuste : FAO-56, note du tableau 22, borné de 0,1 à 0,8 (T07, comparé à la référence de Tlaloc)', () => {
  proche(M.pAjuste(0.4, 2), 0.52, 'ETc 2');
  proche(M.pAjuste(0.4, 12), 0.12, 'ETc 12');
  proche(M.pAjuste(0.8, 0), 0.8, 'borne haute');
  proche(M.pAjuste(0.1, 15), 0.1, 'borne basse');
  for (let i = 0; i <= 100; i += 1) {
    const p = i / 100, etc = (i * 7) % 15;
    proche(M.pAjuste(p, etc), REF.pAjuste(p, etc), `p ${p}, ETc ${etc}`);
  }
});

test('Pluie utile : mêmes résultats que la référence de Tlaloc, jeux Tlaloc et OTF (contrat § 5)', () => {
  let graine = 7;
  const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  for (let k = 0; k < 500; k += 1) {
    const heures = Array.from({ length: 1 + Math.floor(hasard() * 6) }, () => (hasard() < 0.3 ? 0 : hasard() * 40));
    const t = M.pluieUtileMesuree(heures, TLALOC.pluie);
    const rt = REF.pluieUtileMesuree(heures, { interception: 2, seuilRuiss: 15, partRuiss: 0.5 });
    proche(t.utile_mm, rt.Pe, 'mesurée, Tlaloc');
    proche(t.ruissellement_mm, rt.ruissellement, 'ruissellement, Tlaloc');
    proche(M.pluieUtileMesuree(heures, OTF.pluie).utile_mm, REF.pluieUtileMesuree(heures, { interception: 0, seuilRuiss: 15, partRuiss: 0 }).Pe, 'mesurée, OTF');
    const total = heures.reduce((s, h) => s + h, 0);
    proche(M.pluieUtileDuJour(total, TLALOC.pluie).utile_mm, Math.max(0, total - 2), 'total du jour, Tlaloc : interception seule');
    proche(M.pluieUtileDuJour(total, OTF.pluie).utile_mm, total, 'total du jour, OTF');
    const prevue = hasard() * 20;
    const modeles = hasard() < 0.2 ? null : Array.from({ length: Math.floor(hasard() * 4) }, () => hasard() * 10);
    const pt = M.pluieUtilePrevue(prevue, modeles, TLALOC.pluie);
    const rp = REF.pluieUtilePrevue(prevue, modeles, { partPrevue: 0.5, interception: 2, regleSure: true });
    proche(pt.utile_mm, rp.Pe, 'prévue, Tlaloc');
    assert.equal(pt.sure, rp.sure);
    proche(M.pluieUtilePrevue(prevue, modeles, OTF.pluie).utile_mm, REF.pluieUtilePrevue(prevue, modeles, { partPrevue: 1, interception: 0, regleSure: false }).Pe, 'prévue, OTF');
  }
  assert.equal(M.pluieUtile({ type: 'heures', heures: [] }, TLALOC.pluie).utile_mm, 0);
  assert.throws(() => M.pluieUtileDuJour(-1, OTF.pluie), RangeError);
  assert.throws(() => M.pluieUtilePrevue(3, [2, -1], TLALOC.pluie), RangeError);
});

test('Entrées et jeux mal formés : refusés (erreur de programme), jamais lus comme 0', () => {
  const e = (j: Partial<JourDonnees> = {}, autre: Partial<EntreeSuivi> = {}) => () => suivre({ jours: [jour(0, j)], ...autre }, OTF);
  assert.throws(() => suivre({ jours: [jour(0), jour(2)] }, OTF), RangeError, 'jours non consécutifs');
  assert.throws(e({ date: '1/6/2026' }), RangeError);
  assert.throws(e({}, { aujourdhui: 'demain' }), RangeError);
  assert.throws(e({ sol: { ...sol(30), theta_u_mm_m: 0 } }), RangeError);
  assert.throws(e({ sol: { ...sol(30), zr_m: -0.3 } }), RangeError);
  assert.throws(e({ sol: { ...sol(30), p_tableau: 1.2 } }), RangeError);
  assert.throws(e({ sol: { ...sol(30), plancher_mm: 0 } }), RangeError);
  assert.throws(e({ etc_mm: -1 }), RangeError);
  assert.throws(e({ etc_mm: Number.NaN }), RangeError);
  assert.throws(e({ abri: 'non' as unknown as boolean }), RangeError);
  assert.throws(e({ part_paillage: 1.5 }), RangeError);
  assert.throws(e({ pluie: { type: 'heures', heures: [{ instant: a(date(1), 3), mm: 2 }] } }), RangeError, 'heure de pluie hors du jour');
  assert.throws(e({}, { arrosages: [arrosage(a(D0, 8), null, -1)] }), RangeError);
  assert.throws(e({}, { arrosages: [arrosage(a(D0, 8), null, 1, { type: 'goutte' as 'arrosage' })] }), RangeError);
  assert.throws(e({}, { arrosages: [arrosage('hier', null, 1)] }), RangeError);
  assert.throws(e({}, { observations: [{ instant: a(D0, 8), type: 'sonde' as 'manque', dr_mm: 3 }] }), RangeError);
  assert.throws(e({}, { observations: [poing(a(D0, 8), 'humide' as ClassePoing)] }), RangeError);
  assert.throws(e({}, { observations: [tensio(a(D0, 8), 30, 0, 60)] }), RangeError);
  assert.throws(e({}, { observations: [tensio(a(D0, 8), 30, 60, 60)] }), RangeError);
  assert.throws(e({}, { observations: [tensio(a(D0, 8), Number.NaN)] }), RangeError);
  assert.throws(e({}, { observations: [manque('ce matin', 3)] }), RangeError);
  assert.throws(e({}, { observations: [manque(a(D0, 8), -1)] }), RangeError);
  assert.throws(e({}, { etat_initial: { dr_mm: 3, dmax_mm: 0 } }), RangeError);
  assert.throws(e({}, { etat_initial: { dr_mm: 3, dmax_mm: 30, incertitude_mm: -1 } }), RangeError);
  assert.throws(e({}, { kf: { valeur: 2, depuis: null } }), RangeError, 'kf de 0,6 à 1,6');
  assert.throws(e({}, { kf: { valeur: 1, depuis: 'hier' } }), RangeError);
  const jeu = (modif: Partial<JeuDeReglages>) => () => suivre({ jours: [jour(0)] }, { ...OTF, ...modif });
  assert.throws(jeu({ pluie: { ...OTF.pluie, part_prevue: 2 } }), RangeError);
  assert.throws(jeu({ jour_inconnu: 'zero' as 'inconnu' }), RangeError);
  assert.throws(jeu({ conservation: 'mm' as 'manque' }), RangeError);
  assert.throws(jeu({ drainage_au_redemarrage: 'zero' as 'inconnu' }), RangeError);
  assert.throws(jeu({ pas: 'minute' as 'horaire' }), RangeError, 'refusé avant tout calcul, même un jour inconnu');
  assert.throws(jeu({ bassinage: { duree_max_s: 600, part_comptee: 1.5 } }), RangeError);
  assert.throws(jeu({ poing: { ...OTF.poing, sigma_lecture: 0 } }), RangeError);
  assert.throws(jeu({ poing: { ...OTF.poing, fourchette: 'oui' as unknown as boolean } }), RangeError);
  assert.throws(jeu({ tensiometre: { actif: true, releve_prioritaire_h: -1 } }), RangeError);
  assert.throws(jeu({ consommation_apprise: undefined as unknown as boolean }), RangeError);
  assert.doesNotThrow(() => M.verifierJeu(OTF));
  assert.doesNotThrow(() => M.verifierJeu(TLALOC));
  assert.deepEqual(suivre({ jours: [] }, OTF), []);
});

test('Les jeux de réglages sont figés et contiennent les jeux du pas de calcul', () => {
  assert.ok(Object.isFrozen(OTF) && Object.isFrozen(OTF.pluie) && Object.isFrozen(OTF.bassinage));
  assert.ok(Object.isFrozen(TLALOC) && Object.isFrozen(TLALOC.pluie) && Object.isFrozen(TLALOC.bassinage));
  for (const j of [OTF, TLALOC]) assert.ok(Object.isFrozen(j.poing) && Object.isFrozen(j.tensiometre), `${j.nom} : options figées`);
  // MC-20 : aucune option de Tlaloc dans le jeu OTF.
  assert.deepEqual([OTF.poing.fourchette, OTF.tensiometre.actif, OTF.consommation_apprise], [false, false, false]);
  assert.deepEqual([TLALOC.poing.fourchette, TLALOC.tensiometre.actif, TLALOC.consommation_apprise], [true, true, true]);
  assert.deepEqual([TLALOC.poing.sigma_lecture, TLALOC.poing.regroupement_min, TLALOC.tensiometre.releve_prioritaire_h], [8, 60, 48]);
  assert.equal(OTF.pas, 'journalier');
  assert.equal(TLALOC.pas, 'horaire');
  assert.equal(OTF.bassinage.part_comptee, 1);
  assert.equal(TLALOC.bassinage.part_comptee, 0.25);
  assert.equal(TLALOC.bassinage.duree_max_s, 600);
});
