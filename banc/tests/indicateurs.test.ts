// Tests des indicateurs du banc (banc/src/indicateurs.ts). Valeurs calculées à la main dans les commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JEU_OTF, JEU_TLALOC } from '../../src/moteur.ts';
import { joursEntre } from '../src/dates.ts';
import { indicateurs, indicateursFerme, sousSeuilPropre, type IndicateursParcelle } from '../src/indicateurs.ts';
import { juger, type JourJuge } from '../src/juge.ts';
import type { TableKc } from '../src/kc.ts';
import { lireTableSol } from '../src/sol.ts';

/** Un jour de juge avec RU = 16 mm, p = 0,5, RAW = 8 mm (jeu OTF), ETc 1,4 mm. */
const jour = (date: string, dr: number, autre: Partial<JourJuge> = {}): JourJuge => ({
  date, dr_mm: dr, ru_mm: 16, raw_mm: 8, dmax_mm: 16, p: 0.5, p_tableau: 0.5, etc_mm: 1.4, etm_mm: 1.4,
  pluie_mm: 0, arrosage_mm: 0, eau_perdue_mm: 0, connu: true, compte: true, raw_connue: true, decisive: 'X',
  ...autre,
} as JourJuge);

test('seuils au centième, convention stricte de la FAO-56', () => {
  const r = indicateurs([
    jour('2019-07-01', 8), // = RAW : pas en stress ; > 4 : sous le seuil commun ; ≥ 0,5 × 16 : sous le seuil d'OTF
    jour('2019-07-02', 8.004), // 8,00 au centième : toujours pas en stress
    jour('2019-07-03', 8.006), // 8,01 : en stress
    jour('2019-07-04', 4), // = 0,5 × RAW : pas sous le seuil commun
    jour('2019-07-05', 16), // réserve vide (Dr ≥ RU)
    jour('2019-07-06', 3, { raw_connue: false, decisive: null }), // sans culture : non compté
    jour('2019-07-07', 3, { raw_connue: false }), // état inconnu : non compté
    jour('2018-12-31', 16, { compte: false }), // hors de l'année
  ], [], 'otf');
  assert.equal(r.jours_comptes, 5);
  assert.equal(r.jours_sans_culture, 1);
  assert.equal(r.jours_etat_inconnu, 1);
  assert.equal(r.jours_stress, 2);
  assert.equal(r.jours_seuil_commun, 4);
  assert.equal(r.jours_seuil_propre, 4); // OTF : Dr ≥ 8
  assert.equal(r.jours_reserve_vide, 1);
});

test('seuil propre de Tlaloc : 0,5 × p ajusté × RU', () => {
  // p ajusté = 0,5 + 0,04 × (5 − 1,4) = 0,644 ; 0,5 × 0,644 × 16 = 5,152 → 5,15.
  assert.equal(sousSeuilPropre(jour('2019-07-01', 5.15), 'tlaloc'), false);
  assert.equal(sousSeuilPropre(jour('2019-07-01', 5.16), 'tlaloc'), true);
  assert.throws(() => sousSeuilPropre(jour('2019-07-01', 5, { p_tableau: 0.7 }), 'otf'), /2\/3/);
});

test('eau apportée, bassinages, charge, eau perdue', () => {
  const r = indicateurs(
    [jour('2019-07-01', 2, { eau_perdue_mm: 1.5 }), jour('2019-07-02', 2, { eau_perdue_mm: null }), jour('2018-12-31', 2, { compte: false })],
    [
      { date: '2019-07-01', mm: 10, bassinage: false },
      { date: '2019-07-01', mm: 0.5, bassinage: true },
      { date: '2019-07-02', mm: 6, bassinage: false },
      { date: '2018-12-31', mm: 99, bassinage: false }, // hors de l'année
    ],
    'otf',
  );
  assert.equal(r.eau_apportee_mm, 16.5);
  assert.equal(r.eau_apportee_sans_bassinage_mm, 16);
  assert.equal(r.nombre_arrosages, 3);
  assert.equal(r.jours_avec_arrosage, 2);
  assert.equal(r.eau_perdue_mm, 1.5);
  assert.equal(r.jours_eau_perdue_inconnue, 1);
});

test('une année rejouée sans arrosage : la serre se vide,  écart au besoin = − ETM', () => {
  const SOL = lireTableSol({
    source: 'test', theta_u_mm_m: 160, racines_depart_m: { semis: 0.1, plant: 0.15 }, racines_borne_m: 0.6,
    sans_culture: { zr_m: 0.3, p: 0.4 }, cultures: [{ culture: 'X', p: 0.5, racines_max_m: 0.1 }],
  });
  const KC: TableKc = {
    source: 'test', regle: { facteur_serre: 0.7, kc_sol_nu: 0.4 },
    cultures: [{ culture: 'X', kc_ini: 1, kc_mid: 1, source: 'test', implantation_a_debut_recolte_j: [17], recolte_j: [425] }],
  };
  const meteo = joursEntre('2018-10-15', '2019-12-31').map((date) => ({ date, et0_mm: 2, pluie_mm: 0 }));
  const entree = {
    annee: 2019, serre: true, meteo, tableKc: KC, tableSol: SOL, arrosages: [],
    cultures: [{ culture: 'X', implantation: '2018-10-15', debut_recolte: '2018-11-01', fin_recolte: '2019-12-31', surface_m2: 100, plant: false }],
  };
  for (const [jeu, cote] of [[JEU_OTF, 'otf'], [JEU_TLALOC, 'tlaloc']] as const) {
    const r = indicateurs(juger(entree, jeu), [], cote);
    assert.equal(r.jours_comptes, 365);
    // Sous abri le juge part le 1er janvier à Dr = ½ × RAW (Nicolas, 28/11) ; ETM de 1,4 mm par jour, sans eau. RU 16 mm.
    // OTF : RAW 8, départ 4 ; Tlaloc : p ajusté 0,644, RAW 10,3, départ 5,15.
    const attendu = cote === 'otf'
      ? { jours_seuil_propre: 363, jours_seuil_commun: 365, jours_stress: 363, jours_reserve_vide: 357 }
      : { jours_seuil_propre: 365, jours_seuil_commun: 365, jours_stress: 362, jours_reserve_vide: 358 };
    for (const [k, v] of Object.entries(attendu)) assert.equal(r[k as keyof typeof r], v, `${jeu.nom} ${k}`);
    // 365 jours × 1,4 mm d'ETM, sans pluie sous serre ni arrosage.
    assert.equal(r.ecart_besoin_somme_mm, -511);
    assert.equal(r.ecart_besoin_absolu_mm, 511);
  }
});

test('écart au besoin semaine par semaine : un excès une semaine ne compense pas un manque la suivante en valeur absolue', () => {
  // Lundi 1er au dimanche 7 juillet : 7 × 1,4 = 9,8 mm de besoin, 15 mm apportés : + 5,2.
  // Lundi 8 au dimanche 14 : 9,8 mm de besoin, rien : − 9,8.
  const jours = joursEntre('2019-07-01', '2019-07-14').map((d) => jour(d, 2, { arrosage_mm: d === '2019-07-03' ? 15 : 0 }));
  const r = indicateurs(jours, [], 'otf');
  assert.equal(r.ecart_besoin_somme_mm, -4.6);
  assert.equal(r.ecart_besoin_absolu_mm, 15);
});

test('échelle de la ferme : pondération par la surface', () => {
  const base = indicateurs([jour('2019-07-01', 2)], [], 'otf');
  const a: IndicateursParcelle = { ...base, eau_apportee_mm: 10, jours_stress: 0, nombre_arrosages: 2 };
  const b: IndicateursParcelle = { ...base, eau_apportee_mm: 20, jours_stress: 4, nombre_arrosages: 3 };
  const f = indicateursFerme([{ surface_m2: 100, ind: a }, { surface_m2: 300, ind: b }]);
  assert.equal(f.surface_m2, 400);
  assert.equal(f.mm.eau_apportee_mm, 17.5); // (10 × 100 + 20 × 300) ÷ 400
  assert.deepEqual(f.jours.jours_stress, { moyenne: 3, parcelles: 1 });
  assert.equal(f.nombre_arrosages, 5);
});
