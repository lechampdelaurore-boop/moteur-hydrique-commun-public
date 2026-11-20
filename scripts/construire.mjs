// Construit les deux sorties du moteur depuis la même source (MC-28) :
//   dist/moteur-hydrique.mjs : module ES, pour OTF ;
//   dist/moteur-hydrique.js  : script classique, variable globale `MoteurHydrique`, pour Tlaloc.
// Lancer : npm run build ; `npm run build:check` vérifie que les fichiers de dist/ sont à jour.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', racine), 'utf8'));
const banniere = `/* Moteur hydrique commun (OTF et Tlaloc) v${version}. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Fichier construit depuis src/moteur.ts par scripts/construire.mjs : ne pas le modifier à la main. */`;

const sorties = [
  { fichier: 'dist/moteur-hydrique.mjs', format: 'esm' },
  { fichier: 'dist/moteur-hydrique.js', format: 'iife', globalName: 'MoteurHydrique' },
];

const verifier = process.argv.includes('--verifier');
let ecarts = 0;
mkdirSync(new URL('dist/', racine), { recursive: true });
for (const s of sorties) {
  const r = await build({
    entryPoints: [fileURLToPath(new URL('src/moteur.ts', racine))],
    bundle: true,
    format: s.format,
    globalName: s.globalName,
    target: 'es2020',
    platform: 'neutral',
    charset: 'utf8',
    legalComments: 'none',
    banner: { js: banniere },
    write: false,
  });
  const texte = r.outputFiles[0].text;
  const chemin = new URL(s.fichier, racine);
  if (verifier) {
    let actuel = '';
    try { actuel = readFileSync(chemin, 'utf8'); } catch { actuel = ''; }
    if (actuel !== texte) { console.error(`${s.fichier} n'est pas à jour : lancer npm run build`); ecarts++; }
    else console.log(`${s.fichier} à jour`);
  } else {
    writeFileSync(chemin, texte);
    console.log(`${s.fichier} écrit (${texte.length} caractères)`);
  }
}
if (ecarts > 0) process.exit(1);
