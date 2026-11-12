# Contrat du moteur hydrique commun : partie OTF

Version 0.1, 7 novembre 2026. Rédigée côté module OTF (Claude, pour François), à relire par Nicolas. Elle complète `contrat-moteur.md` (ébauche Tlaloc v0.1), qui laisse à OTF : ETM et facteurs, Kc et stades, sol nu et couverts, sol de labo et cailloux, gel.

**Source** : fichier moteur OTF v1.0 (`docs/sources/moteur-otf-v1.0.md`, code relu au commit 64c2e87), recoupé le 7 novembre 2026 avec le code du commit a9ea3e8 pour les points marqués [CODE]. **Rien n'a été exécuté** : les valeurs des cas OTF (`cas/cas-otf.json`) sont calculées à la main d'après ces formules.

**Marques** : **[MC-n]** décision du moteur commun (les points 1 à 9 de l'échange du 7 novembre deviennent MC-01 à MC-09) ; **[PROPOSÉ]** à valider ; **[À TRANCHER]** question ouverte ; **[CODE]** relu dans le code OTF.

---

## 1. Corrections proposées au glossaire (à reporter dans `contrat-moteur.md`)

**RFU a deux sens dans la v0.1.** Trois noms, pour ne plus les confondre :
- **RU** (TAW) : capacité au champ − point de flétrissement.
- **RFU de labo** (ou RFU du sol) = part de référence × RU. Valeur saisie par OTF, fixe quelle que soit la culture (part de référence 2/3 par défaut). C'est la **capacité suivie** et le **plancher** du jeu OTF [CODE : `soil.ts`, `gauge.ts`].
- **RAW** = p × RU : seuil de stress de la culture (FAO-56, tableau 22). Le mot « RFU » n'est plus employé pour p × RU.

Chaque formule du contrat qui dit « RFU » doit nommer laquelle des deux elle prend.

**Numérotation** : les décisions du moteur commun s'appellent MC-xx, pour ne pas entrer en collision avec les D-001 à D-067 d'OTF.

---

## 2. Entrées propres à OTF (à ajouter à la section 3 du contrat)

- **Trois natures d'arrosage**, pas deux [CODE : `gauge.ts`, `IrrigationInterval`] : `actual` (réalisé), `planned` (planifié), `proposed` (créneau proposé, pas encore validé). Les trois entrent dans la jauge ; seul `actual` est du passé.
- **Pluie d'un jour** [CODE] : pluviomètre saisi ▸ réanalyse ▸ prévision enregistrée du jour (nature « estimé ») ▸ inconnue. Sous abri : 0. Un jour passé ou « aujourd'hui » est du **réel** ; « aujourd'hui » n'est **jamais** compté aussi dans la prévue (D-019).
- **Part sous paillage plastique** : multiplicateur de la pluie, 1 par défaut, appliqué après la pluie utile.
- **État de surface** d'une planche nue : `bare`, `impermeable-tarp`, `permeable-tarp`, `mulched`, `green-manure-destroyed`, couverts (§ 6).

---

## 3. ETM [CODE : `crop-water/etm.ts`]

```
ETM(culture, jour) = ET0 × K_abri × Kc × K_paillage × K_ombrage      [mm/j]
```

| Facteur | Valeur | Notes |
|---|---|---|
| ET0 | donnée d'entrée avec sa nature ; **0 ≤ ET0 ≤ 12 mm/j**, hors bornes le jour est bloqué et la dernière valeur valide reste | une ET0 inconnue rend l'ETM inconnue, jamais 0 |
| K_abri | 1 en plein champ ; sous abri 0,8 par défaut, réglable de 0,6 à 1, **refus hors 0,5–1** | choix de François : on garde 0,8 [MC-06] ; Tlaloc garde 0,7 dans son jeu |
| Kc | § 4 | un Kc de 0 est un arrêt d'irrigation avant récolte, pas une anomalie |
| K_paillage | 0,9 si la planche porte un paillage plastique pour la saison civile, sinon 1 | multiplie le Kc, pour ne jamais donner un Kc négatif |
| K_ombrage | 1 ; avec l'option « ombrage » et un filet posé : √(1 − taux), taux de 0 à <1 | hypothèse étiquetée ; option désactivée par défaut |

- **Plusieurs cultures sur une planche** : paramètre `association` = `max` (**jeu OTF** : ETM de la planche = la plus élevée des ETM) ou `moyenne` (jeu Tlaloc : moyenne des Kc des espèces associées) [MC-10, relecture de Nicolas, 8 novembre]. Planche sans culture à Kc : 0 ce jour-là. Engrais vert : état de surface, sans Kc.
- **Plusieurs planches dans une unité** (jardin) : moyenne pondérée par la surface de la planche, volumes additionnés, un volume inconnu rend le total inconnu.
- **Garde-fous** : ETM > 8 mm/j → alerte de cohérence ; proposition d'objectif > 50 % d'écart avec l'objectif → alerte d'écart. (Ce sont des alertes de décision, hors moteur.)

## 4. Kc et stades [CODE : `kc.ts`, `stage.ts`, `reference.ts`]

- **Sources** (une par culture de référence) : `criiam` (CRIIAM Sud, escalier ou calendrier), `fao56` (trapèze), `local` (saisie de la ferme). Jeu commun livré : 19 cultures CRIIAM, 13 FAO-56. Le jeu est dans la migration `drizzle/0023_crop_water_need.sql` du module OTF.
- **Escalier / calendrier** : Kc fixe par stade, sans interpolation.
- **Trapèze FAO-56** : Kc_ini en phase initiale ; montée linéaire au développement ; Kc_mid en pleine saison ; descente linéaire vers Kc_end en dernière phase ; Kc_end jusqu'à la récolte. Un **coefficient d'abattement** ]0 ; 1] multiplie les Kc FAO, pas les surcharges de la ferme.
- **Surcharge de la ferme** : remplace la valeur de la source à partir de son jour (la plus récente par date d'effet puis d'enregistrement), sans réécrire le passé. Bornes du Kc : 0 à 1,3.
- **Lissage** (option, désactivée) : 5 jours après un changement de stade, `Kc = Kc_avant + (Kc − Kc_avant) × (j+1)/5` ; jamais vers un Kc de 0.
- **Stades** : jour 0 = lundi de la semaine d'implantation ; délai de levée ; durées par défaut ; ancrages (`implantation +n j`, `levée +n j`, `J-n avant la récolte`, `première récolte`, `mi-récolte`) ; jeux par mois d'implantation ; stade **déclaré** par le maraîcher (recale les suivants) ; pluriannuelles en `MM-JJ`.
- **Non relu pour ce contrat** : durées de stade par défaut et jeux de saison. [À COMPLÉTER] depuis `reference.ts` et la migration 0023, avec des cas de test.

## 5. Sol de labo, cailloux, profondeur, seuil [CODE : `soil.ts`, `rooting.ts`]

```
RFU du sol (mm/m) = round( RFU labo × (1 − cailloux % / 100) )        cailloux non renseignés : 0 %
capacité (mm)     = RFU du sol (mm/m) × min(profondeur racinaire, plafond de sol) (m)
seuil (mm)        = capacité × (1 − min(1, p / part de référence))        mode « selon la culture »
                  = capacité × X %                                          mode « seuil de la ferme »
```

- **Équivalences avec le vocabulaire du contrat** : RU = RFU du sol ÷ part de référence ; plancher du jeu OTF = capacité ; consommation pour atteindre le seuil = capacité − seuil = p × RU = **RAW** (vérifié : p/part × capacité = p × RU).
- Le mode « seuil de la ferme » est un % de la **capacité** (RFU de labo), pas de la RAW. Le seuil sort du moteur [MC-03] : chaque logiciel garde le sien dans sa décision.
- Valeurs par défaut du sol : part de référence 2/3, TEW 14 mm, REW 7 mm, Ze 10 cm ; `0 < REW < TEW`. Avertissement non bloquant si RFU labo > 200 mm/m ; cailloux de 0 à 99 %.
- Profondeur racinaire : par stade, fixe ou progressive (`début + (fin − début) × min(1, jours/jours_progression)`) ; sans profil : 0,30 m proposés avec avertissement ; ≤ 3 m. Plusieurs cultures : la moins profonde fixe la capacité, le plus petit p le seuil. p : 0,5 si absent.
- Révisions datées pour le sol, le plafond et les réglages.

## 6. Jeu OTF du bilan (à ajouter à la section 4 du contrat)

Le mode journalier du jeu OTF est celui du § 4.2 de `contrat-moteur.md`, **plus les règles suivantes**, sans lesquelles le moteur ne reproduirait pas OTF [MC-01] :

1. **Jour d'une observation.** Une observation « % du plein » (la plus récente du jour l'emporte ; à égalité, la dernière enregistrée) recale l'état : `état = % × capacité` [CODE]. Ce jour-là, la consommation et la pluie ne comptent que pour la **fraction restante** `f = (fin du jour − heure d'observation) / durée du jour` ; les arrosages ne comptent qu'après l'observation.
2. **« Le plein » = la capacité suivie** (RFU de labo × profondeur), pas la RU [CODE : `percent = état / capacité × 100`]. Le moteur reçoit un manque Dr en mm (MC-04) ; chaque logiciel convertit.
3. **Changement de capacité** (nouveau stade, nouvelle culture) : paramètre `conservation` = `pourcent` (**jeu OTF** : le % du plein est conservé, pas les mm) ou `manque` (jeu Tlaloc : le manque Dr en mm est conservé, simplement borné à la nouvelle RU, convention FAO-56 : la couche gagnée par les racines est à la capacité au champ) [MC-11]. [Décrit dans le fichier moteur v1.0 § 6.4 ; non relu ligne à ligne dans le code pour ce contrat.]
4. **Jour inconnu** : toute valeur manquante (pluie, ET0, ETM) rend l'état inconnu. Il **repart** à la fin d'un jour dont les apports remplissent la planche (`apports ≥ capacité`), ou à une observation [CODE : `restart: 'inflow' | 'observation'`].
5. **Natures** : l'état est « estimé » avant aujourd'hui, « prévu » ensuite. Il n'est **jamais** « observé » chez OTF, même recalé par une observation.
6. **Pluie** : `pluie extérieure × R2 (prévision seulement, 100 % par défaut) × part sous paillage × (surface) `, 0 sous abri. R2 s'applique dans la jauge et le planning, **pas** dans le besoin hebdomadaire d'OTF, qui déduit 100 % de la prévue.
7. **Pluie sous bâche imperméable** : 0 ; bâche perméable : évaporation × 0,10.

**Sol nu et couverts** [CODE : `bare-soil.ts`] : paramètre `sol_nu` = `fao56_ch7` (**jeu OTF**, ci-dessous) ou `kc_fixe` à 0,4 (jeu Tlaloc) [MC-12]. Tlaloc passera au chapitre 7 après une mesure sur le banc commun. Forme `fao56_ch7` : deux compartiments.
```
RFU surface  = RFU du sol × min(Ze, profondeur de référence)
RFU profonde = RFU du sol × (profondeur de référence − Ze)+
Kr = 1 si De_veille ≤ REW, sinon max(0, (TEW − De_veille)/(TEW − REW))
E  = min( part_état × Kr × 1,2 × ET0 × K_abri × fraction ; TEW − De_veille )
```
- Profondeur de référence : premier stade de la prochaine culture connue, sinon 0,30 m.
- Parts d'évaporation : nue 1 ; bâche imperméable 0 (et pluie 0) ; bâche perméable 0,10 ; paillée (paille, foin, BRF) et engrais vert détruit 0,50.
- Couverts : un compartiment de 30 cm, consommation `ET0 × K_abri × Kc` ; engrais vert levée 0,3, couverture partielle 0,6, totale 1,0 ; enherbée 0,6 (sans seuil).
- À la dépose d'une bâche imperméable, une surface restée humide (De ≤ REW) repart mouillée (De = 0).

**Eau arrosée en trop** [CODE : `water-surplus.ts`] : sur les 7 derniers jours passés, `drainage × irrigation / (pluie + irrigation)` ; ignoré sous 0,1 mm ; une jauge ou une pluie inconnue ce jour-là met la planche « à part », jamais comptée 0. Le mode horaire donne le calcul exact ; ce prorata en est l'approximation journalière.

## 7. Surface mouillée et pénurie : « inconnu, jamais zéro »

Défaut connu d'OTF (`planning/shortage.ts`, `volumeOf`) : une surface mouillée inconnue compte 0 m³ dans le partage du budget d'eau, ce qui contredit D-003. **Règle du moteur commun** : un volume dont la surface est inconnue est inconnu. Dans le partage de pénurie, la planche est mise **« à part » avec la raison « surface mouillée inconnue »** (cas O08, état « cible »). Correction à faire côté OTF dans la sous-tranche 3.9. Le placement d'OTF refuse déjà un créneau de volume inconnu sous une limite active (`supply.ts`).

La surface mouillée elle-même (matériel, passe-pieds, profils d'aspersion) est **hors du cœur** : le moteur reçoit des mm par unité.

## 8. Points ouverts côté OTF : réponses de la relecture (8 novembre)

Accordés entre la relecture de Nicolas et la proposition d'OTF (non agronomiques) :
1. **Arrosages en intervalles, mode horaire** [MC-13] : découpage en tranches horaires, au prorata de la durée.
2. **« Jours voisins »** du jeu Tlaloc [MC-14] : les 3 derniers jours connus **avant** le jour inconnu, jamais après, pour que le rejeu donne le même état que l'affichage en direct. À écrire en § 4.4 de `contrat-moteur.md`.
3. **Ordre à la même heure** [MC-15] : pluie d'abord, puis arrosage (l'excès est compté contre l'arrosage, choix prudent pour l'eau arrosée en trop).
4. **Gel** : hors du moteur. Une table de seuils partagée (données, pas moteur) pourra faire l'objet d'une PR séparée.

**Paramètres ajoutés par la relecture** : `association` (MC-10), `conservation` (MC-11), `sol_nu` (MC-12). Aucun ne change le comportement d'OTF (chacun a son jeu OTF par défaut).

**[À COMPLÉTER]** Durées de stade, jeux de saison : à relire dans `reference.ts` et la migration 0023.

**[QUESTION POUR PLUS TARD, PR « Kc » à part]** Quelle ETP de référence les Kc du CRIIAM supposent-ils ? État de nos informations : la page du CRIIAM Sud parle de « l'ETP (disponible librement sur le site) » sans nommer la méthode ; son exemple officiel utilise une « ETréf » de 7,3 mm/j. Le CRIIAM semble donc publier **sa propre ETP**. Non vérifié : la méthode de calcul (Penman-Monteith FAO-56 ou autre) et si elle coïncide avec l'ET0 d'Open-Meteo / Visual Crossing utilisée par OTF.

## 9. Journal des changements

| Version | Date | Qui | Ce qui change |
|---|---|---|---|
| 0.1 | 2026-11-07 | Claude (module OTF) | Première version de la partie OTF ; corrections de glossaire proposées ; 10 cas OTF écrits à la main. |
| 0.1.1 | 2026-11-08 | Claude (module OTF) | Relecture de Nicolas : paramètres association, conservation, sol_nu (MC-10 à MC-12) ; points ouverts tranchés (MC-13 à MC-15) ; cas O03, O04, O06, O07 corrigés ou complétés. |
