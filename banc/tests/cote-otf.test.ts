// Tests du côté OTF du banc (banc/src/cote-otf.ts). Ils appellent la logique du module OTF depuis un clone de son dépôt public :
// `MODULE_OTF=<chemin>`, sinon `../module-irrigation-otf-public` à côté de ce dépôt ; sans clone, ils sont sautés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerModuleOtf, premierLundi, rejouerOtf } from '../src/cote-otf.ts';
import { joursEntre } from '../src/dates.ts';

const RACINE = process.env.MODULE_OTF ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../module-irrigation-otf-public');
const ABSENT = !existsSync(path.join(RACINE, 'lib/domain/planning/engine.ts'));

test('premier lundi', () => {
  assert.equal(premierLundi('2018-10-15'), '2018-10-15'); // un lundi
  assert.equal(premierLundi('2008-10-15'), '2008-10-20'); // un mercredi
});

test('objectif = ETM de la semaine, besoin puis placement par le module (passe 1)', { skip: ABSENT && 'clone du module absent' }, async () => {
  const module = await chargerModuleOtf(RACINE);
  const jours = joursEntre('2019-07-01', '2019-07-21');
  // 12 mm de pluie le mercredi 10 juillet ; ETM 3,5 mm/j sous serre, 5 mm/j en plein champ.
  const meteo = jours.map((date) => ({ date, et0_mm: 5, pluie_mm: date === '2019-07-10' ? 12 : 0 }));
  const etm = new Map([['serre', new Map(jours.map((d) => [d, 3.5]))], ['champ', new Map(jours.map((d) => [d, 5]))]]);
  const r = rejouerOtf(module, [
    { id: 'serre', serre: true, surface_m2: 210, materiel: { kind: 'drip', debit_mm_h: 5 } },
    { id: 'champ', serre: false, surface_m2: 100, materiel: { kind: 'sprinkler', debit_mm_h: 8 } },
  ], etm, meteo, '2019-07-01', '2019-07-14', 2019);

  const serre = r.get('serre')!;
  assert.deepEqual(serre.semaines.map((s) => [s.lundi, s.objectif_mm, s.besoin_mm, s.place_mm, s.non_place_mm]), [
    ['2019-07-01', 24.5, 24.5, 24.5, 0],
    ['2019-07-08', 24.5, 24.5, 24.5, 0], // sous serre, la pluie ne compte pas
  ]);
  // Goutte-à-goutte : 10 mm au plus par jour, un arrosage par jour (réglages par défaut du module).
  assert.ok(serre.arrosages.every((a) => a.mm! <= 10 + 1e-9));
  assert.equal(new Set(serre.arrosages.map((a) => a.debut.slice(0, 10))).size, serre.arrosages.length);

  const champ = r.get('champ')!;
  // Semaine du 8 : 35 mm d'objectif − 12 mm de pluie = 23 mm, placés après la pluie (R3 : plus de 5 mm prévus).
  assert.deepEqual(champ.semaines.map((s) => [s.objectif_mm, s.besoin_mm, s.place_mm]), [[35, 35, 35], [35, 23, 23]]);
  const apresPluie = champ.arrosages.filter((a) => a.debut >= '2019-07-08');
  assert.ok(apresPluie.every((a) => a.debut >= '2019-07-10T22:00:00.000Z'));
  assert.equal(Math.round(apresPluie.reduce((s, a) => s + a.mm!, 0) * 100) / 100, 23);
});
