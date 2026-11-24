// Les fichiers rangés dans banc/ se recalculent à l'identique, sans réseau :
// le classement depuis la réanalyse journalière, le CSV de chaque année retenue,
// et les valeurs journalières de la réponse horaire d'Open-Meteo.
// Lancer : node --test --experimental-strip-types banc/tests/fichiers.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { anneesEligibles, classer, totauxAnnuels } from '../src/classement.ts';
import type { Classement } from '../src/classement.ts';
import { fenetreMeteo } from '../src/dates.ts';
import { ecrireCsv, extraire, lireCsv, lireJournalier } from '../src/meteo.ts';
import type { ReponseJournaliere } from '../src/meteo.ts';
import { rapportClassement } from '../src/rapport.ts';

const BANC = new URL('../', import.meta.url);
const lire = (chemin: string) => readFileSync(new URL(chemin, BANC), 'utf8');
const presents = existsSync(new URL('donnees/reanalyse-journaliere.csv', BANC));

test('classement et météo des années retenues : recalculés à l\'identique', { skip: presents ? false : 'données pas encore téléchargées' }, () => {
  const jours = lireCsv(lire('donnees/reanalyse-journaliere.csv'));
  const source = JSON.parse(lire('donnees/reanalyse-source.json'));
  const couverture = JSON.parse(lire('donnees/couverture-previsions.json')) as { sondage: string; annees: { annee: number; couverte: boolean }[] };
  assert.equal(jours[0].date, source.premier_jour);
  assert.equal(jours.at(-1)!.date, source.dernier_jour);

  const totaux = totauxAnnuels(jours);
  const couvertes = new Set(couverture.annees.filter((a) => a.couverte).map((a) => a.annee));
  const recalcule = classer(totaux, anneesEligibles(jours, totaux.map((t) => t.annee)), couvertes);
  const range = JSON.parse(lire('rapport/classement-annees.json')) as Classement;
  assert.deepEqual(recalcule, range);
  assert.equal(rapportClassement(recalcule, source, couverture.sondage), lire('rapport/classement-annees.md'));
  // Toutes les années entières de la réanalyse sont classées (aucune écartée faute de données).
  assert.equal(range.nombre_annees, range.derniere_annee - range.premiere_annee + 1);

  for (const { annee } of Object.values(range.choix)) {
    const { debut, fin } = fenetreMeteo(annee);
    const csv = lire(`meteo/${annee}/meteo-${annee}.csv`);
    assert.equal(csv, ecrireCsv(extraire(jours, debut, fin), true), `CSV de ${annee}`);
    const brut = JSON.parse(lire(`meteo/${annee}/open-meteo-${annee}.json`)) as ReponseJournaliere & { hourly: { time: string[]; precipitation: number[] }; timezone: string };
    assert.equal(brut.timezone, 'Europe/Paris');
    assert.deepEqual(lireJournalier(brut), lireCsv(csv), `réponse d'Open-Meteo de ${annee}`);
    assert.equal(brut.hourly.precipitation.length, brut.hourly.time.length);
    assert.ok(brut.hourly.precipitation.every((x) => typeof x === 'number' && x >= 0), `pluie horaire de ${annee}`);
  }
});
