# Contrat du moteur hydrique commun : version fusionnée v0.2.6 (brouillon)

16 novembre 2026 (v0.2), tenu à jour depuis (journal, § 6) ; le code du moteur est dans `src/`, son mode d'emploi dans `docs/moteur.md`. Rédigé côté OTF (François et Claude), à relire par Nicolas. Fusionne `contrat-moteur.md` (Tlaloc v0.1.1) et `contrat-moteur-partie-otf.md` (OTF v0.1.1) du dépôt commun, et y inscrit les décisions MC-17 à MC-30 et MC-31 à MC-33. **Les formules et valeurs ne sont pas recopiées ici** : elles restent dans les deux contrats sources, cités par section, tant que les cas de test ne sont pas exécutés (risque de faute de recopie). Ce document fixe la structure, les paramètres et les décisions.

Marques : **[MC-nn]** décision ; **[À FAIRE]** à écrire ou vérifier avant la v1.0 ; **[À TRANCHER]** question ouverte.

## 1. Plan du contrat fusionné et origine de chaque section

| § | Contenu | Source |
|---|---|---|
| 1 | Glossaire unique (RU, RFU de labo, RAW, Dr, plancher, nature…) | Tlaloc § 1 + corrections OTF § 1 |
| 2 | Conventions (unités, journée civile Europe/Paris, inconnu, révisions datées, version figée) | Tlaloc § 2 |
| 3 | Entrées et sorties d'un pas ; entrées propres à OTF (trois natures d'arrosage `actual`, `planned`, `proposed`) | Tlaloc § 3 + OTF § 2 |
| 4 | Bilan : horaire, journalier, plancher, jour inconnu | Tlaloc § 4 + OTF § 6 |
| 5 | Pluie utile mesurée et prévue ; paillage, bâche | Tlaloc § 5 + OTF § 2, § 6 |
| 6 | Observations : % du plein, poing en fourchette, tensiomètre ; incertitude ; consommation apprise (options) | Tlaloc §§ 6 à 8 |
| 7 | Jeux de réglages « OTF » et « Tlaloc » (table unique, § 3 ci-dessous) | Tlaloc § 9 + OTF |
| 8 | Entrée « ETM du jour avec trace » : calcul de l'ETM, Kc et stades, sol, racines = **hors moteur en phase 1**, décrits à titre d'interface (proposition A) | OTF §§ 3 à 5 |
| 9 | Cas de test partagés (T01 à T12, O01 à O10, cas limites à ajouter) ; chaque cas dit sa décision et son statut « exécuté / écrit à la main » | `cas/*.json` |
| 10 | Gouvernance, version, journal | README commun |

## 2. Périmètre de la phase 1 [MC-18]

Dans le moteur : bilan, pluie utile, observations, incertitude, projection, règle « inconnu, jamais zéro » (MC-09). Hors moteur : ETM, Kc, stades, sol, racines, sol nu et couverts, gel, matériel, ressource, décision et seuils (MC-03).

## 3. Jeux de réglages, état après les décisions du 14/11

Partie qui change par rapport à Tlaloc § 9 ; le reste du tableau reste celui du contrat Tlaloc.

| Réglage | Jeu OTF | Jeu Tlaloc | Décision |
|---|---|---|---|
| Base de code du moteur | TypeScript d'OTF | idem | MC-17 |
| Pas de temps | **journalier** | horaire | MC-19 |
| Options Tlaloc (poing en fourchette, tensiomètre, consommation apprise) | désactivées, non visibles chez OTF ; l'incertitude peut exister dans le moteur sans affichage | activées | MC-20 |
| p ajusté à la chaleur | **non** | oui | MC-21 |
| « % du plein » se rapporte à | capacité suivie (RFU de labo × profondeur) ; conversion côté OTF ; incertitude après observation 0,05 × RU | non utilisé | MC-22 |
| Jour inconnu | état « inconnu » jusqu'au remplissage ou à une observation | moyenne des 3 jours connus précédents (MC-14) + incertitude | MC-23 |
| `drainage_au_redemarrage` | `depuis_capacite` | `inconnu` | MC-32 |
| Bassinage court (10 min ou moins) : part comptée | 1 | 0,25 | MC-34 |
| K_abri par défaut | 0,8 (MC-06) | 0,7 | inchangé |
| Pluie prévue / pluie sûre | 100 % / non | 50 % / oui | inchangé (MC-05) |
| Association sur une planche | max (MC-10) | moyenne | inchangé |
| Conservation au changement de capacité | pourcent (MC-11) | manque | inchangé |
| Sol nu | FAO-56 chap. 7 (MC-12) | Kc fixe 0,4 | inchangé, hors phase 1 |

## 4. Décisions de François du 14 novembre 2026

| N° | Décision | Question d'origine |
|---|---|---|
| MC-17 | Le code part du TypeScript d'OTF (remplace « code de Tlaloc » de D-066) | 1 |
| MC-18 | Phase 1 = cœur du bilan seulement | 2 |
| MC-19 | OTF reste journalier ; l'horaire est dans le moteur, mesuré plus tard sur le banc | 3 |
| MC-20 | Aucune option Tlaloc visible chez OTF | 4 |
| MC-21 | p ajusté à la chaleur : désactivé dans le jeu OTF, option | 5 |
| MC-22 | « % du plein » = capacité suivie ; incertitude 0,05 × RU | 6 |
| MC-23 | Jour inconnu : OTF garde « inconnu » | 7 |
| MC-24 | Kc du CRIIAM : rien ne change ; la question de l'ETP est posée au CRIIAM par François | 8 |
| MC-25 | Répartition : François et Claude écrivent moteur et adaptateur OTF ; Nicolas relit et branche Tlaloc | 9 |
| MC-26 | Gouvernance : semver (un résultat qui change = majeure), réponse sous 7 jours, publication par celui qui fusionne après relecture de l'autre | 10 |
| MC-27 | Étapes 0 et 1 d'abord ; moteur et adaptateur quand la place de code est libre ; aucune date promise | 11 |
| MC-34 | Bassinage dans le moteur : type d'événement « bassinage » avec un coefficient d'efficacité (0,25 pour 10 min ou moins dans le jeu Tlaloc, 1 dans le jeu OTF : aucun résultat OTF ne change) ; la part non comptée n'entre pas dans la réserve et ne compte ni en drainage ni en eau perdue (tranché par Nicolas le 15/11, accepté par François le 17/11) | § 5 point 3 |
| MC-35 | Tensiomètre : côté Tlaloc ; l'option reste dans le moteur, désactivée dans le jeu OTF (MC-20) ; la conversion de Shock (1998) viendra par une PR de Nicolas (accepté par François le 17/11) | § 5 point 4 |
| MC-36 | Banc d'essai allégé : 3 saisons représentatives au lieu de toutes ; **une saison = une année de maraîchage entière (environ de début janvier à fin décembre), pas seulement l'été** ; 3 saisons = 3 années complètes (une sèche, une humide, une moyenne), choisies ensemble avec les données disponibles ; le banc passe après la Tranche 4 d'OTF s'il traîne ; MC-30 et MC-33 inchangées (accepté par Nicolas le 18/11, issue n° 7 ; proposé par François le 17/11) | § 4 bis, § 5 point 5 |
| MC-37 | **Borne haute de l'ET0 du jour portée de 12 à 15 mm/j, pour toutes les fermes** : 0 ≤ ET0 ≤ 15 mm/j, hors bornes le jour reste bloqué et la dernière valeur valide reste (comportement inchangé). Cas aux limites : 11,9 et 12,1 et 14,9 calculées, 15,1 bloquée. Le module d'OTF garde 12 jusqu'à l'accord, puis change sa constante dans une PR à part. MC-16 inchangée (l'ETP reste hors du moteur). Décision de François du 19/11 (contrat de la Tranche 4 d'OTF) ; **acceptée par Nicolas le 20/11** (approbation de la PR n° 10) | partie OTF § 3, cas L6 |

MC-25 et MC-26 : **acceptées par Nicolas le 16/11** (« d'accord avec les points 1 à 5 »). MC-27 : aucune date promise.

MC-31 à MC-33 (numéros donnés par cette PR) : voir § 5 points 8 et 4 bis (banc).


## 4 bis. Réponse de Nicolas du 14/11 et tickets du dépôt commun (v0.2)

**Numérotation.** Nicolas a déjà proposé **MC-16 = « l'ETP reste hors du moteur »** (ticket n° 2, 12/11). Les onze décisions de François du 14/11 sont donc décalées d'un cran : elles sont **MC-17 à MC-27** (tableau du § 4). MC-16 est accepté tel quel par François : il est conforme au contrat actuel (« l'ET0 est une donnée d'entrée », bornes 0 à 12 mm/j).

| Point de Nicolas | Recommandation | Statut |
|---|---|---|
| **P1. Version « script classique »** exposant une variable globale (`MoteurHydrique`), en plus du `.mjs` (Tlaloc tourne aussi en fichier local, où l'import de module échoue) | **Accepter.** Deux sorties de la même source, une ligne de configuration ; test : les deux fichiers donnent les mêmes résultats sur tous les cas. OTF garde le `.mjs`. | MC-28 **acceptée** (François, 16/11 à 19 h 51) |
| **P2. Événements horodatés dès le départ** (MC-04) ; le journalier n'en est qu'un cas particulier | **Accepter la structure** : le type d'entrée est une liste d'événements horodatés ; le mode journalier OTF reste défini **exactement** comme au contrat § 4.2 (formule du jour, pas une somme d'événements), sans changer un seul résultat OTF (MC-18). Cas T02 testé dans les deux modes. Cela ne change pas MC-18 : OTF reste journalier. | MC-29 **acceptée** (François, 16/11 à 19 h 51) |
| **P3. Deux niveaux de tolérance** : cas de test 0,01 mm ; banc 1 % de l'eau totale de saison + écart en jours sous le seuil, même ET0 pour les deux moteurs | **Accepter.** Précision : le critère « mêmes résultats qu'avant » du module OTF (non-régression, contrat de fusion § 5) reste à **0,01 mm** ; le 1 % ne sert qu'à comparer les deux moteurs entre eux sur le banc. | MC-30 **acceptée** (François, 16/11 à 19 h 51) |
| **Ticket n° 2 : MC-16**, même ET0 sur le banc, test à quatre sources d'ETP | **Accepter MC-16.** Test des quatre ETP (Tlaloc, OTF, Open-Meteo, station Météo-France) = phase banc, pas phase 1. | MC-16 |
| **Ticket n° 2 : trois questions sur l'ETP d'OTF** | Réponses relues dans le code (`visual-crossing-provider.ts`), **non exécutées** : (1) le vent est converti **en supposant** qu'il est à 10 m (formule de passage à 2 m) ; que Visual Crossing le mesure bien à 10 m **n'est pas vérifié**. (2) La rupture au passage réanalyse Open-Meteo (passé) → Visual Crossing (prévision) : **non mesurée** ; à chiffrer au banc. (3) L'altitude vient de la réponse de Visual Crossing et vaut 0 seulement si elle manque ; Open-Meteo n'est pas utilisé pour l'altitude. Remarque sur Tmean : le code utilise bien le champ `temp` de Visual Crossing, pas (Tmax+Tmin)/2. Aucun changement de code sans accord. | à répondre, rien de changé |
| **Ticket n° 1 : veille** (K_abri, K_paillage, Kc locaux, Watermark, bassinage) | **Rien ne change dans la v0.2** (Nicolas le dit lui-même : rien sans mesure sur le banc). Tout est rangé en « pistes du banc », phase 5. Détail ci-dessous. | pistes |

**Réponse de Nicolas du 16/11 (courriel transmis par François).**
- D'accord avec les points 1 à 5 du message de François du 16/11 (base TypeScript, répartition, jeu OTF journalier, gouvernance, cas de test et ses deux propositions sur O07).
- **Cas T01 à T12 exécutés sur le vrai code de Tlaloc (version 421) : tous conformes à 0,01 près.** Le test règle un jardin d'essai en mémoire et appelle les vraies fonctions du bilan. Précisions : **T10** — ses entrées ne se reproduisent pas dans une ferme ; le test vérifie la formule du code contre l'implémentation de référence avec les entrées du banc ; **T03** — le drainage de la pluie n'est pas une sortie du calcul de Tlaloc ; seul le manque est vérifié. Le test sera rangé dans le dépôt de Tlaloc ; Nicolas mettra à jour le statut des cas T dans le dépôt commun.
- Demande de confirmation que **P1 à P3 (MC-28 à MC-30)** sont dans la v0.2 : elles y sont, **acceptées par François le 16/11 à 19 h 51**.
- **Banc et ETP** **[MC-33, TRANCHÉ par François le 16/11 à 19 h 52 : au banc, les deux moteurs rejouent chaque saison avec l'ET0 FAO-56 de la réanalyse Open-Meteo, la station Météo-France en simple comparaison]** : Tlaloc remplace les jours passés par l'ETP de la station Météo-France ; avant le printemps 2026 elle n'est pas en FAO-56, et une station dégagée surestime l'ETP de bord de parcelle. Proposition : au banc, rejouer avec une ETP calculée de la même façon sur toute la saison, la station ne servant que de comparaison.

**Pistes du banc (ticket n° 1), à ne trancher qu'avec mesures :**
1. K_abri 0,65 / 0,7 / 0,8 sur le banc **avant** de rouvrir MC-06 ; **agronomique, à François** ; 0,8 reste en vigueur jusqu'à sa décision.
2. K_paillage : passer à un effet sur l'évaporation du sol (Ke) plutôt que sur toute l'ETM ; lié au sol nu (FAO-56 chap. 7), phase ultérieure ; agronomique.
3. Kc locaux : risque de double compte si un Kc calibré pour l'aspersion (BRL) est multiplié par K_paillage ; **chez OTF le Kc vient du CRIIAM ou de la FAO, pas de BRL** (à confirmer dans les sources) ; la question de l'ETP du CRIIAM reste ouverte (message envoyé).
4. Watermark (formule de Shock 1998) et erreur du poing 8/12/15 points : **côté Tlaloc**, hors OTF (MC-19).
5. Bassinage comme événement distinct : compatible avec P2 (type d'événement) ; [TRANCHÉ : MC-34] le bassinage court est dans le moteur, compté à 25 % dans le jeu Tlaloc et en entier dans le jeu OTF (point 3 du § 5).
6. Fraction du volume mouillé en goutte-à-goutte : chez OTF la surface mouillée existe déjà ; hors phase 1.
7. **Validation externe** par pyfao56 (CC0) et PyEt (MIT) pour l'ET0 et le bilan journalier : recommandé, en plus des cas internes, en phase banc ; vérifier les équations contre les PDF d'origine avant tout codage.
8. FAO-56 2e édition (2025) : à lire avant de toucher aux tables Kc et p ; hors phase 1.

## 5. Ce qui reste à écrire ou trancher avant la v1.0

1. [FAIT] **Exécuter les cas** O01 à O10 sur le code OTF réel et corriger le contrat là où la main s'est trompée ; ajouter les cas limites listés au § 5 du contrat de fusion. Fait côté OTF le 14/11 : 17 cas conformes, O07 et O08 corrigés (cas v0.2, PR n° 3). Côté Tlaloc, T01 à T12 exécutés sur le vrai code (v421 puis v458), tous conformes (PR n° 5).
2. [À FAIRE] Compléter les durées de stade et jeux de saison (partie OTF § 4, déjà marqués non relus) : utile seulement pour la phase suivante (module Kc).
3. [TRANCHÉ : MC-34] Bassinage court sous serre : dans le moteur, avec coefficient d'efficacité (0,25 Tlaloc, 1 OTF).
4. [TRANCHÉ : MC-35] Calage du tensiomètre : côté Tlaloc, désactivé chez OTF.
5. [À TRANCHER] Origine de l'objectif rejoué sur le banc (ETM proposée adoptée chaque lundi, D-065) ; recommandation : cette origine, dite avec les résultats. Agronomique : à François quand le banc arrive.
6. [FAIT côté Tlaloc, PR n° 5 : § 11 de `contrat-moteur.md` mis à jour ; à relire côté OTF] Vérifier que les contrats sources et ce document ne se contredisent pas : le glossaire de Tlaloc § 11 point 1 (« résultats identiques ») est à reformuler comme dans leur proposition, le jeu OTF journalier reproduit OTF à l'identique.
7. Réponse du CRIIAM sur l'ETP (message envoyé par François le 14/11) : **reçue le 16/11** (capture transmise par François). Faits rapportés : (a) le CRIIAM calcule son ETP avec la formule FAO (Penman-Monteith) ; (b) ses Kc ont été établis avec d'autres formules d'ETP, sont jugés « pas très précis », et ne sont pas corrigés selon la formule d'ETP utilisée ; le coefficient de correction n'est pas connu ; (c) Météo-France n'utilise Penman-Monteith FAO-56 que depuis mars-mai 2026 (avant : Penman ou Penman-Monteith selon les produits) ; ses stations, très dégagées (aéroports), donnent souvent des ETP plus élevées que des stations de bord de parcelle ; (d) pour le CRIIAM, l'ETM ne donne qu'une indication, la précision vient des sondes. **Conséquence pour la phase 1 : aucune** (Kc et ETM hors du moteur, MC-17, MC-23). [À TRANCHER par François, agronomique, PR « Kc » à part] : faut-il une correction des Kc du CRIIAM selon la source d'ET0 d'OTF (Open-Meteo, Visual Crossing), et la comparaison ETP/ET0 sur une saison prévue à la question 8 reste-t-elle utile ? Rien n'est décidé.

8. [TRANCHÉ par François le 16/11 à 17 h 56 : les deux acceptées, **MC-31 (nature `borne_basse`) et MC-32 (paramètre `drainage_au_redemarrage`)** ; proposé par Nicolas le 16/11 en approuvant la PR n° 3 du dépôt commun] **Drainage au redémarrage (O07)** : les 0,7 mm sont un minimum que rien ne signale dans la sortie. Proposition : (a) une nature `borne_basse` sur ce drainage (MC-09 appliquée aux minimums) ; (b) un paramètre `drainage_au_redemarrage` : `depuis_capacite` (jeu OTF, comportement actuel, marqué borne basse) ou `inconnu` (jeu Tlaloc). Recommandation : accepter les deux ; rien ne change dans le chiffre affiché chez OTF.

9. [À TRANCHER, Nicolas et OTF] **Arrosage en intervalle, mode horaire** : MC-13 (partie OTF § 8 point 1) le découpe en tranches horaires au prorata de la durée ; le pas de calcul fusionné (`docs/pas-horaire.md`, choix 2) le compte d'un coup, à son début, comme Tlaloc aujourd'hui (le cas T02 en dépend). Le moteur v0.1.0 suit le pas fusionné. Aucun chiffre d'OTF n'en dépend (journalier).
10. [À RELIRE par Nicolas] Les choix du moteur v0.1.0 et v0.2.0 (`docs/moteur.md`, « Choix à relire », points 1 à 13 puis 14 à 20 pour les options de Tlaloc).

## 6. Journal

| Version | Date | Ce qui change |
|---|---|---|
| 0.2.6 brouillon | 2026-11-20 | Moteur v0.2.0 : les options de Tlaloc (poing en fourchette ou au centre de sa classe, tensiomètre, incertitude, consommation apprise ; contrat Tlaloc § 7 et § 8, MC-07, MC-20, MC-22, MC-35), désactivées dans le jeu OTF ; cas T08 à T11 exécutés, tous les cas O, L et T le sont désormais ; § 5 point 10 étendu ; titre, en-tête et § 4 bis point 5 (MC-34) mis à jour (remarques de Nicolas sur la PR n° 11). Aucune formule ni valeur de cas ne change. |
| 0.2.5 brouillon | 2026-11-20 | Moteur v0.1.0, le cœur du bilan (`src/`, `docs/moteur.md`), ses deux fichiers construits (MC-28) et ses contrôles ; MC-37 acceptée par Nicolas (PR n° 10) ; § 5 points 9 et 10 ajoutés. Aucune formule ni valeur de cas ne change. |
| 0.2.4 brouillon | 2026-11-20 | MC-37 proposée : borne haute de l'ET0 de 12 à 15 mm/j (partie OTF § 3, cas L6 avec les limites 11,9 / 12,1 / 14,9 / 15,1). Aucune formule ne change ; une seule valeur de cas change (L6). |
| 0.2.3 brouillon | 2026-11-18 | Côté Tlaloc : le pas de calcul MC-29 écrit en module autonome (`src/pas-horaire.ts`, `docs/pas-horaire.md`), avec 18 tests. Le jeu journalier reproduit OTF à 0,01 mm près. Aucune formule ni valeur de cas ne change. |
| 0.2.2 | 2026-11-18 | MC-36 (banc allégé, définition de la saison) ; MC-34 et MC-35 remises après MC-27 au § 4 ; ancienne ligne « 0.2.1 brouillon » renommée « 0.1.9 brouillon ». Aucune formule ni valeur de cas ne change. |
| 0.2.1 | 2026-11-17 | MC-34 (bassinage) et MC-35 (tensiomètre) ; table des réglages : `drainage_au_redemarrage` et bassinage court ; § 5 points 1, 3, 4, 6 mis à jour ; MC-27 sans mention d'outil. Aucune formule ni valeur de cas ne change. |
| 0.2 | 2026-11-16 | Publication de la v0.2 : MC-17 à MC-30 inscrites, MC-25 et MC-26 acceptées par Nicolas, MC-31 et MC-32 (borne basse, drainage au redémarrage), MC-33 (ET0 du banc), réponse du CRIIAM (§ 5 point 7). Aucune formule ni valeur de cas ne change. |
| 0.1.9 brouillon | 2026-11-14 | Réponse de Nicolas, tickets 1 et 2 ; MC-16 de Nicolas conservé, mes décisions renumérotées MC-17 à MC-27 ; MC-28 à MC-30 proposées. |
| 0.2 brouillon | 2026-11-14 | Structure fusionnée, jeux de réglages à jour, MC-17 à MC-27. Aucune formule recopiée. |
