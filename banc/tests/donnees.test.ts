// Tests de lecture des données du banc : météo, Kc de Nicolas, plan de Tlaloc, couverture de l'archive des prévisions.
// Lancer : node --test --experimental-strip-types banc/tests/donnees.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fenetreMeteo, jourSuivant, joursEntre, estDate } from '../src/dates.ts';
import { assembler, ecrireCsv, extraire, lireCsv, lireJournalier } from '../src/meteo.ts';
import { lireTableKc } from '../src/kc.ts';
import { lirePlanTlaloc } from '../src/plan-tlaloc.ts';
import { analyserCouverture, bornesCouverture } from '../src/couverture.ts';
import { urlPrevisionsPrecedentes, urlReanalyse, variablesPrevisions } from '../src/open-meteo.ts';

test('dates : jours suivants, bissextiles, fenêtre de météo', () => {
  assert.equal(jourSuivant('2024-02-28'), '2024-02-29');
  assert.equal(jourSuivant('2023-02-28'), '2023-03-01');
  assert.equal(jourSuivant('2025-01-01', -1), '2024-12-31');
  assert.equal(joursEntre('2024-01-01', '2024-12-31').length, 366);
  assert.equal(estDate('2023-02-29'), false);
  assert.equal(estDate('2024-02-29'), true);
  assert.deepEqual(fenetreMeteo(2022), { debut: '2021-10-15', fin: '2023-01-12' });
  // 2022 : 78 jours (15/10 au 31/12/2021) + 365 + 12 = 455 jours.
  assert.equal(joursEntre(fenetreMeteo(2022).debut, fenetreMeteo(2022).fin).length, 455);
  assert.deepEqual(bornesCouverture(2024), { debut: '2024-01-01', fin: '2025-01-04' });
});

const reponse = (unites = { precipitation_sum: 'mm', et0_fao_evapotranspiration: 'mm' }) => ({
  daily_units: { time: 'iso8601', ...unites },
  daily: { time: ['2024-07-01', '2024-07-02', '2024-07-03'], precipitation_sum: [0, 12.4, null], et0_fao_evapotranspiration: [5.12, 2.3, 4] },
});

test('réponse journalière d\'Open-Meteo : valeurs lues, inconnu gardé, unité vérifiée', () => {
  assert.deepEqual(lireJournalier(reponse()), [
    { date: '2024-07-01', et0_mm: 5.12, pluie_mm: 0 },
    { date: '2024-07-02', et0_mm: 2.3, pluie_mm: 12.4 },
    { date: '2024-07-03', et0_mm: 4, pluie_mm: null },
  ]);
  assert.throws(() => lireJournalier(reponse({ precipitation_sum: 'inch', et0_fao_evapotranspiration: 'mm' })), /au lieu de « mm »/);
  assert.throws(() => lireJournalier({ daily: { time: ['2024-07-01'] } }), /sans daily/);
  const negatif = reponse();
  negatif.daily.precipitation_sum[0] = -1;
  assert.throws(() => lireJournalier(negatif), /négative/);
});

test('CSV date,et0_mm,pluie_mm : aller-retour, cellule vide = inconnu, fichier d\'année sans trou', () => {
  const jours = lireJournalier(reponse());
  const csv = ecrireCsv(jours);
  assert.equal(csv, 'date,et0_mm,pluie_mm\n2024-07-01,5.12,0\n2024-07-02,2.3,12.4\n2024-07-03,4,\n');
  assert.deepEqual(lireCsv(csv), jours);
  assert.deepEqual(lireCsv(csv.replace(/\n/g, '\r\n')), jours); // fichier passé par Windows
  assert.throws(() => ecrireCsv(jours, true), /2024-07-03/);
  assert.throws(() => lireCsv('date,pluie_mm,et0_mm\n'), /en-tête/);
  assert.throws(() => lireCsv('date,et0_mm,pluie_mm\n2024-07-01,1,1\n2024-07-03,1,1\n'), /discontinue/);
});

test('assemblage et extraction : trou ou doublon refusés', () => {
  const a = [{ date: '2024-12-31', et0_mm: 1, pluie_mm: 0 }];
  const b = [{ date: '2025-01-01', et0_mm: 1, pluie_mm: 0 }];
  assert.equal(assembler([a, b]).length, 2);
  assert.throws(() => assembler([a, a]), /discontinue/);
  assert.throws(() => extraire(a, '2024-12-30', '2024-12-31'), /2024-12-30 manque/);
});

test('Kc de Nicolas : 28 cultures, recopiées de son commentaire, table vérifiée', () => {
  const table = lireTableKc(JSON.parse(readFileSync(new URL('../donnees/kc-stades-tlaloc.json', import.meta.url), 'utf8')));
  assert.equal(table.cultures.length, 28);
  assert.equal(table.regle.facteur_serre, 0.7);
  assert.equal(table.regle.kc_sol_nu, 0.4);
  assert.deepEqual(table.cultures.find((c) => c.culture === 'Tomate'), {
    culture: 'Tomate', kc_ini: 0.6, kc_mid: 1.15, source: 'FAO-56', implantation_a_debut_recolte_j: [42, 70, 84], recolte_j: [14, 70, 133],
  });
  assert.deepEqual(table.cultures.find((c) => c.culture === 'Maïs doux'), {
    culture: 'Maïs doux', kc_ini: 0.3, kc_mid: 1.15, source: 'FAO-56', implantation_a_debut_recolte_j: [84], recolte_j: [35],
  });
  const ail = { culture: 'Ail', kc_ini: 0.7, kc_mid: 1, source: 'FAO-56', implantation_a_debut_recolte_j: [245], recolte_j: [21] };
  const base = { source: 's', regle: { facteur_serre: 0.7, kc_sol_nu: 0.4 } };
  assert.throws(() => lireTableKc({ ...base, cultures: [ail, ail] }), /en double/);
  assert.throws(() => lireTableKc({ ...base, cultures: [{ ...ail, kc_mid: 0.5 }] }), /Kc mid inférieur/);
  assert.throws(() => lireTableKc({ ...base, cultures: [{ ...ail, recolte_j: [2.5] }] }), /durées/);
  assert.throws(() => lireTableKc({ ...base, regle: { facteur_serre: 0, kc_sol_nu: 0.4 }, cultures: [] }), /serre/);
});

const ENTETE = 'date,parcelle,mm,mm_sol,mm_fond,mm_complement,mm_bassinage,mm_autre,reserve_facile_pct_opuntia,rfu_mm_opuntia,kc_opuntia';

test('plan de Tlaloc : l\'exemple de Nicolas se lit, les incohérences sont refusées', () => {
  // Ligne d'exemple du commentaire de Nicolas : 3,33 + 26,67 + 0,86 + 0 = 30,86 = mm.
  const [l] = lirePlanTlaloc(`${ENTETE}\n2023-07-01,pa1,30.86,30.21,3.33,26.67,0.86,0,31,40.4,0.775\n`);
  assert.deepEqual(l, {
    date: '2023-07-01', parcelle: 'pa1', mm: 30.86, mm_sol: 30.21, mm_fond: 3.33, mm_complement: 26.67, mm_bassinage: 0.86, mm_autre: 0,
    reserve_facile_pct_opuntia: 31, rfu_mm_opuntia: 40.4, kc_opuntia: 0.775,
  });
  assert.equal(lirePlanTlaloc(`${ENTETE}\n2023-07-01,pa1,0,0,0,0,0,0,,,\n`)[0].kc_opuntia, null);
  assert.throws(() => lirePlanTlaloc('date,parcelle,mm\n'), /en-tête/);
  assert.throws(() => lirePlanTlaloc(`${ENTETE}\n2023-07-01,pa1,31.86,30.21,3.33,26.67,0.86,0,31,40.4,0.775\n`), /somme des origines/);
  assert.throws(() => lirePlanTlaloc(`${ENTETE}\n2023-07-01,pa1,1,2,1,0,0,0,,,\n`), /dépasse/);
  assert.throws(() => lirePlanTlaloc(`${ENTETE}\n2023-07-01,pa1,0,0,0,0,0,0,,,\n2023-07-01,pa1,0,0,0,0,0,0,,,\n`), /en double/);
  assert.throws(() => lirePlanTlaloc(`${ENTETE}\n2023-07-01,pa1,-1,0,0,0,0,-1,,,\n`), /mm illisible/);
});

test('couverture de l\'archive des prévisions', () => {
  const variables = ['a', 'b'];
  assert.deepEqual(analyserCouverture({ error: true, reason: 'Data not available' }, variables), { complete: false, premier_manque: null, erreur: 'Data not available' });
  assert.deepEqual(analyserCouverture({ hourly: { time: ['t0', 't1'], a: [1, 2], b: [0, null] } }, variables), { complete: false, premier_manque: { variable: 'b', heure: 't1' }, erreur: null });
  assert.deepEqual(analyserCouverture({ hourly: { time: ['t0'], a: [1] } }, variables).erreur, 'variable absente de la réponse : b');
  assert.deepEqual(analyserCouverture({ hourly: { time: ['t0', 't1'], a: [1, 2], b: [0, 0] } }, variables), { complete: true, premier_manque: null, erreur: null });
});

test('adresses d\'Open-Meteo : lieu du contrat, jours de Paris, modèle fixé', () => {
  const r = new URL(urlReanalyse('2021-10-15', '2023-01-12', true));
  assert.equal(r.searchParams.get('latitude'), '45.5');
  assert.equal(r.searchParams.get('longitude'), '5.75');
  assert.equal(r.searchParams.get('timezone'), 'Europe/Paris');
  assert.equal(r.searchParams.get('models'), 'era5_seamless');
  assert.equal(r.searchParams.get('daily'), 'et0_fao_evapotranspiration,precipitation_sum');
  assert.equal(r.searchParams.get('hourly'), 'precipitation');
  assert.equal(new URL(urlReanalyse('2021-01-01', '2021-12-31', false)).searchParams.has('hourly'), false);
  assert.equal(variablesPrevisions().length, 8);
  const p = new URL(urlPrevisionsPrecedentes('2024-01-01', '2025-01-04', 'best_match'));
  assert.equal(p.searchParams.has('models'), false);
  assert.match(p.searchParams.get('hourly')!, /precipitation_previous_day4/);
  assert.equal(new URL(urlPrevisionsPrecedentes('2024-01-01', '2024-01-01', 'ecmwf_ifs025')).searchParams.get('models'), 'ecmwf_ifs025');
});
