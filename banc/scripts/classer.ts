/**
 * Étape 2 du banc (sans réseau) : classe les années et choisit les 3 années
 * rejouées (contrat, § 3), puis range la météo de chacune au format CSV commun.
 * Lit banc/donnees/ ; écrit :
 *   banc/rapport/classement-annees.json et .md   le tableau du classement
 *   banc/meteo/<année>/meteo-<année>.csv         du 15 octobre d'avant au 12 janvier d'après
 *
 *   npm run banc:classer
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { anneesEligibles, classer, totauxAnnuels } from '../src/classement.ts';
import { fenetreMeteo } from '../src/dates.ts';
import { ecrireCsv, extraire, lireCsv } from '../src/meteo.ts';
import { rapportClassement } from '../src/rapport.ts';

const BANC = new URL('../', import.meta.url);
const lire = (chemin: string) => readFileSync(new URL(chemin, BANC), 'utf8');

const jours = lireCsv(lire('donnees/reanalyse-journaliere.csv'));
const source = JSON.parse(lire('donnees/reanalyse-source.json'));
const couverture = JSON.parse(lire('donnees/couverture-previsions.json')) as { sondage: string; annees: { annee: number; couverte: boolean }[] };

const totaux = totauxAnnuels(jours);
const eligibles = anneesEligibles(jours, totaux.map((t) => t.annee));
const couvertes = new Set(couverture.annees.filter((a) => a.couverte).map((a) => a.annee));
const classement = classer(totaux, eligibles, couvertes);

mkdirSync(new URL('rapport/', BANC), { recursive: true });
writeFileSync(new URL('rapport/classement-annees.json', BANC), JSON.stringify(classement, null, 2) + '\n');
writeFileSync(new URL('rapport/classement-annees.md', BANC), rapportClassement(classement, source, couverture.sondage));

for (const { annee } of Object.values(classement.choix)) {
  const { debut, fin } = fenetreMeteo(annee);
  const dossier = new URL(`meteo/${annee}/`, BANC);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(new URL(`meteo-${annee}.csv`, dossier), ecrireCsv(extraire(jours, debut, fin), true));
}
const { seche, humide, moyenne } = classement.choix;
console.log(`${classement.nombre_annees} années classées ; sèche ${seche.annee}, humide ${humide.annee}, moyenne ${moyenne.annee}`);
