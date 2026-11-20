# Le moteur hydrique commun v0.2.0 : le bilan et les options de Tlaloc

20 novembre 2026. Côté OTF (François et Claude, MC-25), à relire par Nicolas. Le moteur de la phase 1 (MC-18) : le bilan de la réserve du sol jour après jour, la pluie utile, les observations, l'incertitude, le jour inconnu, la projection. Le pas d'un jour est celui de Nicolas (`src/pas-horaire.ts`, MC-29, `docs/pas-horaire.md`).

- v0.1.0 : le cœur du bilan, les observations en manque.
- v0.2.0 : les options de Tlaloc (contrat Tlaloc § 7 et § 8) : test du poing lu en fourchette ou au centre de sa classe, tensiomètre, incertitude, consommation apprise. Désactivées dans le jeu OTF (MC-20) : aucun résultat d'OTF ne change.

Hors moteur (MC-18, MC-03) : ETM, Kc et stades, sol de labo et cailloux, profondeur des racines, sol nu et couverts, gel, matériel, ressource, décision et seuils, signalement des relevés utiles.

## Un seul appel : `suivre(entree, jeu)`

Il rend une sortie par jour, sur des jours consécutifs, pour une unité d'arrosage (une planche chez OTF, un jardin chez Tlaloc).

| Entrée | Contenu |
|---|---|
| `aujourdhui` | date locale `AAAA-MM-JJ` : les jours d'avant sont « estimés », aujourd'hui et la suite « prévus » |
| `jours` | un objet par jour, sans trou : `date`, `etc_mm` (ETM du jour, `null` : inconnue, avec `etc_raison` facultative), `sol` (ci-dessous, `null` : inconnu), `abri` (vrai : pluie 0, pas lue), `pluie` (ci-dessous, `null` : inconnue), `part_paillage` (OTF, 1 par défaut) |
| `sol` | `theta_u_mm_m` (θu, mm/m), `zr_m` (racines, m, déjà bornées par le plafond de sol), `p_tableau` (`null` : inconnue), `plancher_mm` (`null` chez Tlaloc ; la capacité suivie chez OTF, MC-02) |
| `pluie` | `{ type: 'heures', heures: [{ instant, mm }] }` mesurée heure par heure ; `{ type: 'jour', mm }` un total sans heure ; `{ type: 'prevue', mm, modeles }` la prévision |
| `arrosages` | tous les arrosages de la période : `debut`, `fin` (`null` : ponctuel), `mm` sur la surface de l'unité (`null` : inconnu), `type` (`arrosage` ou `bassinage`), `nature` (passe telle quelle) |
| `observations` | `{ instant, type: 'manque', dr_mm }` : chaque logiciel convertit depuis son affichage (OTF : manque = capacité × (1 − % du plein), MC-22) ; `{ instant, type: 'poing', classe }` : une prise du test du poing (`tres_sec`, `sec`, `correct`, `frais`, `plein`) ; `{ instant, type: 'tensio', kpa, bas_kpa, haut_kpa }` : une mesure du tensiomètre et ses deux seuils |
| `etat_initial` | `{ dr_mm, dmax_mm, incertitude_mm? }` : le manque au début du premier jour, le Dmax auquel il se rapporte, son incertitude (mm ; absente : 0,35 × RU du premier jour) ; absent : inconnu |
| `kf` | `{ valeur, depuis }` : la consommation apprise de l'unité (0,6 à 1,6) et l'instant du relevé qui l'a fixée ; 1 et `null` par défaut ; sans effet si le jeu ne l'apprend pas |
| `fuseau` | `Europe/Paris` par défaut (contrat § 2) |

| Sortie (par jour) | Contenu |
|---|---|
| `dr_mm`, `pct_plein` | manque au soir (mm) et 100 × (1 − Dr/Dmax) ; `null` : inconnu |
| `incertitude_mm` | l'incertitude du manque au soir (un écart-type, mm, § 7.4) ; `null` avec l'état |
| `connu`, `raison_inconnu` | si l'état est connu ; sinon le premier trou de données, daté (`etc_inconnue`, `pluie_inconnue`, `sol_inconnu`, `apport_inconnu`, `duree_bassinage_inconnue`, ou `pas_commence`) |
| `ru_mm`, `p`, `raw_mm`, `dmax_mm` | RU = θu × zr ; p (ajusté à la chaleur si le jeu le dit, MC-21) ; RAW = p × RU ; Dmax = min(RU, plancher) |
| `dr_depart_mm` | le manque au départ du calcul du jour : la veille, conservée au changement de Dmax (MC-11), ou la dernière observation du jour |
| `drainage_mm`, `eau_perdue_mm`, `drainage_pluie_mm` | l'eau au-delà de la capacité au champ ; la part due à l'arrosage ; la part due à la pluie ; `null` : inconnu (MC-09) |
| `drainage_borne_basse` | le drainage d'un jour de redémarrage est un minimum (MC-31) |
| `pluie_mm`, `arrosage_mm`, `etc_mm`, `fraction` | ce qui est compté : après l'heure de la dernière observation, la part du jour qui reste ; `etc_mm` = ETM × kf |
| `etc_estimee` | la consommation prise à la moyenne des 3 dernières connues (MC-14) |
| `redemarrage` | `observation`, `remplissage` (apports ≥ Dmax), ou `null` |
| `nature` | `estime`, `prevu`, ou `observe` (jeu Tlaloc, le jour d'une observation) |
| `pic_mm`, `apres_apports` | horaire : le manque le plus bas du jour et le manque juste après chaque apport ; journalier : `null` et vide |
| `ancrages` | le journal des ancrages du jour, dans l'ordre : `instant`, `type`, `prises` (poing en fourchette : le nombre de prises groupées), `dr_observe_mm` (le manque retenu), `dr_calcule_mm` (le calcul juste avant, `null` si l'état d'avant était inconnu), `incertitude_avant_mm`, `incertitude_apres_mm` |
| `kf_apres` | `{ valeur, depuis }` quand un relevé de ce jour a appris la consommation (§ 8) : l'appelant le garde et le repasse en `kf` ; sinon `null` |

Une entrée hors bornes (date mal écrite, jours non consécutifs, θu nul, mm négatifs, classe du poing inconnue, seuils du tensiomètre à l'envers, kf hors de 0,6 à 1,6, jeu mal formé…) est une erreur de programme : le moteur la refuse (`RangeError`) au lieu de la lire comme 0.

Autres fonctions exportées : `pluieUtile` (et ses trois formes), `pAjuste`, `conserver`, `verifierJeu` ; les formules des options, utiles aussi à l'affichage : `poingFourchette`, `kfApres`, `tensioVersDr`, `incertitudeMm`, `enPoints`, `etatEnPoints`, `manqueDepuisPoints`, et leurs constantes (`CLASSES_POING`, `CENTRE_CLASSE`, `INCERTITUDE`, `CONSOMMATION_APPRISE`) ; celles du pas (`pasDuJour`, `apportsDesArrosages`, `bornesDuJour`, `fractionDuJour`).

## Les deux jeux de réglages

Un jeu est un objet figé. Pour changer une valeur pour une ferme (R2 chez OTF), on passe une copie : `{ ...JEU_OTF, pluie: { ...JEU_OTF.pluie, part_prevue: 0.8 } }`.

| Réglage | `JEU_OTF` | `JEU_TLALOC` | Décision |
|---|---|---|---|
| `pas` | journalier | horaire | MC-19, MC-29 |
| `bassinage` (10 min ou moins) | compté en entier | compté à 25 % | MC-34 |
| `pluie` : interception, ruissellement | 0 ; aucun | 2 mm par jour ; au-delà de 15 mm/h, la moitié | MC-05 |
| `pluie` : part de la prévue, pluie sûre | 1 (R2) ; non | 0,5 ; oui | MC-05 |
| `pluie.f_sans_heure` | 15 h (sans effet en journalier) | 15 h | contrat Tlaloc § 4.1 |
| `p_ajuste_chaleur` | non | oui | MC-21 |
| `jour_inconnu` | `inconnu` | `moyenne_3_jours` | MC-23, MC-14 |
| `drainage_au_redemarrage` | `depuis_capacite` (borne basse) | `inconnu` | MC-32, MC-31 |
| `conservation` | `pourcent` | `manque` | MC-11 |
| `nature_observee` | non | oui | partie OTF § 6 point 5 |
| `poing` : `fourchette`, `sigma_lecture`, `regroupement_min` | non (centre de la classe) ; 8 ; 60 | oui ; 8 points ; 60 min | contrat Tlaloc § 7.1, MC-20 |
| `tensiometre` : `actif`, `releve_prioritaire_h` | non ; 48 | oui ; 48 h | § 7.3, MC-35, MC-20 |
| `consommation_apprise` | non | oui | § 8, MC-20 |

L'incertitude (§ 7.4, MC-07) n'est pas un réglage : elle est calculée dans les deux jeux ; OTF ne l'affiche pas (MC-20).

## Un jour, dans l'ordre

1. Le sol du jour : RU, p, RAW, Dmax.
2. La consommation : ETM × kf ; si elle manque, dans le jeu Tlaloc, la moyenne des 3 dernières connues avant ce jour (jamais après, et jamais une estimation) ; sinon inconnue.
3. Le départ : le manque de la veille, conservé si Dmax change (MC-11).
4. Les observations du jour, si Dmax est connu (un tensiomètre demande aussi la RAW) : le jour ne compte qu'après la dernière (à instant égal, la dernière de la liste) : consommation et pluie au prorata (en horaire, la pluie placée après elle), arrosages coupés au prorata à son heure.
5. Les apports comptés : pluie utile (× part sous paillage), arrosages et bassinages.
6. Un trou de données, dans l'ordre d'OTF : consommation, pluie, sol, puis un apport inconnu. Avec un trou, ou sans départ :
   - si les apports connus du jour atteignent Dmax, l'unité repart pleine le soir (`remplissage`) ; son drainage vaut apports − Dmax, un minimum, ou reste inconnu selon le jeu ; son incertitude est 0 ;
   - sinon le jour est inconnu ; le trou se nomme s'il y avait de quoi partir (un état la veille ou une observation du jour), sinon la raison d'avant reste.
7. Sinon, chaque observation recale à son heure, dans l'ordre. Le calcul depuis la précédente (ou depuis minuit) donne le manque et l'incertitude juste avant ; l'observation donne le manque retenu et l'incertitude après :

   | Observation | Manque retenu | Incertitude après |
   |---|---|---|
   | `manque` | la valeur, bornée à Dmax | 0,05 × RU (MC-22) |
   | `poing`, en fourchette | l'a posteriori du § 7.1, avec le calcul juste avant comme a priori (plat s'il est inconnu) ; les prises à moins de 60 min de la première comptent ensemble, à l'heure de la dernière | l'écart-type a posteriori |
   | `poing`, sans fourchette | le centre de la classe (12,5, 37,5, 62,5, 87,5 ou 100 % de la RU), borné à Dmax | 0,15 × RU |
   | `tensio` | la conversion du § 7.3, bornée à Dmax ; ignoré dans les 48 h qui suivent un relevé de terrain (poing ou manque) | 0,1 × RAW |

   Un relevé en fourchette apprend la consommation (§ 8) s'il suit un ancrage de cet appel (une observation ou un remplissage, sans état inconnu entre les deux), si plus de 2 mm ont été consommés depuis, et s'il est postérieur au relevé qui a fixé le kf reçu : kf ← kfApres(kf, calcul avant, retenu, consommation, incertitudes avant et après), rendu dans `kf_apres`.
8. Le pas du jour (`pasDuJour`) à partir de la dernière observation, ou du départ, sur la partie du jour qui compte. L'incertitude au soir : √(sdR² + E²), sdR celle du dernier ancrage, E = 0,2 × la consommation depuis (0,5 × celle d'un jour estimé, MC-14).

La projection n'est qu'un `suivre` sur des jours à venir, avec la pluie prévue.

## Comment OTF s'en servira (adaptateur, PR à venir dans le module)

Le module importe `dist/moteur-hydrique.mjs` à une version figée. L'adaptateur traduit sans rien calculer du bilan :
- sol : θu = RFU du sol ÷ part de référence ; zr = profondeur de la planche (plafond compris) ; p = le plus petit p des cultures ; plancher = capacité (RFU du sol × profondeur), d'où Dmax = la capacité ;
- ETM : `etmMm` si le jour est calculé ; sinon `null`, avec la raison d'OTF (`missing-et0`, `blocked`, `crop-without-etm`) dans `etc_raison` ;
- pluie : pluviomètre, réanalyse et prévision enregistrée d'un jour passé en `jour` ; prévision en `prevue` ; R2 dans le jeu ; part sous paillage plastique dans `part_paillage` ; sous abri `abri: true` ;
- observations de la planche (son jardin, ou sa parcelle en plein champ) converties en manque, triées par heure puis par enregistrement ;
- jours sans sol de la planche (« no-soil ») : le suivi est coupé et repart de zéro après eux, comme chez OTF ;
- retour : état = capacité − Dr ; drainage d'un jour inconnu affiché 0 comme aujourd'hui ; raisons rendues dans les mots d'OTF (`sol_inconnu` → `crop-without-etm`) ; ni poing, ni tensiomètre, ni kf passés, incertitude pas affichée (MC-20) ;
- sol nu et couverts : restent dans OTF (MC-18), avec le passage du % du plein entre les modes.

Le script `scripts/comparer-jauge-otf.ts` joue cet adaptateur sur des suites de jours tirées au hasard et compare chaque jour au vrai code de la jauge d'OTF (`bedSoilReserve`, planche cultivée) : état, départ, capacité, drainage, eau arrosée en trop, pluie, arrosage et consommation comptés, fraction, redémarrage, raison, nature, % du plein. Il tourne à chaque PR sur un commit figé du module.

## Comment Tlaloc s'en servira

Tlaloc charge `dist/moteur-hydrique.js` par une balise `<script>` (page ouverte en fichier local) et appelle `MoteurHydrique.suivre(entree, MoteurHydrique.JEU_TLALOC)`. Rien d'autre n'est posé dans la page.

- Départ du calcul (14 jours avant aujourd'hui) : `etat_initial: { dr_mm: 0.5 × RAW, dmax_mm: RU }` ; l'incertitude de départ est alors 0,35 × RU (§ 7.4).
- Relevés : les prises du poing, et les mesures du tensiomètre de moins de 12 h (cette règle reste à Tlaloc, qui choisit les mesures à passer).
- Consommation apprise : `kf` gardé par jardin avec sa date ; le `kf_apres` du dernier jour qui en a un remplace le kf gardé. Le kf reçu vaut jusqu'au jour d'un relevé qui apprend ; le kf appris sert dès le lendemain dans le même appel, projection comprise, comme Tlaloc aujourd'hui.
- Relevés utiles (près du seuil, incertitude plus grande que l'écart au seuil) : côté décision, à partir de `incertitude_mm`.

## Contrôles

```text
npm ci                       # esbuild, TypeScript, types de Node : versions figées, développement seulement
npm run controles            # types, dist/ à jour, 61 tests
npm run cas -- --dist        # rapport valeur par valeur des cas partagés, et les deux fichiers construits
```

- `tests/pas-horaire.test.ts` (Nicolas, 18 tests) : le pas d'un jour.
- `tests/moteur.test.ts` (39 tests) : les règles ci-dessus, le poing en fourchette (T08, T09) contre la référence de Tlaloc, la pluie utile et p ajusté aussi (`docs/ref-tlaloc/ref-tlaloc.mjs`), les entrées refusées.
- `tests/cas.test.ts` (4 tests) : aucun cas en écart, plus rien à venir ; les deux fichiers construits donnent les mêmes résultats que `src/` ; le script classique ne pose que `MoteurHydrique` ; la version est la même partout.
- Comparaison avec la jauge d'OTF, depuis une copie du module : `node --experimental-strip-types --no-warnings --import ./tests/support/register.mjs <dépôt commun>/scripts/comparer-jauge-otf.ts [graine] [suites]`.

`npm run build` reconstruit `dist/` après un changement de `src/` ; `build:check` échoue si on l'a oublié.

## Choix à relire

**v0.1.0**

1. **Total de pluie sans heure : pas de ruissellement.** Le ruissellement se compte heure par heure (§ 5.1) ; un total du jour ne garde que l'interception. Seul le jeu Tlaloc est concerné, quand la pluie n'a pas d'heures.
2. **Pluie inconnue dans le jeu Tlaloc : le jour est inconnu.** MC-14 ne parle que de la consommation ; le § 11 point 2 du contrat Tlaloc reste ouvert pour la pluie.
3. **Redémarrage par remplissage en horaire : manque 0 à la fin du jour**, comme chez OTF (§ 4.4), sans la consommation qui suit le dernier apport. Rare chez Tlaloc, où la consommation d'un jour inconnu est estimée (MC-14) : le suivi n'y repart ainsi qu'au début, ou après un trou de pluie, de sol ou d'apport.
4. **Jour d'une observation : il ne compte qu'après elle, dans les deux modes** (partie OTF § 6 point 1 ; contrat Tlaloc § 7.2). La partie d'avant sert au journal des ancrages, et depuis la v0.2.0 à l'a priori du poing, à l'incertitude et à la consommation apprise.
5. **MC-14 avec moins de 3 jours connus : la moyenne de ceux qu'il y a ; aucun : inconnu.** Une consommation estimée n'entre pas dans les moyennes suivantes.
6. **Un arrosage à cheval sur l'heure d'une observation est coupé au prorata**, comme à minuit (OTF `irrigationBetween`). Un apport à l'instant exact de l'observation compte après elle.
7. **Drainage d'un jour inconnu : `null`** (MC-09). OTF affiche 0 ; son adaptateur gardera cet affichage.
8. **MC-13 et le choix 2 de `docs/pas-horaire.md` se contredisent.** La partie OTF § 8 point 1 (MC-13) découpe un arrosage en tranches horaires en mode horaire ; le pas de Nicolas le compte d'un coup, à son début, comme Tlaloc aujourd'hui (le cas T02 en dépend). Le moteur suit le pas fusionné. Aucun chiffre d'OTF n'en dépend (journalier). À trancher ensemble.
9. **Version du moteur distincte de celle du contrat** (0.2.x). Semver du code (MC-26) ; proposition : 1.0.0 avec le contrat v1.0.
10. **`dist/` est versionné**, pour que Tlaloc ouvre le fichier sans outil de construction ; un contrôle vérifie qu'il est à jour, fins de ligne LF partout (`.gitattributes`).
11. **Dépendances de développement seulement**, versions figées ; aucun paquet dans les fichiers construits.
12. **Les bornes de l'ET0 (MC-37) restent hors du moteur** : chaque logiciel passe une consommation `null`, avec sa raison, quand son ET0 est bloquée (cas L6).
13. **Deux petits changements dans `src/pas-horaire.ts`** : `mmCompte` est exporté (le bilan s'en sert pour nommer un apport inconnu) ; `apportsDesArrosages` prend un intervalle facultatif `entre` (avant ou après l'heure d'une observation). Sans cet intervalle, rien ne change ; les 18 tests de Nicolas passent tels quels.

**v0.2.0 (options de Tlaloc)**

14. **Plusieurs observations un même jour : chacune recale à son heure, dans l'ordre.** Le jour ne compte qu'après la dernière, comme chez OTF (rien ne change pour lui : 0 écart contre sa jauge) ; le journal les garde toutes. `ancrage` (v0.1.0) devient `ancrages`, une liste.
15. **Prises du poing groupées : à moins de 60 min de la première prise**, pas de proche en proche, pour que toutes les prises d'un groupe soient à moins de 60 min les unes des autres. Le groupe est daté de sa dernière prise et compte le jour de celle-ci, même à cheval sur minuit.
16. **Poing en fourchette sur un état inconnu : a priori plat** (la vraisemblance des prises seule). Sans fourchette : le centre de la classe de chaque prise, chacune seule, sans regroupement.
17. **Tensiomètre** : « moins de 12 h » reste à l'appelant, qui ne passe que les mesures à prendre ; « relevé de terrain » = une prise du poing ou un manque observé, dans les 48 h avant la mesure (même instant compris) ; une mesure sans RAW connue (p inconnu) est ignorée.
18. **Incertitude** : calculée dans les deux jeux (OTF ne l'affiche pas, MC-20) ; les erreurs de consommation s'additionnent, comme une erreur de Kc, qui ne se compense pas d'un jour à l'autre ; 0 après un redémarrage par remplissage (plein le soir, quel que soit le départ) ; inchangée quand Dmax change (MC-11) ; inconnue avec l'état. Une incertitude passée au départ vaut sdR ; l'erreur de consommation repart de 0.
19. **Consommation apprise** : le kf reçu vaut jusqu'au jour d'un relevé qui apprend ; le kf appris sert **dès le lendemain**, jours passés, aujourd'hui et projection (§ 8), comme Tlaloc, dont la consommation d'un jour se calcule à son début (relecture de Nicolas, PR n° 12) ; un jour à ETM inconnue (MC-14) prend la moyenne des 3 dernières ETM connues × le kf du jour ; plusieurs relevés d'un appel s'enchaînent, chacun à partir du kf appris au précédent ; « un ancrage précède dans la fenêtre » = une observation ou un redémarrage par remplissage plus tôt dans l'appel, sans état inconnu entre les deux ; un relevé à 2 mm ou moins de l'ancrage précédent n'apprend rien et n'est pas compté comme appris. Un `kf` passé avec un jeu qui n'apprend pas (OTF) est ignoré.
20. **Version 0.2.0** : l'interface change (`ancrages`, champs ajoutés), aucun résultat d'OTF ne change ; en 0.x, semver permet un changement d'interface dans une version mineure.
