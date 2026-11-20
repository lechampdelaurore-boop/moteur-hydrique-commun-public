# Moteur hydrique commun (OTF et Tlaloc)

Dépôt commun à François (module d'irrigation OTF) et Nicolas (Tlaloc). Le but : un seul moteur de calcul de l'eau (consommation des cultures, état du sol, drainage, eau perdue, projection), enrichi à deux. Chaque logiciel garde sa propre couche de décision.

**État : moteur v0.1.0, le cœur du bilan (phase 1, MC-18), à relire ; pas encore branché dans OTF ni dans Tlaloc.** Mode d'emploi : `docs/moteur.md`. Licence : PolyForm Shield 1.0.0 (voir `LICENSE` et `NOTICE`).

## Contenu
- `docs/sources/proposition-tlaloc-v0.1.md` : proposition de Nicolas (7 novembre 2026).
- `docs/sources/moteur-otf-v1.0.md` : description du moteur d'OTF (commit 64c2e87).
- `docs/contrat-moteur.md` : ébauche du contrat côté Tlaloc (v0.1.1).
- `docs/contrat-moteur-fusionne.md` : **contrat fusionné v0.2** (structure, jeux de réglages, décisions MC-16 à MC-37) ; les formules restent dans les deux contrats ci-dessous.
- `docs/contrat-moteur-partie-otf.md` : partie OTF du contrat (v0.2) et corrections de glossaire proposées.
- `cas/cas-tlaloc.json`, `cas/cas-otf.json` : cas de test chiffrés de chaque côté.
- `docs/ref-tlaloc/` : implémentation de référence de Tlaloc (sert à calculer les sorties attendues ; `node docs/ref-tlaloc/cas.mjs` réécrit `cas/cas-tlaloc.json`).
- `src/pas-horaire.ts`, `tests/pas-horaire.test.ts`, `docs/pas-horaire.md` : le pas de calcul d'un jour, en mode horaire (jeu Tlaloc) et journalier (jeu OTF), MC-29.
- `src/moteur.ts` (point d'entrée), `src/bilan.ts` (le suivi jour par jour), `src/pluie.ts` (pluie utile), `src/reglages.ts` (jeux OTF et Tlaloc), `docs/moteur.md` (mode d'emploi, choix à relire) : le moteur v0.1.0.
- `dist/moteur-hydrique.mjs` (module ES, pour OTF) et `dist/moteur-hydrique.js` (script classique, variable globale `MoteurHydrique`, pour Tlaloc) : construits depuis `src/` (MC-28), ne pas les modifier à la main.
- `tests/` : les tests ; `scripts/cas.ts` exécute les cas partagés ; `scripts/comparer-jauge-otf.ts` compare le jeu OTF au vrai code de la jauge d'OTF ; `.github/workflows/controles.yml` lance tout à chaque PR.
- `docs/sources/comparaison-kc-gel-tlaloc-otf.md` : comparaison des Kc (CRIIAM, FAO-56, Tlaloc) et des seuils de gel (fiche FRAB), document de travail côté Tlaloc.

## Contrôles

Node 22.6 ou plus. `npm ci`, puis `npm run controles` (types, fichiers construits à jour, tests) et `npm run cas -- --dist` (rapport des cas valeur par valeur). Après un changement de `src/` : `npm run build`. Détail dans `docs/moteur.md`.

## Règle pour ne rien écrire de contradictoire
1. **Toute modification passe par une PR relue par l'autre côté.** Pas d'écriture directe sur `main`.
2. **Le contrat est mis à jour dans la même PR**, avec la ligne du journal des changements et le numéro de version.
3. Un changement qui touche le comportement d'un des deux logiciels se **discute avant d'être écrit**.
4. Quand deux choix se défendent, on en fait un **paramètre** avec un jeu de réglages par logiciel.
5. Une décision agronomique d'OTF passe par François ; chaque logiciel fige la version du moteur qu'il utilise.

## Méthode pour les Claude de chacun
Chaque côté travaille avec son Claude. Pour éviter les copier-coller, **tout passe par ce dépôt** :
- Une question ou un désaccord s'écrit dans une **PR ou un commentaire d'issue**, jamais dans un message privé.
- Chaque Claude **lit la PR en entier** (description, fichiers, commentaires) avant de répondre, et répond **dans la PR**.
- Une réponse dit : ce qui est accepté, ce qui est refusé, avec la raison et la ligne du contrat concernée.
- Chaque décision reçoit un numéro (`MC-01`, `MC-02`…) dans le contrat ; on cite ce numéro, on ne répète pas le texte.
- Les humains tranchent en commentant la PR ; leur mot est le dernier.

## Licence

Ce dépôt est sous la licence [PolyForm Shield 1.0.0](LICENSE) : on peut l'utiliser, l'étudier et le modifier, y compris dans une ferme, mais pas le revendre ni l'offrir en service concurrent. Chaque auteur ajoute sa propre ligne `Required Notice:` dans `NOTICE`.
