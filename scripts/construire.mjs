// Construit les sorties du moteur depuis la même source (MC-28) :
//   dist/moteur-hydrique.mjs : module ES, pour OTF ;
//   dist/moteur-hydrique.js  : script classique, variable globale `MoteurHydrique`, pour Tlaloc ;
//   dist/moteur-hydrique.d.mts et dist/types/ : les types du module ES, pour OTF (TypeScript).
// Lancer : npm run build ; `npm run build:check` vérifie que les fichiers de dist/ sont à jour.
import { build } from 'esbuild';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', racine), 'utf8'));
const banniere = `/* Moteur hydrique commun (OTF et Tlaloc) v${version}. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Fichier construit depuis src/moteur.ts par scripts/construire.mjs : ne pas le modifier à la main. */`;
const banniereTypes = `/* Moteur hydrique commun (OTF et Tlaloc) v${version}. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Types du module ES, construits depuis src/ par scripts/construire.mjs : ne pas les modifier à la main. */`;

const sorties = [
  { fichier: 'dist/moteur-hydrique.mjs', format: 'esm' },
  { fichier: 'dist/moteur-hydrique.js', format: 'iife', globalName: 'MoteurHydrique' },
];

const verifier = process.argv.includes('--verifier');

/** Les fichiers construits, chacun avec son chemin dans le dépôt. */
const fichiers = [];
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
  fichiers.push({ fichier: s.fichier, texte: r.outputFiles[0].text });
}
fichiers.push(...types());

let ecarts = 0;
mkdirSync(new URL('dist/types/', racine), { recursive: true });
// Un fichier de types qui n'est plus construit : retiré par la construction, signalé par la vérification.
const attendus = new Set(fichiers.map((f) => f.fichier));
for (const nom of readdirSync(new URL('dist/types/', racine))) {
  const fichier = `dist/types/${nom}`;
  if (attendus.has(fichier)) continue;
  if (verifier) { console.error(`${fichier} n'est plus construit : lancer npm run build`); ecarts++; }
  else { rmSync(new URL(fichier, racine)); console.log(`${fichier} retiré`); }
}
for (const { fichier, texte } of fichiers) {
  const chemin = new URL(fichier, racine);
  if (verifier) {
    let actuel = '';
    try { actuel = readFileSync(chemin, 'utf8'); } catch { actuel = ''; }
    if (actuel !== texte) { console.error(`${fichier} n'est pas à jour : lancer npm run build`); ecarts++; }
    else console.log(`${fichier} à jour`);
  } else {
    writeFileSync(chemin, texte);
    console.log(`${fichier} écrit (${texte.length} caractères)`);
  }
}
if (ecarts > 0) process.exit(1);

/**
 * Les types du module ES : les déclarations de src/, par le compilateur
 * TypeScript du dépôt, sans rien d'autre ; les imports relatifs en `.ts` de
 * src/ deviennent `.js`, la forme que lit tout projet TypeScript.
 */
function types() {
  const src = fileURLToPath(new URL('src/', racine));
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    declaration: true,
    emitDeclarationOnly: true,
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    erasableSyntaxOnly: true,
    skipLibCheck: true,
    types: [],
    lib: ['lib.es2022.d.ts'],
    newLine: ts.NewLineKind.LineFeed,
    rootDir: src,
    outDir: fileURLToPath(new URL('dist/types/', racine)),
  };
  const programme = ts.createProgram([`${src}moteur.ts`], options);
  const emis = [];
  const resultat = programme.emit(undefined, (chemin, texte) => emis.push({ chemin, texte }), undefined, true);
  const erreurs = [...ts.getPreEmitDiagnostics(programme), ...resultat.diagnostics];
  if (erreurs.length > 0) {
    throw new Error(ts.formatDiagnostics(erreurs, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => src, getNewLine: () => '\n' }));
  }
  return [
    { fichier: 'dist/moteur-hydrique.d.mts', texte: `${banniereTypes}\nexport * from './types/moteur.js';\n` },
    ...emis
      .sort((a, b) => (a.chemin < b.chemin ? -1 : 1))
      .map(({ chemin, texte }) => ({
        fichier: `dist/types/${basename(chemin)}`,
        texte: `${banniereTypes}\n${texte.replace(/(from '\.{1,2}\/[^']+)\.ts'/g, "$1.js'")}`,
      })),
  ];
}
