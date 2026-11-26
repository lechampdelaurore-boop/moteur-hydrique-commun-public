# Données de la démo de Tlaloc pour le banc d'essai (MC-36)

Fournies par Nicolas (Tlaloc / Opuntia v723), pour les 3 années retenues (2009, 2013, 2019). **Ferme de démonstration, assolement fictif : aucune donnée de ferme réelle.**

Fabriquées par les scripts de `outils/banc/` du dépôt de Tlaloc (mode d'emploi : `outils/banc/LISEZMOI.md`), avec la météo rangée ici (`banc/meteo/<année>/open-meteo-<année>.json`, pluie heure par heure). Passe 1 : prévisions parfaites, débit sans limite, pas de relevé ni de tensiomètre.

| Fichier | Contenu |
|---|---|
| `<année>/export-demo-<année>.json` | la démo : parcelles, sol, vannes (débit en mm/h), assolement aux dates de l'année, Kc et durées de stade par culture, réglages du plan du jour |
| `<année>/plan-tlaloc-<année>.csv` | le plan de Tlaloc rejoué : mm par parcelle et par jour (colonnes de `banc/src/plan-tlaloc.ts`) |
| `<année>/plan-tlaloc-<année>-arrosages.csv` | les arrosages un par un, bassinages compris : `date, parcelle, vanne, debut, fin, mm, mm_sol, origine` (heures HH:MM de Paris, mm sur la surface de la parcelle) |
| `<année>/plan-tlaloc-<année>.json` | règles du rejeu, parcelles, vannes, totaux (mm et m³), événements de chaque jour, dont l'eau sans créneau libre par parcelle (`evenements[].sans_creneau_par_parcelle`) |

Par jour et par parcelle, la somme des arrosages un par un redonne `mm` et `mm_sol` du plan (vérifié : 0 écart).

| Année | m³ arrosés (ferme entière) | Plans du jour appliqués | Eau sans créneau |
|---|---|---|---|
| 2009 | 2 628 | 256 | 0 mm |
| 2013 | 2 163 | 232 | 0 mm |
| 2019 | 2 681 | 264 | 1,8 mm (pj4, le 23 juin) |
