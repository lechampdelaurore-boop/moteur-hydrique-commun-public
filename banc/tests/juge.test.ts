// Tests du sol du juge (banc/src/sol.ts) et du juge (banc/src/juge.ts). Valeurs calculées à la main dans les commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JEU_OTF, JEU_TLALOC } from '../../src/moteur.ts';
import { joursEntre } from '../src/dates.ts';
import type { CultureEnPlace } from '../src/etm.ts';
import { juger, pluieHoraire, type ReponseHoraire } from '../src/juge.ts';
import type { TableKc } from '../src/kc.ts';
import { lireTableSol, racinesDuJour, solDuJour } from '../src/sol.ts';

const TOL = 1e-9;
const proche = (a: number | null | undefined, b: number) => assert.ok(a != null && Math.abs(a - b) <= TOL, `${a} ≠ ${b}`);

const SOL = lireTableSol({
  source: 'test',
  theta_u_mm_m: 160,
  racines_depart_m: { semis: 0.1, plant: 0.15 },
  racines_borne_m: 0.6,
  sans_culture: { zr_m: 0.3, p: 0.4 },
  cultures: [
    { culture: 'Tomate', p: 0.4, racines_max_m: 0.7 },
    { culture: 'Laitue', p: 0.3, racines_max_m: 0.2 },
    { culture: 'Radis', p: 0.5, racines_max_m: 0.2 },
    { culture: 'X', p: 0.5, racines_max_m: 0.1 },
  ],
});

const TOMATE: CultureEnPlace = { culture: 'Tomate', implantation: '2019-05-01', debut_recolte: '2019-06-12', fin_recolte: '2019-08-31', surface_m2: 60, plant: true };
const LAITUE: CultureEnPlace = { culture: 'Laitue', implantation: '2019-05-01', debut_recolte: '2019-05-31', fin_recolte: '2019-06-30', surface_m2: 30, plant: false };
const RADIS: CultureEnPlace = { culture: 'Radis', implantation: '2019-05-10', debut_recolte: '2019-06-01', fin_recolte: '2019-06-20', surface_m2: 30, plant: false };

test('racines : de 15 cm (plant) ou 10 cm (semis) à la profondeur maxi, bornée à 60 cm', () => {
  proche(racinesDuJour(TOMATE, '2019-05-01', SOL), 0.15);
  proche(racinesDuJour(TOMATE, '2019-05-22', SOL), 0.375); // 21 jours sur 42 : 0,15 + 0,45 / 2
  proche(racinesDuJour(TOMATE, '2019-06-12', SOL), 0.6); // 70 cm bornés à 60
  proche(racinesDuJour(TOMATE, '2019-08-31', SOL), 0.6);
  assert.equal(racinesDuJour(TOMATE, '2019-09-01', SOL), null);
  proche(racinesDuJour(LAITUE, '2019-05-16', SOL), 0.15); // semis : 0,1 + 0,1 × 15 / 30
  assert.throws(() => racinesDuJour({ ...TOMATE, plant: undefined }, '2019-05-02', SOL), /plant ou semis/);
});

test('sol du jour : la culture la moins enracinée décide ; à égalité, le p le plus bas ; sans culture, 30 cm et p 0,4', () => {
  const a = solDuJour([TOMATE, LAITUE], '2019-05-22', SOL); // tomate 0,375 m ; laitue 0,1 + 0,1 × 21 / 30 = 0,17 m
  assert.equal(a.decisive, 'Laitue');
  proche(a.sol.zr_m, 0.17);
  assert.equal(a.sol.p_tableau, 0.3);
  assert.equal(a.sol.plancher_mm, null);
  proche(a.sol.theta_u_mm_m * a.sol.zr_m, 27.2);
  const b = solDuJour([RADIS, LAITUE], '2019-06-05', SOL); // les deux à 20 cm : laitue (p 0,3) avant radis (0,5)
  assert.equal(b.decisive, 'Laitue');
  const c = solDuJour([TOMATE], '2019-09-01', SOL);
  assert.equal(c.decisive, null);
  assert.deepEqual(c.sol, { theta_u_mm_m: 160, zr_m: 0.3, p_tableau: 0.4, plancher_mm: null });
});

test('table du sol refusée', () => {
  assert.throws(() => lireTableSol({ ...SOL, cultures: [...SOL.cultures, SOL.cultures[0]] }), /en double/);
  assert.throws(() => lireTableSol({ ...SOL, cultures: [{ culture: 'Y', p: 1.2, racines_max_m: 0.3 }] }), /p entre 0 et 1/);
  assert.throws(() => lireTableSol({ ...SOL, theta_u_mm_m: 0 }), /theta_u_mm_m/);
});

// Une culture « X » au Kc constant de 1 et aux racines constantes de 10 cm : RU = 16 mm, p = 0,5.
const KC: TableKc = {
  source: 'test',
  regle: { facteur_serre: 0.7, kc_sol_nu: 0.4 },
  cultures: [{ culture: 'X', kc_ini: 1, kc_mid: 1, source: 'test', implantation_a_debut_recolte_j: [17], recolte_j: [425] }],
};
const X: CultureEnPlace = { culture: 'X', implantation: '2018-10-15', debut_recolte: '2018-11-01', fin_recolte: '2019-12-31', surface_m2: 100, plant: false };
const JOURS = joursEntre('2018-10-15', '2019-12-31');

test('juge sous serre : départ à la moitié de la réserve facile, arrosage, deux jeux', () => {
  const meteo = JOURS.map((date) => ({ date, et0_mm: 2, pluie_mm: 50 })); // sous serre, la pluie n'est pas lue
  const entree = {
    annee: 2019, serre: true, cultures: [X], meteo, tableKc: KC, tableSol: SOL,
    arrosages: [{ debut: '2019-01-06T08:00:00Z', fin: '2019-01-06T09:00:00Z', mm: 10 }],
  };
  const otf = juger(entree, JEU_OTF);
  // Sous abri, le juge part le 1er janvier (Nicolas, 28/11) ; en plein champ, le 15 octobre (test suivant).
  assert.equal(otf.length, 365);
  assert.equal(otf[0].date, '2019-01-01');
  // ETM = 2 × 1 × 0,7 = 1,4 mm ; départ 0,5 × 0,5 × 16 = 4 mm ; le soir du 1er : 5,4 mm.
  proche(otf[0].etm_mm, 1.4);
  proche(otf[0].dr_mm, 5.4);
  proche(otf[0].raw_mm, 8);
  proche(otf[0].dmax_mm, 16);
  // Le 6 : 4 + 5 × 1,4 = 11 la veille au soir, − 10 + 1,4 = 2,4.
  proche(otf[5].dr_mm, 2.4);
  assert.equal(otf[5].arrosage_mm, 10);
  assert.equal(otf[5].pluie_mm, 0);
  assert.equal(otf.find((j) => j.date === '2018-12-31'), undefined);
  assert.equal(otf.find((j) => j.date === '2019-01-01')!.compte, true);
  assert.ok(otf.every((j) => j.nature === 'estime' && j.decisive === 'X'));

  const tlaloc = juger(entree, JEU_TLALOC);
  // p ajusté : 0,5 + 0,04 × (5 − 1,4) = 0,644 ; départ 0,5 × 0,644 × 16 = 5,152 ; le soir : 6,552.
  proche(tlaloc[0].p, 0.644);
  proche(tlaloc[0].dr_mm, 6.552);
  assert.ok(tlaloc[0].raw_connue);
});

test('juge en plein champ : total du jour (jeu journalier) ou heure par heure (jeu horaire) ; sans culture, RAW inconnue', () => {
  const meteo = JOURS.map((date) => ({ date, et0_mm: 0, pluie_mm: date === '2018-10-16' ? 20 : 0 }));
  const heures = pluieHoraire({
    hourly_units: { precipitation: 'mm' },
    hourly: {
      time: JOURS.flatMap((d) => Array.from({ length: 24 }, (_, i) => `${d}T${String(i).padStart(2, '0')}:00`)),
      precipitation: JOURS.flatMap((d) => Array.from({ length: 24 }, (_, i) => (d === '2018-10-16' && i === 14 ? 20 : 0))),
    },
  });
  const entree = { annee: 2019, serre: false, cultures: [X], meteo, heures, tableKc: KC, tableSol: SOL, arrosages: [] };
  // OTF : ni ruissellement ni interception, 20 mm.
  proche(juger(entree, JEU_OTF)[1].pluie_mm, 20);
  // Tlaloc : (20 − 15) × 0,5 = 2,5 mm ruisselés, 2 mm interceptés : 15,5 mm.
  proche(juger(entree, JEU_TLALOC)[1].pluie_mm, 15.5);

  const nu = juger({ ...entree, cultures: [{ ...X, fin_recolte: '2019-06-30' }] }, JEU_OTF);
  const juillet = nu.find((j) => j.date === '2019-07-01')!;
  assert.equal(juillet.decisive, null);
  assert.equal(juillet.raw_connue, false);
  proche(juillet.ru_mm, 48); // 30 cm × 160 mm/m
});

test('pluie heure par heure d\'Open-Meteo', () => {
  const rep = (jours: string[], f: (d: string, i: number) => number | null = () => 0.1): ReponseHoraire => ({
    hourly_units: { time: 'iso8601', precipitation: 'mm' },
    hourly: {
      time: jours.flatMap((d) => Array.from({ length: 24 }, (_, i) => `${d}T${String(i).padStart(2, '0')}:00`)),
      precipitation: jours.flatMap((d) => Array.from({ length: 24 }, (_, i) => f(d, i))),
    },
  });
  const h = pluieHoraire(rep(['2019-03-30', '2019-03-31']));
  assert.equal(h.get('2019-03-30')!.length, 24);
  assert.equal(h.get('2019-03-30')![0].instant, '2019-03-29T23:00:00.000Z'); // minuit à Paris, heure d'hiver
  // Le 31 mars ne dure que 23 h : la 12e valeur tombe à 11 h 30 de temps écoulé.
  assert.equal(h.get('2019-03-31')![12].instant, '2019-03-31T10:30:00.000Z');
  assert.equal(pluieHoraire(rep(['2019-07-01'], (_, i) => (i === 5 ? null : 0))).get('2019-07-01'), null);
  const r = rep(['2019-07-01']);
  assert.throws(() => pluieHoraire({ ...r, hourly_units: { precipitation: 'inch' } }), /unité/);
  (r.hourly!.time as string[]).pop();
  (r.hourly!.precipitation as number[]).pop();
  assert.throws(() => pluieHoraire(r), /23 heures/);
});
