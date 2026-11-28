// Tests du rejeu d'une année (banc/src/rejeu.ts), sur la météo rangée de 2019 et une démo réduite à deux parcelles.
// Le côté OTF appelle le module (voir cote-otf.test.ts) ; sans son clone, ces tests-là sont sautés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerModuleOtf, type MaterielOtf } from '../src/cote-otf.ts';
import { joursEntre } from '../src/dates.ts';
import { etmSerie } from '../src/etm.ts';
import { lireExportDemo } from '../src/export-demo.ts';
import { pluieHoraire } from '../src/juge.ts';
import { lireTableKc } from '../src/kc.ts';
import { lireCsv } from '../src/meteo.ts';
import type { LignePlan } from '../src/plan-tlaloc.ts';
import { arrosagesTlaloc, instantParis, rapportAnnee, rattrapageDuLundi, rejouerAnnee } from '../src/rejeu.ts';
import { lireTableSol } from '../src/sol.ts';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = process.env.MODULE_OTF ?? path.resolve(ICI, '../../../module-irrigation-otf-public');
const ABSENT = !existsSync(path.join(RACINE, 'lib/domain/planning/engine.ts'));
const lire = (f: string) => readFileSync(path.join(ICI, '..', f), 'utf8');

test('heure de Paris en instant', () => {
  assert.equal(instantParis('2019-07-01', '06:00'), '2019-07-01T04:00:00.000Z'); // heure d'été
  assert.equal(instantParis('2019-01-15', '06:00'), '2019-01-15T05:00:00.000Z'); // heure d'hiver
  assert.throws(() => instantParis('2019-01-15', '6h'), /heure illisible/);
});

const ligne = (date: string, parcelle: string, mm: number, bassinage = 0): LignePlan => ({
  date, parcelle, mm, mm_sol: mm, mm_fond: mm - bassinage, mm_complement: 0, mm_bassinage: bassinage, mm_autre: 0,
  reserve_facile_pct_opuntia: null, rfu_mm_opuntia: null, kc_opuntia: null,
});

test('plan de Tlaloc en arrosages : l\'arrosage du jour à son heure, le bassinage à part, avec sa durée', () => {
  const { arrosages, apports } = arrosagesTlaloc(
    [ligne('2019-07-01', 'pa1', 6.5, 0.5), ligne('2019-07-01', 'pa2', 4), ligne('2019-07-02', 'pa1', 0)],
    'pa1', { arrosage: '06:00', bassinage: { heure: '13:00', duree_s: 300 } },
  );
  assert.deepEqual(arrosages, [
    { debut: '2019-07-01T04:00:00.000Z', fin: null, mm: 6, type: 'arrosage', nature: 'banc-tlaloc' },
    { debut: '2019-07-01T11:00:00.000Z', fin: '2019-07-01T11:05:00.000Z', mm: 0.5, type: 'bassinage', nature: 'banc-tlaloc' },
  ]);
  assert.deepEqual(apports, [{ date: '2019-07-01', mm: 6, bassinage: false }, { date: '2019-07-01', mm: 0.5, bassinage: true }]);
});

test('le bassinage entre au sol pour sa part `mm_sol`, et reste entier dans l\'eau apportée (Nicolas, 28/11)', () => {
  const l = { ...ligne('2019-07-01', 'pa1', 6.5, 0.5), mm_sol: 6.12 }; // 6 mm d'arrosage, 0,5 mm bassinés dont 0,12 mm au sol
  const heures = { arrosage: '06:00', bassinage: { heure: '13:00', duree_s: 300 } };
  const { arrosages, apports } = arrosagesTlaloc([l], 'pa1', heures);
  assert.deepEqual(arrosages.map((a) => [a.type, a.mm]), [['arrosage', 6], ['bassinage', 0.12]]);
  assert.deepEqual(apports.map((a) => [a.bassinage, a.mm]), [[false, 6], [true, 0.5]]);
  // Un bassinage qui n'arrive pas au sol n'est pas un arrosage du juge, mais reste dans l'eau apportée.
  const r = arrosagesTlaloc([{ ...l, mm_sol: 6 }], 'pa1', heures);
  assert.deepEqual(r.arrosages.map((a) => a.type), ['arrosage']);
  assert.equal(r.apports.length, 2);
});

test('une année rejouée de bout en bout : deux côtés, deux juges, la ferme et le rapport', { skip: ABSENT && 'clone du module absent' }, async () => {
  const tableKc = lireTableKc(JSON.parse(lire('donnees/kc-stades-tlaloc.json')));
  const tableSol = lireTableSol({
    source: 'test', theta_u_mm_m: 160, racines_depart_m: { semis: 0.1, plant: 0.15 }, racines_borne_m: 0.6,
    sans_culture: { zr_m: 0.3, p: 0.4 },
    cultures: [{ culture: 'Tomate', p: 0.4, racines_max_m: 0.6 }, { culture: 'Laitue', p: 0.3, racines_max_m: 0.2 }],
  });
  const meteo = lireCsv(lire('meteo/2019/meteo-2019.csv'));
  const heures = pluieHoraire(JSON.parse(lire('meteo/2019/open-meteo-2019.json')));
  const { parcelles } = lireExportDemo({
    format: 'banc-opuntia-demo', version: 1, annee: 2019,
    parcelles: [
      { id: 'pa1', categorie: 'serre', surface_m2: 200, planches: null, cultures: [
        { cycle: 2019, culture: 'Tomate', ou: { surface_m2: 200 }, implantation: '2019-04-20', debut_recolte: '2019-06-25', fin: '2019-10-15', plant: true },
      ] },
      { id: 'pa2', categorie: 'jardin', surface_m2: 100, planches: null, cultures: [
        { cycle: 2019, culture: 'Laitue', ou: { surface_m2: 100 }, implantation: '2019-04-01', debut_recolte: '2019-05-15', fin: '2019-06-15', plant: true },
      ] },
    ],
  }, tableKc);
  // Plan de Tlaloc imaginaire : 3 mm chaque jour de 2019 sur pa1, 2 mm sur pa2.
  const planTlaloc = joursEntre('2019-01-01', '2019-12-31').flatMap((d) => [ligne(d, 'pa1', 3), ligne(d, 'pa2', 2)]);
  const materiels = new Map<string, MaterielOtf>([['pa1', { kind: 'drip', debit_mm_h: 5 }], ['pa2', { kind: 'sprinkler', debit_mm_h: 8 }]]);
  const r = rejouerAnnee({
    annee: 2019, parcelles, planTlaloc, meteo, heures, tableKc, tableSol, materiels,
    heuresTlaloc: { arrosage: '06:00', bassinage: { heure: '13:00', duree_s: 300 } },
    module: await chargerModuleOtf(RACINE),
  });

  const pa1 = r.parcelles.find((p) => p.id === 'pa1')!;
  assert.equal(pa1.tlaloc.juge_otf.eau_apportee_mm, 1095); // 365 × 3
  assert.equal(pa1.tlaloc.juge_tlaloc.eau_apportee_mm, 1095);
  // Sous serre, OTF apporte l'ETM de chaque semaine où la tomate est en place (0 sans culture, D-045), sauf les restes
  // sous la dose minimale (3 mm au goutte-à-goutte), comptés en eau non placée ; sur l'année, à une semaine près.
  const et0 = new Map(meteo.map((m) => [m.date, m.et0_mm]));
  const etmCulture = etmSerie(parcelles[0].cultures, true, et0, '2019-01-01', '2019-12-31', tableKc).filter((j) => j.cultures.length > 0).reduce((s, j) => s + j.etm_mm!, 0);
  const otfTotal = pa1.otf.juge_otf.eau_apportee_mm + pa1.otf.eau_non_placee_mm!;
  assert.ok(Math.abs(otfTotal - etmCulture) < 25, `${otfTotal} contre ${etmCulture}`);
  assert.ok(pa1.otf.eau_non_placee_mm! > 0 && pa1.otf.eau_non_placee_mm! < 20);
  assert.equal(pa1.tlaloc.eau_non_placee_mm, null);
  // Les deux juges voient les mêmes jours ; les jours sans culture sont hors des comptes.
  for (const p of r.parcelles) for (const c of [p.otf, p.tlaloc]) {
    assert.equal(c.juge_otf.jours_comptes + c.juge_otf.jours_sans_culture + c.juge_otf.jours_etat_inconnu, 365);
    assert.equal(c.juge_otf.jours_sans_culture, c.juge_tlaloc.jours_sans_culture);
  }
  assert.equal(r.ferme.otf.juge_otf.surface_m2, 300);
  assert.equal(r.ferme.tlaloc.juge_otf.mm.eau_apportee_mm, Math.round(((1095 * 200 + 730 * 100) / 300) * 100) / 100);
  assert.deepEqual(r.hors_comparaison, []);
  // Rattrapage du lundi (§ 7 ter) : sans culture en place, rien à rattraper ; sous serre sans eau, la tomate a un manque à rattraper.
  const entree = {
    annee: 2019, parcelles, planTlaloc, meteo, heures, tableKc, tableSol, materiels,
    heuresTlaloc: { arrosage: '06:00', bassinage: { heure: '13:00', duree_s: 300 } },
    module: await chargerModuleOtf(RACINE),
  };
  assert.equal(rattrapageDuLundi(entree, 'pa1', '2019-03-04', []), 0);
  const manque = rattrapageDuLundi(entree, 'pa1', '2019-07-01', []);
  assert.ok(manque > 0, `manque ${manque}`);
  // Un arrosage copieux avant le lundi supprime le manque.
  const gros = [{ debut: '2019-06-29T04:00:00.000Z', fin: null, mm: 300, type: 'arrosage' as const, nature: 'banc-otf' }];
  assert.ok(rattrapageDuLundi(entree, 'pa1', '2019-07-01', gros) < manque);
  // Une parcelle sans débit chez Tlaloc sort des indicateurs de la ferme, mais reste rapportée à part.
  const r2 = rejouerAnnee({
    annee: 2019, parcelles: parcelles.map((p) => ({ ...p, sans_debit: p.id === 'pa2' })), planTlaloc, meteo, heures, tableKc, tableSol, materiels,
    detail: ['pa1'],
    heuresTlaloc: { arrosage: '06:00', bassinage: { heure: '13:00', duree_s: 300 } },
    module: await chargerModuleOtf(RACINE),
  });
  assert.deepEqual(r2.hors_comparaison, ['pa2']);
  // Le sol du juge jour par jour, à la demande : RU, RAW et profondeur des racines pour chaque côté et chaque juge.
  assert.equal(r.detail, undefined);
  assert.deepEqual(Object.keys(r2.detail!), ['pa1']);
  const jours = r2.detail!.pa1.otf.juge_otf;
  assert.equal(jours.length, 365);
  const juillet = jours.find((j) => j.date === '2019-07-01')!;
  assert.equal(juillet.decisive, 'Tomate');
  assert.equal(juillet.zr_m, 0.6);
  assert.equal(juillet.ru_mm, 96); // 160 mm/m × 0,6 m
  assert.ok(juillet.raw_mm! > 0 && juillet.raw_mm! < juillet.ru_mm!);
  assert.equal(r2.detail!.pa1.tlaloc.juge_tlaloc.length, 365);
  assert.equal(r2.ferme.tlaloc.juge_otf.surface_m2, 200);
  assert.equal(r2.ferme.tlaloc.juge_otf.mm.eau_apportee_mm, 1095);
  assert.match(rapportAnnee(r2), /Hors des comparaisons de la ferme .* : pa2\./);
  assert.match(rapportAnnee(r2), /\| pa2 \(hors comparaison\) \| 100 \|/);
  const md = rapportAnnee(r);
  assert.match(md, /^# Banc d'essai, passe 1 : 2019/);
  assert.match(md, /## Ferme, juge OTF/);
  assert.match(md, /## Ferme, juge Tlaloc/);
  assert.match(md, /\| pa2 \| 100 \| non \|/);
});
