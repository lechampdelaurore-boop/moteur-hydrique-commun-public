# Le moteur hydrique commun v0.1.0 : le cœur du bilan

20 novembre 2026. Côté OTF (François et Claude, MC-25), à relire par Nicolas. Première version du moteur de la phase 1 (MC-18) : le bilan de la réserve du sol jour après jour, la pluie utile, les observations en manque, le jour inconnu, la projection. Le pas d'un jour est celui de Nicolas (`src/pas-horaire.ts`, MC-29, `docs/pas-horaire.md`).

Hors moteur (MC-18, MC-03) : ETM, Kc et stades, sol de labo et cailloux, profondeur des racines, sol nu et couverts, gel, matériel, ressource, décision et seuils. Les options de Tlaloc (poing en fourchette, tensiomètre, incertitude, consommation apprise) viennent dans la PR suivante.

## Un seul appel : `suivre(entree, jeu)`

Il rend une sortie par jour, sur des jours consécutifs, pour une unité d'arrosage (une planche chez OTF, un jardin chez Tlaloc).

| Entrée | Contenu |
|---|---|
| `aujourdhui` | date locale `AAAA-MM-JJ` : les jours d'avant sont « estimés », aujourd'hui et la suite « prévus » |
| `jours` | un objet par jour, sans trou : `date`, `etc_mm` (ETM du jour, `null` : inconnue, avec `etc_raison` facultative), `sol` (ci-dessous, `null` : inconnu), `abri` (vrai : pluie 0, pas lue), `pluie` (ci-dessous, `null` : inconnue), `part_paillage` (OTF, 1 par défaut) |
| `sol` | `theta_u_mm_m` (θu, mm/m), `zr_m` (racines, m, déjà bornées par le plafond de sol), `p_tableau` (`null` : inconnue), `plancher_mm` (`null` chez Tlaloc ; la capacité suivie chez OTF, MC-02) |
| `pluie` | `{ type: 'heures', heures: [{ instant, mm }] }` mesurée heure par heure ; `{ type: 'jour', mm }` un total sans heure ; `{ type: 'prevue', mm, modeles }` la prévision |
| `arrosages` | tous les arrosages de la période : `debut`, `fin` (`null` : ponctuel), `mm` sur la surface de l'unité (`null` : inconnu), `type` (`arrosage` ou `bassinage`), `nature` (passe telle quelle) |
| `observations` | `{ instant, type: 'manque', dr_mm }` : chaque logiciel convertit depuis son affichage (OTF : manque = capacité × (1 − % du plein), MC-22) |
| `etat_initial` | `{ dr_mm, dmax_mm }` : le manque au début du premier jour et le Dmax auquel il se rapporte ; absent : inconnu |
| `fuseau` | `Europe/Paris` par défaut (contrat § 2) |

| Sortie (par jour) | Contenu |
|---|---|
| `dr_mm`, `pct_plein` | manque au soir (mm) et 100 × (1 − Dr/Dmax) ; `null` : inconnu |
| `connu`, `raison_inconnu` | si l'état est connu ; sinon le premier trou de données, daté (`etc_inconnue`, `pluie_inconnue`, `sol_inconnu`, `apport_inconnu`, `duree_bassinage_inconnue`, ou `pas_commence`) |
| `ru_mm`, `p`, `raw_mm`, `dmax_mm` | RU = θu × zr ; p (ajusté à la chaleur si le jeu le dit, MC-21) ; RAW = p × RU ; Dmax = min(RU, plancher) |
| `dr_depart_mm` | le manque au départ du calcul du jour : la veille, conservée au changement de Dmax (MC-11), ou l'observation |
| `drainage_mm`, `eau_perdue_mm`, `drainage_pluie_mm` | l'eau au-delà de la capacité au champ ; la part due à l'arrosage ; la part due à la pluie ; `null` : inconnu (MC-09) |
| `drainage_borne_basse` | le drainage d'un jour de redémarrage est un minimum (MC-31) |
| `pluie_mm`, `arrosage_mm`, `etc_mm`, `fraction` | ce qui est compté : après l'heure d'une observation, la part du jour qui reste |
| `etc_estimee` | la consommation prise à la moyenne des 3 dernières connues (MC-14) |
| `redemarrage` | `observation`, `remplissage` (apports ≥ Dmax), ou `null` |
| `nature` | `estime`, `prevu`, ou `observe` (jeu Tlaloc, le jour d'une observation) |
| `pic_mm`, `apres_apports` | horaire : le manque le plus bas du jour et le manque juste après chaque apport ; journalier : `null` et vide |
| `ancrage` | journal des ancrages : l'observation, le manque observé et le manque calculé juste avant (`null` si l'état d'avant était inconnu) |

Une entrée hors bornes (date mal écrite, jours non consécutifs, θu nul, mm négatifs, jeu mal formé…) est une erreur de programme : le moteur la refuse (`RangeError`) au lieu de la lire comme 0.

Autres fonctions exportées : `pluieUtile` (et ses trois formes), `pAjuste`, `conserver`, `verifierJeu`, et celles du pas (`pasDuJour`, `apportsDesArrosages`, `bornesDuJour`, `fractionDuJour`).

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

## Un jour, dans l'ordre

1. Le sol du jour : RU, p, RAW, Dmax.
2. La consommation : connue ; sinon, dans le jeu Tlaloc, la moyenne des 3 dernières connues avant ce jour (jamais après, et jamais une estimation) ; sinon inconnue.
3. Le départ : le manque de la veille, conservé si Dmax change (MC-11).
4. L'observation du jour, s'il y en a une et que Dmax est connu : la plus récente (à instant égal, la dernière de la liste) devient le départ, bornée à Dmax ; le jour ne compte qu'après son heure : consommation et pluie au prorata (en horaire, la pluie placée après elle), arrosages coupés au prorata à son heure.
5. Les apports comptés : pluie utile (× part sous paillage), arrosages et bassinages.
6. Un trou de données, dans l'ordre d'OTF : consommation, pluie, sol, puis un apport inconnu. Avec un trou, ou sans départ :
   - si les apports connus du jour atteignent Dmax, l'unité repart pleine le soir (`remplissage`) ; son drainage vaut apports − Dmax, un minimum, ou reste inconnu selon le jeu ;
   - sinon le jour est inconnu ; le trou se nomme s'il y avait de quoi partir (un état la veille ou une observation du jour), sinon la raison d'avant reste.
7. Sinon le pas du jour (`pasDuJour`) à partir du départ, sur la partie du jour qui compte ; et le journal des ancrages.

La projection n'est qu'un `suivre` sur des jours à venir, avec la pluie prévue.

## Comment OTF s'en servira (adaptateur, PR à venir dans le module)

Le module importe `dist/moteur-hydrique.mjs` à une version figée. L'adaptateur traduit sans rien calculer du bilan :
- sol : θu = RFU du sol ÷ part de référence ; zr = profondeur de la planche (plafond compris) ; p = le plus petit p des cultures ; plancher = capacité (RFU du sol × profondeur), d'où Dmax = la capacité ;
- ETM : `etmMm` si le jour est calculé ; sinon `null`, avec la raison d'OTF (`missing-et0`, `blocked`, `crop-without-etm`) dans `etc_raison` ;
- pluie : pluviomètre, réanalyse et prévision enregistrée d'un jour passé en `jour` ; prévision en `prevue` ; R2 dans le jeu ; part sous paillage plastique dans `part_paillage` ; sous abri `abri: true` ;
- observations de la planche (son jardin, ou sa parcelle en plein champ) converties en manque, triées par heure puis par enregistrement ;
- jours sans sol de la planche (« no-soil ») : le suivi est coupé et repart de zéro après eux, comme chez OTF ;
- retour : état = capacité − Dr ; drainage d'un jour inconnu affiché 0 comme aujourd'hui ; raisons rendues dans les mots d'OTF (`sol_inconnu` → `crop-without-etm`) ;
- sol nu et couverts : restent dans OTF (MC-18), avec le passage du % du plein entre les modes.

Le script `scripts/comparer-jauge-otf.ts` joue cet adaptateur sur des suites de jours tirées au hasard et compare chaque jour au vrai code de la jauge d'OTF (`bedSoilReserve`, planche cultivée) : état, départ, capacité, drainage, eau arrosée en trop, pluie, arrosage et consommation comptés, fraction, redémarrage, raison, nature, % du plein. Il tourne à chaque PR sur un commit figé du module.

## Comment Tlaloc s'en servira

Tlaloc charge `dist/moteur-hydrique.js` par une balise `<script>` (page ouverte en fichier local) et appelle `MoteurHydrique.suivre(entree, MoteurHydrique.JEU_TLALOC)`. Rien d'autre n'est posé dans la page.

## Contrôles

```text
npm ci                       # esbuild, TypeScript, types de Node : versions figées, développement seulement
npm run controles            # types, dist/ à jour, 50 tests
npm run cas -- --dist        # rapport valeur par valeur des cas partagés, et les deux fichiers construits
```

- `tests/pas-horaire.test.ts` (Nicolas, 18 tests) : le pas d'un jour.
- `tests/moteur.test.ts` (28 tests) : les règles ci-dessus, la pluie utile et p ajusté contre la référence de Tlaloc (`docs/ref-tlaloc/ref-tlaloc.mjs`), les entrées refusées.
- `tests/cas.test.ts` (4 tests) : aucun cas en écart ; les deux fichiers construits donnent les mêmes résultats que `src/` ; le script classique ne pose que `MoteurHydrique` ; la version est la même partout.
- Comparaison avec la jauge d'OTF, depuis une copie du module : `node --experimental-strip-types --no-warnings --import ./tests/support/register.mjs <dépôt commun>/scripts/comparer-jauge-otf.ts [graine] [suites]`.

`npm run build` reconstruit `dist/` après un changement de `src/` ; `build:check` échoue si on l'a oublié.

## Choix à relire

1. **Total de pluie sans heure : pas de ruissellement.** Le ruissellement se compte heure par heure (§ 5.1) ; un total du jour ne garde que l'interception. Seul le jeu Tlaloc est concerné, quand la pluie n'a pas d'heures.
2. **Pluie inconnue dans le jeu Tlaloc : le jour est inconnu.** MC-14 ne parle que de la consommation ; le § 11 point 2 du contrat Tlaloc reste ouvert pour la pluie.
3. **Redémarrage par remplissage en horaire : manque 0 à la fin du jour**, comme chez OTF (§ 4.4), sans la consommation qui suit le dernier apport. Rare chez Tlaloc, où la consommation d'un jour inconnu est estimée (MC-14) : le suivi n'y repart ainsi qu'au début, ou après un trou de pluie, de sol ou d'apport.
4. **Jour d'une observation : il ne compte qu'après elle, dans les deux modes** (partie OTF § 6 point 1 ; contrat Tlaloc § 7.2). La partie d'avant ne sert qu'au journal des ancrages.
5. **MC-14 avec moins de 3 jours connus : la moyenne de ceux qu'il y a ; aucun : inconnu.** Une consommation estimée n'entre pas dans les moyennes suivantes.
6. **Un arrosage à cheval sur l'heure d'une observation est coupé au prorata**, comme à minuit (OTF `irrigationBetween`). Un apport à l'instant exact de l'observation compte après elle.
7. **Drainage d'un jour inconnu : `null`** (MC-09). OTF affiche 0 ; son adaptateur gardera cet affichage.
8. **MC-13 et le choix 2 de `docs/pas-horaire.md` se contredisent.** La partie OTF § 8 point 1 (MC-13) découpe un arrosage en tranches horaires en mode horaire ; le pas de Nicolas le compte d'un coup, à son début, comme Tlaloc aujourd'hui (le cas T02 en dépend). Le moteur suit le pas fusionné. Aucun chiffre d'OTF n'en dépend (journalier). À trancher ensemble.
9. **Version du moteur 0.1.0, distincte de celle du contrat** (0.2.x). Semver du code (MC-26) ; proposition : 1.0.0 avec le contrat v1.0.
10. **`dist/` est versionné**, pour que Tlaloc ouvre le fichier sans outil de construction ; un contrôle vérifie qu'il est à jour, fins de ligne LF partout (`.gitattributes`).
11. **Dépendances de développement seulement**, versions figées ; aucun paquet dans les fichiers construits.
12. **Les bornes de l'ET0 (MC-37) restent hors du moteur** : chaque logiciel passe une consommation `null`, avec sa raison, quand son ET0 est bloquée (cas L6).
13. **Deux petits changements dans `src/pas-horaire.ts`** : `mmCompte` est exporté (le bilan s'en sert pour nommer un apport inconnu) ; `apportsDesArrosages` prend un intervalle facultatif `entre` (avant ou après l'heure d'une observation). Sans cet intervalle, rien ne change ; les 18 tests de Nicolas passent tels quels.
