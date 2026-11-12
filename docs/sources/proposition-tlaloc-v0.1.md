# Moteur hydrique commun : comparaison de Tlaloc et du module OTF, et méthode d'unification

Version 0.1, 7 novembre 2026. Rédigé côté Tlaloc à partir de deux sources :

- **Côté Tlaloc** : le code de la v183 et l'état de la v186 (relevés au poing lus en fourchette, consommation apprise), décrits dans « Description de Tlaloc » et dans les notes de version v184 à v186.
- **Côté module OTF** : le document « Moteur de calcul hydrique du module d'irrigation OTF » v1.0 (commit 64c2e87), tel que François l'a transmis. Je n'ai pas lu son code. Ce que je dis de son moteur vient de ce document, avec ses propres marques [CODE] et [CONTRAT].

---

## 1. Ce qu'on unifie

Je propose d'unifier **le moteur hydrique**, et lui seulement. Il fait :

- la consommation des cultures (ETM) ;
- l'état du sol jour par jour, et heure par heure dans la journée ;
- le drainage et l'eau perdue ;
- les recalages par les observations ;
- la projection sur les jours à venir.

Chacun garde **sa couche de décision** : le planning hebdomadaire et les réglages R2 à R14 côté OTF ; le fond, le plan du jour et les contraintes Solem côté Tlaloc. Les deux philosophies de décision sont trop différentes pour être fusionnées utilement :

- le module OTF part d'un objectif hebdomadaire saisi, et sa jauge reste une information ;
- Tlaloc décide à partir de la réserve.

Elles peuvent en revanche s'appuyer sur le même moteur : il calcule, et chaque logiciel décide.

```
Données (chacun ses fournisseurs)          Moteur commun                         Décision (chacun la sienne)
météo jour/heure + nature    ──┐
cultures, stades (OTF)       ──┼──>  ETM → bilan du sol → état ± incertitude  ──>  OTF : planning hebdo, pénurie
sol, couverts, matériel      ──┤        drainage, eau perdue, projection           Tlaloc : fond, plan du jour, Solem
arrosages réalisés/prévus    ──┤
observations (poing, % plein,  ┘
tensiomètre)
```

L'ET0 et la ressource en eau (réserves, pompes) restent en dehors du cœur :
- l'ET0 est une **donnée d'entrée** (chacun garde son fournisseur et sa méthode), avec sa nature ;
- la ressource peut devenir un second module commun, plus tard.

---

## 2. D'abord le vocabulaire : un même mot ne veut pas dire la même chose chez nous deux

C'est le point le plus urgent : sans lui, toute comparaison de chiffres est fausse.

| Notion | Tlaloc | Module OTF | Proposition commune |
|---|---|---|---|
| Valeur du sol saisie (mm/m) | « eau utile » θu = **réserve utile** RU (TAW FAO), 80 à 180 mm/m selon 4 textures | « **RFU** du sol », mesure de labo, × (1 − cailloux), part de référence 2/3 | Garder **les deux noms au sens agronomique français** : RU (capacité au champ − point de flétrissement) et RFU = part facilement utilisable. Saisie au choix ; conversion RU = RFU / part de référence. |
| Capacité du réservoir suivi | RU × zr (tout le TAW) ; la courbe descend sous 0 % de réserve facile jusqu'au sol sec | RFU × min(zr, plafond) : le tiers bas du TAW n'est pas suivi, la jauge s'arrête à 0 | Suivre **tout le TAW** (on voit le stress profond), et afficher en plus la jauge « RFU » d'OTF, qui en est une vue. |
| Part facile p | tableau 22 FAO, ajusté chaque jour : p = clamp(p_tab + 0,04 × (5 − ETc), 0,1, 0,8) | tableau 22 FAO (0,5 par défaut), fixe | Garder l'ajustement FAO (éq. de la note du tableau 22) comme **option**, désactivée pour retrouver OTF. |
| Seuil « à arroser » | quand il reste moins de X % de la RAW (50 % par défaut) | quand la RAW est consommée (mode « selon la culture »), ou X % de la capacité (mode ferme) | Un seul seuil exprimé **en % de la RAW restante** ; OTF « selon la culture » = 0 %, Tlaloc = 50 %. Les deux restent possibles. |
| Jour | journée de Paris, événements à l'heure (pluie vers 15 h sans pluviomètre, arrosages à l'heure des blocs) | journée de Paris, prorata horaire pour les observations et les arrosages | Journée de Paris, **événements horodatés** (le journalier d'OTF est un cas particulier). |
| Donnée inconnue | ETc inconnue comptée 0 ce jour-là (point faible) ; trou → l'incertitude grandit (v184) | null, jamais 0 ; jauge inconnue jusqu'à un jour qui remplit la planche | **Null jamais 0** (règle OTF D-003), avec l'incertitude de Tlaloc : un trou élargit la fourchette au lieu de rendre la jauge inconnue pour des jours. |
| Nature des valeurs | ETP « mesurée / calculée / prévue », passé et prévision séparés à l'affichage | observé / estimé / prévu, jamais mélangés (D-006) | Chaque valeur porte sa nature (règle OTF). |

---

## 3. Bloc par bloc : qui fait quoi, et ce que je propose

| Bloc | Tlaloc | Module OTF | Proposition |
|---|---|---|---|
| ET0 | FAO-56 Penman-Monteith **horaire** (G = 0,1 / 0,5 Rn), heures AROME/ARPEGE, station Météo-France pour le passé, 5 modèles comparés | FAO-56 Penman-Monteith **journalière** (G = 0), Visual Crossing, réanalyse Open-Meteo pour le passé ; bornes 0 à 12 mm/j | Hors du cœur : entrée « ET0 du jour + nature ». Reprendre les **bornes** d'OTF. Le calcul horaire de Tlaloc peut être offert en option du côté des données. |
| Pluie utile | interception 2 mm/j, ruissellement 50 % au-delà de 15 mm/h ; prévue 50 % − 2 mm, ou 80 % du plus faible des modèles − 1 mm si sûre | aucune règle (pluie brute) ; R2 = part de pluie prévue (1) ; part sous paillage | Une **fonction paramétrée** : interception, seuil et part de ruissellement, part de la prévue, règle « pluie sûre », part sous paillage. Les réglages d'OTF (tout à 0 et R2 = 1) et ceux de Tlaloc en sont deux jeux. |
| ETM | ET0 × Kc × 0,7 sous serre × (1 − 10 %) sur toile pour les plants | ET0 × K_abri (0,8, de 0,6 à 1) × Kc × K_paillage (0,9) × K_ombrage (√(1 − taux), option) | **Prendre la structure d'OTF** (facteurs séparés, révisions datées). La toile de Tlaloc devient un K_paillage. Défaut de K_abri à trancher : 0,7 ou 0,8. |
| Kc | 2 valeurs par espèce (FAO tableau 12), montée linéaire de l'implantation au début de récolte, puis plateau ; pas de phase de fin | **CRIIAM Sud** (escalier ou calendrier, 19 cultures) ou **trapèze FAO** (Kc ini, montée, Kc mid, descente vers Kc end), lissage optionnel, abattement, surcharges datées, bornes 0 à 1,3 | **Prendre OTF** : sources CRIIAM et FAO trapèze, Kc end, stades par ancrages et déclaration du maraîcher, surcharges datées. C'est le point où Tlaloc est le plus faible (le banc v2 montre que l'erreur de Kc pèse plus que tout le reste). |
| Stades | dates OTF : semaine d'implantation, semaines de récolte réalisées sinon prévues | jour 0 = lundi de la semaine d'implantation, levée, durées par défaut, ancrages, stades déclarés, pluriannuelles en MM-JJ | Prendre OTF. Tlaloc garde son repli : la récolte réalisée prime sur la prévue. |
| Plusieurs cultures | Kc moyen pondéré par la surface dans un jardin ; la moins enracinée fixe zr | ETM de la planche = la plus élevée ; la moins profonde fixe la capacité, le plus petit p fixe le seuil | Les deux règles sont justes à leur échelle : **max sur une même planche** (association), **moyenne pondérée sur une unité de plusieurs planches** (vanne, jardin). Racines et p : même règle des deux côtés. |
| Sol | 4 textures, θu fixe, pas de cailloux, profondeur fixable par parcelle | RFU labo × (1 − cailloux), par parcelle avec exception jardin ou abri, révisions datées, plafond de profondeur | **Prendre OTF** (labo, cailloux, plafond, révisions), en gardant les 4 textures de Tlaloc comme valeurs par défaut quand il n'y a pas d'analyse. |
| Racines | zr linéaire de z0 (0,15 plant, 0,10 semis) à zmax (FAO tableau 22, borne basse, 60 cm max) au début de récolte | profondeur par stade, fixe ou progressive ; 0,30 m par défaut | Prendre la forme d'OTF (par stade) avec les valeurs de Tlaloc par défaut. |
| Sol nu, couverts | Kc = 0,4 | FAO-56 chapitre 7 à deux compartiments (TEW 14, REW 7, Ze 10 cm), états de surface (bâche, paillage, engrais vert, enherbé) | **Prendre OTF.** |
| Bilan dans la journée | événements à l'heure ; perte = arrosage qui arrive sur un sol plein ; projection 8 jours | bilan journalier ; drainage du jour réparti entre pluie et irrigation au prorata | **Garder Tlaloc** : l'heure compte. Un arrosage du matin et une pluie de l'après-midi ne perdent pas la même eau, et c'est ce qui a révélé le bogue des compléments du matin (32 → 5,7 m³ perdus sur le banc). |
| Arrosage compté | celui des programmes (Solem ne renvoie pas ce qui a vraiment coulé) | celui réalisé (terminé ou partiel), au prorata de la durée | Le moteur prend des **arrosages horodatés avec leur nature** (réalisé, programmé). Chacun lui donne ce qu'il a. |
| Observations | test du poing en 5 classes de RU lu **en fourchette** (filtre bayésien, erreur de lecture 8 points, prises groupées sur 60 min) ; tensiomètre converti en RFU ; consommation apprise par parcelle (× 0,6 à × 1,6) | observation « % du plein » qui recale l'état au prorata de l'heure | Garder **les deux types** : « % du plein » (précis) et « classe du poing » (fourchette), plus le tensiomètre. L'apprentissage de la consommation de Tlaloc est un plus à proposer. |
| Incertitude | écart-type sdR qui grandit avec la consommation depuis le dernier ancrage | jauge connue ou inconnue | Proposer **état ± incertitude** comme sortie standard. Ça évite les jauges « inconnues » pendant des jours après un trou de données. |
| Eau perdue | arrosage au-delà du manque, à l'heure ; jamais la pluie seule | part du drainage due à l'irrigation, sur les 7 derniers jours | Même notion, calcul à l'heure ; la répartition au prorata d'OTF en est l'approximation journalière. |
| Matériel | goutte-à-goutte : L/h ÷ espacement × lignes ÷ largeur de planche ; aspersion : uniforme sur la surface | goutte-à-goutte uniforme ; aspersion par **profils distance → mm/h** ; surface mouillée avec passe-pied | Hors du cœur (le moteur reçoit des mm par unité et par heure). Prendre les profils d'aspersion d'OTF si Tlaloc en a besoin un jour. |
| Ressource | nombre de vannes ouvertes à la fois seulement | ressources, réserves (pluie, évaporation, minimum de sécurité), pompes, limites journalières | Second module commun possible, venant d'OTF. |
| Gel | 3 classes de rusticité (1, −2, −6 °C), + 2 °C sous serre | seuil de dégâts par culture (fiche FRAB AuRA) + marge + décalage de microclimat | Hors du cœur, mais Tlaloc gagnerait à **prendre la table FRAB d'OTF**. |
| Unités et révisions | unités par habitude, réglages sans date | `units.ts` comme seul endroit de conversion ; réglages en révisions datées | **Prendre OTF.** |

---

## 4. Ce que Tlaloc devrait changer pour coller au moteur d'OTF

À confier au chat du moteur, qui travaille sur la v186. Classé par gain attendu, sans rien perdre de ce que Tlaloc fait de plus :

1. **Kc par stade à la manière d'OTF** :
   - trapèze FAO avec Kc end ;
   - tables CRIIAM Sud pour les légumes ;
   - stades par ancrages ;
   - stades déclarés par le maraîcher ;
   - surcharges datées ;
   - Kc = 0 pour le séchage avant récolte.
   C'est le levier le plus fort d'après le banc v2.
2. **Facteurs d'ETM séparés et datés** : K_abri, K_paillage (la toile de Tlaloc en devient un), K_ombrage en option.
3. **Sol** :
   - saisie labo en RU ou en RFU avec la part de référence ;
   - cailloux ;
   - plafond de profondeur ;
   - révisions datées.
   Les 4 textures actuelles restent les valeurs par défaut.
4. **Sol nu et couverts** selon FAO-56 chapitre 7 (deux compartiments, états de surface) à la place du Kc 0,4.
5. **Null jamais 0** :
   - une ET0 inconnue ne compte plus 0 ;
   - elle élargit l'incertitude ;
   - chaque valeur porte sa nature (observé, estimé, prévu).
6. **Observation « % du plein »** en plus du poing et du tensiomètre.
7. **Arrosages avec leur nature** (réalisé ou programmé), pour accueillir un jour les arrosages vraiment mesurés (capteur de débit, matériel maison).
8. **Gel** : table FRAB par culture, marge, décalage de microclimat.

**Ce que Tlaloc garde** et propose au moteur commun :
- les événements à l'heure dans la journée ;
- le suivi de tout le TAW, sous la réserve facile ;
- la pluie utile paramétrée et la « pluie sûre » à partir de plusieurs modèles ;
- l'ajustement journalier de p ;
- le poing lu en fourchette ;
- l'apprentissage de la consommation par parcelle ;
- le tensiomètre ;
- l'incertitude.

Côté décision, propre à Tlaloc : le fond, le plan du jour, les contraintes Solem et la semaine simulée.

---

## 5. Méthode de travail pour n'avoir plus qu'un moteur

Le principe : **un seul texte de référence, une seule implémentation, les mêmes cas de test**, et une décision écrite pour chaque écart.

**Étape 1. Le contrat du moteur (une semaine).**
- Un document versionné, sur le modèle de celui de François : variables, unités, valeurs par défaut, ordre des calculs, règles des données manquantes, une formule par ligne.
- Il commence par le glossaire de la section 2 de ce document.
- Chaque point de la section 3 y reçoit une **décision numérotée**, en reprenant la numérotation D-xxx d'OTF : on prend le comportement d'OTF, celui de Tlaloc, ou on en fait un paramètre avec deux jeux de réglages.
- Règle : quand les deux choix se défendent, on en fait un **paramètre**. Le moteur commun sait alors reproduire chacun des deux logiciels, ce qui permet de passer de l'un à l'autre sans rupture.

**Étape 2. Des cas de test partagés.**
- Une série de petits cas figés, en JSON : entrées (météo, culture, sol, arrosages, observations) et sorties attendues (ETM, état, drainage, eau perdue, jour par jour), chacun avec la décision qu'il illustre.
  - Exemples : un jour sans ET0 ; une pluie de 30 mm/h ; un arrosage le matin d'un jour de pluie ; une observation à 14 h ; un changement de stade ; une serre ; une association sur une planche.
- On les fait d'abord tourner dans **les deux moteurs actuels** : on mesure où ils divergent, avant toute ligne de code commune.

**Étape 3. Le banc commun de saisons rejouées** (la proposition de François et ma réponse) : mêmes saisons, même météo figée, mêmes indicateurs. Il mesure l'effet des choix du contrat sur une saison entière, alors que les cas de test vérifient seulement que le calcul est exact.

**Étape 4. Une seule implémentation.**
- Le module d'OTF est en TypeScript avec des fonctions pures dans `lib/domain`, déjà testées. C'est la meilleure base.
- Le moteur commun serait un dépôt à part (ou un dossier `lib/domain/hydrique`), sans dépendance, compilé en un fichier JavaScript autonome (`moteur-hydrique.mjs`).
- Tlaloc le charge tel quel dans la page, sans étape de construction sur l'hébergement OVH.
- Les apports de Tlaloc listés plus haut y sont écrits en TypeScript, avec leurs cas de test.

**Étape 5. Brancher Tlaloc dessus, par un adaptateur.**
- Tlaloc garde sa couche de décision. Les calculs de `cutValve`, `resvCurve` et `pjsStep` sont remplacés par des appels au moteur commun, derrière une fine couche qui traduit ses données (parcelles, blocs Solem, relevés).
- Vérification avec le banc de Tlaloc : avec le jeu de réglages « Tlaloc », les résultats doivent rester ceux d'avant à 1 % près ; puis on passe aux réglages communs et on mesure le changement.

**Étape 6. Gouvernance.**
- Version du moteur et journal des changements, comme celui de François.
- Toute modification passe par le contrat, puis les cas de test, puis le code, dans cet ordre.
- Une décision se prend à deux : les deux maraîchers pour le comportement, les deux développeurs pour la forme.
- Chaque logiciel affiche la version du moteur qu'il utilise.

**Ce qu'il faut pour commencer** :
- un dépôt commun (GitHub, celui d'OTF ou un nouveau) ;
- le glossaire validé à deux ;
- une première liste de 10 à 15 cas de test.
On peut faire tout le contrat et les cas de test avant de toucher à une ligne de l'un ou l'autre logiciel.

---

## 6. Points à trancher ensemble dès le départ

1. **RU ou RFU** comme valeur de sol de référence, et quelle part de référence par défaut (2/3 ?).
2. **Suivre tout le TAW** (Tlaloc) ou seulement la RFU (OTF) ?
3. **Seuil** : en % de RAW restante ? Défaut à 0 % (OTF) ou 50 % (Tlaloc) ?
4. **Pas de temps** : événements horodatés (Tlaloc) ou journalier au prorata (OTF) ?
5. **Pluie utile** : jeu de réglages par défaut (interception, ruissellement, part de la prévue).
6. **K_abri par défaut** : 0,7 ou 0,8 ?
7. **Incertitude** en sortie standard, ou état connu ou inconnu seulement ?
8. **Langage et dépôt** de l'implémentation commune.
9. Un point à vérifier côté OTF, signalé dans son propre document : en pénurie, un volume de surface mouillée inconnue compte 0 (`volumeOf`), contre la règle « jamais 0 ».
