# Contrat du banc d'essai du moteur commun (MC-36) : v0.4 (brouillon)

21 novembre 2026. Sans code. Rédigé côté OTF (Claude, pour François), à relire par François puis par Nicolas. v0.2 : réponses de Nicolas du 21 novembre inscrites (§ 3, § 4, § 7, § 10). v0.3 (24 novembre, PR 1 du banc) : données de Nicolas du 22 novembre reçues (§ 4), précisions du classement (§ 3 bis), de la météo rangée (§ 4 bis) et de la couverture de la passe 2 (§ 6), réglage confirmé par François (§ 8). v0.4 (brouillon de la PR 2) : définitions des indicateurs (§ 7 bis), à relire par Nicolas. Sources : contrat fusionné v0.2.9 (§ 4 MC-30, MC-33, MC-36 ; § 4 bis ; § 5 point 5), moteur v0.3.0 (`docs/moteur.md`), D-065, D-154 point 4, roadmap § 6 ter.

## 1. Objet

Rejouer **3 années entières** (une sèche, une humide, une moyenne) dans les deux manières de décider d'arroser, avec les mêmes données, et comparer des indicateurs définis de la même façon. Le but est de voir où elles divergent et pourquoi, **pas de désigner un gagnant** (D-065). Le banc chiffre aussi les pistes du ticket n° 1 (K_abri, K_paillage, sol nu, Watermark) mais **ne change aucun réglage** : toute valeur modifiée reste une décision agronomique de François.

## 2. Ce qui est rejoué

- **Juge commun** : le moteur commun v0.3.0 (`suivre`) calcule la réserve de chaque planche, jour après jour, pour les deux côtés, avec le même sol, la même ET0 et la même pluie (MC-33). Les indicateurs de réserve viennent donc d'une seule règle de calcul.
- **Côté OTF** : l'objectif hebdomadaire (§ 5) est transformé en arrosages par la logique du module (besoin de la semaine, puis placement). La jauge ne pilote pas (D-041, D-047).
- **Côté Tlaloc** : le plan de Tlaloc, tel quel, comme sa démonstration le fait aujourd'hui. Nicolas confirme (21/11) que le plan se rejoue tel quel.
- Le moteur commun n'est pas un décideur (MC-18) : il est le juge. Les deux décideurs sont rejoués « tels quels », sans être réécrits.

## 3. Saisons

- **Une saison = une année entière** (début janvier à fin décembre), pas seulement l'été (MC-36).
- **Lieu (Nicolas, 21/11)** : les Jardins Pentus, en coordonnées arrondies à 0,05° près (environ 5 km, assez fin pour la grille d'Open-Meteo) : **latitude 45,50 N, longitude 5,75 E**. L'adresse exacte de la ferme ne figure pas dans le dépôt public.
- **Choix des 3 années (accord de Nicolas, 21/11)** : on classe les années par pluie totale de l'année, avec l'ET0 Open-Meteo comme contrôle. Sèche : année dans le quart le plus sec ; humide : quart le plus humide ; moyenne : la plus proche de la médiane. **Le classement porte sur toute la réanalyse disponible** ; la passe 2 est omise pour les années hors de l'archive des prévisions (§ 6). Le tableau du classement est publié avec les résultats.
- **ET0 des deux côtés** : FAO-56 de la réanalyse Open-Meteo (MC-33). La station Météo-France ne sert que de comparaison.

## 3 bis. Précisions du classement (PR 1, à relire par Nicolas)

Là où le § 3 laisse le choix, la PR 1 fixe (règle complète et commentée en tête de `banc/src/classement.ts`, avec la même numérotation ; tableau publié dans `banc/rapport/classement-annees.md`). Les comparaisons (quartiles, contrôle, distances à la cible) se font au centième de mm, la précision des données : une égalité au bruit de calcul près est une égalité.

1. **Réanalyse** : modèle `era5_seamless` d'Open-Meteo (ERA5-Land à 0,1° complété par ERA5), **de 1950 à la dernière année entière**, le même pour toutes les années, pour que le classement compare des années calculées de la même façon. Jours de Paris.
2. **Quartiles et médiane** : interpolation linéaire entre les années triées (méthode des tableurs). Quart sec : pluie ≤ 1er quartile ; quart humide : pluie ≥ 3e quartile.
3. **Années classées, années jouables** : une année est classée si ses 365 ou 366 jours ont pluie et ET0 ; elle peut être choisie si toute sa fenêtre de météo (§ 4 bis) est complète.
4. **Contrôle par l'ET0** : le bilan climatique de l'année (pluie − ET0). Sèche : bilan ≤ médiane des bilans ; humide : ≥ médiane ; moyenne : entre le 1er et le 3e quartile des bilans.
5. **Années récentes d'abord** (proposée le 24/11, à accepter par Nicolas) : le classement et ses quarts portent sur toutes les années, comme convenu, mais le choix se fait d'abord parmi les **30 dernières années classées** (les 30 plus récentes du classement : une année incomplète n'en prend pas la place ; une normale climatique). Sur ce lieu, l'ET0 moyenne de 1996 à 2025 (794 mm) dépasse d'environ 10 % celle de 1950 à 1978 (725 mm), et la réanalyse d'avant 1979 (sans satellites) est moins sûre : sans cette règle, le premier passage retenait 1959, 1974 et 1975, un climat qui n'est plus celui des fermes d'aujourd'hui.
6. **Sèche et humide** : dans le quart, d'abord les années qui passent le contrôle (s'il n'y en a aucune, toutes les années du quart, et le contrôle est dit « non conforme ») ; puis les années récentes ; puis, s'il y en a, celles que couvre l'archive des prévisions (passe 2 possible) ; enfin la plus proche du milieu du quart (percentile 12,5 ou 87,5), pour ne pas prendre un extrême isolé. À égalité, la plus récente.
7. **Moyenne** : la plus proche de la médiane de toutes les années, prise parmi les années récentes (à égalité, la plus récente) ; le contrôle et la couverture sont seulement dits.

## 4. Données (en commentaire de PR sur le dépôt commun)

1. **Assolement** de la démonstration de Tlaloc (une année entière fictive, parcelles et planches) : JSON pour la structure (parcelles, surfaces, sol en mm, dates d'implantation et de récolte, matériel). **La météo ne vient pas de Nicolas** : le script du banc (PR 1) va chercher lui-même l'ET0 FAO-56 et la pluie de la réanalyse Open-Meteo pour le lieu et les années choisis (MC-33), la même pour les deux côtés.
2. **Site** : fixé au § 3. Les années sont classées par le script de la PR 1.
3. **Kc et durées de stade** par culture (Nicolas les donne), pour calculer l'ETM des deux côtés de la même façon (hors moteur, MC-18). Côté Tlaloc, le Kc monte en ligne droite du Kc initial au Kc de pleine végétation, entre l'implantation et le début de la récolte. **Reçus le 22 novembre** (28 cultures ; sous serre × 0,7 ; sol nu entre deux cultures : Kc 0,4) : `banc/donnees/kc-stades-tlaloc.json`, recopiés sans changement. Les dates de chaque culture viennent de l'export de la démonstration, que Nicolas produit pour chacune des 3 années retenues.
4. **Format de sortie du plan** : arrosages par parcelle et par jour, en mm. **Reçu le 22 novembre** : CSV `date,parcelle,mm,mm_sol,mm_fond,mm_complement,mm_bassinage,mm_autre,reserve_facile_pct_opuntia,rfu_mm_opuntia,kc_opuntia` et un JSON d'accompagnement ; lu et vérifié par `banc/src/plan-tlaloc.ts` (`mm` = somme des quatre origines, `mm_sol` ≤ `mm`).
5. **Prévisions archivées** : voir § 6.

Données de la démonstration : rangées dans le dépôt commun (assolement fictif et météo publique d'Open-Meteo, donc sans problème de droits ; accord de Nicolas, 21/11).

## 4 bis. Météo rangée pour chaque année retenue (demande de Nicolas du 22/11)

Pour chaque année retenue, **du 15 octobre de l'année d'avant au 12 janvier de l'année d'après** (14 jours de mise en route de Tlaloc, 60 jours en arrière, 12 en avant) :
- `banc/meteo/<année>/meteo-<année>.csv` : `date,et0_mm,pluie_mm`, la date à l'heure de Paris, sans trou ;
- `banc/meteo/<année>/open-meteo-<année>.json` : la réponse d'Open-Meteo telle quelle, avec `daily.et0_fao_evapotranspiration`, `daily.precipitation_sum` et `hourly.precipitation` (`timezone=Europe/Paris`), dont les valeurs journalières sont celles du CSV (vérifié par les tests).

Toute la réanalyse journalière est aussi rangée (`banc/donnees/reanalyse-journaliere.csv`), pour que le classement se recalcule sans réseau. Open-Meteo n'étant pas joignable de toutes les machines, le téléchargement tourne dans le job « Banc » de GitHub Actions (gratuit pour un dépôt public).

## 5. Origine de l'objectif rejoué : TRANCHÉ (François, 21/11, option A)

Chaque lundi, l'objectif de la semaine rejouée côté OTF est l'**ETM proposée** (ET0 × Kc, D-045). Conséquence à **dire avec les résultats** : « jours sous le seuil » mesure alors en partie ce choix d'objectif ; les indicateurs de stress et d'eau perdue restent comparables. Une variante (autre objectif) n'est lancée que si les écarts sont grands, sur décision de François.

## 6. Passes

- **Passe 1 (obligatoire)** : prévisions parfaites (météo réalisée).
- **Passe 2 (si les archives existent)** : prévisions réelles archivées J+1 à J+4. L'archive de Tlaloc ne remonte qu'à la mise en service de chaque ferme : **on utilise l'archive des prévisions d'Open-Meteo, la même pour les deux côtés**, si elle couvre l'année. Sinon, la passe 2 est omise pour l'année concernée et le dit.
- **Couverture (PR 1)** : l'archive « historical forecast » d'Open-Meteo ne garde que le début de chaque prévision ; pour des échéances J+1 à J+4, la PR 1 sonde l'archive des **prévisions précédentes** (Previous Runs API : `precipitation_previous_day1` à `4`, `et0_fao_evapotranspiration_previous_day1` à `4`). Une année est couverte si chaque heure du 1er janvier au 4 janvier de l'année d'après a ces 8 valeurs, avec un même modèle (`best_match`, sinon `ecmwf_ifs025`). Résultat dans `banc/donnees/couverture-previsions.json`.
- **Variantes** (« exécution imparfaite », une vanne à la fois) : hors du premier lot.
- Débit sans limite en passe 1 (D-065). Pluie utile écrite dans le fichier, règle commune ; rejeu ensuite avec la règle de chaque jeu.

## 7. Indicateurs et tolérances

Eau apportée ; eau perdue ; jours sous le seuil (seuil propre à chaque côté, **doublé d'un seuil commun à 50 % de la réserve facile**, accord de Nicolas le 21/11) ; jours en stress (réserve facile épuisée, définie au § 7 bis ; « réserve à zéro » à confirmer par Nicolas dans ce sens) ; écart au besoin ; stabilité (somme des écarts en mm entre deux plans successifs) ; charge pour le maraîcher ; eau non placée. Tolérance : **1 % de l'eau totale de saison** et écart en jours sous le seuil (MC-30). La non-régression du module reste à 0,01 mm, hors banc.

## 7 bis. Définitions des indicateurs (PR 2, proposition à relire par Nicolas)

Proposées le 24/11 avec le code de la PR 2, relues côté OTF le même jour ; rien n'est calculé tant qu'elles ne sont pas acceptées. Notations du moteur (`docs/moteur.md`), par unité (une parcelle de Tlaloc), par jour : Dr le manque au soir, RU, p (`p_tableau`, ajusté à la chaleur dans le jeu Tlaloc, MC-21), RAW = p × RU la réserve facile du juge, Dmax le manque maximal suivi.

- **Une seule convention, celle de la FAO-56** : Ks = 1 tant que Dr ≤ RAW, le stress commence strictement au-delà. Toutes les comparaisons de jours sont strictes (>) et se font au centième de mm.
- **Jours non comptés** : un jour dont l'état est inconnu, et un jour sans RAW connue (sol nu entre deux cultures : aucune culture, donc aucun p), n'entrent dans aucun compte de jours ; leurs nombres sont publiés à côté.
- **p des cultures** : celui de la FAO-56 (tableau 22) déjà enregistré dans les profils d'OTF (D-053, D-056), le même pour les deux côtés, sans rien changer à un réglage. Pour une culture sans p chez OTF, ou dont l'analogie diffère de celle de Tlaloc, la valeur est une **question agronomique pour François** (§ 1), posée avant tout calcul. Tlaloc a ses propres p (FAO-56, tableau 22, borne basse ; liste des 28 donnée par Nicolas sur la PR n° 18) : ils sont égaux à ceux d'OTF ou à ceux proposés pour les cultures absentes d'OTF, sauf la **mâche (OTF 0,20, Tlaloc 0,30)** et le **melon (OTF 0,40, Tlaloc 0,45)**, posées à François.
- **Sol** : celui de la démonstration de Tlaloc (réponse de Nicolas du 24/11), le même pour les deux juges, **sans plancher** (Dmax = RU) : RU = 160 mm/m (texture « limoneux » de toute la démo) × profondeur des racines du jour. Les racines vont de 10 cm (semis) ou 15 cm (plant) à la profondeur maxi de la culture, en ligne droite entre l'implantation et le début de la récolte ; sur une parcelle, **la culture la moins enracinée décide** de la profondeur et du p (à profondeur égale, le p le plus bas). **La RU change donc d'un jour à l'autre** : le juge le permet, `suivre` prenant un sol par jour (`theta_u_mm_m`, `zr_m`, `p_tableau`), avec conservation de l'eau quand la profondeur change (MC-11). Sans culture en place, le juge garde la réserve de Tlaloc (30 cm, p = 0,4) pour suivre l'eau d'un jour à l'autre, mais ces jours restent « sans RAW connue » (point ci-dessus) : leur nombre est publié avec les résultats.

**Le juge.** Chaque côté est rejoué par `suivre` **deux fois**, avec `JEU_OTF` puis avec `JEU_TLALOC` (pluie utile, pas et bassinage de chaque jeu, § 6) ; les indicateurs sont publiés pour les deux juges. Mêmes jours, même sol, même ETM (Kc de Nicolas, `banc/src/etm.ts`), même pluie (la réanalyse, en total du jour, ou heure par heure pour le jeu Tlaloc), même état de départ : `{ dr_mm: 0,5 × RAW, dmax_mm: RU }` le 15 octobre de l'année d'avant (la mise en route de Tlaloc) ; seuls les jours du 1er janvier au 31 décembre sont comptés.

| Indicateur | Définition proposée |
|---|---|
| Eau apportée (mm) | Σ des arrosages et bassinages de l'année (colonne `mm` de Tlaloc ; arrosages placés d'OTF). Publiée aussi sans les bassinages (limite signalée par Nicolas). |
| Eau perdue (mm) | Σ `eau_perdue_mm` du juge : le drainage dû à l'arrosage. Les jours où il est inconnu sont comptés à part. |
| Jours sous le seuil propre | Tlaloc : **Dr > 0,5 × RAW du jeu Tlaloc** (réglage « seuil » de Tlaloc : 50 % de la réserve facile, RAW = p ajusté × RU du jour ; réponse de Nicolas du 24/11). Le bas de bande relevé à 65 % en stade sensible n'est pas rejoué : l'export ne donne que sa valeur du jour de l'export. Avec le juge Tlaloc, ce compte est donc celui du seuil commun ; le rapport le dit. OTF : la jauge d'OTF dit « sous le seuil » quand état ≤ seuil, soit **Dr ≥ p_tableau × RU** (seuil = capacité × (1 − p ÷ part de référence)). L'équivalence ne vaut qu'en mode « seuil selon la culture » (celui que le banc rejoue ; pas le mode « seuil de la ferme ») et pour p ≤ 2/3 (au-delà, le seuil d'OTF tombe à 0). Elle prend p_tableau, pas le p ajusté à la chaleur : avec le juge Tlaloc, le seuil propre d'OTF n'est pas « Dr > RAW du juge ». **Côté OTF, ce compte est celui des jours en stress** (avec le juge OTF), à un jour d'égalité près (≥ chez OTF, > ici) : le seuil d'OTF est justement le début du stress de la FAO-56 ; le rapport le dit au lieu de montrer deux colonnes qui sembleraient mesurer deux choses. |
| Jours sous le seuil commun | **Dr > 0,5 × RAW** : il reste moins de la moitié de la réserve facile. La même formule pour les deux côtés et les deux juges ; sa valeur, elle, varie avec le juge, puisque le jeu Tlaloc ajuste p à la chaleur : on n'attend donc pas deux chiffres identiques d'un juge à l'autre. |
| Jours en stress | **Dr > RAW** : la réserve facile est épuisée (FAO-56, éq. 84). Publié aussi : jours à réserve vide, **Dr ≥ RU** (la même borne pour les deux juges, le banc ne passant aucun plancher). |
| Écart au besoin (mm) | Chaque semaine (lundi à dimanche, coupée au 1er janvier et au 31 décembre) : arrosage compté par le juge − max(0, ETM − pluie utile du juge) ; on publie la somme des écarts et la somme de leurs valeurs absolues. Une semaine où un jour a son ETM ou sa pluie inconnue est sautée. |
| Stabilité (mm) | Pour chaque nouveau plan (OTF : chaque calcul ; Tlaloc : fond refait et plan du jour), Σ sur les jours à venir communs aux deux plans de \|mm du nouveau − mm de l'ancien\| ; somme sur l'année. |
| Charge pour le maraîcher | Nombre de jours avec au moins un arrosage, et nombre d'arrosages (un arrosage = une mise en route d'une vanne ou d'un matériel). |
| Eau non placée (mm) | Ce que chaque côté voulait apporter sans trouver de créneau : OTF « non placé » du planning ; Tlaloc « eau sans créneau » de ses événements. En passe 1 (débit sans limite), attendue nulle ou presque. |

**À l'échelle de la ferme** : les mm se pondèrent par la surface, Σ(mm × m²) ÷ Σ(m²) ; les jours se donnent en moyenne pondérée par la surface et en nombre de parcelles touchées.

**Tolérance (§ 7)** : deux côtés sont dits « d'accord » sur l'eau quand leurs écarts restent sous 1 % de l'eau totale de la saison ; sinon l'écart est montré, parcelle par parcelle, avec ce qui l'explique.

## 8. Réglage de code (à valider)

- **Où** : dépôt commun, dossier `banc/` (scripts, jeux de données, tests, rapport). Le module n'est pas touché ; l'adaptation de la logique OTF (besoin et placement) se fait par un script du banc qui l'appelle, sans modifier le module. Les deux dépôts étant distincts, le chantier peut avancer pendant un chantier du module (D-154 point 5).
- **Découpage** : PR 1 chargement des données et classement des années ; PR 2 rejeu et indicateurs, passe 1 ; PR 3 passe 2 et rapport. Chaque PR est relue par Nicolas avant fusion.
- **Réglage : Opus 5.5 · Élevé**, comme les lots du module : c'est du code de mesure, qui ne change pas le moteur. Opus 5.5 · Max seulement si une PR touche `src/` du moteur, ce que le banc n'a pas à faire. **Confirmé par François le 22 novembre** (avec une relecture du calcul du classement et du seuil commun à 50 % par une conversation séparée). Fable interdit.
- **Conditions de lancement** : Kc, durées de stade et format du plan reçus de Nicolas, ce contrat relu, ligne de roadmap inscrite. Rien d'autre n'est nécessaire.

## 9. Ce que le banc ne fait pas

Aucun changement de réglage ni de moteur ; aucune donnée de la ferme réelle de François ; aucune écriture dans OTF ; aucun gagnant désigné.

## 10. Points encore ouverts

- Exports de l'assolement de la démonstration pour les 3 années retenues, puis plans rejoués par Tlaloc : à fournir par Nicolas une fois la PR 1 fusionnée (PR « données seules »).
- Registres du module (roadmap § 6 ter, ligne dédiée, décision) : à inscrire par une PR du module.
- Export de la démo (§ 7 bis) : lecture de `ou.planches` (plage [première, dernière] ou liste de numéros), « pépinière » sous abri ou non (× 0,7), profondeur maxi des racines des 28 cultures : à confirmer par Nicolas.
- p de la mâche et du melon (OTF et Tlaloc diffèrent) : à trancher par François.

Reçus de Nicolas le 22/11 : Kc et durées de stade, format du plan, question de la météo (§ 4 bis). Le 24/11 : format de l'export de la démo, p des 28 cultures, modèle de sol et seuil propre de Tlaloc, Kc d'une parcelle à plusieurs cultures (moyenne pondérée par la surface).

Tranchés avec Nicolas le 21/11 : lieu, classement sur toute la réanalyse, seuil commun à 50 %, plan rejoué tel quel, données rangées dans le dépôt commun.
