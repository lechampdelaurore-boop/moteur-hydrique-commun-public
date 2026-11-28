# Banc d'essai, passe 1 : 2009

Module OTF au commit `4b8b33b1875aa8a77c15ba8b6c9232fcc980f0f4`. Contrat : `docs/contrat-banc-essai.md`, § 7 bis et § 7 ter. Aucun gagnant n'est désigné (D-065).

## Ferme, juge OTF

Surface : 3 635 m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).

| Indicateur | OTF | Tlaloc |
|---|---|---|
| Eau apportée (mm) | 301,41 | 722,99 |
| Eau apportée sans bassinage (mm) | 301,41 | 637,19 |
| Eau perdue (mm) | 32,07 | 177,54 |
| Écart au besoin, somme (mm) | -28,23 | 339,42 |
| Écart au besoin, valeurs absolues (mm) | 28,24 | 384,17 |
| Jours sous le seuil propre | 155,59 (15) | 20,62 (11) |
| Jours sous le seuil commun (Dr > 0,5 × RAW) | 192,68 (15) | 27,5 (15) |
| Jours en stress (Dr > RAW) | 155,59 (15) | 16,51 (6) |
| Jours à réserve vide (Dr ≥ RU) | 19,61 (7) | 0,17 (3) |
| Nombre d'arrosages | 589 | 5328 |

Eau apportée : **écart** de 421,58 mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.

## Ferme, juge Tlaloc

Surface : 3 635 m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).

| Indicateur | OTF | Tlaloc |
|---|---|---|
| Eau apportée (mm) | 301,41 | 722,99 |
| Eau apportée sans bassinage (mm) | 301,41 | 637,19 |
| Eau perdue (mm) | 14,78 | 143,64 |
| Écart au besoin, somme (mm) | -95,53 | 248,22 |
| Écart au besoin, valeurs absolues (mm) | 95,54 | 335,37 |
| Jours sous le seuil propre | 162,68 (15) | 43,42 (14) |
| Jours sous le seuil commun (Dr > 0,5 × RAW) | 208,02 (15) | 43,42 (14) |
| Jours en stress (Dr > RAW) | 136,79 (15) | 25 (7) |
| Jours à réserve vide (Dr ≥ RU) | 10,81 (15) | 0,21 (3) |
| Nombre d'arrosages | 589 | 5328 |

Eau apportée : **écart** de 421,58 mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.

Hors des comparaisons de la ferme (sans débit de vanne chez Tlaloc, d'accord avec Nicolas sur la PR n° 19) : pa62. Leur eau est rapportée à part, dans le tableau des parcelles.

## Parcelles (juge OTF)

| Parcelle | Surface (m²) | Serre | Eau OTF (mm) | Eau Tlaloc (mm) | Perdue OTF | Perdue Tlaloc | Stress OTF (j) | Stress Tlaloc (j) | Non placée OTF |
|---|---|---|---|---|---|---|---|---|---|
| pa1 | 210 | oui | 552,69 | 1 093,29 | 0 | 244,53 | 365 | 46 | 26,62 |
| pa2 | 210 | oui | 538,7 | 1 044,9 | 0 | 204,46 | 365 | 48 | 33,15 |
| pa3 | 210 | oui | 493,96 | 994,21 | 0 | 189,59 | 353 | 52 | 32,28 |
| pa4 | 210 | oui | 472,57 | 766,4 | 0 | 221,7 | 359 | 69 | 29,96 |
| pa5 | 137,5 | oui | 514,12 | 1 001,69 | 0 | 120,65 | 365 | 62 | 40,75 |
| pa61 | 137,5 | oui | 452,66 | 783,18 | 0 | 190,79 | 336 | 46 | 37,7 |
| pa62 (hors comparaison) | 140 | oui | 506,93 | 0 | 0 | 0 | 359 | 359 | 39,41 |
| pj1 | 300 | non | 231,64 | 637,69 | 60,56 | 148,64 | 67 | 0 | 29,35 |
| pj2 | 300 | non | 226,77 | 680,35 | 52,24 | 208,91 | 74 | 0 | 5,61 |
| pj3 | 300 | non | 254,32 | 634,43 | 70,71 | 137,94 | 71 | 0 | 11,75 |
| pj4 | 300 | non | 205,79 | 598,43 | 40,67 | 142,56 | 70 | 0 | 16,15 |
| pj5 | 300 | non | 203,42 | 608,51 | 42,68 | 163,7 | 95 | 0 | 12,54 |
| pj6 | 300 | non | 153,15 | 470,54 | 28,91 | 122,36 | 24 | 0 | 13,77 |
| pj7 | 300 | non | 214,25 | 746,53 | 31,6 | 255,39 | 109 | 0 | 25,38 |
| pj8 | 300 | non | 206,18 | 616,58 | 43,1 | 174,03 | 27 | 0 | 11,87 |
| ppep | 120 | non | 182,31 | 549,95 | 45,4 | 131,69 | 44 | 0 | 18,51 |

Les bassinages de Tlaloc entrent au sol pour la part que son plan compte (`mm_sol`) ; « eau apportée » les garde en entier.

Les jours de stress du côté OTF, surtout sous serre, viennent de la règle du rejeu (§ 7 ter) : l'objectif de la semaine est l'ETM de la semaine, sans rattrapage du manque, et l'eau non placée n'est pas rendue. Ils ne disent rien du module lui-même.

Jours sans culture et jours à état inconnu : hors des comptes de jours, publiés dans le JSON. Stabilité : 0 côté OTF en passe 1 par construction (§ 7 ter) ; côté Tlaloc, elle demande l'historique de ses plans (passe 2).

p du juge : ceux d'OTF (FAO-56). Deux écarts avec Tlaloc, tranchés par François le 24/11 : mâche 0,20 (Tlaloc 0,30), melon 0,40 (Tlaloc 0,45).
