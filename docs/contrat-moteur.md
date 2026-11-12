# Contrat du moteur hydrique commun : ébauche côté Tlaloc

Version 0.1.1, 8 novembre 2026 (0.1 du 7 novembre ; journal au § 12). Rédigée par Nicolas (Tlaloc) avec Claude, pour le dépôt commun.

**Ce que couvre cette ébauche** :
- le glossaire ;
- les conventions ;
- les entrées et sorties du moteur ;
- le bilan dans la journée ;
- tout ce que Tlaloc apporte au moteur commun : pluie utile, pluie sûre, part facile ajustée, observations au poing et au tensiomètre, incertitude, consommation apprise ;
- les jeux de réglages des deux logiciels ;
- 12 cas de test chiffrés.

**Ce qu'elle ne couvre pas** et qui revient au côté OTF : ETM et facteurs, Kc et stades (CRIIAM, trapèze FAO, ancrages), sol nu et couverts (FAO-56 chapitre 7), sol labo et cailloux, gel. Je n'y ai mis que ce qu'il faut pour que les deux parties s'emboîtent.

**Marques** :
- **[MC-nn]** : décision du moteur commun. MC-01 à MC-09 = points 1 à 9 de l'échange du 7 novembre 2026 (appelés « D-1 » à « D-9 » dans la v0.1) ; MC-10 et suivants : voir `contrat-moteur-partie-otf.md` ;
- **[PROPOSÉ]** : proposition de Tlaloc, à valider ;
- **[À TRANCHER]** : question ouverte.

Les formules sont celles de Tlaloc v184, réécrites en fonctions autonomes (pas de code copié). Les valeurs attendues des cas de test sont calculées par l'implémentation de référence (`docs/ref-tlaloc/ref-tlaloc.mjs` ; `node docs/ref-tlaloc/cas.mjs` écrit `cas/cas-tlaloc.json`) et vérifiées à la main.

---

## 1. Glossaire

| Terme | Définition | Unité |
|---|---|---|
| **RU** (réserve utile, TAW FAO) | Eau retenue entre la capacité au champ et le point de flétrissement, à portée des racines : RU = θu × zr. Valeur interne du moteur **[MC-01]** | mm |
| θu | Eau utile du sol par mètre de profondeur. Saisie directe, ou à partir d'une RFU de labo : θu = RFU_labo / part de référence **[MC-01]** | mm/m |
| **RFU de labo** (RFU du sol) | Part de référence × RU. Valeur saisie par OTF, fixe quelle que soit la culture ; c'est la capacité suivie et le plancher du jeu OTF (partie OTF, § 1) | mm/m, mm |
| **RAW** (réserve facilement utilisable de la culture, FAO-56) | Part de la RU que la culture prend sans stress : RAW = p × RU. Le mot « RFU » n'est plus employé dans ce sens | mm |
| p | Part facile, FAO-56 tableau 22 ; ajustée à la chaleur en option (§ 6) | sans unité |
| Part de référence | Rapport RFU de labo / RU supposé par une analyse de labo (2/3 côté OTF) | sans unité |
| **Manque Dr** | Eau qu'il faudrait pour ramener la zone racinaire à la capacité au champ. 0 = sol plein ; Dr = RU = point de flétrissement | mm |
| État, jauge | Eau disponible = RU − Dr. Exprimée en % de RU, en % de RAW (100 × (1 − Dr/RAW), peut être négatif ; c'est le « % de réserve facile » affiché par Tlaloc), ou en % du plein (à définir, § 7.2) | mm, % |
| **Plancher** | Manque au-delà duquel le moteur n'accumule plus le déficit. Aucun (Tlaloc) ou capacité suivie (OTF) **[MC-02]** | mm |
| ET0 | Évapotranspiration de référence du jour, **donnée d'entrée** avec sa nature | mm/j |
| ETM, ETc | Consommation de la culture : ET0 × facteurs × Kc (partie OTF) × facteur appris (§ 8) | mm/j |
| Pluie brute | Pluie mesurée ou prévue, avant toute réduction | mm |
| **Pluie utile Pe** | Pluie qui entre dans la réserve (§ 5) | mm |
| Pluie sûre | Pluie annoncée par tous les modèles disponibles (au moins 2), chacun ≥ 1 mm (§ 5.2) | — |
| Unité d'arrosage | Ce que le moteur suit : une planche (OTF) ou un jardin arrosé par une vanne (Tlaloc). Le moteur ne fait pas d'hypothèse de taille | — |
| Événement | Apport horodaté dans la journée : pluie, arrosage, observation | — |
| Drainage | Eau qui dépasse la capacité au champ au moment où elle arrive | mm |
| **Eau perdue** (arrosée en trop) | Part du drainage due à l'arrosage ; la pluie seule n'en produit jamais | mm, m³ |
| Observation | Information de terrain sur l'état : classe du test du poing, % du plein, tensiomètre | — |
| Incertitude | Écart-type de l'état estimé, en mm ou en points de RU (option, § 7.4) **[MC-07]** | mm, points |
| Nature | observé, estimé ou prévu, portée par chaque valeur (règle OTF D-006) | — |

---

## 2. Conventions

- **Unités** : hauteurs d'eau en mm ; volumes en m³ ; débits en mm/h ; durées en secondes dans le moteur. Les conversions se font en un seul endroit (règle OTF `units.ts`).
- **Temps** :
  - journée civile de Europe/Paris, de 23, 24 ou 25 h selon les changements d'heure ;
  - instants en ISO 8601 avec décalage ;
  - dans le moteur, un événement est placé par sa fraction de journée, f = (instant − minuit local) / durée du jour, de 0 à 1.
- **Inconnu** : une donnée inconnue reste null et n'est jamais comptée 0 **[MC-09]**. Ce que devient l'état après un jour inconnu : § 4.4.
- **Révisions datées** : un réglage ou une valeur de sol vaut à partir de sa date d'effet ; à date égale, le dernier enregistré (règle OTF).
- **Version du moteur** : chaque logiciel fige la version qu'il utilise, sans mise à jour automatique (demande d'OTF).

---

## 3. Entrées et sorties

**Entrées d'un pas de calcul (une unité, un jour)** :

| Entrée | Contenu |
|---|---|
| `jour` | date locale, durée du jour (h) |
| `et0` | mm, nature ; ou null |
| `etm` | mm, calculée par la partie OTF (ET0 × facteurs × Kc) ; ou null |
| `sol` | θu (mm/m), zr (m), p_tableau, plancher (mm ou null) |
| `pluie` | liste d'heures en mm (mesurée), ou un total du jour (modèle, placé à f = 15/24), ou prévision avec la liste des modèles ; nature |
| `arrosages` | liste {début, fin (instants), mm sur la surface de l'unité, nature : réalisé ou programmé} ; un arrosage qui chevauche minuit est réparti au prorata |
| `observations` | liste {instant, type (poing, pctPlein, tensio), valeur} |
| `abri` | vrai ou faux (sous abri : pluie nulle) |
| `reglages` | jeu de réglages (§ 9) |

**Sorties d'un pas** :
- Dr au soir (mm) et au moment de chaque événement ;
- pic (Dr minimal de la journée) ;
- drainage, dont eau perdue (mm) ;
- RU et RAW du jour ;
- incertitude (option) ;
- nature de l'état (observé s'il est ancré sur une observation du jour, estimé avant aujourd'hui, prévu ensuite) ;
- journal des ancrages (quelle observation a recalé, de combien).

La **projection** enchaîne les pas sur les jours à venir avec les natures « prévu ». Le seuil de décision reste hors du moteur **[MC-03]**.

---

## 4. Le bilan

### 4.1 Mode horaire (jeu Tlaloc) [MC-04]

Entre deux événements, la consommation est continue. À chaque apport, l'excès part sous les racines.

```
Dmax = RU                     si plancher = null
     = min(RU, plancher)      sinon
entre deux instants f1 < f2 :   Dr = min(Dmax, Dr + ETc × (f2 − f1))
à un apport de a mm (pluie utile ou arrosage) :
    excès = max(0, a − Dr)
    si arrosage : eau perdue += excès   ;   si pluie : drainage de pluie += excès
    Dr = max(0, Dr − a)
fin de journée :                Dr = min(Dmax, Dr + ETc × (1 − f_dernier))
pluie du modèle sans heure : un seul apport à f = 15/24
```

### 4.2 Mode journalier (jeu OTF) [MC-04]

```
brut = Dr_veille + ETc − Pe − I
drainage = max(0, −brut)
Dr = clamp(brut, 0, Dmax)
eau perdue = drainage × I / (Pe + I)
```

**Ce qui est identique et ce qui ne l'est pas (cas T02 et T12)** :
- Les deux modes donnent le même résultat tant qu'aucun apport n'arrive sur un sol plein dans la journée (T12).
- Sinon, ils divergent. Exemple T02 : 6 mm à 6 h sur un sol à 2 mm de manque.
  - En horaire : 2,8 mm perdus, Dr au soir 3,6 mm.
  - En journalier : 0 perdu, Dr au soir 0,8 mm.
- **[PROPOSÉ]** Le jeu OTF reste en journalier, défini exactement comme en § 4.2. Le point MC-04 (« cas particulier à résultats identiques ») veut alors dire : le moteur commun en mode journalier reproduit OTF à l'identique. Il ne veut pas dire que l'horaire et le journalier coïncident toujours.

### 4.3 Plancher [MC-02]

- Aucun (jeu Tlaloc) : on suit tout le RU ; sous la RAW, la courbe en % de RAW devient négative.
- OTF : plancher = capacité suivie (RFU de labo × profondeur). Une fois au plancher, le déficit n'est plus accumulé. La pluie suivante repart du plancher (cas T06 : 33 mm manquent encore après la pluie sans plancher, 17 mm avec).

### 4.4 Jour inconnu

- **Jeu OTF** (actuel) : l'état devient inconnu. Il repart à la fin d'un jour dont les apports remplissent l'unité (apports ≥ capacité), ou à une observation.
- **[PROPOSÉ] jeu Tlaloc** : la consommation du jour est prise égale à la moyenne des ETc connues des **3 derniers jours connus avant** le jour inconnu, jamais après **[MC-14]**, pour que le rejeu donne le même état que l'affichage en direct (nature « estimé »), et l'incertitude grandit de 0,5 × cette valeur (§ 7.4).
- Tlaloc compte aujourd'hui 0, ce qui est un défaut reconnu : il sera abandonné.

---

## 5. Pluie utile [MC-05]

### 5.1 Pluie mesurée (heure par heure)

```
P = Σ P_h
ruissellement = Σ_h max(0, P_h − seuil_ruiss) × part_ruiss
Pe = max(0, P − ruissellement − interception)          interception une fois par jour
sous abri : Pe = 0
```

Cas T04 : 2, 30 puis 3 mm → jeu Tlaloc 25,5 mm (7,5 ruisselés, 2 interceptés) ; jeu OTF 35 mm.

Chaque heure de pluie utile est un apport placé à son heure. Le coefficient Pe / P s'applique à chaque heure.

### 5.2 Pluie prévue

```
base = max(0, prévue × part_prévue − interception)
pluie sûre : au moins 2 modèles, tous ≥ 1 mm
Pe = max(base ; 0,8 × min(modèles) − 1)     si pluie sûre et regle_sure = vrai
   = base                                  sinon
```

Cas T05 : 8 mm prévus → jeu Tlaloc 2 mm si les modèles sont en désaccord, 3,8 mm s'ils sont d'accord ; jeu OTF 8 mm.

Le côté OTF ajoute la part de pluie sous paillage (multiplicateur, 1 par défaut) : à placer après Pe.

---

## 6. Part facile p ajustée à la chaleur [À TRANCHER]

```
p = clamp(p_tableau + 0,04 × (5 − ETc), 0,1, 0,8)        (FAO-56, note du tableau 22)
```

- Option ; désactivée, p = p_tableau (jeu OTF). Cas T07 : p_tableau 0,40 → 0,52 à 2 mm/j, 0,32 à 7 mm/j, 0,12 à 12 mm/j.
- Conséquence : la RAW change de taille d'un jour à l'autre. **Les compléments et les états se calculent en mm de manque, jamais en % de RAW additionnés.** C'est un bogue que Tlaloc a eu en v177.

---

## 7. Observations

### 7.1 Test du poing lu en fourchette (option, jeu Tlaloc)

L'observation dit : « la réserve utile est dans cette classe », avec une erreur de lecture. On la combine au calcul.

| Classe | Part de la RU (%) |
|---|---|
| Très sec | moins de 25 |
| Sec | 25 à 50 |
| Correct | 50 à 75 |
| Frais | 75 à 95 |
| Plein | 95 et plus |

```
u = état en % de RU ; calcul : um = 100 × (1 − Dr/RU), incertitude sdU (points de RU, § 7.4)
a priori :       w0(u) = exp(−½ ((u − um) / max(1, sdU))²)
vraisemblance :  pour chaque prise de classe [a, b] : Φ((b − u)/σ) − Φ((a − u)/σ)      σ = 8 points (erreur de lecture)
a posteriori :   w(u) = w0(u) × Π vraisemblances ;  grille u = 0 à 100 par pas de 0,5
μ = Σ w·u / Σ w ;  sd = √max(0,25, Σ w·u² / Σ w − μ²)
Dr = (1 − μ/100) × RU ;  incertitude après = sd
```

- **Prises groupées** : les relevés d'une même unité notés à moins de 60 min d'écart forment une seule observation, et leurs vraisemblances se multiplient.
- Cas T08 (classe Correct, incertitude 15 points) : un calcul à 60 % passe à 61,6 % ; un calcul à 40 % passe à 54,7 % (pas au centre de la classe, 62,5 %).
- Cas T09 (trois prises Correct, Correct, Sec) : 51,8 % ± 5,4.
- Sans l'option, le relevé remplace le calcul par le centre de sa classe (12,5, 37,5, 62,5, 87,5 ou 100 %), avec une incertitude de 0,15 × RU.

**Pourquoi** : sur le banc de Tlaloc (12 saisons d'été, Kc et RU faux de ± 20 %), remplacer par le centre de classe donne 19,9 % de jours sous le seuil et 60 m³ perdus. La fourchette avec 3 prises donne 11,5 % et 29 m³ ; un tensiomètre juste, 6 % et 13 m³.

### 7.2 Observation « % du plein » (jeu OTF) [À TRANCHER]

Elle recale l'état, avec le jour compté au prorata des heures restantes. Il faut décider à quoi se rapporte « le plein » :
- à la capacité suivie par OTF (RFU de labo × profondeur) ;
- ou à la RU.

**[PROPOSÉ]** Le moteur la reçoit en mm de manque (Dr), et chaque logiciel convertit depuis son affichage. Incertitude après : [À TRANCHER], par exemple 0,05 × RU.

### 7.3 Tensiomètre (jeu Tlaloc)

- Il recale l'état si sa mesure a moins de 12 h et qu'aucun relevé de terrain n'a moins de 48 h (le relevé a le dernier mot).
- Seuils par capteur : T_bas (frais), T_haut (à arroser), en kPa.

```
T < T_bas :           Dr = 0,2 × RAW × T / T_bas
T_bas ≤ T ≤ T_haut :  Dr = 0,2 × RAW + 0,8 × RAW × (T − T_bas)/(T_haut − T_bas)
T > T_haut :          Dr = 1,05 × RAW
incertitude après = 0,1 × RAW
```

Cas T11 : 30 kPa entre 10 et 60 → 10,4 mm. Cette correspondance est **à caler** sur des relevés (Watermark) : c'est le levier le plus fort d'après le banc v2.

### 7.4 Incertitude (option) [MC-07]

```
départ du calcul (14 jours avant aujourd'hui, Dr = 0,5 × RAW) :  sdR = 0,35 × RU
grandit avec la consommation cumulée depuis le dernier ancrage C :  sdU (points de RU) = √(sdR² + (0,2 × C)²) / RU × 100
après une observation : sdR = sd a posteriori (poing), 0,1 × RAW (tensiomètre), 0,15 × RU (poing sans fourchette)
```

Le coefficient 0,2 représente une erreur de Kc typique de ± 20 %. Tlaloc s'en sert pour signaler les **relevés utiles** : l'unité est près du seuil et l'incertitude est plus grande que l'écart au seuil. Ce signalement reste du côté de la décision.

---

## 8. Consommation apprise (option, jeu Tlaloc)

Quand un relevé au poing corrige le calcul, la consommation de l'unité est ajustée par un facteur kf.

```
ETc_utilisée = ETM × kf          (passé, aujourd'hui et projection)
après un relevé en fourchette, si un ancrage précède dans la fenêtre et que C > 2 mm :
  gain = 0,3 × max(0, 1 − (sd après / sd avant)²)
  kf ← clamp( kf × clamp(1 + gain × (Dr après − Dr avant) / C, 0,85, 1,18), 0,6, 1,6 )
```

- kf est gardé par unité avec sa date. Seuls les relevés postérieurs l'ajustent encore, pour ne pas compter deux fois le même relevé. Il se remet à zéro par le maraîcher.
- Cas T10 : le relevé T08 (calcul à 40 %, classe Correct, C = 20 mm) donne kf = 0,91.
- OTF ne l'expose pas : option du moteur, désactivée dans le jeu OTF.

---

## 9. Jeux de réglages

| Réglage | Jeu Tlaloc | Jeu OTF | Note |
|---|---|---|---|
| Pas de temps | horaire | journalier | MC-04 |
| Plancher | aucun | capacité suivie (RFU de labo) | MC-02 |
| Interception (mm/j) | 2 | 0 | MC-05 |
| Seuil de ruissellement (mm/h) | 15 | sans | MC-05 |
| Part ruisselée | 0,5 | 0 | MC-05 |
| Part de la pluie prévue | 0,5 | 1 (R2) | MC-05 |
| Règle de la pluie sûre | oui | non | MC-05 |
| Pluie du modèle sans heure | à 15 h | (journalier) | |
| p ajusté à la chaleur | oui | non | à trancher |
| Test du poing en fourchette | oui, σ = 8, prises 60 min | non | option |
| Observation % du plein | non | oui | à trancher |
| Tensiomètre | oui | non | |
| Incertitude | oui | non affichée | MC-07 |
| Consommation apprise | oui, 0,6 à 1,6 | non | option |
| Jour inconnu | consommation des voisins + incertitude | état inconnu jusqu'au remplissage | à trancher |
| K_abri par défaut | 0,7 | 0,8 (de 0,6 à 1) | MC-06, partie OTF |
| Bassinage court sous serre (≤ 10 min) | compté à 25 % | — | [PROPOSÉ] option |

---

## 10. Cas de test

Fichier : `cas/cas-tlaloc.json`. Chaque cas contient les entrées, la sortie attendue, la décision illustrée et une note. Ce sont les cas du côté Tlaloc ; le côté OTF ajoute les siens (Kc par stade, sol nu, couverts, paillage, ombrage, plancher en journalier).

| N° | Cas | Sortie attendue |
|---|---|---|
| T01 | Journée sèche, Dr0 5, ETc 4 | Dr 9 |
| T02 | 6 mm à 6 h, Dr0 2, ETc 4,8 | horaire : Dr 3,6, perdue 2,8 · journalier : Dr 0,8, perdue 0 |
| T03 | 20 mm de pluie utile à 15 h, Dr0 10, ETc 3 | Dr 1,13, drainage de pluie 8,13, eau perdue 0 |
| T04 | Averse 2, 30, 3 mm | Pe Tlaloc 25,5 (ruissellement 7,5) · OTF 35 |
| T05 | 8 mm prévus | Tlaloc 2 (désaccord) ou 3,8 (sûre) · OTF 8 |
| T06 | 6 jours secs puis 15 mm, RU 48, RFU de labo 32 | sans plancher : 48 puis 33 · plancher 32 : 32 puis 17 |
| T07 | p_tableau 0,40, ETc 2, 5, 7, 12 | 0,52 · 0,40 · 0,32 · 0,12 |
| T08 | Poing Correct, incertitude 15 | calcul 40 % → 54,7 ± 8,7 · 60 % → 61,6 ± 8,9 |
| T09 | Trois prises Correct, Correct, Sec, calcul 40 % | 51,8 ± 5,4 |
| T10 | Consommation apprise après T08, C = 20 mm | kf 0,91 |
| T11 | Tensiomètre 30 kPa (10–60), RAW 20 | Dr 10,4 · à 5 kPa : 2 · à 80 kPa : 21 |
| T12 | Journée sans débordement (I 5 à 6 h, P 3, ETc 4, Dr0 20) | horaire = journalier = 16 |

---

## 11. Points à trancher

1. § 4.2 : sens exact de « résultats identiques » (proposition : le jeu OTF en journalier reproduit OTF à l'identique).
2. § 4.4 : que devient l'état après un jour sans ET0 ou sans pluie connue (le jeu Tlaloc reste à valider ; « jours voisins » = avant seulement, MC-14).
3. § 6 : p ajusté à la chaleur, en option ou non.
4. § 7.2 : à quoi se rapporte « % du plein », et l'incertitude après cette observation.
5. § 7.3 : calage du tensiomètre (Watermark) sur des relevés.
6. Bassinages courts sous serre comptés en partie : dans le moteur (efficacité d'application) ou dans la décision.
7. ~~Ordre des apports à la même heure~~ : tranché, pluie d'abord puis arrosage **[MC-15]**.

---

## 12. Journal des changements

| Version | Date | Qui | Ce qui change |
|---|---|---|---|
| 0.1 | 2026-11-07 | Nicolas (Tlaloc), avec Claude | Ébauche. |
| 0.1.1 | 2026-11-08 | Nicolas (Tlaloc), avec Claude | Vocabulaire de la partie OTF § 1 : RU, RFU de labo, RAW (« RFU » n'est plus employé pour p × RU) ; numérotation MC-xx ; § 4.4 jours voisins = avant seulement (MC-14) ; § 11 point 7 tranché (MC-15) ; chemin des cas de test. **Aucune valeur de cas ne change.** |
