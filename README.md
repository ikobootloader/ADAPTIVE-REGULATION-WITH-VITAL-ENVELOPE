# ARVE — Adaptive Regulation with Vital Envelope

> **Version** 0.1
> **Auteur** Frédérick Murat
> **Licence** MIT
> **Base** DVPA v1.29 — Dynamic Value Propagation Agent

---

## Vue d'ensemble

ARVE est un modèle d'agent autonome à **décision continue sans état terminal**, conçu pour naviguer dans des environnements partiellement observables sous contrainte énergétique stricte.

Il prolonge DVPA en remplaçant toute logique de branchement par des **pressions continues émergentes**, sans apprentissage, sans réseau de neurones, et sans connaissance préalable de la carte.

## Proposition de valeur

| Dimension | DVPA | ARVE |
|---|---|---|
| Décision survie/exploration | Seuil adaptatif | Pression continue α(t) |
| Anti-impasse | Mécanismes manuels N1/N2/N3 | Diffusion spatiale de ψ(s) |
| Mémoire temporelle | Rétrospective (positions visitées) | Prospective (trajectoires candidates) |
| Rythme interne | Aucun | Oscillateur endogène φ(t) |
| Nouveauté | Binaire (connu/inconnu) | Surprise prédictive η(a) |
| Résistance zone froide | Cellule par cellule | Diffusion spatiale λ-atténuée |

## Architecture

### Modules métier

ARVE étend DVPA avec les modules suivants :

**Hérités de DVPA (réutilisés) :**
- `world.js` — Carte, découverte progressive, propagation BFS
- `frontier-manager.js` — Détection et ranking des frontières
- `budget-manager.js` — Calcul du coût de retour BFS et verrou d'urgence
- `threshold-manager.js` — Seuil adaptatif (référence, non actif)

**Nouveaux modules ARVE :**
- `clock-manager.js` — Horloge interne φ(t) et arousal α(t)
- `prospective-memory.js` — Mémoire prospective π̂ (séquences N-step)
- `diffusion-manager.js` — Résistance spatiale diffuse ψ(s)
- `surprise-estimator.js` — Surprise prédictive η(a)
- `arve-agent.js` — Agent ARVE unifié

### Fonction d'utilité

```
U(a) = α(t) · [wᵢ · I(a) + wₙ · η(a)]
     − wc · 1
     − wr · ĉ(t) · R(a)
     − wψ · ψ(nextPos(a))
     + wκ · κ(a)
```

**Termes :**
- `I(a)` : gain informationnel (frontières + nouveauté)
- `η(a)` : surprise prédictive (divergence prior local)
- `α(t)` : arousal dérivé de l'oscillateur φ(t)
- `ĉ(t)` : coût de retour normalisé
- `ψ(s)` : pénalité zone froide diffusée
- `κ(a)` : cohérence de trajectoire

## Utilisation

### Prérequis

- Navigateur moderne (Chrome, Firefox, Edge)
- Aucune installation requise

### Exécution

Ouvrir `index.html` dans un navigateur.

### Benchmark (headless)

```bash
node benchmark.js [runs] [seed] [width] [height]
```

**Flags d'ablation :**
```bash
node benchmark.js --no-clock          # Sans horloge interne
node benchmark.js --no-prospective    # Sans mémoire prospective
node benchmark.js --no-diffusion      # Sans résistance diffuse
node benchmark.js --no-surprise       # Sans surprise prédictive
node benchmark.js --baseline-dvpa     # DVPA v1.29 pur
node benchmark.js --full              # Tous modules actifs
```

## Stack technique

- JavaScript pur (ES6+)
- HTML5 Canvas
- Architecture locale sans serveur

## Visualisation runtime

- Overlay diffusion ψ(s) en rouge (activable/désactivable)
- Overlay des zones revisitées en bleu (activable/désactivable)
- Overlay des frontières détectées en violet/magenta (activable/désactivable)
- Overlay du coût de retour en dégradé ambre → brun (activable/désactivable)
- Overlay de surprise locale η en cyan/turquoise (activable/désactivable)
- Rendu optimisé : caches d'overlays recalculés par tick et grille Canvas précalculée
- Passe ultra-perf : mise à jour incrémentale des caches basée sur les cellules nouvellement découvertes
- Passe perf ciblée revisites : cache dédié des cellules revisitées et exclusion obstacle/récompense sans reconstruction complète par frame
- Passe 4 revisites : décroissance lazy O(1) des visites dans `arve-world.js` + lecture optimisée côté overlay
- Explanation UI enrichie : parcours "débutant + expert", cycle de décision, lecture des stats/overlays et glossaire
- Micro-UX explanation : blocs visuels différenciés débutant/expert, synthèse rapide et présentation orientée modèle ARVE global
- Densification pédagogique : scénarios concrets "si X alors Y" et méthode rapide de lecture des décisions
- Commentaires techniques renforcés sur les fonctions critiques pour faciliter maintenance et onboarding
- Runtime ARVE autonome : l'application ARVE ne charge plus de modules depuis `DVPA/`
- Organisation code : modules JavaScript ARVE regroupés dans le répertoire `js/`
- API globale nettoyée : suppression des alias de transition `DVPA*`, exposition `ARVE*` uniquement

## Hypothèses fondatrices

### H1 — La vie comme pression, pas comme seuil

La contrainte énergétique agit en permanence sur tous les poids de la fonction d'utilité. Il n'existe pas d'état "mode survie" — seulement un gradient continu.

### H2 — L'émergence remplace les règles

Les comportements complexes (anti-impasse, rythme, prudence) émergent de la dynamique des champs de pression, non de conditions `if/else`.

### H3 — La prospective est légère ou elle ne vaut rien

Planification limitée à 3-5 séquences candidates sur N ≤ 4 pas, évaluées sur le gradient de valeur connu.

### H4 — Le rythme brise la symétrie

Un oscillateur interne à dérive lente résout les situations de symétrie décisionnelle sans aléatoire pur.

## État du développement

**Phase actuelle :** Phase F — Intégration finale (en cours)

Voir [ARVE_project_plan.md](ARVE_project_plan.md) pour le plan détaillé.

### Phases prévues

1. **Phase A** — Fondations et nettoyage
2. **Phase B** — Diffusion spatiale
3. **Phase C** — Horloge interne et arousal
4. **Phase D** — Mémoire prospective
5. **Phase E** — Surprise prédictive
6. **Phase F** — Intégration et benchmark comparatif

## Comparaison avec DVPA

ARVE transforme les décisions binaires de DVPA en gradients continus :

| Aspect | DVPA | ARVE |
|---|---|---|
| Type de décision | Seuil + branchements | Utilité continue |
| Anti-impasse | N1/N2/N3 (règles) | Diffusion spatiale ψ |
| Temporalité | Aucune | Oscillateur φ(t) |
| Planification | Réactive | Prospective (N-step) |
| Nouveauté | Binaire | Surprise η(a) |

## Limites connues

- Pas de garantie d'optimalité globale
- Sensibilité aux pondérations (6 poids dans U(a))
- Oscillateur non-adaptatif (fréquence fixe)
- Prior local simplifié (non bayésien)

## Références

Le projet s'inscrit dans la tradition des **behavior-based robotics** (Brooks, 1991) et des **light-weight autonomous agents** pour systèmes embarqués.

Voir section 10 du [ARVE_project_plan.md](ARVE_project_plan.md) pour les références détaillées.

## Licence

MIT License
