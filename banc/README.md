# Banc d'essai du moteur commun (MC-36)

Contrat : `docs/contrat-banc-essai.md`. Le banc rejoue 3 années entières (une sèche, une humide, une moyenne) dans les deux manières de décider d'arroser, OTF et Tlaloc, avec le moteur commun comme juge. Il ne change aucun réglage ni le moteur (§ 9).

## Où en est le banc

- **PR 1 (celle-ci) : chargement des données et classement des années.** Kc et durées de stade de Nicolas, lecture du plan de Tlaloc, réanalyse d'Open-Meteo, classement, météo des 3 années retenues.
- PR 2 : rejeu et indicateurs, passe 1 (prévisions parfaites).
- PR 3 : passe 2 (prévisions archivées) et rapport.

## Contenu

| Chemin | Rôle |
|---|---|
| `donnees/kc-stades-tlaloc.json` | Kc et durées de stade des 28 cultures, recopiés du commentaire de Nicolas du 22/11 (PR n° 15) |
| `donnees/reanalyse-journaliere.csv` | Réanalyse `era5_seamless` d'Open-Meteo, `date,et0_mm,pluie_mm`, jours de Paris, de 1950 au 12 janvier après la dernière année entière |
| `donnees/reanalyse-source.json` | D'où vient cette réanalyse (modèle, lieu, date du téléchargement) |
| `donnees/couverture-previsions.json` | Pour chaque année sondée : l'archive des prévisions J+1 à J+4 la couvre-t-elle (passe 2 possible) |
| `rapport/classement-annees.md` et `.json` | Le tableau du classement et les 3 années retenues, avec leurs raisons |
| `meteo/<année>/meteo-<année>.csv` | Météo de l'année retenue, du 15 octobre d'avant au 12 janvier d'après |
| `meteo/<année>/open-meteo-<année>.json` | La même, réponse d'Open-Meteo telle quelle, avec la pluie heure par heure |
| `src/` | Lecture et vérification des données ; `classement.ts` porte la règle du classement, commentée en tête |
| `scripts/` | Les trois étapes ci-dessous |
| `tests/` | Règles du classement (valeurs calculées à la main), lecture des données, fichiers rangés recalculés à l'identique |

## Refaire les fichiers

Open-Meteo n'est pas joignable de toutes les machines : le job « Banc » de GitHub Actions (`.github/workflows/banc.yml`) fait les trois étapes à chaque PR qui touche `banc/src/` ou `banc/scripts/`, et joint les fichiers produits (« banc-donnees »). Il échoue si le choix des années change par rapport aux fichiers versionnés.

```text
npm run banc:telecharger   # réseau : réanalyse de toutes les années, couverture de l'archive des prévisions (une dizaine de minutes, appels espacés)
npm run banc:classer       # sans réseau : classement, rapport, CSV des 3 années
npm run banc:annees        # réseau : réponse d'Open-Meteo avec la pluie horaire des 3 années
```

`npm test` vérifie sans réseau que le classement et les CSV se recalculent à l'identique depuis les fichiers rangés.
