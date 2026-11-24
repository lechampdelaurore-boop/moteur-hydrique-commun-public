# Classement des années du banc d'essai

Fichier écrit par `npm run banc:classer` (`banc/scripts/classer.ts`) : ne pas le modifier à la main.

Réanalyse Open-Meteo, modèle `era5_seamless`, au lieu du banc (45.5 N, 5.75 E), jours de Paris, téléchargée le 2026-11-24. 76 années entières classées, de 1950 à 2025. Règle : `banc/src/classement.ts` (en tête du fichier).

## Les 3 années retenues

| Année | Choisie | Pluie (mm) | Contrôle par l'ET0 | Passe 2 |
|---|---|---|---|---|
| Sèche | **2009** | 1194,2 | conforme | omise |
| Humide | **2013** | 1637,0 | conforme | omise |
| Moyenne | **2019** | 1504,1 | conforme | omise |

- **Sèche** : 19 années du quart sec peuvent être rejouées ; 19 passent le contrôle par l'ET0 (bilan ≤ médiane des bilans, 765,7 mm) ; 10 sont des 30 dernières années (1996 à 2025) ; aucune n'est couverte par l'archive des prévisions : passe 2 omise ; la plus proche du milieu du quart (percentile 12,5, 1198,1 mm) est 2009 (1194,2 mm).
- **Humide** : 19 années du quart humide peuvent être rejouées ; 19 passent le contrôle par l'ET0 (bilan ≥ médiane des bilans, 765,7 mm) ; 6 sont des 30 dernières années (1996 à 2025) ; aucune n'est couverte par l'archive des prévisions : passe 2 omise ; la plus proche du milieu du quart (percentile 87,5, 1643,8 mm) est 2013 (1637,0 mm).
- **Moyenne** : la plus proche de la médiane de toutes les années (1495,6 mm), parmi 30 années récentes (1996 à 2025) qui peuvent être rejouées, est 2019 (1504,1 mm) ; contrôle par l'ET0 conforme (bilan 660,1 mm, entre 490,1 et 838,2 mm attendu) ; passe 2 omise.

## Repères

- Pluie annuelle : percentile 12,5 = 1198,1 mm ; 1er quartile = 1286,5 mm ; médiane = 1495,6 mm ; 3e quartile = 1588,5 mm ; percentile 87,5 = 1643,8 mm.
- Bilan climatique (pluie − ET0) : 1er quartile = 490,1 mm ; médiane = 765,7 mm ; 3e quartile = 838,2 mm.
- Archive des prévisions : De 2025 en remontant le temps, arrêt après 2 années non couvertes de suite ; les années avant 2023 ne sont pas sondées et comptent comme non couvertes.

## Toutes les années, de la moins pluvieuse à la plus pluvieuse

| Rang pluie | Année | Pluie (mm) | ET0 (mm) | Bilan (mm) | Rang bilan | Catégorie | Récente | Peut être rejouée | Passe 2 possible |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1989 | 910,3 | 806,0 | 104,3 | 1 | quart sec | non | oui | non |
| 2 | 1953 | 1052,6 | 752,6 | 300,0 | 5 | quart sec | non | oui | non |
| 3 | 1964 | 1063,8 | 770,6 | 293,1 | 4 | quart sec | non | oui | non |
| 4 | 2003 | 1095,9 | 884,8 | 211,1 | 2 | quart sec | oui | oui | non |
| 5 | 1962 | 1137,6 | 794,2 | 343,4 | 7 | quart sec | non | oui | non |
| 6 | 1957 | 1151,7 | 738,5 | 413,2 | 12 | quart sec | non | oui | non |
| 7 | 2011 | 1162,5 | 823,4 | 339,1 | 6 | quart sec | oui | oui | non |
| 8 | 1961 | 1165,3 | 797,5 | 367,8 | 9 | quart sec | non | oui | non |
| 9 | 2009 | 1194,2 | 826,6 | 367,6 | 8 | quart sec | oui | oui | non |
| 10 | 1959 | 1195,1 | 792,4 | 402,7 | 11 | quart sec | non | oui | non |
| 11 | 2015 | 1203,0 | 827,9 | 375,1 | 10 | quart sec | oui | oui | non |
| 12 | 2005 | 1203,8 | 773,0 | 430,8 | 15 | quart sec | oui | oui | non |
| 13 | 2004 | 1208,0 | 779,7 | 428,3 | 14 | quart sec | oui | oui | non |
| 14 | 2022 | 1216,7 | 929,5 | 287,2 | 3 | quart sec | oui | oui | non |
| 15 | 2006 | 1225,6 | 792,7 | 432,9 | 16 | quart sec | oui | oui | non |
| 16 | 1976 | 1230,7 | 742,9 | 487,8 | 19 | quart sec | non | oui | non |
| 17 | 1997 | 1230,8 | 796,9 | 433,9 | 17 | quart sec | oui | oui | non |
| 18 | 2017 | 1254,4 | 838,0 | 416,4 | 13 | quart sec | oui | oui | non |
| 19 | 1991 | 1273,8 | 770,4 | 503,4 | 21 | quart sec | non | oui | non |
| 20 | 1956 | 1290,8 | 694,6 | 596,2 | 25 | milieu | non | oui | non |
| 21 | 1950 | 1290,9 | 800,0 | 490,9 | 20 | milieu | non | non | non |
| 22 | 2020 | 1322,9 | 836,9 | 486,0 | 18 | milieu | oui | oui | non |
| 23 | 1985 | 1327,4 | 748,9 | 578,5 | 23 | milieu | non | oui | non |
| 24 | 1971 | 1331,5 | 720,2 | 611,3 | 27 | milieu | non | oui | non |
| 25 | 1972 | 1332,7 | 666,0 | 666,7 | 32 | milieu | non | oui | non |
| 26 | 1998 | 1357,2 | 774,3 | 582,9 | 24 | milieu | oui | oui | non |
| 27 | 2010 | 1363,2 | 739,3 | 623,9 | 29 | milieu | oui | oui | non |
| 28 | 1955 | 1364,4 | 757,4 | 607,0 | 26 | milieu | non | oui | non |
| 29 | 1967 | 1386,2 | 744,7 | 641,5 | 30 | milieu | non | oui | non |
| 30 | 2025 | 1391,6 | 857,3 | 534,3 | 22 | milieu | oui | oui | oui |
| 31 | 1973 | 1403,9 | 697,8 | 706,1 | 34 | milieu | non | oui | non |
| 32 | 1963 | 1455,3 | 679,4 | 776,0 | 42 | milieu | non | oui | non |
| 33 | 2018 | 1455,5 | 840,8 | 614,7 | 28 | milieu | oui | oui | non |
| 34 | 2008 | 1471,2 | 738,3 | 732,9 | 36 | milieu | oui | oui | non |
| 35 | 1969 | 1474,0 | 686,5 | 787,5 | 46 | milieu | non | oui | non |
| 36 | 1954 | 1475,3 | 691,3 | 784,0 | 45 | milieu | non | oui | non |
| 37 | 1952 | 1486,2 | 816,7 | 669,5 | 33 | milieu | non | oui | non |
| 38 | 1951 | 1495,1 | 713,4 | 781,7 | 43 | milieu | non | oui | non |
| 39 | 1975 | 1496,1 | 678,7 | 817,4 | 54 | milieu | non | oui | non |
| 40 | 1990 | 1501,9 | 779,1 | 722,8 | 35 | milieu | non | oui | non |
| 41 | 2019 | 1504,1 | 844,0 | 660,1 | 31 | milieu | oui | oui | non |
| 42 | 2000 | 1511,2 | 778,0 | 733,2 | 37 | milieu | oui | oui | non |
| 43 | 1992 | 1520,0 | 728,9 | 791,1 | 48 | milieu | non | oui | non |
| 44 | 1993 | 1522,0 | 756,6 | 765,4 | 38 | milieu | non | oui | non |
| 45 | 2016 | 1524,4 | 753,2 | 771,2 | 40 | milieu | oui | oui | non |
| 46 | 2002 | 1531,0 | 747,7 | 783,3 | 44 | milieu | oui | oui | non |
| 47 | 1994 | 1538,5 | 764,4 | 774,1 | 41 | milieu | non | oui | non |
| 48 | 1983 | 1542,4 | 739,6 | 802,8 | 49 | milieu | non | oui | non |
| 49 | 1982 | 1549,8 | 732,6 | 817,2 | 53 | milieu | non | oui | non |
| 50 | 2007 | 1550,2 | 746,7 | 803,5 | 50 | milieu | oui | oui | non |
| 51 | 1986 | 1556,4 | 745,5 | 810,9 | 51 | milieu | non | oui | non |
| 52 | 1958 | 1558,9 | 742,0 | 816,9 | 52 | milieu | non | oui | non |
| 53 | 1984 | 1560,2 | 710,5 | 849,7 | 58 | milieu | non | oui | non |
| 54 | 2012 | 1567,9 | 801,9 | 766,0 | 39 | milieu | oui | oui | non |
| 55 | 2014 | 1579,7 | 760,0 | 819,7 | 55 | milieu | oui | oui | non |
| 56 | 2024 | 1582,2 | 794,3 | 787,9 | 47 | milieu | oui | oui | non |
| 57 | 1966 | 1587,1 | 711,4 | 875,7 | 61 | milieu | non | oui | non |
| 58 | 1960 | 1592,8 | 758,5 | 834,3 | 57 | quart humide | non | oui | non |
| 59 | 1988 | 1597,8 | 723,5 | 874,3 | 60 | quart humide | non | oui | non |
| 60 | 1987 | 1605,0 | 703,5 | 901,5 | 63 | quart humide | non | oui | non |
| 61 | 1995 | 1608,3 | 743,6 | 864,7 | 59 | quart humide | non | oui | non |
| 62 | 1996 | 1621,4 | 718,1 | 903,3 | 64 | quart humide | oui | oui | non |
| 63 | 2001 | 1631,2 | 750,1 | 881,1 | 62 | quart humide | oui | oui | non |
| 64 | 1979 | 1633,8 | 695,6 | 938,1 | 66 | quart humide | non | oui | non |
| 65 | 2013 | 1637,0 | 729,0 | 908,0 | 65 | quart humide | oui | oui | non |
| 66 | 1968 | 1643,1 | 704,1 | 939,0 | 67 | quart humide | non | oui | non |
| 67 | 1974 | 1644,3 | 672,8 | 971,5 | 68 | quart humide | non | oui | non |
| 68 | 1978 | 1662,4 | 672,3 | 990,1 | 70 | quart humide | non | oui | non |
| 69 | 2023 | 1667,6 | 839,3 | 828,3 | 56 | quart humide | oui | oui | non |
| 70 | 1980 | 1723,6 | 647,4 | 1076,2 | 72 | quart humide | non | oui | non |
| 71 | 1977 | 1737,0 | 651,5 | 1085,5 | 73 | quart humide | non | oui | non |
| 72 | 2021 | 1747,2 | 760,4 | 986,9 | 69 | quart humide | oui | oui | non |
| 73 | 1999 | 1759,5 | 749,7 | 1009,8 | 71 | quart humide | oui | oui | non |
| 74 | 1970 | 1785,5 | 685,3 | 1100,2 | 74 | quart humide | non | oui | non |
| 75 | 1965 | 1820,4 | 695,9 | 1124,5 | 75 | quart humide | non | oui | non |
| 76 | 1981 | 1885,2 | 688,7 | 1196,5 | 76 | quart humide | non | oui | non |
