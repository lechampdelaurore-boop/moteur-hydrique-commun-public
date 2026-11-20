// Les cas partagés (cas/*.json) sur le moteur et sur ses deux fichiers construits (MC-28, MC-30).
// Lancer : node --test --experimental-strip-types tests/cas.test.ts
// Le rapport détaillé, valeur par valeur : node --experimental-strip-types scripts/cas.ts --dist
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as SRC from '../src/moteur.ts';
import { chargerDist, executerCas } from '../scripts/cas.ts';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

test('Cas O, L et T sur le moteur (src/) : aucune valeur en écart à 0,01 mm près', () => {
  const resultats = executerCas(SRC);
  const ecarts = resultats.flatMap((r) => r.valeurs
    .filter((v) => v.verdict === 'écart')
    .map((v) => `${r.id} ${v.cle} : attendu ${String(v.attendu)}, moteur ${String(v.obtenu)}${v.note ? ` (${v.note})` : ''}`));
  assert.deepEqual(ecarts, []);
  const conformes = resultats.flatMap((r) => r.valeurs).filter((v) => v.verdict === 'conforme').length;
  assert.ok(conformes >= 75, `${conformes} valeurs conformes`);
  // Ce qui reste à venir : les options de Tlaloc seulement (poing en fourchette, consommation apprise, tensiomètre).
  const aVenir = resultats.filter((r) => r.valeurs.some((v) => v.verdict === 'à venir')).map((r) => r.id);
  assert.deepEqual(aVenir, ['T08', 'T09', 'T10', 'T11']);
});

test('Les deux fichiers construits donnent les mêmes résultats que src/ sur tous les cas (MC-28)', async () => {
  const { mjs, iife } = await chargerDist();
  const reference = JSON.stringify(executerCas(SRC));
  assert.equal(JSON.stringify(executerCas(mjs)), reference, 'dist/moteur-hydrique.mjs');
  assert.equal(JSON.stringify(executerCas(iife)), reference, 'dist/moteur-hydrique.js');
  assert.deepEqual(Object.keys(mjs).sort(), Object.keys(SRC).sort(), 'mêmes exports');
  assert.deepEqual(Object.keys(iife).sort(), Object.keys(SRC).sort(), 'mêmes exports');
});

test('Le script classique ne pose qu\'une variable globale : MoteurHydrique', () => {
  const contexte: Record<string, unknown> = {};
  createContext(contexte);
  runInContext(lire('../dist/moteur-hydrique.js'), contexte);
  assert.deepEqual(Object.keys(contexte), ['MoteurHydrique']);
});

test('La version du moteur est celle de package.json, et chaque fichier construit la porte', async () => {
  const { version } = JSON.parse(lire('../package.json'));
  assert.equal(SRC.VERSION_MOTEUR, version);
  const { mjs, iife } = await chargerDist();
  assert.equal(mjs.VERSION_MOTEUR, version);
  assert.equal(iife.VERSION_MOTEUR, version);
  for (const fichier of ['../dist/moteur-hydrique.mjs', '../dist/moteur-hydrique.js']) {
    assert.ok(lire(fichier).startsWith(`/* Moteur hydrique commun (OTF et Tlaloc) v${version}.`), `${fichier} : en-tête de version`);
  }
});
