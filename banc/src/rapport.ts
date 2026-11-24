/** Le tableau du classement, publié avec les résultats (contrat, § 3). */
import type { Classement, Choix } from './classement.ts';

const mm = (x: number) => x.toFixed(1).replace('.', ',');
const oui = (b: boolean) => (b ? 'oui' : 'non');

export function rapportClassement(c: Classement, source: { modele: string; lieu: { latitude: number; longitude: number }; telecharge_le: string }, sondage: string): string {
  const ligneChoix = (nom: string, x: Choix) =>
    `| ${nom} | **${x.annee}** | ${mm(c.tableau.find((l) => l.annee === x.annee)!.pluie_mm)} | ${x.controle_et0} | ${x.passe2} |`;
  return [
    '# Classement des années du banc d\'essai',
    '',
    'Fichier écrit par `npm run banc:classer` (`banc/scripts/classer.ts`) : ne pas le modifier à la main.',
    '',
    `Réanalyse Open-Meteo, modèle \`${source.modele}\`, au lieu du banc (${source.lieu.latitude} N, ${source.lieu.longitude} E), jours de Paris, téléchargée le ${source.telecharge_le}. ` +
      `${c.nombre_annees} années entières classées, de ${c.premiere_annee} à ${c.derniere_annee}. Règle : \`banc/src/classement.ts\` (en tête du fichier).`,
    '',
    '## Les 3 années retenues',
    '',
    '| Année | Choisie | Pluie (mm) | Contrôle par l\'ET0 | Passe 2 |',
    '|---|---|---|---|---|',
    ligneChoix('Sèche', c.choix.seche),
    ligneChoix('Humide', c.choix.humide),
    ligneChoix('Moyenne', c.choix.moyenne),
    '',
    `- **Sèche** : ${c.choix.seche.raison}`,
    `- **Humide** : ${c.choix.humide.raison}`,
    `- **Moyenne** : ${c.choix.moyenne.raison}`,
    '',
    '## Repères',
    '',
    `- Pluie annuelle : percentile 12,5 = ${mm(c.pluie.p12_5)} mm ; 1er quartile = ${mm(c.pluie.q1)} mm ; médiane = ${mm(c.pluie.mediane)} mm ; 3e quartile = ${mm(c.pluie.q3)} mm ; percentile 87,5 = ${mm(c.pluie.p87_5)} mm.`,
    `- Bilan climatique (pluie − ET0) : 1er quartile = ${mm(c.bilan.q1)} mm ; médiane = ${mm(c.bilan.mediane)} mm ; 3e quartile = ${mm(c.bilan.q3)} mm.`,
    `- Archive des prévisions : ${sondage}`,
    '',
    '## Toutes les années, de la moins pluvieuse à la plus pluvieuse',
    '',
    '| Rang pluie | Année | Pluie (mm) | ET0 (mm) | Bilan (mm) | Rang bilan | Catégorie | Peut être rejouée | Passe 2 possible |',
    '|---|---|---|---|---|---|---|---|---|',
    ...c.tableau.map((l) => `| ${l.rang_pluie} | ${l.annee} | ${mm(l.pluie_mm)} | ${mm(l.et0_mm)} | ${mm(l.bilan_mm)} | ${l.rang_bilan} | ${l.categorie} | ${oui(l.eligible)} | ${oui(l.couverte)} |`),
    '',
  ].join('\n');
}
