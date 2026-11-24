// Tests de l'ETM à la façon de Tlaloc (banc/src/etm.ts). Valeurs calculées à la main dans les commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etmSerie, joursDe, kcCulture, kcDuJour } from '../src/etm.ts';
import type { CultureEnPlace } from '../src/etm.ts';
import { lireTableKc } from '../src/kc.ts';

const TABLE = lireTableKc(JSON.parse(readFileSync(new URL('../donnees/kc-stades-tlaloc.json', import.meta.url), 'utf8')));
const TOL = 1e-12;
const proche = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) <= TOL, `${a} ≠ ${b}`);

// Tomate : Kc ini 0,6, Kc mid 1,15 ; implantée le 1er mai, récolte du 12 juin (42 jours) au 31 août.
const TOMATE: CultureEnPlace = { culture: 'Tomate', implantation: '2019-05-01', debut_recolte: '2019-06-12', fin_recolte: '2019-08-31' };

test('jours entre deux dates', () => {
  assert.equal(joursDe('2019-05-01', '2019-06-12'), 42);
  assert.equal(joursDe('2019-06-12', '2019-05-01'), -42);
  assert.equal(joursDe('2019-03-30', '2019-04-01'), 2); // passage à l'heure d'été sans effet
});

test('montée en ligne droite puis palier', () => {
  proche(kcCulture(TOMATE, '2019-05-01', TABLE), 0.6); // implantation : Kc ini
  proche(kcCulture(TOMATE, '2019-05-22', TABLE), 0.875); // 21 jours sur 42 : 0,6 + 0,55 / 2
  proche(kcCulture(TOMATE, '2019-06-12', TABLE), 1.15); // début de la récolte : Kc mid
  proche(kcCulture(TOMATE, '2019-08-31', TABLE), 1.15); // fin de la récolte : encore en place
  assert.throws(() => kcCulture(TOMATE, '2019-09-01', TABLE), /pas en place/);
});

test('sol nu, serre, deux cultures à la fois refusées', () => {
  assert.deepEqual(kcDuJour([TOMATE], '2019-09-01', false, TABLE), { kc: 0.4, culture: null });
  proche(kcDuJour([TOMATE], '2019-09-01', true, TABLE).kc, 0.28); // 0,4 × 0,7
  proche(kcDuJour([TOMATE], '2019-06-12', true, TABLE).kc, 0.805); // 1,15 × 0,7
  const laitue: CultureEnPlace = { culture: 'Laitue', implantation: '2019-08-20', debut_recolte: '2019-09-17', fin_recolte: '2019-10-08' };
  assert.throws(() => kcDuJour([TOMATE, laitue], '2019-08-25', false, TABLE), /plusieurs cultures/);
});

test('série d\'ETM : ET0 × Kc, ET0 inconnue → ETM inconnue', () => {
  const et0 = new Map<string, number | null>([['2019-05-01', 4], ['2019-05-22', 5], ['2019-06-12', null]]);
  const s = etmSerie([TOMATE], false, et0, '2019-04-30', '2019-06-12', TABLE);
  assert.equal(s.length, 44);
  assert.deepEqual(s[0], { date: '2019-04-30', kc: 0.4, culture: null, etm_mm: null }); // ET0 absente de la carte
  proche(s[1].etm_mm, 2.4); // 4 × 0,6
  proche(s[22].etm_mm, 4.375); // 5 × 0,875
  assert.equal(s[43].etm_mm, null);
  assert.throws(() => etmSerie([{ ...TOMATE, culture: 'Banane' }], false, et0, '2019-05-01', '2019-05-02', TABLE), /absente de la table/);
  assert.throws(() => etmSerie([{ ...TOMATE, debut_recolte: '2019-04-01' }], false, et0, '2019-05-01', '2019-05-02', TABLE), /désordre/);
});
