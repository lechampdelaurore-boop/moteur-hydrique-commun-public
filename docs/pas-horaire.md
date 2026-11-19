# Le pas de calcul horaire et journalier (MC-29) : `src/pas-horaire.ts`

18 novembre 2026. Côté Tlaloc (Nicolas et son Claude), à relire côté OTF. Exception à MC-25 limitée à ce point (accord de François sur la PR n° 4, puis sur la PR n° 6 : module autonome, sans attendre le `src/` d'OTF, critère « jeu journalier d'OTF inchangé à 0,01 mm »).

## Ce que fait le module

Un seul appel, `pasDuJour(entree, reglages)`, calcule une journée pour une unité d'arrosage.

| Entrée | Contenu |
|---|---|
| `dr_veille` | manque à minuit au début du jour (mm) ; `null` : inconnu |
| `etc` | consommation de la journée entière (mm) ; `null` : inconnue |
| `ru` | réserve utile du jour (mm) |
| `plancher` | `null` (jeu Tlaloc) ou capacité suivie (jeu OTF), MC-02 |
| `apports` | liste `{ type: pluie, arrosage ou bassinage ; f : fraction du jour de 0 à 1 ; mm ; duree_s }` |

`reglages` : `JEU_TLALOC` (pas horaire, bassinage de 10 min ou moins compté à 25 %) ou `JEU_OTF` (pas journalier, bassinage compté à 100 %).

| Sortie | Contenu |
|---|---|
| `dr` | manque au soir (mm) |
| `apres_apports` | horaire : le manque juste après chaque apport ; journalier : vide |
| `pic` | horaire : manque le plus bas de la journée, minuit compris ; journalier : `null` |
| `drainage`, `eau_perdue`, `drainage_pluie` | mm ; l'eau perdue ne vient que de l'arrosage et du bassinage |
| `compte` | mm de pluie et d'arrosage pris en compte (après la part du bassinage court) |

Une entrée inconnue donne `{ connu: false, raison }`, jamais un 0 (MC-09). Une entrée hors bornes (RU nulle, f hors de 0 à 1, mm négatifs) est une erreur de programme : le module la refuse.

- **Horaire** : contrat Tlaloc § 4.1, ligne à ligne.
- **Journalier** : contrat Tlaloc § 4.2, qui est la jauge d'OTF (`gauge.ts`, `computeDay`, planche cultivée) écrite en manque plutôt qu'en état.
- **Bassinage** (MC-34) : la part non comptée n'entre pas dans la réserve, ni en drainage, ni en eau perdue. Si la part comptée vaut 1 (jeu OTF), la durée ne sert pas. Sinon, un bassinage sans durée connue rend le jour inconnu.

Deux aides pour le temps (contrat § 2) :
- `bornesDuJour` et `fractionDuJour` : la journée de Europe/Paris dure 23, 24 ou 25 h ;
- `apportsDesArrosages` : un arrosage qui chevauche minuit est réparti au prorata (même règle qu'OTF `irrigationBetween`). Sa part du jour est placée à son début, ou à minuit s'il a commencé la veille, comme Tlaloc le fait aujourd'hui.

## Hors du module (à brancher par le moteur ou l'adaptateur)

- la pluie utile (§ 5) ;
- les observations (§ 7) ;
- l'enchaînement des jours : jour inconnu (MC-14, MC-23), redémarrage (MC-32), changement de capacité (MC-11) ;
- la projection ;
- la sortie « script classique » (MC-28), qui viendra avec le moteur.

## Contrôles (18 tests, tous passés)

Lancer : `node --test --experimental-strip-types tests/pas-horaire.test.ts` (Node 22 ou plus, aucune dépendance).

1. **Cas Tlaloc** T01, T02 (horaire et journalier), T03, T06 et T12, lus dans `cas/cas-tlaloc.json` : conformes à 0,01 mm.
2. **Cas OTF du bilan journalier** O04, O10, L4 et L7, lus dans `cas/cas-otf.json` (avec état = capacité − Dr) : conformes à 0,01 mm.
3. **Journalier contre OTF** : 20 000 jours tirés au hasard, comparés aux lignes du bilan d'OTF recopiées dans le test (`balance = start + inflow − consumed`, borné à [0 ; capacité]) : écart toujours inférieur à 0,01 mm.
4. **Horaire contre la référence Tlaloc** : 20 000 jours comparés à `docs/ref-tlaloc/ref-tlaloc.mjs` (`jourHoraire`) : écart toujours inférieur à 0,01 mm.
5. **T12 généralisé** : sans débordement ni plafond dans la journée, horaire et journalier coïncident.
6. **Bassinage** (MC-34), **inconnu** (MC-09), entrées refusées.
7. **Temps** : journées de 23, 24 et 25 h, fraction du jour, prorata à minuit, même total qu'OTF.

Le contrôle des types passe aussi (`tsc --strict`). Seule la syntaxe effaçable est utilisée (ni `enum` ni `namespace`), pour que Node lance le fichier sans le compiler.

## Choix à relire

1. **`pic` compte minuit.** Le contrat dit « Dr minimal de la journée ». Le `mn` de Tlaloc ne compte pas minuit : sans apport, il vaut le manque du soir. Ici, il vaut le manque de la veille. Ce n'est qu'une sortie d'affichage : aucun bilan ne change.
2. **Un arrosage compte d'un coup, à son début.** C'est le comportement actuel de Tlaloc. Le cas T02 en dépend. Le répartir sur sa durée serait un autre choix, à discuter avant d'être écrit (règle 3 du README).
3. **Journée de 23 ou 25 h.** Le module suit le contrat § 2. Le code actuel de Tlaloc compte toujours 24 h. Quand Tlaloc branchera le moteur, ses chiffres bougeront donc un peu, deux jours par an. Rien ne change chez OTF.
