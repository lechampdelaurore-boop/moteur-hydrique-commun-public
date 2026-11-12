# Kc et gel : comparaison Tlaloc / OTF

Document de travail du 8 novembre 2026, côté Tlaloc (Nicolas, avec Claude). Il prépare une future PR « Kc » et la question du gel. Il ne décide rien : tout ce qui touche l'agronomie d'OTF passe par François.

**Sources comparées** :
- OTF : migration `0023_crop_water_need.sql` (jeu commun : CRIIAM Sud relevé le 29 octobre 2026, FAO-56 tableaux 11 et 12 relus le 31 octobre 2026) ;
- gel : fiche FRAB AuRA « Synthèse des exigences agronomiques en maraîchage — conditions de base pour les légumes » (R. El Beaino, avril 2026) ;
- Tlaloc : catalogue des Kc et familles de gel de l'application (v183 ; inchangés depuis à notre connaissance).

La migration 0023 est dans le dépôt du module OTF ; la fiche FRAB n'est pas versée ici (document de la FRAB AuRA). Le tableau des Kc a été produit par un script qui lit la migration et le catalogue de Tlaloc, pas recopié à la main.

## 1. Forme de la courbe de Kc

| | OTF | Tlaloc |
|---|---|---|
| Formes | **paliers** (CRIIAM : un Kc par stade, début de stade ancré sur l'implantation, la levée, la récolte ou le temps avant récolte) ; **trapèze** FAO-56 (ini, mi, fin, 4 phases en jours, jeux de saison par mois) ; **calendrier** (vivaces : artichaut, asperge, fraisier) | **rampe** : Kc monte linéairement de Kc_ini (implantation I) à Kc_plein (début de récolte R), puis reste au plein jusqu'à la fin F |
| Fin de cycle | Kc_end (FAO) ; Kc à 0 en fin de cycle CRIIAM pour l'ail (20 j avant récolte) et la pomme de terre (20 j) : le séchage est dans le Kc | pas de Kc_end ; le séchage avant récolte est une **alerte** séparée (`DRY_CAT` : bulbes 15 j, pomme de terre 14 j…) |
| Saisons | jusqu'à 3 jeux de durées selon le mois d'implantation (betterave, chou-fleur, salade…) | aucun |
| Levée | délai semis → levée par culture (Harrington, 15 °C) | non |
| Révisions | surcharges de Kc et stades déclarés datés, jamais effacés (D-006) | Kc par espèce dans Réglages ; stade forcé « jeune / développée » par série |
| Facteurs | abri (0,6 à 1), paillage plastique, filet d'ombrage, lissage | abri (0,7), toile tissée (− 10 %), sol nu 0,4 |
| Associations | correspondance espèce → culture par la ferme, exception par série | moyenne simple des Kc des espèces associées |

## 2. Valeurs : où les deux catalogues divergent

« Écart au plein » = Kc plein de Tlaloc ÷ Kc maximal d'OTF − 1. Positif : Tlaloc compte plus d'eau au pic.

| Culture OTF | Source OTF | Kc OTF (stades ou ini / mi / fin) | Max OTF | Tlaloc (ini → plein) | Écart au plein |
|---|---|---|---|---|---|
| Ail | CRIIAM (paliers) | 0,50 / 0,90 / 0,60 / 0,00 | 0,90 | 0,70 → 1,00 | +11 % |
| Artichaut remontant | CRIIAM (paliers) | 0,50 / 0,80 / 1,10 / 0,60 | 1,10 | 0,50 → 1,00 | −9 % |
| Asperge | CRIIAM (paliers) | 0,50 / 0,90 / 0,70 / 0,50 | 0,90 | 0,50 → 0,95 | +6 % |
| Aubergine | CRIIAM (paliers) | 0,50 / 0,60 / 0,90 / 0,60 | 0,90 | 0,60 → 1,05 | +17 % |
| Betterave | CRIIAM (paliers) | 0,50 / 0,70 / 1,00 | 1,00 | 0,50 → 1,05 | +5 % |
| Carotte | CRIIAM (paliers) | 0,50 / 1,00 | 1,00 | 0,70 → 1,05 | +5 % |
| Chou-fleur | CRIIAM (paliers) | 0,50 / 1,00 / 1,30 | 1,30 | 0,70 → 1,05 | −19 % |
| Courgette | CRIIAM (paliers) | 0,50 / 1,00 / 0,70 | 1,00 | 0,50 → 0,95 | −5 % |
| Fraisier non remontant | CRIIAM (paliers) | 0,40 / 0,60 / 0,90 / 0,70 | 0,90 | 0,40 → 0,85 | −6 % |
| Haricot | CRIIAM (paliers) | 0,60 / 0,80 / 1,00 | 1,00 | 0,50 → 1,05 | +5 % |
| Melon | CRIIAM (paliers) | 0,40 / 0,60 / 1,00 / 0,65 | 1,00 | 0,50 → 0,85 | −15 % |
| Oignon | CRIIAM (paliers) | 0,60 / 0,80 / 1,00 / 1,10 / 0,50 | 1,10 | 0,70 → 1,05 | −5 % |
| Poireau | CRIIAM (paliers) | 0,70 | 0,70 | 0,70 → 1,00 (Poireau (assimilé oignon vert)) | +43 % |
| Poivron | CRIIAM (paliers) | 0,50 / 0,60 / 0,70 / 0,60 | 0,70 | 0,60 → 1,05 | +50 % |
| Pomme de terre | CRIIAM (paliers) | 0,50 / 1,10 / 0,60 / 0,00 | 1,10 | 0,50 → 1,15 | +5 % |
| Salade d'été | CRIIAM (paliers) | 0,40 / 0,70 | 0,70 | 0,70 → 1,00 | +43 % |
| Tomate | CRIIAM (paliers) | 0,20 / 0,60 / 0,90 / 0,70 | 0,90 | 0,60 → 1,15 | +28 % |
| Brocoli | FAO-56 (trapèze) | 0,70 / 1,05 / 0,95 | 1,05 | 0,70 → 1,05 | 0 % |
| Céleri | FAO-56 (trapèze) | 0,70 / 1,05 / 1,00 | 1,05 | 0,70 → 1,05 | 0 % |
| Concombre | FAO-56 (trapèze) | 0,60 / 1,00 / 0,75 | 1,00 | 0,60 → 1,00 | 0 % |
| Crucifères (choux) | FAO-56 (trapèze) | 0,70 / 1,05 / 0,95 | 1,05 | 0,70 → 1,05 | 0 % |
| Épinard | FAO-56 (trapèze) | 0,70 / 1,00 / 0,95 | 1,00 | 0,70 → 1,00 | 0 % |
| Fève | FAO-56 (trapèze) | 0,50 / 1,15 / 1,10 | 1,15 | 0,50 → 1,15 | 0 % |
| Navet | FAO-56 (trapèze) | 0,50 / 1,10 / 0,95 | 1,10 | 0,50 → 1,10 | 0 % |
| Oignon vert | FAO-56 (trapèze) | 0,70 / 1,00 / 1,00 | 1,00 | 0,70 → 1,00 | 0 % |
| Pastèque | FAO-56 (trapèze) | 0,40 / 1,00 / 0,75 | 1,00 | 0,40 → 1,00 | 0 % |
| Patate douce | FAO-56 (trapèze) | 0,50 / 1,15 / 0,65 | 1,15 | 0,50 → 1,15 | 0 % |
| Petit pois | FAO-56 (trapèze) | 0,50 / 1,15 / 1,10 | 1,15 | 0,50 → 1,15 | 0 % |
| Potiron, courge d'hiver | FAO-56 (trapèze) | 0,50 / 1,00 / 0,80 | 1,00 | 0,50 → 1,00 | 0 % |
| Radis | FAO-56 (trapèze) | 0,70 / 0,90 / 0,85 | 0,90 | 0,70 → 0,90 | 0 % |

**Lecture** :
- **Les 13 cultures FAO-56 sont identiques** des deux côtés (même tableau 12). Seule différence : Tlaloc n'a pas de Kc_end.
- **L'écart vient du CRIIAM**, qu'OTF préfère au FAO pour 17 légumes. Au pic, Tlaloc compte nettement plus d'eau pour :
  - poivron : + 50 % ;
  - salade d'été : + 43 % ;
  - poireau : + 43 % ;
  - tomate : + 28 % ;
  - aubergine : + 17 %.
- Il en compte moins pour le chou-fleur (− 19 %, CRIIAM monte à 1,30 en formation de la pomme) et le melon (− 15 %).
- La forme ajoute à l'écart. La rampe de Tlaloc garde le Kc plein jusqu'à la fin, alors que le CRIIAM redescend après la mi-récolte (tomate 0,70, aubergine 0,60). Sur une saison, l'écart en eau consommée est donc plus grand que l'écart au pic.
- Côté Tlaloc, la **consommation apprise** (kf, v184) corrige en partie le Kc d'après les relevés. Une partie de l'écart peut donc déjà être absorbée sur une ferme qui fait des relevés.

**Question pour François (notée au § 8 de la partie OTF)** : quelle ETP de référence les Kc du CRIIAM supposent-ils ? D'après OTF, la page du CRIIAM Sud parle de « l'ETP (disponible librement sur le site) » sans nommer la méthode ; il publie donc sans doute sa propre ETP. Si ce n'est pas l'ET0 FAO, multiplier ces Kc par l'ET0 d'Open-Meteo n'est pas cohérent. Pour la tomate sous abri, au pic : OTF 0,9 × 0,8 = 0,72 ; Tlaloc 1,15 × 0,7 = 0,81, soit encore 12 % d'écart.

## 3. Propositions pour le contrat [PROPOSÉ]

- **Proposition A.** Le moteur reçoit, pour chaque unité et chaque jour, un **Kc du jour déjà calculé** (avec sa trace : culture, stade, source, facteurs). Le calcul du Kc reste dans chaque logiciel en phase 1. Raisons :
  - c'est de l'agronomie propre à chacun (règle 5 du README) ;
  - OTF stocke déjà son ETM du jour avec sa trace (`irrigation_crop_etm_days`).
- **Proposition B.** En phase 2, un module « Kc » commun, séparé du bilan, avec les quatre formes : paliers, trapèze, calendrier et **rampe** (la forme de Tlaloc, pour que le jeu Tlaloc ne bouge pas). Les catalogues seraient des données du dépôt (`donnees/kc/`), avec source et date de relevé comme dans la migration 0023.
- **Proposition C.** Le banc commun rejoue chaque saison avec les deux catalogues sur les mêmes cultures. Il mesure ce que l'écart CRIIAM / FAO change en eau et en jours sous le seuil, et le confronte aux relevés. **Tlaloc ne change pas son catalogue avant cette mesure** : c'est la décision de Nicolas.

## 4. Gel : seuils comparés

Tlaloc classe chaque espèce dans l'une de 3 familles, avec un seuil de minimale prévue (air) : sensible + 1 °C, demi-rustique − 2 °C, rustique − 6 °C.
- L'alerte « à surveiller » part au seuil + 2 °C, l'alerte « à protéger » au seuil.
- Sous serre, les seuils sont décalés de + 2 °C.

La FRAB donne la « température de début de dégât de gel ».

| Légume | FRAB (°C) | Famille Tlaloc | Seuil Tlaloc (°C) | Tlaloc par rapport à la FRAB |
|---|---|---|---|---|
| Ail | −10 | rustique | −6 | alerte 4 °C plus tôt |
| Aubergine | 0 | sensible | +1 | 1 °C plus tôt |
| Betterave rouge | −7 | demi-rustique | −2 | 5 °C plus tôt |
| Blette | −6 | demi-rustique | −2 | 4 °C plus tôt |
| Carotte | −6 | rustique | −6 | identique |
| Céleri branche et rave | −2 | demi-rustique | −2 | identique |
| Chou pommé | −8 | rustique | −6 | 2 °C plus tôt |
| **Chou-fleur** | **−3** | **rustique** | **−6** | **3 °C trop tard** |
| Concombre | 0 | sensible | +1 | 1 °C plus tôt |
| Courge | −1 | sensible | +1 | 2 °C plus tôt |
| Courgette | 0 | sensible | +1 | 1 °C plus tôt |
| Épinard | −8 à −10 | rustique | −6 | 2 à 4 °C plus tôt |
| **Fenouil** | **0 à −2** | **demi-rustique** | **−2** | **jusqu'à 2 °C trop tard** |
| Haricot vert | 0 à −2 | sensible | +1 | 1 à 3 °C plus tôt |
| Laitue | −4 | demi-rustique | −2 | 2 °C plus tôt |
| Navet | −8 | demi-rustique | −2 | 6 °C plus tôt |
| Oignon jaune | −6 à −8 | rustique | −6 | 0 à 2 °C plus tôt |
| Petit pois | −4 à −6 | demi-rustique | −2 | 2 à 4 °C plus tôt |
| Poireau | −8 à −10 | rustique | −6 | 2 à 4 °C plus tôt |
| Poivron | 0 | sensible | +1 | 1 °C plus tôt |
| Pomme de terre | −5 | demi-rustique | −2 | 3 °C plus tôt |
| Radis rond | −4 | demi-rustique | −2 | 2 °C plus tôt |
| Tomate | 0 | sensible | +1 | 1 °C plus tôt |

**Lecture** :
- Tlaloc est presque partout plus prudent. Pour les sensibles, la marge de + 1 °C est voulue : la minimale prévue est celle de l'air à 2 m, et une nuit claire peut être plus froide au ras des cultures. Pour navet, betterave et blette, la prudence (4 à 6 °C) donne des alertes inutiles.
- **Deux cas où Tlaloc alerte trop tard** :
  - le **chou-fleur** : rangé avec les choux en rustique (− 6 °C), alors que la FRAB donne − 3 °C ;
  - le **fenouil** : − 2 °C, alors que la FRAB donne 0 à − 2 °C.
  
  À corriger côté Tlaloc, si Nicolas le veut.
- **[À TRANCHER]** La fiche ne dit pas de quelle température elle parle (air sous abri météo, ou température au niveau de la plante). Elle ne parle pas non plus de durée d'exposition ni de stade (un jeune plant est plus fragile).

**Proposition [PROPOSÉ]** : le gel **n'est pas du ressort du moteur hydrique** (ce n'est pas un bilan d'eau). Les deux logiciels peuvent en revanche partager une **table de seuils** dans le dépôt (`donnees/gel/`), avec la source FRAB. Chacun garde sa règle d'alerte (marge, décalage sous abri).

## 5. Autres colonnes de la fiche FRAB, utiles plus tard

- **Temps de levée** à température optimale. OTF utilise des délais à 15 °C (Harrington), plus longs pour certaines cultures (haricot 16 j contre 6 à 8 j à l'optimum). Les deux sont cohérents : le délai dépend de la température. Les degrés-jours, prévus mais hors de la migration 0023, régleraient la question.
- **Zéro végétatif**. C'est la base des degrés-jours, si un jour la durée des stades se compte ainsi.
