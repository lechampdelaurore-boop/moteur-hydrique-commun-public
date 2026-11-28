// Lecture de l'export de la démo de Tlaloc (banc/src/export-demo.ts), sur l'exemple de Nicolas (PR n° 17, 24/11), complété.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireExportDemo } from '../src/export-demo.ts';
import { lireTableKc } from '../src/kc.ts';

const TABLE = lireTableKc(JSON.parse(readFileSync(new URL('../donnees/kc-stades-tlaloc.json', import.meta.url), 'utf8')));

const exemple = () => ({
  format: 'banc-opuntia-demo', version: 1, annee: 2019,
  parcelles: [
    {
      id: 'pa1', nom: 'Serre 1', categorie: 'serre', surface_m2: 210, sol: 'limoneux',
      planches: { nombre: 7, longueur_m: 25, largeur_m: 1.2 }, seuil_bas_pct_RFU: 65, haut_de_bande_pct_RFU: 90,
      cultures: [
        { cycle: 2018, culture: 'Mâche', ou: { planches: [1, 5] }, implantation: '2018-11-12', debut_recolte: '2018-12-31', fin: '2019-02-25', plant: false },
        { cycle: 2018, culture: 'Laitue', ou: { planches: [6, 7] }, implantation: '2018-10-08', debut_recolte: '2018-11-19', fin: '2019-01-14', plant: true },
      ],
    },
    {
      id: 'pa62', nom: 'Serre 62', categorie: 'serre', surface_m2: 140, planches: null,
      cultures: [{ cycle: 2019, culture: 'Laitue', ou: { surface_m2: 70 }, implantation: '2019-03-04', debut_recolte: '2019-04-15', fin: '2019-05-13', plant: true }],
    },
  ],
});

test('l\'exemple de Nicolas : surfaces par planches (plage) ou en m², serre', () => {
  const { annee, parcelles } = lireExportDemo(exemple(), TABLE);
  assert.equal(annee, 2019);
  assert.equal(parcelles.length, 2);
  // Mâche : planches 1 à 5 → 5 × 25 × 1,2 = 150 m² ; laitue : 6 à 7 → 2 × 25 × 1,2 = 60 m² ; 150 + 60 = 210 = la serre.
  assert.deepEqual(parcelles[0].cultures.map((c) => [c.culture, c.surface_m2]), [['Mâche', 150], ['Laitue', 60]]);
  assert.equal(parcelles[0].serre, true);
  assert.deepEqual(parcelles[0].cultures[0], { culture: 'Mâche', implantation: '2018-11-12', debut_recolte: '2018-12-31', fin_recolte: '2019-02-25', surface_m2: 150, plant: false });
  assert.equal(parcelles[1].cultures[0].surface_m2, 70);
});

test('une parcelle sans vanne d\'arrosage avec un débit est « sans débit » (la serre 62 de la démo)', () => {
  const e = exemple();
  const vannes = (gag: number | null) => [{ id: 'v1', famille: 'gag', debit_mm_h: gag, bassinage: false }, { id: 'v2', famille: 'asp', debit_mm_h: 2.5, bassinage: true }];
  (e.parcelles[0] as { vannes?: unknown }).vannes = vannes(8.3);
  (e.parcelles[1] as { vannes?: unknown }).vannes = vannes(null);
  const { parcelles } = lireExportDemo(e, TABLE);
  assert.deepEqual(parcelles.map((p) => p.sans_debit), [false, true]); // la vanne de bassinage ne compte pas
  assert.equal(lireExportDemo(exemple(), TABLE).parcelles[1].sans_debit, false); // pas de vannes dans l'export : on ne devine rien
});

test('exports refusés', () => {
  const avec = (f: (e: ReturnType<typeof exemple>) => void) => { const e = exemple(); f(e); return e; };
  assert.throws(() => lireExportDemo(avec((e) => { (e as { version: number }).version = 2; }), TABLE), /format d'export/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[1].id = 'pa1'; }), TABLE), /en double/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[0].cultures[0].culture = 'Banane'; }), TABLE), /absente de la table/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[0].cultures[0].ou = { planches: [5, 8] }; }), TABLE), /planches illisibles/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[1].cultures[0].ou = { planches: [1, 2] }; }), TABLE), /parcelle sans planches/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[1].cultures[0].ou = { surface_m2: 200 }; }), TABLE), /hors de la parcelle/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[1].cultures[0].fin = '2019-04-01'; }), TABLE), /désordre/);
  assert.throws(() => lireExportDemo(avec((e) => { e.parcelles[0].categorie = 'tunnel'; }), TABLE), /catégorie inconnue/);
  assert.throws(() => lireExportDemo(avec((e) => { delete (e.parcelles[1].cultures[0] as { plant?: boolean }).plant; }), TABLE), /plant ou semis/);
});
