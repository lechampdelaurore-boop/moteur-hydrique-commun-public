// Tests du classement des années (contrat du banc, § 3). Valeurs calculées à la main dans les commentaires.
// Lancer : node --test --experimental-strip-types banc/tests/classement.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anneesEligibles, classer, percentile, totauxAnnuels } from '../src/classement.ts';
import type { TotauxAnnee } from '../src/classement.ts';
import { joursEntre } from '../src/dates.ts';
import type { JourMeteo } from '../src/meteo.ts';

const TOL = 1e-9;
const proche = (a: number, b: number) => assert.ok(Math.abs(a - b) <= TOL, `${a} ≠ ${b}`);

/** 8 années 2001 à 2008, pluie 400 à 1100 mm par pas de 100 ; ET0 700 mm sauf indication. */
function huitAnnees(et0: Record<number, number> = {}): TotauxAnnee[] {
  return [400, 500, 600, 700, 800, 900, 1000, 1100].map((pluie, i) => {
    const annee = 2001 + i;
    const e = et0[annee] ?? 700;
    return { annee, jours: 365, pluie_mm: pluie, et0_mm: e, bilan_mm: pluie - e };
  });
}
const TOUTES = new Set([2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008]);
const AUCUNE = new Set<number>();

test('percentile par interpolation linéaire (type 7)', () => {
  // [1, 2, 3, 4] : h = 3 × p ; p = 0,25 → h = 0,75 → 1 + 0,75 × 1 = 1,75 ; p = 0,5 → 2,5 ; p = 0,125 → h = 0,375 → 1,375.
  proche(percentile([4, 1, 3, 2], 0.25), 1.75);
  proche(percentile([4, 1, 3, 2], 0.5), 2.5);
  proche(percentile([4, 1, 3, 2], 0.125), 1.375);
  proche(percentile([4, 1, 3, 2], 0), 1);
  proche(percentile([4, 1, 3, 2], 1), 4);
  proche(percentile([7], 0.75), 7);
  assert.throws(() => percentile([], 0.5));
  assert.throws(() => percentile([1, 2], 1.5));
});

test('cas de base : repères, quarts et les 3 années', () => {
  // Pluies triées 400…1100, h = 7 × p : P12,5 = 400 + 0,875 × 100 = 487,5 ; Q1 = 500 + 0,75 × 100 = 575 ;
  // médiane = 750 ; Q3 = 900 + 0,25 × 100 = 925 ; P87,5 = 1000 + 0,125 × 100 = 1012,5.
  const c = classer(huitAnnees(), TOUTES, AUCUNE);
  proche(c.pluie.p12_5, 487.5); proche(c.pluie.q1, 575); proche(c.pluie.mediane, 750); proche(c.pluie.q3, 925); proche(c.pluie.p87_5, 1012.5);
  // Bilans −300…400 : Q1 = −125, médiane = 50, Q3 = 225.
  proche(c.bilan.q1, -125); proche(c.bilan.mediane, 50); proche(c.bilan.q3, 225);
  assert.deepEqual(c.tableau.map((l) => l.categorie), ['quart sec', 'quart sec', 'milieu', 'milieu', 'milieu', 'milieu', 'quart humide', 'quart humide']);
  assert.deepEqual(c.tableau.map((l) => l.rang_pluie), [1, 2, 3, 4, 5, 6, 7, 8]);
  // Sèche : quart sec = 2001 (400), 2002 (500) ; plus proche de 487,5 → 2002.
  assert.equal(c.choix.seche.annee, 2002);
  assert.deepEqual(c.choix.seche.candidats.quart, [2001, 2002]);
  assert.equal(c.choix.seche.controle_et0, 'conforme'); // bilan −200 ≤ 50
  assert.equal(c.choix.seche.passe2, 'omise');
  // Humide : 2007 (1000), 2008 (1100) ; plus proche de 1012,5 → 2007.
  assert.equal(c.choix.humide.annee, 2007);
  assert.equal(c.choix.humide.controle_et0, 'conforme'); // bilan 300 ≥ 50
  // Moyenne : 700 (2004) et 800 (2005) à 50 mm de 750 : à égalité, la plus récente → 2005 ; bilan 100 entre −125 et 225.
  assert.equal(c.choix.moyenne.annee, 2005);
  assert.equal(c.choix.moyenne.controle_et0, 'conforme');
  assert.equal(c.nombre_annees, 8);
  assert.equal(c.premiere_annee, 2001);
  assert.equal(c.derniere_annee, 2008);
});

test('dans le quart, une année couverte par l\'archive des prévisions passe devant', () => {
  const c = classer(huitAnnees(), TOUTES, new Set([2001, 2008]));
  assert.equal(c.choix.seche.annee, 2001);
  assert.equal(c.choix.seche.passe2, 'possible');
  assert.deepEqual(c.choix.seche.candidats.apres_couverture, [2001]);
  assert.equal(c.choix.humide.annee, 2008);
  // La moyenne ne regarde pas la couverture : toujours 2005, passe 2 omise.
  assert.equal(c.choix.moyenne.annee, 2005);
  assert.equal(c.choix.moyenne.passe2, 'omise');
});

test('le contrôle par l\'ET0 écarte une année sèche par la pluie mais pas par le bilan', () => {
  // 2002 avec ET0 0 : bilan 500. Bilans triés −300, −100, 0, 100, 200, 300, 400, 500 : médiane = 150.
  // 2002 (500 > 150) ne passe pas ; 2001 (−300) passe → sèche = 2001.
  const c = classer(huitAnnees({ 2002: 0 }), TOUTES, AUCUNE);
  proche(c.bilan.mediane, 150);
  assert.equal(c.choix.seche.annee, 2001);
  assert.deepEqual(c.choix.seche.candidats.apres_controle, [2001]);
  assert.equal(c.choix.seche.controle_et0, 'conforme');
});

test('si aucune année du quart ne passe le contrôle, on les garde toutes et on le dit', () => {
  // 2001 et 2002 avec ET0 0 : bilans 400 et 500 ; triés −100, 0, 100, 200, 300, 400, 400, 500 : médiane = 250.
  // Aucune des deux ≤ 250 → toutes gardées ; plus proche de 487,5 → 2002, contrôle non conforme.
  const c = classer(huitAnnees({ 2001: 0, 2002: 0 }), TOUTES, AUCUNE);
  proche(c.bilan.mediane, 250);
  assert.equal(c.choix.seche.annee, 2002);
  assert.deepEqual(c.choix.seche.candidats.apres_controle, [2001, 2002]);
  assert.equal(c.choix.seche.controle_et0, 'non conforme');
  assert.match(c.choix.seche.raison, /aucune ne passe le contrôle/);
});

test('une année dont la fenêtre de météo est incomplète est classée mais pas choisie', () => {
  const sans2002 = new Set([...TOUTES].filter((a) => a !== 2002));
  const c = classer(huitAnnees(), sans2002, AUCUNE);
  assert.equal(c.choix.seche.annee, 2001);
  assert.equal(c.tableau.find((l) => l.annee === 2002)!.eligible, false);
  assert.equal(c.nombre_annees, 8); // toujours classée
  const sansQuartSec = new Set([...TOUTES].filter((a) => a > 2002));
  assert.throws(() => classer(huitAnnees(), sansQuartSec, AUCUNE), /aucune année du quart sec/);
});

test('moins de 4 années : pas de quarts', () => {
  assert.throws(() => classer(huitAnnees().slice(0, 3), TOUTES, AUCUNE), /au moins 4 années/);
});

/** Météo constante de `debut` à `fin`. */
const serie = (debut: string, fin: string, pluie: number | null, et0: number | null): JourMeteo[] =>
  joursEntre(debut, fin).map((date) => ({ date, pluie_mm: pluie, et0_mm: et0 }));

test('totaux annuels : années entières seulement, bissextiles comprises, un inconnu écarte l\'année', () => {
  const jours = [
    ...serie('2000-10-15', '2000-12-31', 1, 2),
    ...serie('2001-01-01', '2001-12-31', 1, 2), // 365 jours : pluie 365, ET0 730
    ...serie('2002-01-01', '2002-06-30', 1, 2),
    { date: '2002-07-01', pluie_mm: null, et0_mm: 2 }, // pluie inconnue : 2002 non classée
    ...serie('2002-07-02', '2003-12-31', 1, 2),
    ...serie('2004-01-01', '2004-12-31', 0.5, 1), // 366 jours : pluie 183, ET0 366
    ...serie('2005-01-01', '2005-01-12', 0, 0),
  ];
  const t = totauxAnnuels(jours);
  assert.deepEqual(t.map((x) => x.annee), [2001, 2003, 2004]); // 2000 et 2005 incomplètes, 2002 avec un inconnu
  assert.deepEqual(t[0], { annee: 2001, jours: 365, pluie_mm: 365, et0_mm: 730, bilan_mm: -365 });
  assert.deepEqual(t[2], { annee: 2004, jours: 366, pluie_mm: 183, et0_mm: 366, bilan_mm: -183 });
  // Fenêtres complètes : 2001 (15/10/2000 au 12/01/2002), 2003 (15/10/2002 au 12/01/2004), 2004 (15/10/2003 au 12/01/2005).
  assert.deepEqual([...anneesEligibles(jours, [2001, 2003, 2004])], [2001, 2003, 2004]);
  // Sans le 12/01/2005, la fenêtre de 2004 est incomplète.
  assert.deepEqual([...anneesEligibles(jours.slice(0, -1), [2004])], []);
  // La pluie inconnue du 1/7/2002 est dans la fenêtre de 2002.
  assert.deepEqual([...anneesEligibles(jours, [2002])], []);
});

test('totaux arrondis au centième', () => {
  const jours = serie('2001-01-01', '2001-12-31', 0.1, 0.3); // 365 × 0,1 = 36,5 (le flottant donne 36,50000000000…)
  const [t] = totauxAnnuels(jours);
  assert.equal(t.pluie_mm, 36.5);
  assert.equal(t.et0_mm, 109.5);
  assert.equal(t.bilan_mm, -73);
});
