/**
 * Étape 3 du banc (réseau) : pour chacune des 3 années retenues, la réponse
 * d'Open-Meteo telle quelle, avec la pluie heure par heure, pour que le rejeu de
 * Tlaloc fasse tomber la pluie à son heure (demande de Nicolas du 22/11).
 *   banc/meteo/<année>/open-meteo-<année>.json
 * Ses valeurs journalières doivent être celles du CSV de la même année : un
 * écart arrête tout.
 *
 *   npm run banc:annees
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Classement } from '../src/classement.ts';
import { fenetreMeteo } from '../src/dates.ts';
import { lireCsv, lireJournalier } from '../src/meteo.ts';
import type { ReponseJournaliere } from '../src/meteo.ts';
import { obtenir, urlReanalyse } from '../src/open-meteo.ts';

const BANC = new URL('../', import.meta.url);
const classement = JSON.parse(readFileSync(new URL('rapport/classement-annees.json', BANC), 'utf8')) as Classement;

for (const { annee } of Object.values(classement.choix)) {
  const { debut, fin } = fenetreMeteo(annee);
  const { texte, json } = await obtenir(urlReanalyse(debut, fin, true), 4_000);
  if (json.error === true) throw new Error(`Open-Meteo refuse ${annee} : ${String(json.reason)}`);
  const journalier = lireJournalier(json as ReponseJournaliere);
  const csv = lireCsv(readFileSync(new URL(`meteo/${annee}/meteo-${annee}.csv`, BANC), 'utf8'));
  if (JSON.stringify(journalier) !== JSON.stringify(csv)) throw new Error(`${annee} : les valeurs journalières de la réponse horaire diffèrent du CSV`);
  const horaire = (json.hourly as { time: string[]; precipitation: (number | null)[] } | undefined);
  if (!horaire || horaire.precipitation.length !== horaire.time.length || horaire.precipitation.some((x) => x === null)) {
    throw new Error(`${annee} : pluie horaire absente ou incomplète`);
  }
  writeFileSync(new URL(`meteo/${annee}/open-meteo-${annee}.json`, BANC), texte.endsWith('\n') ? texte : texte + '\n');
  console.log(`${annee} : ${journalier.length} jours, ${horaire.time.length} heures`);
}
