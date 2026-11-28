# Banc d'essai, passe 1 : 2019

Module OTF au commit `4b8b33b1875aa8a77c15ba8b6c9232fcc980f0f4`. Contrat : `docs/contrat-banc-essai.md`, § 7 bis et § 7 ter. Aucun gagnant n'est désigné (D-065).

## Ferme, juge OTF

Surface : 3 635 m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).

| Indicateur | OTF | Tlaloc |
|---|---|---|
| Eau apportée (mm) | 331,7 | 737,67 |
| Eau apportée sans bassinage (mm) | 331,7 | 651,87 |
| Eau perdue (mm) | 39,59 | 169,45 |
| Écart au besoin, somme (mm) | -32,56 | 319,45 |
| Écart au besoin, valeurs absolues (mm) | 35,27 | 363,74 |
| Jours sous le seuil propre | 158,88 (15) | 20,67 (12) |
| Jours sous le seuil commun (Dr > 0,5 × RAW) | 187,67 (15) | 27,43 (15) |
| Jours en stress (Dr > RAW) | 158,88 (15) | 17,71 (6) |
| Jours à réserve vide (Dr ≥ RU) | 26,51 (14) | 0,23 (4) |
| Nombre d'arrosages | 608 | 5192 |

Eau apportée : **écart** de 405,97 mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.

## Ferme, juge Tlaloc

Surface : 3 635 m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).

| Indicateur | OTF | Tlaloc |
|---|---|---|
| Eau apportée (mm) | 331,7 | 737,67 |
| Eau apportée sans bassinage (mm) | 331,7 | 651,87 |
| Eau perdue (mm) | 34,83 | 131,13 |
| Écart au besoin, somme (mm) | -69,7 | 258,42 |
| Écart au besoin, valeurs absolues (mm) | 72,41 | 336,26 |
| Jours sous le seuil propre | 146,29 (15) | 47,2 (15) |
| Jours sous le seuil commun (Dr > 0,5 × RAW) | 188,26 (15) | 47,2 (15) |
| Jours en stress (Dr > RAW) | 123,17 (15) | 25,1 (7) |
| Jours à réserve vide (Dr ≥ RU) | 14,65 (14) | 0,15 (3) |
| Nombre d'arrosages | 608 | 5192 |

Eau apportée : **écart** de 405,97 mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.

Hors des comparaisons de la ferme (sans débit de vanne chez Tlaloc, d'accord avec Nicolas sur la PR n° 19) : pa62. Leur eau est rapportée à part, dans le tableau des parcelles.

## Parcelles (juge OTF)

| Parcelle | Surface (m²) | Serre | Eau OTF (mm) | Eau Tlaloc (mm) | Perdue OTF | Perdue Tlaloc | Stress OTF (j) | Stress Tlaloc (j) | Non placée OTF |
|---|---|---|---|---|---|---|---|---|---|
| pa1 | 210 | oui | 549,81 | 1 096,94 | 0 | 231,7 | 365 | 55 | 45,53 |
| pa2 | 210 | oui | 541,92 | 1 066,97 | 0 | 207,95 | 365 | 56 | 46,23 |
| pa3 | 210 | oui | 498,6 | 1 007,49 | 0 | 191,47 | 353 | 46 | 44,69 |
| pa4 | 210 | oui | 473,59 | 766,84 | 0 | 210,67 | 359 | 69 | 39,7 |
| pa5 | 137,5 | oui | 525 | 1 011,93 | 0 | 115,13 | 365 | 77 | 44,78 |
| pa61 | 137,5 | oui | 462,18 | 797,84 | 0 | 189,12 | 337 | 46 | 39,95 |
| pa62 (hors comparaison) | 140 | oui | 516,42 | 0 | 0 | 0 | 359 | 359 | 47,45 |
| pj1 | 300 | non | 290,91 | 632,81 | 80,96 | 119,13 | 68 | 0 | 21,98 |
| pj2 | 300 | non | 252,07 | 694,32 | 53,29 | 214,95 | 89 | 0 | 13,54 |
| pj3 | 300 | non | 297,33 | 669,14 | 66,57 | 138,02 | 87 | 0 | 16,75 |
| pj4 | 300 | non | 254,58 | 625,17 | 49,87 | 139,95 | 69 | 0 | 13,38 |
| pj5 | 300 | non | 231,87 | 629,24 | 46,12 | 160,99 | 86 | 0 | 18,06 |
| pj6 | 300 | non | 191,41 | 494,65 | 43,2 | 109,93 | 25 | 0 | 4,49 |
| pj7 | 300 | non | 260,42 | 770,16 | 55,01 | 255,71 | 104 | 0 | 8,02 |
| pj8 | 300 | non | 247,06 | 599,24 | 52,36 | 138,99 | 48 | 0 | 13,34 |
| ppep | 120 | non | 240,67 | 592,76 | 80,76 | 117,04 | 45 | 0 | 22,46 |

Les bassinages de Tlaloc entrent au sol pour la part que son plan compte (`mm_sol`) ; « eau apportée » les garde en entier.

Les jours de stress du côté OTF, surtout sous serre, viennent de la règle du rejeu (§ 7 ter) : l'objectif de la semaine est l'ETM de la semaine, sans rattrapage du manque, et l'eau non placée n'est pas rendue. Ils ne disent rien du module lui-même.

Jours sans culture et jours à état inconnu : hors des comptes de jours, publiés dans le JSON. Stabilité : 0 côté OTF en passe 1 par construction (§ 7 ter) ; côté Tlaloc, elle demande l'historique de ses plans (passe 2).

p du juge : ceux d'OTF (FAO-56). Deux écarts avec Tlaloc, tranchés par François le 24/11 : mâche 0,20 (Tlaloc 0,30), melon 0,40 (Tlaloc 0,45).
