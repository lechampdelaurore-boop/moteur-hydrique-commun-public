# Moteur de calcul hydrique du module d'irrigation OTF

**Version du fichier : 1.0 · 7 novembre 2026**
**Code lu : dépôt `lechampdelaurore-boop/module-irrigation-otf`, branche `main`, commit `64c2e87`.**
**Rôle : donner à un autre Claude (ou à un développeur) les variables, formules, unités, valeurs par défaut et ordre des calculs du module, tels qu'ils sont codés.**

---

## 0. Comment lire ce fichier

- **Règle d'or : le code fait foi.** Chaque formule ci-dessous est suivie du fichier qui la contient (`lib/...`). En cas de doute, relire le fichier cité, pas ce texte.
- **Marques** : `[CODE]` = formule relue dans le code à ce commit. `[CONTRAT]` = décrite dans un contrat de `docs/`, **code non relu pour ce fichier**. `[ÉCART]` = le code diffère de la description écrite le 7 novembre 2026 (`description-module-irrigation-otf.md`) ou d'un contrat ; voir la section 12.
- **Unités** : hauteurs d'eau en **mm** ; volumes en **m³** ; débits de matériel en **mm/h** ; débits de pompe en **m³/h** ; températures en **°C** ; rayonnement en **MJ/m²/jour** ; RFU en **mm par mètre de sol (mm/m)** ; dates `AAAA-MM-JJ` en heure de **Europe/Paris** ; semaine du **lundi au dimanche**.
- **Conversions** (`lib/domain/units.ts`, seul endroit autorisé) : `1 mm sur 1 m² = 1 L` ; `m³ = mm × m² / 1000` ; `mm = m³ × 1000 / m²` ; `mm = mm/h × secondes / 3600` ; `secondes = mm / (mm/h) × 3600`.
- **Principes qui valent partout** : une donnée inconnue reste `null` et **n'est jamais comptée pour zéro** (D-003) ; observé / estimé / prévu ne se mélangent pas (D-006) ; le module **informe, le maraîcher décide** (D-028) ; les réglages sont des **révisions datées** (la plus récente en vigueur à la date du jour fait foi ; à date égale, la dernière enregistrée).
- **Ce que le module ne fait pas** : il ne pilote aucun matériel ; l'ET0 **n'entre pas** dans le besoin hebdomadaire (D-010) mais dans l'ETM proposée, la jauge du sol et l'évaporation des réserves.

---

## 1. Ordre des calculs (vue d'ensemble)

1. **Météo journalière** (pluie, ET0, températures) par lieu : prévision J0 à J+14 + réanalyse des jours passés. → §2
2. **Objectif hebdomadaire** (mm) de chaque planche, saisi par le maraîcher (historique de révisions). → §3
3. **Besoin hebdomadaire** : objectif − pluie − irrigation, seuil, remplacement manuel, volume. → §4
4. **ETM par culture** puis par planche (proposition d'objectif, à côté, jamais automatique). → §5
5. **Réserve du sol** (jauge) : consomme l'ETM, la pluie, l'irrigation. Information seulement. → §6
6. **Matériel et surface mouillée** : mm/h → durée, volume, débit. → §7
7. **Ressource, réserve d'eau, pompe**. → §8
8. **Planning hebdomadaire** : place des créneaux selon besoin restant, réglages R2–R14, contraintes. → §9
9. **Pénurie** : partage du budget d'eau. → §10
10. **Alertes** (gel, séchage, aspersion) : lisent la météo et le plan de culture, ne modifient rien. → §11

Le recalcul tourne chaque matin après la synchro météo (06 h 15 Paris), à la demande, et sur événement (irrigation créée/terminée, pluie saisie, objectif changé, proposition refusée…).

---

## 2. Météo [CODE]

### 2.1 Sources
- **Prévision** : Visual Crossing (offre gratuite), journalier, `unitGroup=metric`, champs `datetime, precip, tempmax, tempmin, temp, dew, windspeedmean, solarenergy, elevation` (`lib/adapters/weather/visual-crossing-provider.ts`).
- **Réanalyse historique + géocodage** : Open-Meteo, champs `precipitation_sum`, `et0_fao_evapotranspiration` (`lib/adapters/weather/open-meteo-provider.ts`). Open-Meteo sert aussi de repli de prévision si la clé Visual Crossing manque.
- **Conservés en base** : pluie, ET0, température min/max prévues, énergie solaire. **Non conservés** : vent, humidité, rafales.

### 2.2 ET0 de prévision : FAO-56 Penman-Monteith journalière, calculée côté serveur
Fonction `calculateFao56Et0Mm`. Entrées : `temp` (moyenne), `tempmin`, `tempmax`, `dew` (point de rosée), `windspeedmean` (km/h), `solarenergy` (MJ/m²/j, utilisé comme Rs), `elevation` (m, **0 si absente**), latitude, jour de l'année. Si l'une des six mesures manque → ET0 = `null`.

```
e(T)        = 0,6108 · exp(17,27·T / (T + 237,3))          [kPa]
es          = (e(Tmax) + e(Tmin)) / 2
ea          = e(point de rosée)
Δ           = 4098 · e(Tmoy) / (Tmoy + 237,3)²
P           = 101,3 · ((293 − 0,0065·z) / 293)^5,26
γ           = 0,000665 · P
u10         = vent_km/h / 3,6                               [m/s]
u2          = u10 · 4,87 / ln(67,8·10 − 5,42)               [m/s]
dr          = 1 + 0,033·cos(2π·J/365)
δ           = 0,409·sin(2π·J/365 − 1,39)
ωs          = acos(clamp(−tan(φ)·tan(δ), −1, 1))
Ra          = (24·60/π)·0,0820·dr·(ωs·sin φ·sin δ + cos φ·cos δ·sin ωs)
Rso         = (0,75 + 0,00002·z) · Ra
Rns         = (1 − 0,23) · Rs
fcd         = 1,35 · clamp(Rs/Rso, 0,3, 1) − 0,35           (Rso ≤ 0 : rapport = 0)
Rnl         = 4,903e-9 · ((Tmax+273,16)⁴ + (Tmin+273,16)⁴)/2 · (0,34 − 0,14·√ea) · fcd
Rn          = Rns − Rnl
VPD         = max(0, es − ea)
ET0         = (0,408·Δ·Rn + γ·(900/(Tmoy+273))·u2·VPD) / (Δ + γ·(1 + 0,34·u2))
ET0 (mm/j)  = max(0, ET0), arrondie au centième
```
Notes : pas de terme de flux de chaleur du sol (G = 0, pas journalier) ; pas de pas horaire.

### 2.3 Pluie d'un jour (`lib/services/water-dashboard.ts`, `lib/domain/irrigation-needs.ts`) [CODE]
- **Pluie réelle d'un jour passé** : `pluviomètre saisi à la main` ▸ sinon `réanalyse` ▸ sinon `prévision enregistrée pour ce jour` (jour marqué « estimé ») ▸ sinon `0` (jour listé comme « manquant »). `effectiveActualRainMm = manualRainMm ?? reanalysisRainMm`.
- **Pluie d'un jour à venir** : prévision (jour inconnu : listé, compté 0 dans le besoin).
- **Aujourd'hui** appartient au « réel » : jamais compté aussi dans la pluie prévue (D-019).
- **Sous abri** (`Plot.mode === 'greenhouse'`) : pluie = 0.
- Pas de pluie utile, d'interception ni de ruissellement.

### 2.4 Bornes
- ET0 d'un jour admise dans l'ETM : `0 ≤ ET0 ≤ 12 mm/j` (hors bornes : le jour est « bloqué », la dernière valeur valide reste).

---

## 3. Objectif hebdomadaire [CODE] (`lib/domain/irrigation-needs.ts`, `objectiveForBed`)

- Saisi par le maraîcher en **mm/semaine**, à l'échelle ferme, parcelle, jardin ou planche. Révisions datées (une révision compte à partir de son jour de pose, D-034).
- **Objectif applicable à une planche un jour donné** : parmi les révisions en vigueur et qui s'appliquent à la planche, celle de **portée la plus précise** (planche 4 > jardin 3 > parcelle 2 > ferme 1) ; à portée égale, la plus récente. Une révision `cleared` (ou montant nul) retire l'objectif de cette portée.
- **Objectif de la semaine** = Σ sur les 7 jours de `montant_applicable / 7`. Un objectif posé en cours de semaine ne vaut donc que pour ses jours restants. Aucun jour couvert → objectif `null` (« non calculable »).

---

## 4. Besoin hebdomadaire [CODE] (`lib/domain/irrigation-needs.ts`)

Par planche, sur la semaine lundi→dimanche. `pluie réelle` = somme des jours ≤ aujourd'hui (règle §2.3) ; `pluie prévue` = somme des jours > aujourd'hui. Sous abri, les deux valent 0.

```
reste réel      = max(0, objectif − pluie réelle − max(0, irrigation réelle))
reste brut      = max(0, objectif − pluie réelle − pluie prévue − max(0, irrigation réelle) − max(0, irrigation planifiée))
besoin calculé  = 0 si reste brut < seuil d'exploitation, sinon reste brut
besoin effectif = remplacement manuel ?? besoin calculé
volume (m³)     = max(0, besoin effectif) × surface mouillée (m²) / 1000
déficit relatif = reste réel / objectif × 100   (objectif ≤ 0 → 0)
```
- `irrigation réelle` : irrigations `completed` ou `partially_completed` de la semaine, mm × fraction de la durée tombant dans la semaine.
- `irrigation planifiée` : mm restant à appliquer des irrigations planifiées, de maintenant à la fin de la semaine.
- Objectif `null`, ou pluie réelle/prévue `null` (en pratique non, voir §2.3) → résultat `null`, jamais 0.
- **Priorité** : `low | normal | high` (`normal` par défaut).
- **Agrégat d'un jardin** : mm = moyenne pondérée par la **surface de la planche** ; volumes additionnés ; un volume inconnu rend le total inconnu.
- **Seuil d'exploitation** (`minimum_need_threshold_mm`, `db/irrigation-need-repository.ts`) : réglable par l'exploitation ; **0 mm par défaut** (aucun reste n'est mis à zéro).
- **R2 n'est pas appliquée ici** : le besoin du tableau de bord déduit 100 % de la pluie prévue. R2 agit plus loin, dans le planning (§9.3) et la jauge (§6.4). `[ÉCART]` avec la description du 7/11 qui place `× R2` dans cette formule.

---

## 5. Besoin par culture et par stade : ETM [CODE]

Fichiers : `lib/domain/crop-water/etm.ts`, `kc.ts`, `stage.ts`, `reference.ts`, `proposal.ts`.

### 5.1 Formule
```
ETM(culture, jour) = ET0(jour) × K_abri × Kc(culture, stade, jour) × K_paillage × K_ombrage      [mm/j]
```
- **ET0 du jour** : jour passé → réanalyse (nature `reanalysis`), sinon prévision enregistrée (nature `estimated`) ; jour ≥ aujourd'hui → prévision (`forecast`) ; sinon **inconnue** (ETM `unknown`, jamais 0).
- **K_abri** : `1` en plein champ ; sous abri : dernière révision de l'abri en vigueur, sinon **0,8**. Réglable de **0,6 à 1** ; le calcul refuse hors de 0,5–1.
- **K_paillage** : **0,9** si la planche porte un paillage plastique pour la saison civile du jour, sinon 1.
- **K_ombrage** : `1` par défaut ; si l'option « ombrage » est activée et qu'un filet est posé ce jour : `√(1 − taux)` (taux de 0 à <1). C'est une **hypothèse**, étiquetée comme telle. Option désactivée par défaut.
- **Kc** : voir §5.2. Un Kc de 0 est un **arrêt d'irrigation avant récolte**, pas une anomalie.
- **Plusieurs cultures sur une planche** : l'ETM de la planche = **la plus élevée** des ETM. Planche sans culture à Kc : 0 ce jour-là. Engrais vert : état de surface, sans Kc (§6.6).
- **Objectif proposé de la semaine** = Σ des 7 ETM de la planche (lundi→dimanche), donné **à côté** de l'objectif saisi ; il n'entre dans le besoin que si le maraîcher l'**adopte** (révision ordinaire de la planche, arrondie à 0,1 mm, valable dès le jour d'adoption). Seule une proposition **complète** (aucun jour inconnu) s'adopte.
- **Garde-fous** : ETM > **8 mm/j** → alerte de cohérence ; proposition qui s'écarte de plus de **50 %** de l'objectif applicable → alerte d'écart (`objectif = 0` et proposition > 0 → alerte).

### 5.2 Kc
- **Sources** (une seule par culture de référence) : `criiam` (CRIIAM Sud, escalier ou calendrier), `fao56` (trapèze), `local` (saisie de la ferme). Jeu commun livré en base (`drizzle/0023_crop_water_need.sql`) : **19** cultures CRIIAM (17 légumes + artichaut et fraisier en deux types) et **13** cultures FAO-56 (32 en tout).
- **Escalier / calendrier** : Kc fixe par stade, sans interpolation.
- **Trapèze FAO-56** : `Kc_initial` pendant la phase initiale ; montée linéaire pendant le développement ; `Kc_mid` en pleine saison ; descente linéaire vers `Kc_end` pendant la dernière phase ; `Kc_end` jusqu'à la récolte. **Coefficient d'abattement** (1 proposé, ]0 ; 1]) multiplie les Kc FAO, **pas** les surcharges de la ferme.
- **Surcharge de Kc par la ferme** : remplace la valeur de la source à partir de son jour (la plus récente par jour d'effet puis d'enregistrement), sans réécrire le passé ; valeur d'origine conservée. Bornes de Kc : 0 à 1,3.
- **Lissage** (option, désactivée par défaut) : sur **5 jours** après un changement de stade, `Kc = Kc_avant + (Kc − Kc_avant) × (j+1)/5` ; jamais vers un Kc de 0.

### 5.3 Stade
- Calculé depuis le « jour 0 » (lundi de la semaine d'implantation), le délai de levée et des durées par défaut ; ancrages possibles : `implantation +n j`, `levée +n j`, `J-n avant la récolte`, `première récolte`, `mi-récolte` ; jeux de dates par mois d'implantation. **Ou déclaré** par le maraîcher (un stade déclaré recale les suivants selon leur ancrage). Cultures pluriannuelles : calendrier `MM-JJ`.
- Une culture sans culture de référence reste sur la planche du premier jour à la dernière récolte, sans ETM.
- Détail des durées par défaut et des jeux de saison : **non relu ici** (voir `reference.ts`, `stage.ts` et les lignes du jeu commun de la migration 0023) `[CONTRAT]`.

---

## 6. Réserve du sol (jauge) [CODE]

Fichiers : `lib/domain/soil-reserve/{soil,rooting,gauge,bare-soil,water-surplus}.ts`. **Information seulement** : ne change ni besoin, ni priorité, ni dose, ni plan (D-047).

### 6.1 Sol
```
RFU du sol (mm/m) = round( RFU labo × (1 − cailloux% / 100) )        (cailloux non renseignés : 0 %, mention affichée)
exemple : 62 mm/m, 18 % de cailloux → 51 mm/m
```
- Saisie par parcelle ; un jardin ou un abri peut avoir sa valeur propre, qui prime. Révisions datées.
- Avertissement (non bloquant) si RFU labo > **200 mm/m**. Cailloux : 0–99 %.
- Valeurs de départ d'une parcelle : **part de référence = 2/3**, **TEW = 14 mm**, **REW = 7 mm**, **Ze = 10 cm** (limon sableux). Contrainte : `0 < REW < TEW`.
- Plafond de profondeur de sol (m) optionnel, borne la profondeur racinaire.

### 6.2 Profondeur racinaire et part utilisable p
- Par culture de référence : `p` (FAO-56, tableau 22 ; **0,5 si absent**) et une profondeur par stade, fixe ou **progressive** : `profondeur = début + (fin − début) × min(1, jours / jours_progression)`.
- Sans profil ni ligne pour le stade : **0,30 m proposés**, avec avertissement. Profondeur ≤ 3 m.
- Plusieurs cultures : **la moins profonde** fixe la capacité, **le plus petit p** fixe le seuil.

### 6.3 Capacité, seuil
```
capacité (mm)  = RFU du sol (mm/m) × min(profondeur racinaire, plafond de sol) (m)
seuil (mm)     = capacité × (1 − min(1, p / part de référence))          [mode « selon la culture », défaut]
               = capacité × X %                                            [mode « seuil de la ferme », X de 20 à 80 % par pas de 5, 50 % proposé]
```
(Le « seuil » est le niveau de la jauge en dessous duquel l'information « à arroser » apparaît.)

### 6.4 Bilan quotidien d'une planche cultivée
```
état(j) = min(capacité, max(0, état(j−1) + pluie + irrigation − consommation))
drainage = max(0, état(j−1) + pluie + irrigation − consommation − capacité)
consommation = ETM de la planche (§5)
pluie comptée = pluie extérieure × (R2 si prévision) × (part de pluie sous paillage plastique, 1 par défaut) ; 0 sous abri
```
- `R2` = part de la pluie prévue retenue (réglage du planning, **100 %** par défaut).
- Un changement de capacité (nouveau stade, nouvelle culture) **conserve le % du plein**.
- **Observation** du maraîcher (% du plein, la plus récente du jour prime) : recale l'état ; le jour de l'observation ne compte que **au prorata des heures restantes** (`fraction = (fin du jour − heure d'observation)/(durée du jour)`, 23 à 25 h aux changements d'heure) ; l'irrigation n'est comptée qu'après l'observation.
- **Jauge inconnue** au départ et après tout trou de données (pluie, ET0 ou ETM manquants) ; elle **repart** à la fin d'un jour dont les apports (pluie + irrigation) remplissent la planche (`apports ≥ capacité`). Estimée avant aujourd'hui, prévue ensuite.
- Irrigation en intervalles `[début, fin]` en mm sur la surface mouillée, répartie **au prorata de la durée** dans chaque jour.

### 6.5 Sol nu (planche sans culture) : FAO-56 chapitre 7 simplifié, deux compartiments
```
RFU surface   = RFU du sol × min(Ze, profondeur de référence)
RFU profonde  = RFU du sol × (profondeur de référence − Ze)+
capacité      = RFU surface + RFU profonde
jauge         = max(0, RFU surface − De) + réserve profonde            (De = épuisement de surface)
Kr            = 1 si De_veille ≤ REW, sinon max(0, (TEW − De_veille) / (TEW − REW))
E (évaporation) = min( part_état × Kr × 1,2 × ET0 × K_abri × fraction ; TEW − De_veille )          (Kc_max = 1,20, FAO-56 éq. 72)
apports d'abord à la surface (réduisent De), l'excédent va à la réserve profonde, au-delà de sa RFU : drainé
```
- Profondeur de référence : premier stade de la **prochaine culture connue** de la planche, sinon **0,30 m**.
- **États de surface** et leurs coefficients (réglables, révisions datées) :
  - `bare` (nue) : part d'évaporation 1 ; `impermeable-tarp` : évaporation 0 **et pluie 0** ; `permeable-tarp` : évaporation × **0,10** ; `mulched` (paille, foin, BRF) et `green-manure-destroyed` : × **0,50**.
  - Couverts (un seul compartiment de 30 cm, consommation `ET0 × K_abri × Kc`) : engrais vert levée **0,3**, couverture partielle **0,6**, totale **1,0** ; enherbée (`grass`) **0,6** (sans seuil). Engrais vert : seuil avec p = 0,5.
  - Bornes des Kc de couvert : 0 à 1,3.
- État de surface : dernière déclaration depuis la fin de la dernière culture ; sinon engrais vert levé si une série d'engrais vert occupe la planche, sinon `bare`.
- À la dépose d'une bâche imperméable, une surface restée humide (`De ≤ REW`) repart mouillée (`De = 0`).

### 6.6 Pastille « eau arrosée en trop » (`water-surplus.ts`)
Sur les **7 derniers jours passés** (jusqu'à hier) : `drainage_irrigation(jour) = drainage × irrigation / (pluie + irrigation)` ; cumul par planche (ignoré sous **0,1 mm**) ; volume = mm × surface mouillée / 1000 réparti au prorata ; jauge ou pluie inconnue ce jour-là → la planche est dite « à part », jamais comptée 0.

---

## 7. Matériel, surface mouillée, durée [CODE] (`lib/domain/irrigation-calculations.ts`, `irrigation-timer.ts`)

- **Types** : `drip` (goutte-à-goutte) : **un taux uniforme en mm/h** ; `sprinkler` (aspersion) : **deux profils** « distance → mm/h » (gauche, droite).
- **Taux d'une planche en aspersion** = interpolation **linéaire** du profil à la **distance du centre de la planche** `(début + fin)/2` ; au-delà du dernier point : 0 ; distance négative ou invalide : 0 ; points invalides ignorés. Les passe-pieds, l'ordre physique des planches et la distance entre jardins alignés entrent dans le calcul des distances. Plusieurs matériels sur la même planche : apports **cumulés**.
- **Hauteur apportée** = `mm/h × durée_min / 60` (0 si négatif ou non fini).
- **Durée pour une cible** : `max(1, round(mm / (mm/h) × 3600))` secondes (0 si cible ou taux ≤ 0).
- **Débit en L/h** d'une planche = `mm/h × surface (m²)` (surface ≤ 0 → 0) ; **débit demandé à la pompe (m³/h)** = Σ des planches de `mm/h × surface mouillée / 1000` ; **`null` dès qu'une surface mouillée est inconnue**.
- **Surface mouillée** (D-022) :
  - goutte-à-goutte : surface de la planche ;
  - aspersion : `surface planche + longueur × largeur du passe-pied` ; passe-pied inconnu ou négatif → **inconnue** (jamais 0, jamais la planche seule) ;
  - plusieurs matériels : celle du matériel d'aspersion si présent, sinon la planche ; aucun matériel : la planche (`bed-only`).
  - La **surface de la planche** (`Bed.area`) reste celle qui pondère les mm.
- **Calculateur de saisie** (mm/h depuis le catalogue) : contrat écrit, **rien codé**.

---

## 8. Ressources, réserves d'eau, pompes [CODE] (`water-resources.ts`, `pumps.ts`, `resource-flow.ts`)

- **Ressource** : débit nominal (m³/h), état, période de disponibilité, **limite de prélèvement en m³/jour** historisée (la plus récemment créée en vigueur).
- **Potentiel d'une ressource sur un segment de jour** = `min(débit nominal × heures du segment ; max(0, limite journalière − déjà prélevé))` ; 0 si inactive ou hors période.
- **Réserve** : capacité, minimum de sécurité, surface exposée, volume observé (peut être inconnu).
  - `mobilisable = max(0, volume − minimum de sécurité)` (inconnu si volume inconnu).
  - pluie sur réserve (m³) = `mm × surface exposée / 1000` (0–10 000 mm ; surface 0–100 000 000 m²).
  - évaporation (m³) = `ET0 (mm) × surface exposée / 1000 × coefficient` (coefficient 0–100, réglage de la réserve).
  - mouvement : `volume' = min(capacité, max(0, volume + delta))` ; débordement = `max(0, brut − capacité)` ; manque = `max(0, −brut)`. Mouvements append-only.
  - projections à 24 h, 48 h, 7 jours ou date choisie.
- **Pompe** : **une seule contrainte, le débit maximal (m³/h)** ; simultanéité = débits **additionnés par segment de temps** sur la même pompe ; refus si capacité dépassée, pompe archivée ou origine indisponible. Pression, perte de charge, nombre de vannes simultanées : **non modélisés**.
- **Faisabilité** : compare le besoin au stock mobilisable, aux limites journalières et aux apports `[CONTRAT]` (non relue ligne à ligne).

---

## 9. Planning hebdomadaire [CODE] (`lib/domain/planning/*`)

Fonction pure et **déterministe** (mêmes entrées, même plan). Le moteur propose des créneaux ; le maraîcher valide ; il n'arrose rien.

### 9.1 Réglages (valeurs de départ, `settings.ts`, D-024)
| Code | Sens | Défaut |
|---|---|---|
| R2 | part de la pluie prévue déduite du besoin (0–1) | **1** |
| R3 | pluie prévue (mm/jour) au-dessus de laquelle on place après la pluie | **5** |
| R4 | dose minimale par arrosage | aspersion **5 mm** · goutte **3 mm** |
| R5 | dose maximale par arrosage | aspersion **15 mm** · goutte **10 mm** |
| R6 | arrosages par jour civil et par planche | **1** (1 à 24) |
| R7 | espacement de début à début | **1 jour** (0 à 7) |
| R8 | plage horaire (heure de Paris, peut passer minuit) | aspersion **21 h → 8 h** · goutte **6 h → 22 h** |
| R9 | conduite en pénurie | `priority-then-equal-share` |
| R10 | report du déficit sur la semaine suivante | **non** |
| R11 | dose d'un matériel collectif | `highest-need` |
| R12 | matériel préféré quand deux arrosent la même planche | **goutte-à-goutte** |
| R13 | part du débit le plus fort sous laquelle une planche ne « commande » pas | **0,5** |
| R14 | tolérance avant « en retard » | **30 min** |

### 9.2 Besoin restant à placer (`demand.ts`, `remainingNeedExcludingMm`)
```
si remplacement manuel :  restant = max(0, manuel − planifié)
sinon :                    brut = reste brut du §4 (recalculé si on exclut du planifié)
                           ajusté = brut + (1 − R2) × pluie prévue   (0 sous abri)
                           restant = 0 si max(0, ajusté) < seuil, sinon max(0, ajusté)
objectif null et pas de manuel → planche non planifiable
```

### 9.3 Quand
- **Pas avant** : l'instant du calcul ; ou le **lendemain du dernier jour de pluie prévue > R3** (sauf s'il ne reste alors aucun jour : on arrose avant la pluie ; sous abri ou R3 ≤ 0 : sans attente) ; puis `début d'un arrosage connu + R7`.
- **Plages** : R8 transposée en instants sur les jours restants, bornée par « pas avant » et la fin de dimanche ; une plage passant minuit appartient au jour où elle commence ; les créneaux **refusés** de la semaine sont retirés.
- **Répartition « au plus tôt »** dans la plage.

### 9.4 Combien (`engine.ts`, `nextCandidate`)
- Matériel d'une planche : parmi ceux qu'elle **commande** (`taux ≥ R13 × taux le plus fort`), la nature préférée R12 si présente, puis le taux le plus fort, puis le nom.
- Planche de référence d'un matériel collectif : celle au **taux le plus élevé** ; à égalité, besoin restant le plus élevé (R11 `highest-need`) ou le plus faible (`lowest-need`).
- `dose = restant de la référence`, plafonnée à R5 (raison `maximum-dose`). **Aucune planche arrosée ne reçoit plus de R5** (la durée est réduite si une autre planche du matériel dépasserait).
- Sous R4 (− 1e-9) : le créneau **attend que le besoin grandisse**, **sauf le dernier jour** (raison `last-day-below-minimum`).
- `durée = max(1, round(dose / taux_référence × 3600))` s. Durée minimale acceptée = `ceil(R4 / taux × 3600)` s (1 s le dernier jour).
- Reste sous **0,01 mm** = résidu d'arrondi, pas un besoin.

### 9.5 Ordre de service
`priorité (high > normal > low)` ▸ **déficit relatif le plus fort** (`besoin / objectif`, objectif ≤ 0 mais besoin > 0 → 1) ▸ nom ▸ identifiant. Un arbitrage de pénurie validé prime.

### 9.6 Contraintes opposables (liste fermée)
1. limite journalière (jour civil par jour civil) ; 2. limite de prélèvement par ressource ; 3. minimum de sécurité d'une réserve (projection heure par heure, bornée par la capacité) ; 4. débit maximal de pompe (le créneau est décalé ou raccourci pour tenir dans le trou) ; 5. origine indisponible ; 6. plage horaire.
**Ne sont pas des contraintes** : ET0, pluie prévue (sauf R3 pour le « pas avant »), seuil.
Quand une limite coupe le créneau : `durée' = floor(durée × volume_permis / volume)` ; en dessous de la durée minimale, le créneau est bloqué ce jour-là et un autre jour est tenté.
- Jusqu'à **4 tours** de répartition des parts (`MAX_SHARE_ROUNDS`) ; 10 000 itérations au plus.
- Chaque proposition porte sa justification (`justification.ts`).

---

## 10. Pénurie et arbitrage [CODE] (`shortage.ts`, `shares.ts`)

Par origine d'eau (réserve ou ressource directe) :
```
budget  = min(eau disponible (réserve mobilisable ou budget de la ressource), limite journalière restante)
demande = Σ volume du besoin de chaque planche (mm × surface mouillée du matériel / 1000), par priorité
si demande > budget :
  equal-share                : fraction = budget / demande pour toutes les priorités
  priority-then-equal-share  : high servi d'abord, puis normal, puis low, chacun min(1, budget restant / demande du niveau)
  defer                      : servir dans l'ordre de service jusqu'à épuisement ; les autres → cible 0, raison 'deferred'
cible d'une planche = besoin × fraction de sa priorité
```
- Motif de la coupe : `daily-limit` si la limite journalière laisse moins que l'eau, sinon `water-budget`.
- La **part attribuée est réservée** à la planche (D-037) : un créneau ne prend que ce que ses parts paient ; les parts non reçues sont libérées et redistribuées en fin de tour.
- Un **arbitrage manuel** non vide (m³ par planche) remplace ce calcul : `cible = min(besoin, m³ alloués → mm via la surface mouillée)`.
- Surface mouillée inconnue : volume traité comme 0 dans ce calcul de parts `[ÉCART possible]` avec « jamais 0 » ailleurs ; à confirmer dans `shortage.ts` (`volumeOf`).

---

## 11. Alertes [CODE] (`lib/domain/crop-alerts/*`, `lib/domain/weather/weather-alerts.ts`)

Information seulement (D-010, D-028).

- **Gel par culture** : `seuil d'alerte = dégâts + marge + décalage microclimat`.
  - marge = **3 °C** si `dégâts ≥ −2 °C` (sensible), **2 °C** sinon (rustique) ;
  - décalage microclimat par exploitation : **−5 à +5 °C, pas de 0,5, défaut 0** ;
  - seuil de dégâts saisissable de −30 à +10 °C ; jeu commun d'après une fiche FRAB AuRA (« début de dégâts de gel »), **un seul seuil par culture, stades ignorés** ;
  - alerte quand la **minimale prévue la plus récente** du jour ≤ seuil, sur un **horizon de 3 jours par défaut** (aujourd'hui compris) ; une alerte par version du sujet et jour visé (pas de répétition) ; le curseur n'entre pas dans la clé de répétition.
  - Priorité du seuil : exception de la série ▸ espèce ; seuil de la ferme ▸ seuil du jeu commun. Espèce sans rattachement : pas de seuil.
- **Séchage avant récolte** : `date d'arrêt = lundi de la première semaine de récolte attendue − délai de séchage` (délai 1–60 j) ; alerte ce jour-là, ou le premier matin qui la voit si elle est passée et la récolte pas commencée ; une fois par série ; pas d'échéance si une semaine de récolte est déjà réalisée.
- **Aspersion à reconsidérer** : créneau d'**aspersion**, sur au moins une planche **sous abri**, qui **commence entre lever et coucher du soleil** ; signalé si la maximale prévue du jour < **24 °C** (défaut) **ou** si le rayonnement moyen du jour < **400 W/m²** (défaut), avec `rayonnement = énergie solaire (MJ/m²) × 1 000 000 / durée du jour (s)`. Durée du jour par FAO-56 (équations 24, 25, 32, 34).
- **Alertes météo libres** : critère = champ (températures min/max, pluie), sens, seuil, horizon 1 à 7 jours `[CONTRAT]` (fichier `weather-alerts.ts` non relu ligne à ligne).

---

## 12. Écarts constatés entre le code et la description du 7 novembre 2026

1. **R2 et le besoin hebdomadaire** : la description place `× R2` dans le « reste à planifier » ; dans le code, `buildIrrigationNeedsDashboard` déduit **100 %** de la pluie prévue, et R2 n'agit que dans le **planning** (`demand.ts`, qui rend `(1 − R2) × pluie prévue`) et la **jauge** (pluie prévue × R2).
2. **Données météo conservées** : la description oublie l'**énergie solaire** (conservée, utilisée par l'alerte d'aspersion).
3. **Aspersion à reconsidérer** : la description dit « ciel couvert ou temps frais » ; le code ajoute les conditions **sous abri** et **créneau de jour**, et fixe les seuils par défaut à 24 °C et 400 W/m².
4. **Paillage plastique** : la description le décrit à la fois sur l'ETM (×0,9) ; c'est exact, mais il porte aussi un **second réglage** distinct : la part de pluie comptée sous paillage (défaut 1) dans la jauge.
5. **Valeurs que la description citait « d'après le contrat, code non relu »** et qui sont maintenant relues : K_abri 0,8 (0,6–1), paillage 0,9, ombrage `√(1 − taux)`, seuil `capacité × (1 − min(1, p/part de référence))`, part de référence 2/3, Kc max sol nu 1,2, TEW 14 / REW 7 / Ze 10 cm, R2–R14 — tous **confirmés**.
6. **Point à vérifier** : en pénurie, un volume de planche dont la surface mouillée est inconnue compte **0** dans `shortage.ts` (`volumeOf`), alors que la règle générale est « inconnu, jamais zéro ».

---

## 13. Ce qui n'est pas relu dans ce fichier (à compléter au fil des mises à jour)

Durées de stade par défaut et jeux de saison (`reference.ts`, `stage.ts`, migration 0023) ; correspondance espèce → culture de référence (`species.ts`) ; chaînes d'approvisionnement et projection des réserves heure par heure (`supply.ts`, `chains.ts`, `projectWaterAvailability`) ; suggestions « Réduire / Annuler » (`suggestions.ts`) ; suivi par série ; export CSV ; alertes météo libres. **Aucun test n'a été relancé** pour ce fichier : il décrit le code lu, pas un comportement mesuré.

**Pas dans le moteur** : pilotage d'électrovannes (contrat écrit, rien codé), capteurs (aucun lu), pluie utile, interception, vent, maladies.

---

## 14. Journal des changements de ce fichier

| Version | Date | Qui | Ce qui change |
|---|---|---|---|
| 1.0 | 2026-11-07 | Claude (module OTF) | Première version : formules relues dans le code au commit `64c2e87` ; écarts avec la description du 7/11 listés au §12. |

*Règle de mise à jour proposée : toute modification incrémente la version, ajoute une ligne ci-dessus (date, qui, quoi, commit du code relu), et ne change une formule qu'après relecture du fichier de code cité.*
