/**
 * Étape 1 du banc (réseau) : la réanalyse journalière de toutes les années et la
 * couverture de l'archive des prévisions. Écrit :
 *   banc/donnees/reanalyse-journaliere.csv   date,et0_mm,pluie_mm (jours de Paris)
 *   banc/donnees/reanalyse-source.json       d'où viennent ces jours
 *   banc/donnees/couverture-previsions.json  passe 2 possible ou non, par année
 *
 *   npm run banc:telecharger [-- --derniere-annee 2025]
 *
 * Open-Meteo n'est pas joignable de toutes les machines : le job « Banc » de
 * GitHub Actions lance ce script (dépôt public : gratuit).
 */
import { writeFileSync } from 'node:fs';
import { jourSuivant } from '../src/dates.ts';
import { assembler, ecrireCsv, lireJournalier } from '../src/meteo.ts';
import type { JourMeteo, ReponseJournaliere } from '../src/meteo.ts';
import { analyserCouverture, bornesCouverture } from '../src/couverture.ts';
import type { ResultatCouverture } from '../src/couverture.ts';
import {
  LIEU, MODELE_REANALYSE, MODELES_PREVISIONS, PREMIERE_ANNEE, URL_PREVISIONS_PRECEDENTES, URL_REANALYSE,
  obtenir, urlPrevisionsPrecedentes, urlReanalyse, variablesPrevisions,
} from '../src/open-meteo.ts';

const DOSSIER = new URL('../donnees/', import.meta.url);
const PAUSE_ANNEE_MS = 4_000;
const PAUSE_SONDE_MS = 1_500;
/** On arrête de sonder l'archive des prévisions après ce nombre d'années non couvertes de suite, en remontant le temps. */
const ARRET_APRES_NON_COUVERTES = 2;

function derniereAnnee(): number {
  const i = process.argv.indexOf('--derniere-annee');
  if (i >= 0) return Number(process.argv[i + 1]);
  // La dernière année dont la fenêtre (jusqu'au 12 janvier d'après) est passée depuis au moins 8 jours (délai de la réanalyse).
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const annee = Number(aujourdhui.slice(0, 4));
  return jourSuivant(`${annee}-01-12`, 8) <= aujourdhui ? annee - 1 : annee - 2;
}

async function reanalyse(fin: number): Promise<JourMeteo[]> {
  const morceaux: JourMeteo[][] = [];
  for (let annee = PREMIERE_ANNEE; annee <= fin + 1; annee++) {
    const debut = `${annee}-01-01`;
    const finMorceau = annee === fin + 1 ? `${annee}-01-12` : `${annee}-12-31`;
    const { json } = await obtenir(urlReanalyse(debut, finMorceau, false), PAUSE_ANNEE_MS);
    if (json.error === true) throw new Error(`Open-Meteo refuse ${debut} à ${finMorceau} : ${String(json.reason)}`);
    const jours = lireJournalier(json as ReponseJournaliere);
    if (jours[0]?.date !== debut || jours.at(-1)?.date !== finMorceau) throw new Error(`réponse incomplète pour ${debut} à ${finMorceau}`);
    morceaux.push(jours);
    console.log(`réanalyse ${annee} : ${jours.length} jours`);
  }
  return assembler(morceaux);
}

type CouvertureAnnee = { annee: number; couverte: boolean; modele: string | null; essais: Record<string, ResultatCouverture> };

async function couvertureAnnee(annee: number): Promise<CouvertureAnnee> {
  const variables = variablesPrevisions();
  const { debut, fin } = bornesCouverture(annee);
  const essais: Record<string, ResultatCouverture> = {};
  for (const modele of MODELES_PREVISIONS) {
    // Sonde d'un jour d'abord (le 1er janvier) : inutile de demander l'année si son début manque.
    const sonde = await obtenir(urlPrevisionsPrecedentes(debut, debut, modele), PAUSE_SONDE_MS);
    let r = analyserCouverture(sonde.json, variables);
    if (r.complete) {
      const annuel = await obtenir(urlPrevisionsPrecedentes(debut, fin, modele), PAUSE_ANNEE_MS);
      r = analyserCouverture(annuel.json, variables);
    }
    essais[modele] = r;
    console.log(`archive des prévisions ${annee}, ${modele} : ${r.complete ? 'couverte' : r.erreur ?? `manque ${r.premier_manque?.variable} le ${r.premier_manque?.heure}`}`);
    if (r.complete) return { annee, couverte: true, modele, essais };
  }
  return { annee, couverte: false, modele: null, essais };
}

const fin = derniereAnnee();
const jours = await reanalyse(fin);
writeFileSync(new URL('reanalyse-journaliere.csv', DOSSIER), ecrireCsv(jours));
writeFileSync(
  new URL('reanalyse-source.json', DOSSIER),
  JSON.stringify({
    source: 'Open-Meteo, Historical Weather API (réanalyse)',
    url: URL_REANALYSE,
    modele: MODELE_REANALYSE,
    lieu: LIEU,
    fuseau: 'Europe/Paris',
    variables: { et0_mm: 'daily.et0_fao_evapotranspiration (FAO-56)', pluie_mm: 'daily.precipitation_sum' },
    premier_jour: jours[0].date,
    dernier_jour: jours.at(-1)!.date,
    derniere_annee_entiere: fin,
    telecharge_le: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n',
);

// Archive des prévisions : on remonte le temps depuis la dernière année.
const couverture: CouvertureAnnee[] = [];
let nonCouvertesDeSuite = 0;
for (let annee = fin; annee >= PREMIERE_ANNEE && nonCouvertesDeSuite < ARRET_APRES_NON_COUVERTES; annee--) {
  const c = await couvertureAnnee(annee);
  couverture.push(c);
  nonCouvertesDeSuite = c.couverte ? 0 : nonCouvertesDeSuite + 1;
}
const plusAncienneSondee = Math.min(...couverture.map((c) => c.annee));
writeFileSync(
  new URL('couverture-previsions.json', DOSSIER),
  JSON.stringify({
    source: 'Open-Meteo, Previous Runs API (prévisions archivées)',
    url: URL_PREVISIONS_PRECEDENTES,
    modeles_essayes: MODELES_PREVISIONS,
    variables: variablesPrevisions(),
    regle: 'Année couverte : chaque heure du 1er janvier au 4 janvier de l\'année d\'après a sa pluie et son ET0 prévues 1, 2, 3 et 4 jours plus tôt, avec un même modèle.',
    sondage: `De ${fin} en remontant le temps, arrêt après ${ARRET_APRES_NON_COUVERTES} années non couvertes de suite ; les années avant ${plusAncienneSondee} ne sont pas sondées et comptent comme non couvertes.`,
    sonde_le: new Date().toISOString().slice(0, 10),
    annees: couverture.sort((a, b) => a.annee - b.annee),
  }, null, 2) + '\n',
);
console.log(`fini : ${jours.length} jours, ${couverture.filter((c) => c.couverte).length} année(s) couverte(s) par l'archive des prévisions`);
