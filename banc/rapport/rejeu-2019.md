# Banc d'essai, passe 1 : 2019

Module OTF au commit `4b8b33b1875aa8a77c15ba8b6c9232fcc980f0f4`. Contrat : `docs/contrat-banc-essai.md`, § 7 bis et § 7 ter. Aucun gagnant n'est désigné (D-065).

## Ferme, juge OTF

Surface : 3 635 m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).

| Indicateur | OTF | Tlaloc |
|---|---|---|
| Eau apportée (mm) | 415,92 | 737,67 |
| Eau apportée sans bassinage (mm) | 415,92 | 651,87 |
| Eau perdue (mm) | 86,03 | 169,45 |
| Écart au besoin, somme (mm) | 51,65 | 319,45 |
| Écart au besoin, valeurs absolues (mm) | 100,59 | 363,74 |
| Jours sous le seuil propre | 43,78 (15) | 20,67 (12) |
| Jours sous le seuil commun (Dr > 0,5 × RAW) | 120,11 (15) | 27,43 (15) |
| Jours en stress (Dr > RAW) | 43,7 (15) | 17,71 (6) |
| Jours à réserve vide (Dr ≥ RU) | 0,69 (4) | 0,23 (4) |
| Nombre d'arrosages | 754 | 5192 |

Eau apportée : **écart** de 321,75 mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.

## Ferme, juge Tlaloc

Surface : 3 635 m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).

| Indicateur | OTF | Tlaloc |
|---|---|---|
| Eau apportée (mm) | 415,92 | 737,67 |
| Eau apportée sans bassinage (mm) | 415,92 | 651,87 |
| Eau perdue (mm) | 72,39 | 131,13 |
| Écart au besoin, somme (mm) | 14,51 | 258,42 |
| Écart au besoin, valeurs absolues (mm) | 90,89 | 336,26 |
| Jours sous le seuil propre | 61,62 (15) | 47,2 (15) |
| Jours sous le seuil commun (Dr > 0,5 × RAW) | 97,2 (15) | 47,2 (15) |
| Jours en stress (Dr > RAW) | 41,91 (15) | 25,1 (7) |
| Jours à réserve vide (Dr ≥ RU) | 3,52 (11) | 0,15 (3) |
| Nombre d'arrosages | 754 | 5192 |

Eau apportée : **écart** de 321,75 mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.

Hors des comparaisons de la ferme (sans débit de vanne chez Tlaloc, d'accord avec Nicolas sur la PR n° 19) : pa62. Leur eau est rapportée à part, dans le tableau des parcelles.

## Parcelles (juge OTF)

| Parcelle | Surface (m²) | Serre | Eau OTF (mm) | Eau Tlaloc (mm) | Perdue OTF | Perdue Tlaloc | Stress OTF (j) | Stress Tlaloc (j) | Non placée OTF |
|---|---|---|---|---|---|---|---|---|---|
| pa1 | 210 | oui | 611,08 | 1 096,94 | 15,08 | 231,7 | 51 | 55 | 35,05 |
| pa2 | 210 | oui | 604,92 | 1 066,97 | 23,58 | 207,95 | 34 | 56 | 33,56 |
| pa3 | 210 | oui | 589,36 | 1 007,49 | 44,52 | 191,47 | 7 | 46 | 31,62 |
| pa4 | 210 | oui | 538,02 | 766,84 | 23,62 | 210,67 | 35 | 69 | 28,73 |
| pa5 | 137,5 | oui | 714,86 | 1 011,93 | 146,75 | 115,13 | 94 | 77 | 30,27 |
| pa61 | 137,5 | oui | 542,79 | 797,84 | 25,49 | 189,12 | 19 | 46 | 30,72 |
| pa62 (hors comparaison) | 140 | oui | 583,28 | 0 | 29,94 | 0 | 57 | 359 | 34,25 |
| pj1 | 300 | non | 373,19 | 632,81 | 129,38 | 119,13 | 46 | 0 | 34,11 |
| pj2 | 300 | non | 355,44 | 694,32 | 111,44 | 214,95 | 58 | 0 | 11,76 |
| pj3 | 300 | non | 398,67 | 669,14 | 124,07 | 138,02 | 65 | 0 | 15,49 |
| pj4 | 300 | non | 346,37 | 625,17 | 104,93 | 139,95 | 41 | 0 | 6,95 |
| pj5 | 300 | non | 328,53 | 629,24 | 103,93 | 160,99 | 56 | 0 | 9,46 |
| pj6 | 300 | non | 225,76 | 494,65 | 61,05 | 109,93 | 15 | 0 | 3,83 |
| pj7 | 300 | non | 364,04 | 770,16 | 124,42 | 255,71 | 69 | 0 | 14,55 |
| pj8 | 300 | non | 297,71 | 599,24 | 79,36 | 138,99 | 26 | 0 | 15,55 |
| ppep | 120 | non | 332,57 | 592,76 | 125,32 | 117,04 | 32 | 0 | 7,26 |

Les bassinages de Tlaloc entrent au sol pour la part que son plan compte (`mm_sol`) ; « eau apportée » les garde en entier.

Côté OTF, l'objectif du lundi est l'ETM de la semaine plus le rattrapage du manque du lundi au-delà de 0,5 × RAW (§ 7 ter, décidé par François le 28/11) : le manque est lu au soir de la veille par le juge Tlaloc sur les arrosages d'OTF déjà faits. Les jours de stress qui restent viennent de cette règle hebdomadaire (un seul calcul le lundi) et de l'eau non placée, pas du module lui-même.

Jours sans culture et jours à état inconnu : hors des comptes de jours, publiés dans le JSON. Stabilité : 0 côté OTF en passe 1 par construction (§ 7 ter) ; côté Tlaloc, elle demande l'historique de ses plans (passe 2).

p du juge : ceux d'OTF (FAO-56). Deux écarts avec Tlaloc, tranchés par François le 24/11 : mâche 0,20 (Tlaloc 0,30), melon 0,40 (Tlaloc 0,45).
