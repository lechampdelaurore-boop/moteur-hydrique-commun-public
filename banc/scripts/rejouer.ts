/**
 * Étape 4 du banc (sans réseau), passe 1 : rejoue les 3 années retenues dans
 * les deux manières de décider (contrat, § 2, § 7 bis, § 7 ter) et écrit le
 * rapport de chacune. Lit :
 *   banc/rapport/classement-annees.json            les 3 années
 *   banc/meteo/<année>/                             la météo rangée (journalière et horaire)
 *   banc/demo/<année>/export-demo-<année>.json      l'export de la démo de Tlaloc (Nicolas)
 *   banc/demo/<année>/plan-tlaloc-<année>.csv       le plan rejoué par Tlaloc (Nicolas)
 *   banc/demo/materiel-otf.json                     { "<parcelle>": { "kind": "drip" | "sprinkler", "debit_mm_h": n } }
 *   banc/donnees/kc-stades-tlaloc.json, banc/donnees/sol-tlaloc.json
 * et la logique du module OTF dans un clone de son dépôt public (MODULE_OTF,
 * sinon ../module-irrigation-otf-public). Écrit banc/rapport/rejeu-<année>.json et .md.
 *
 *   MODULE_OTF=<chemin> npm run banc:rejouer [-- --annee 2019]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chargerModuleOtf, type MaterielOtf } from '../src/cote-otf.ts';
import { lireExportDemo } from '../src/export-demo.ts';
import { pluieHoraire } from '../src/juge.ts';
import { lireTableKc } from '../src/kc.ts';
import { lireCsv } from '../src/meteo.ts';
import { lirePlanTlaloc } from '../src/plan-tlaloc.ts';
import { rapportAnnee, rejouerAnnee, type HeuresPlanTlaloc } from '../src/rejeu.ts';
import { lireTableSol } from '../src/sol.ts';

/** En attendant les heures du plan de Tlaloc (contrat, § 10). */
const HEURES_TLALOC: HeuresPlanTlaloc = { arrosage: '06:00', bassinage: { heure: '13:00', duree_s: 300 } };

const BANC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = (chemin: string) => readFileSync(path.join(BANC, chemin), 'utf8');
const { values } = parseArgs({ options: { annee: { type: 'string', multiple: true } } });

const racine = process.env.MODULE_OTF ?? path.resolve(BANC, '../../module-irrigation-otf-public');
if (!existsSync(path.join(racine, 'lib/domain/planning/engine.ts'))) throw new Error(`module OTF introuvable dans ${racine} (MODULE_OTF)`);
const module = await chargerModuleOtf(racine);

const classement = JSON.parse(lire('rapport/classement-annees.json')) as { choix: Record<string, { annee: number }> };
const annees = values.annee?.map(Number) ?? Object.values(classement.choix).map((c) => c.annee);
const tableKc = lireTableKc(JSON.parse(lire('donnees/kc-stades-tlaloc.json')));
const tableSol = lireTableSol(JSON.parse(lire('donnees/sol-tlaloc.json')));
const materiels = new Map(Object.entries(JSON.parse(lire('demo/materiel-otf.json')) as Record<string, MaterielOtf>));

mkdirSync(path.join(BANC, 'rapport'), { recursive: true });
for (const annee of annees) {
  const { parcelles } = lireExportDemo(JSON.parse(lire(`demo/${annee}/export-demo-${annee}.json`)), tableKc);
  const rapport = rejouerAnnee({
    annee, parcelles, tableKc, tableSol, materiels, module, heuresTlaloc: HEURES_TLALOC,
    // Le sol du juge jour par jour pour une serre de 2019 (demande de Nicolas, 28/11).
    detail: annee === 2019 ? ['pa1'] : undefined,
    planTlaloc: lirePlanTlaloc(lire(`demo/${annee}/plan-tlaloc-${annee}.csv`)),
    meteo: lireCsv(lire(`meteo/${annee}/meteo-${annee}.csv`)),
    heures: pluieHoraire(JSON.parse(lire(`meteo/${annee}/open-meteo-${annee}.json`))),
  });
  writeFileSync(path.join(BANC, `rapport/rejeu-${annee}.json`), JSON.stringify(rapport, null, 2) + '\n');
  writeFileSync(path.join(BANC, `rapport/rejeu-${annee}.md`), rapportAnnee(rapport));
  console.log(`${annee} : ${parcelles.length} parcelles rejouées ; module OTF ${module.commit ?? 'commit inconnu'}`);
}
