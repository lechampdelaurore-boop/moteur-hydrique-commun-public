# Contrat du banc d'essai du moteur commun (MC-36) : brouillon v0.1

21 novembre 2026. Sans code. Rédigé côté OTF (Claude, pour François), à relire par François puis par Nicolas. Sources : contrat fusionné v0.2.9 (§ 4 MC-30, MC-33, MC-36 ; § 4 bis ; § 5 point 5), moteur v0.3.0 (`docs/moteur.md`), D-065, D-154 point 4, roadmap § 6 ter.

## 1. Objet

Rejouer **3 années entières** (une sèche, une humide, une moyenne) dans les deux manières de décider d'arroser, avec les mêmes données, et comparer des indicateurs définis de la même façon. Le but est de voir où elles divergent et pourquoi, **pas de désigner un gagnant** (D-065). Le banc chiffre aussi les pistes du ticket n° 1 (K_abri, K_paillage, sol nu, Watermark) mais **ne change aucun réglage** : toute valeur modifiée reste une décision agronomique de François.

## 2. Ce qui est rejoué (à confirmer par Nicolas)

- **Juge commun** : le moteur commun v0.3.0 (`suivre`) calcule la réserve de chaque planche, jour après jour, pour les deux côtés, avec le même sol, la même ET0 et la même pluie (MC-33). Les indicateurs de réserve viennent donc d'une seule règle de calcul.
- **Côté OTF** : l'objectif hebdomadaire (§ 5) est transformé en arrosages par la logique du module (besoin de la semaine, puis placement). La jauge ne pilote pas (D-041, D-047).
- **Côté Tlaloc** : le plan de Tlaloc, tel quel, comme sa démonstration le fait aujourd'hui.
- Le moteur commun n'est pas un décideur (MC-18) : il est le juge. Les deux décideurs sont rejoués « tels quels », sans être réécrits.

## 3. Saisons

- **Une saison = une année entière** (début janvier à fin décembre), pas seulement l'été (MC-36).
- **Choix des 3 années** : on classe les années disponibles du site par pluie totale de l'année, avec l'ET0 Open-Meteo comme contrôle. Sèche : année dans le quart le plus sec ; humide : quart le plus humide ; moyenne : la plus proche de la médiane. Le tableau du classement est publié avec les résultats. Le site et les années disponibles viennent de Nicolas (§ 4).
- **ET0 des deux côtés** : FAO-56 de la réanalyse Open-Meteo (MC-33). La station Météo-France ne sert que de comparaison.

## 4. Données demandées à Nicolas (en commentaire de PR sur le dépôt commun)

1. L'assolement de la démonstration de Tlaloc (une année entière fictive, parcelles et planches) : JSON pour la structure (parcelles, surfaces, sol en mm, dates d'implantation et de récolte, matériel). **La météo ne vient pas de lui** : le script du banc (PR 1) va chercher lui-même l'ET0 FAO-56 et la pluie de la réanalyse Open-Meteo pour le lieu et les années choisis (MC-33), la même pour les deux côtés (proposition de Nicolas, PR n° 15).
2. Le site (coordonnées) et les années réellement couvertes, pour que nous classions les années.
3. Les Kc et durées de stade qu'il applique à chaque culture, pour calculer l'ETM des deux côtés de la même façon (hors moteur, MC-18).
4. Le format de sortie de son plan : arrosages par parcelle et par jour, en mm.
5. Si les prévisions archivées couvrent ces années (voir § 6).
Licence et droits : les données qu'il fournit restent les siennes ; elles sont rangées dans le dépôt commun s'il en est d'accord, sinon lues en local.

## 5. Origine de l'objectif rejoué : TRANCHÉ (François, 21/11, option A)

Chaque lundi, l'objectif de la semaine rejouée côté OTF est l'**ETM proposée** (ET0 × Kc, D-045). Conséquence à **dire avec les résultats** : « jours sous le seuil » mesure alors en partie ce choix d'objectif ; les indicateurs de stress et d'eau perdue restent comparables. Une variante (autre objectif) n'est lancée que si les écarts sont grands, sur décision de François.

## 6. Passes

- **Passe 1 (obligatoire)** : prévisions parfaites (météo réalisée).
- **Passe 2 (si les archives existent)** : prévisions réelles archivées J+1 à J+4. L'archive de Tlaloc ne remonte qu'à la mise en service de chaque ferme : **on utilise l'archive « historical forecast » d'Open-Meteo, la même pour les deux côtés**, si elle couvre les années choisies (couverture à vérifier par le script de la PR 1, non vérifiée à ce jour). Sinon, la passe 2 est omise pour l'année concernée et le dit.
- **Variantes** (« exécution imparfaite », une vanne à la fois) : hors du premier lot.
- Débit sans limite en passe 1 (D-065). Pluie utile écrite dans le fichier, règle commune ; rejeu ensuite avec la règle de chaque jeu.

## 7. Indicateurs et tolérances

Eau apportée ; eau perdue ; jours sous le seuil (seuil propre à chaque côté, **doublé d'un seuil commun à 50 % de la réserve facile**) ; jours en stress (réserve à zéro) ; écart au besoin ; stabilité (somme des écarts en mm entre deux plans successifs) ; charge pour le maraîcher ; eau non placée. Tolérance : **1 % de l'eau totale de saison** et écart en jours sous le seuil (MC-30). La non-régression du module reste à 0,01 mm, hors banc.

## 8. Réglage de code (à valider)

- **Où** : dépôt commun, dossier `banc/` (scripts, jeux de données, tests, rapport). Le module n'est pas touché ; l'adaptation de la logique OTF (besoin et placement) se fait par un script du banc qui l'appelle, sans modifier le module. Les deux dépôts étant distincts, le chantier peut avancer pendant un chantier du module (D-154 point 5).
- **Découpage** : PR 1 chargement des données et classement des années ; PR 2 rejeu et indicateurs, passe 1 ; PR 3 passe 2 et rapport. Chaque PR est relue par Nicolas avant fusion.
- **Réglage recommandé : Opus 5.5 · Élevé**, comme les lots du module : c'est du code de mesure, qui ne change pas le moteur. Opus 5.5 · Max seulement si une PR touche `src/` du moteur, ce que le banc n'a pas à faire. À confirmer par François et à inscrire à la roadmap avant le lancement. Fable interdit.
- **Conditions de lancement** : données de Nicolas reçues, ce contrat relu, ligne de roadmap inscrite. Rien d'autre n'est nécessaire.

## 9. Ce que le banc ne fait pas

Aucun changement de réglage ni de moteur ; aucune donnée de la ferme réelle de François ; aucune écriture dans OTF ; aucun gagnant désigné.

## 10. Points encore ouverts

- **Classement des années** (remarque de Nicolas, PR n° 15) : classer sur toute la réanalyse (vraies années sèche et humide, passe 2 omise pour les années trop anciennes) ou seulement parmi les années couvertes par l'archive de prévisions (passe 2 partout, choix restreint). Recommandation côté OTF : **toute la réanalyse**, car la passe 1 est la comparaison de fond et la passe 2 un complément ; à confirmer par Nicolas.

- Confirmer par Nicolas que son plan se rejoue tel quel avec les entrées du § 4.
- Où mettre les données (dépôt commun ou local).
- Registres du module (roadmap § 6 ter, ligne dédiée, décision) : à inscrire par PR après la fusion de #162.
