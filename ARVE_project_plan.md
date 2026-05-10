# ARVE — Adaptive Regulation with Vital Envelope
## Plan de projet

> **Version** 0.1 — document fondateur  
> **Auteur** Frédérick Murat  
> **Licence** MIT  
> **Base** DVPA v1.26 — Dynamic Value Propagation Agent  

---

## Table des matières

1. [Vision et positionnement](#1-vision-et-positionnement)
2. [Contexte et héritage DVPA](#2-contexte-et-héritage-dvpa)
3. [Hypothèses fondatrices](#3-hypothèses-fondatrices)
4. [Architecture du modèle](#4-architecture-du-modèle)
5. [Spécification des modules](#5-spécification-des-modules)
6. [Fonction d'utilité unifiée](#6-fonction-dutilité-unifiée)
7. [Plan de développement](#7-plan-de-développement)
8. [Protocole d'évaluation](#8-protocole-dévaluation)
9. [Risques et limites anticipées](#9-risques-et-limites-anticipées)
10. [Références et positionnement académique](#10-références-et-positionnement-académique)

---

## 1. Vision et positionnement

### 1.1 Objectif

ARVE est un modèle d'agent autonome à **décision continue sans état terminal**, conçu pour naviguer dans des environnements partiellement observables sous contrainte énergétique stricte. Il prolonge DVPA en remplaçant toute logique de branchement par des **pressions continues émergentes**, sans apprentissage, sans réseau de neurones, et sans connaissance préalable de la carte.

### 1.2 Proposition de valeur

| Dimension | DVPA | ARVE |
|---|---|---|
| Décision survie/exploration | Seuil adaptatif | Pression continue α(t) |
| Anti-impasse | Mécanismes manuels N1/N2/N3 | Diffusion spatiale de ψ(s) |
| Mémoire temporelle | Rétrospective (positions visitées) | Prospective (trajectoires candidates) |
| Rythme interne | Aucun | Oscillateur endogène φ(t) |
| Nouveauté | Binaire (connu/inconnu) | Surprise prédictive η(a) |
| Résistance zone froide | Cellule par cellule | Diffusion spatiale λ-atténuée |

### 1.3 Périmètre

- **Inclus** : agent unique, grille 2D, environnement statique partiellement observable, contrainte énergétique, JavaScript pur (ES6+), HTML5 Canvas.
- **Exclu** : apprentissage par renforcement, réseaux de neurones, multi-agents, environnements dynamiques, serveur.

---

## 2. Contexte et héritage DVPA

### 2.1 Acquis de DVPA v1.26

DVPA constitue la fondation technique d'ARVE. Les modules suivants sont réutilisés sans modification majeure :

- **`world.js`** — carte, découverte progressive, propagation de valeurs BFS, `lowYieldMap` lazy
- **`frontier-manager.js`** — détection et ranking des frontières d'exploration
- **`budget-manager.js`** — calcul du coût de retour BFS et verrou d'urgence
- **`threshold-manager.js`** — seuil adaptatif (conservé à titre de référence et de comparaison)
- **Protocole de benchmark** — `benchmark.js`, seeds reproductibles, ablation L1/L2/L3, export CSV

### 2.2 Limites identifiées à résoudre

1. **Seuil résiduel** : même adaptatif, `adaptiveThreshold` reste un point de discontinuité dans la décision.
2. **Anti-impasse règle-based** : les mécanismes N1/N2/N3 sont fragiles sur topologies atypiques et ajoutent de la complexité de configuration.
3. **Absence de continuité temporelle** : l'agent réagit à l'état courant sans anticipation ni rythme propre.
4. **Nouveauté binaire** : une cellule est connue ou inconnue — aucune nuance sur la valeur de ce qui a été découvert.
5. **Résistance locale** : la pénalité `lowYieldMap` ne se propage pas spatialement, ce qui permet le contournement par cellule adjacente.

---

## 3. Hypothèses fondatrices

### H1 — La vie comme pression, pas comme seuil

La contrainte énergétique agit en permanence sur **tous** les poids de la fonction d'utilité. Il n'existe pas d'état "mode survie" — seulement un gradient continu entre appétence exploratoire et urgence de retour.

### H2 — L'émergence remplace les règles

Les comportements complexes (anti-impasse, rythme, prudence) doivent émerger de la dynamique des champs de pression, non de conditions `if/else`. Un système avec moins de règles explicites et plus de couplages dynamiques est plus robuste aux topologies inattendues.

### H3 — La prospective est légère ou elle ne vaut rien

La planification n'est utile que si son coût computationnel reste inférieur au gain décisionnel. ARVE n'utilise que 3 à 5 séquences candidates sur N ≤ 4 pas, évaluées sur le gradient de valeur connu — pas de simulation du monde.

### H4 — Le rythme brise la symétrie

Un oscillateur interne à dérive lente résout les situations de symétrie décisionnelle (deux directions d'utilité égale) sans introduire d'aléatoire pur. Le rythme est une propriété endogène, pas un bruit.

---

## 4. Architecture du modèle

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOUCLE PRINCIPALE                        │
│                                                                 │
│   Monde partiel ──► Perception ──► Moteur de décision           │
│       ▲                               │                         │
│       └───────────── Action ◄─────────┘                         │
└─────────────────────────────────────────────────────────────────┘

Signaux modulateurs (entrées continues vers Moteur de décision) :

  Horloge interne φ(t)       ──►  arousal α ∈ [0,1]
  Budget énergie ĉ(t)        ──►  poids retour continu
  Gradient valeur V(s)        ──►  attraction récompense
  Résistance zone ψ(s)        ──►  répulsion spatiale diffuse
  Frontières actives          ──►  gradient d'incertitude
  Surprise prédictive η(a)    ──►  bonus nouveauté
  Cohérence trajectoire κ(a)  ──►  régularité de direction
  Mémoire prospective π̂      ──►  séquences candidates
```

### 4.1 Flux de décision

```
tick → beginTick()
     → discoverSurroundings()
     → propagateValues()          // V(s) BFS
     → diffuseLowYield()          // ψ(s) spatial
     → updateProspectiveMemory()  // π̂ N-step
     → updateArousal()            // α(t) via φ(t)
     → scoreDirections()          // U(a) continu
     → move()
     → updateLowYieldMemory()
     → updateClock()              // φ(t) += Δφ
```

---

## 5. Spécification des modules

### 5.1 `clock-manager.js` — Horloge interne *(nouveau)*

**Responsabilité** : maintenir un oscillateur endogène φ(t) ∈ [0, 2π] à dérive lente, et en dériver l'arousal α(t).

**Interface** :
```javascript
class ARVEClockManager {
  constructor(config)
  tick()                        // φ(t) += config.clockDrift + bruit(ε)
  getArousal()                  // α = (1 + sin(φ)) / 2  ∈ [0,1]
  getPhase()                    // φ courant
}
```

**Paramètres de configuration** :

| Paramètre | Valeur par défaut | Rôle |
|---|---|---|
| `clockDrift` | `0.05` | Vitesse de progression de φ (rad/tick) |
| `clockNoise` | `0.005` | Bruit additif — brise les cycles parfaits |
| `arousalMin` | `0.2` | Plancher de l'arousal (jamais totalement inerte) |
| `arousalMax` | `0.9` | Plafond (jamais totalement indifférent à l'énergie) |

**Comportement attendu** : sur une période complète (~125 ticks à drift=0.05), l'agent traverse une phase exploratoire (α élevé → poids information fort) puis une phase de consolidation (α bas → poids retour fort). Ce cycle n'est pas rigide — la dérive lente et le bruit empêchent toute périodicité exacte.

---

### 5.2 `prospective-memory.js` — Mémoire prospective *(nouveau)*

**Responsabilité** : générer et évaluer un petit ensemble de séquences d'actions candidates sur N pas.

**Interface** :
```javascript
class ARVEProspectiveMemory {
  constructor(config, world, frontierManager)
  update(agentPosition, budgetStatus)   // régénère les séquences
  getBestHead()                         // retourne la meilleure 1ère action
  getCandidates()                       // retourne toutes les séquences scorées
}
```

**Algorithme** :
1. À partir de la position courante, générer `config.prospectiveBranches` séquences de `config.prospectiveDepth` pas par expansion greedy pondérée (pas de BFS complet — projection sur gradient V(s)).
2. Scorer chaque séquence par utilité cumulée actualisée : `Score(π) = Σ γ^k · U(aₖ)`.
3. Retourner la première action de la meilleure séquence.

**Paramètres** :

| Paramètre | Valeur par défaut | Rôle |
|---|---|---|
| `prospectiveBranches` | `4` | Nombre de séquences candidates |
| `prospectiveDepth` | `3` | Longueur de chaque séquence |
| `prospectiveGamma` | `0.8` | Actualisation inter-pas |
| `prospectiveRecomputeEvery` | `3` | Fréquence de régénération (ticks) |

**Contrainte computationnelle** : le nombre d'évaluations d'utilité par tick est au plus `branches × depth = 12`. Acceptable dans la boucle temps réel.

---

### 5.3 `diffusion-manager.js` — Résistance spatiale diffuse *(nouveau)*

**Responsabilité** : propager la pénalité de zone froide ψ(s) vers les cellules voisines avec atténuation, remplaçant la `lowYieldMap` cellule par cellule de DVPA.

**Interface** :
```javascript
class ARVEDiffusionManager {
  constructor(config, world)
  updateFromPosition(position, context)  // met à jour ψ(s) + diffuse
  getPenalty(position)                   // ψ décayée (lazy)
  diffuseStep()                          // propagation aux voisins (appelée par world)
}
```

**Algorithme de diffusion** :
```
Pour chaque cellule c avec ψ(c) > seuil_diffusion :
  Pour chaque voisin v de c :
    ψ(v) = max(ψ(v), ψ(c) × λ_diffusion)
```

Exécuté une fois par tick, lazy (seulement les cellules actives).

**Paramètres** :

| Paramètre | Valeur par défaut | Rôle |
|---|---|---|
| `diffusionLambda` | `0.4` | Facteur d'atténuation spatiale |
| `diffusionThreshold` | `0.1` | Seuil minimal pour diffuser |
| `diffusionMaxRadius` | `3` | Rayon maximal de propagation |

**Effet attendu** : un couloir de 3 cellules fréquemment traversé sans gain génère une zone répulsive de rayon ~3 cellules, rendant le contournement par cellule adjacente inefficace. L'anti-impasse N1/N2/N3 devient superflu.

---

### 5.4 `surprise-estimator.js` — Surprise prédictive *(nouveau)*

**Responsabilité** : estimer la surprise η(a) d'une action avant de la prendre, en comparant la prédiction locale au résultat attendu.

**Interface** :
```javascript
class ARVESurpriseEstimator {
  constructor(config, world)
  predict(position)              // prédit le contenu des cellules voisines
  computeSurprise(action)        // η = divergence(prédit, base-rate)
  updateModel(position, actual)  // met à jour le modèle local après découverte
}
```

**Modèle local** : pour chaque cellule découverte, l'estimateur maintient un historique de densité locale (ratio obstacles/récompenses/vide dans un rayon R). La surprise η(a) est la divergence entre la prédiction par ce prior et le cas uniforme. Si une zone dense en récompenses vient d'être découverte, les cellules adjacentes inexplorées ont un prior favorable → η élevé → elles sont explorées en priorité.

**Paramètres** :

| Paramètre | Valeur par défaut | Rôle |
|---|---|---|
| `surpriseRadius` | `5` | Rayon du prior local (en cellules) |
| `surpriseWeight` | `0.5` | Poids η dans U(a) |
| `surpriseDecay` | `0.95` | Décroissance du prior local |

**Note** : ce module est le plus ambitieux. Il peut être désactivé (`enableSurprise: false`) pour comparer son apport empiriquement.

---

### 5.5 `arve-agent.js` — Agent ARVE *(refactorisé)*

Remplace `agent.js` de DVPA. Conserve la même interface de construction mais remplace :
- `chooseContinuousDirection()` → intègre α(t), π̂, η(a), κ(a)
- `applyEscapePolicy()` → supprimé (remplacé par diffusion ψ)
- `updateEscapeMode()` → supprimé
- `updatePath()` → conservé

Ajoute :
- `computeCoherenceBonus(direction)` → κ(a) : récompense la continuité de direction
- `integrateProspectiveHead()` → fusionne la tête de séquence π̂ avec le score U(a)

---

### 5.6 `world.js` — Évolutions *(modifications mineures)*

- Ajouter `diffuseLowYield(diffusionManager)` appelé par la boucle principale
- Exposer `getNeighborValues(position)` pour la mémoire prospective
- Supprimer la dépendance aux niveaux d'impasse (N1/N2/N3) de l'état

---

## 6. Fonction d'utilité unifiée

```
U(a) = α(t) · [wᵢ · I(a) + wₙ · η(a)] 
     − wc · 1 
     − wr · ĉ(t) · R(a) 
     − wψ · ψ(nextPos(a)) 
     + wκ · κ(a)
```

### Décomposition des termes

| Terme | Symbole | Description |
|---|---|---|
| Gain informationnel | `I(a)` | Frontières + nouveauté cellule + progression (hérité DVPA) |
| Surprise prédictive | `η(a)` | Divergence prior local vs uniforme |
| Coût de déplacement | `wc · 1` | Stamina, constant |
| Dette de retour | `wr · ĉ(t) · R(a)` | Énergie requise pour revenir, pondérée par budget |
| Résistance zone | `wψ · ψ(nextPos)` | Pénalité low-yield diffuse |
| Cohérence | `wκ · κ(a)` | Bonus si direction alignée avec Δ récent |

### Rôle de α(t)

L'arousal `α(t) ∈ [arousalMin, arousalMax]` module globalement les termes informationnels `I(a)` et `η(a)`. Quand α est bas (phase de consolidation), ces termes sont atténués et le poids relatif de la dette de retour augmente mécaniquement — sans qu'aucune règle ne le prescrive.

### Paramètres de pondération

| Paramètre | Valeur initiale | Rôle |
|---|---|---|
| `utilityInfoWeight` | `1.0` | `wᵢ` |
| `utilitySurpriseWeight` | `0.5` | `wₙ` |
| `utilityCostWeight` | `0.35` | `wc` |
| `utilityReturnDebtWeight` | `2.5` | `wr` |
| `utilityLowYieldWeight` | `0.6` | `wψ` |
| `utilityCoherenceWeight` | `0.3` | `wκ` |

---

## 7. Plan de développement

### Phase A — Fondations et nettoyage *(~1 semaine)*

**Objectif** : repartir de DVPA v1.26 dans un état propre, supprimer ce qui sera remplacé, préparer le terrain.

| Tâche | Détail |
|---|---|
| A1 | Créer branche `arve/main` depuis DVPA v1.26 |
| A2 | Supprimer la logique N1/N2/N3 de `agent.js` |
| A3 | Supprimer `applyEscapePolicy()`, `updateEscapeMode()`, `findWallFollowerDirection()` |
| A4 | Conserver `threshold-manager.js` comme module de comparaison (non actif par défaut) |
| A5 | Mettre à jour `benchmark.js` pour retirer les métriques N1/N2/N3 devenues caduques |
| A6 | Ajouter flag `--baseline-dvpa` dans benchmark pour comparaison croisée |

**Livrable** : ARVE-A — DVPA nettoyé, fonctionnel, sans régression sur le benchmark.

---

### Phase B — Diffusion spatiale *(~1 semaine)*

**Objectif** : implémenter `diffusion-manager.js` et valider qu'il remplace effectivement l'anti-impasse manuel.

| Tâche | Détail |
|---|---|
| B1 | Implémenter `ARVEDiffusionManager` avec propagation lazy |
| B2 | Intégrer dans la boucle `world.js` (`diffuseLowYield()`) |
| B3 | Remplacer `wψ · lowYieldPenalty` par `wψ · ψ(nextPos)` dans `agent.js` |
| B4 | Ablation : benchmark avec/sans diffusion sur scénarios topologies contraintes |
| B5 | Tuning de `diffusionLambda` et `diffusionMaxRadius` sur le benchmark |
| B6 | Ajouter visualisation de la carte ψ(s) dans `index.html` (overlay optionnel) |

**Livrable** : ARVE-B — résistance spatiale diffuse active, benchmarkée.

**Critère de succès** : taux de survie ≥ DVPA v1.26 sur scénarios topologies contraintes, sans mécanismes N1/N2/N3.

---

### Phase C — Horloge interne et arousal *(~1 semaine)*

**Objectif** : implémenter `clock-manager.js` et valider l'effet de l'oscillateur sur la distribution exploration/retour.

| Tâche | Détail |
|---|---|
| C1 | Implémenter `ARVEClockManager` (oscillateur + arousal) |
| C2 | Intégrer α(t) dans `chooseContinuousDirection()` |
| C3 | Ajouter visualisation de φ(t) et α(t) dans l'interface (mini-graphe ou indicateur) |
| C4 | Benchmark : comparer couverture et énergie finale avec/sans horloge |
| C5 | Tuning de `clockDrift` et `arousalMin/Max` |
| C6 | Documenter les effets observés sur le comportement émergent |

**Livrable** : ARVE-C — oscillateur actif, effets de rythme documentés empiriquement.

**Critère de succès** : variabilité de couverture réduite (écart-type inter-runs ↓) par rapport à DVPA, sans dégradation du taux de survie.

---

### Phase D — Mémoire prospective *(~1 semaine)*

**Objectif** : implémenter `prospective-memory.js` et valider l'apport sur les décisions à court horizon.

| Tâche | Détail |
|---|---|
| D1 | Implémenter `ARVEProspectiveMemory` (génération + scoring de séquences) |
| D2 | Intégrer la tête de séquence dans `chooseContinuousDirection()` |
| D3 | Ablation : benchmark avec/sans mémoire prospective |
| D4 | Tuning de `prospectiveBranches`, `prospectiveDepth`, `prospectiveGamma` |
| D5 | Mesurer l'impact CPU (ticks/seconde) avec et sans le module |
| D6 | Ajouter visualisation des séquences candidates dans `index.html` (optionnel) |

**Livrable** : ARVE-D — mémoire prospective active, apport mesuré.

**Critère de succès** : amélioration mesurable de la couverture moyenne sans dégradation du taux de survie, overhead CPU < 15%.

---

### Phase E — Surprise prédictive *(~2 semaines)*

**Objectif** : implémenter `surprise-estimator.js` — module le plus complexe, avec son prior local.

| Tâche | Détail |
|---|---|
| E1 | Implémenter le modèle de prior local (densité dans rayon R) |
| E2 | Implémenter le calcul de divergence η(a) |
| E3 | Implémenter la mise à jour du modèle post-découverte |
| E4 | Intégrer η(a) dans U(a) |
| E5 | Ablation complète : benchmark avec/sans surprise, tous scénarios |
| E6 | Analyse qualitative : l'agent suit-il les clusters de récompenses ? |

**Livrable** : ARVE-E — surprise prédictive active, comportement d'exploration en cluster documenté.

**Critère de succès** : amélioration significative de l'énergie finale moyenne sur scénarios à récompenses clusterisées.

---

### Phase F — Intégration et benchmark comparatif *(~1 semaine)*

**Objectif** : intégration complète, benchmark ARVE vs DVPA vs random walk, documentation finale.

| Tâche | Détail |
|---|---|
| F1 | Intégration complète de tous les modules dans `arve-agent.js` |
| F2 | Benchmark complet (500 runs, tous scénarios) ARVE vs DVPA v1.26 vs random walk |
| F3 | Rapport comparatif 3 voies (adapter `compare-three-way.js`) |
| F4 | Tableau paper-ready (adapter `export-paper-table.js`) |
| F5 | Rédaction du README ARVE complet |
| F6 | Nettoyage du code, JSDoc sur tous les nouveaux modules |
| F7 | Release tag `arve/v1.0` |

**Livrable** : ARVE v1.0 — système complet, benchmarké, documenté.

---

### Tableau de synthèse

```
Semaine 1    │ Phase A — Fondations et nettoyage
Semaine 2    │ Phase B — Diffusion spatiale
Semaine 3    │ Phase C — Horloge interne et arousal
Semaine 4    │ Phase D — Mémoire prospective
Semaines 5-6 │ Phase E — Surprise prédictive
Semaine 7    │ Phase F — Intégration et benchmark comparatif
```

---

## 8. Protocole d'évaluation

### 8.1 Métriques principales (héritées DVPA)

| Métrique | Description |
|---|---|
| `survival_rate` | Proportion de runs sans mort de l'agent |
| `final_energy_mean` | Énergie moyenne à t_max sur les runs survivants |
| `coverage_mean` | Couverture moyenne de la carte (cellules libres découvertes) |

### 8.2 Métriques nouvelles ARVE

| Métrique | Description |
|---|---|
| `arousal_mean` | Valeur moyenne de α(t) sur un run |
| `arousal_variance` | Variance de α(t) — mesure le dynamisme de l'oscillateur |
| `prospective_hit_rate` | Fréquence où la tête de séquence prospective est choisie vs override |
| `diffusion_active_cells` | Nombre moyen de cellules avec ψ > seuil — mesure l'extension de la répulsion |
| `surprise_gain_mean` | Contribution moyenne de η(a) au score U(a) final |
| `direction_coherence` | Fréquence des changements de direction — mesure la fluidité du déplacement |

### 8.3 Scénarios de benchmark

| Scénario | `numObstacles` | `numRewards` | Topologie |
|---|---|---|---|
| Sparse | 1000 | 15 | Espace ouvert |
| Standard | 2500 | 30 | Référence DVPA |
| Dense | 4000 | 30 | Couloirs étroits |
| Reward-clustered | 2500 | 30 | Récompenses groupées |
| Reward-sparse | 2500 | 10 | Récompenses rares |

### 8.4 Protocole d'ablation

Chaque module peut être désactivé indépendamment :

```
node benchmark.js --no-clock          // sans horloge interne
node benchmark.js --no-prospective    // sans mémoire prospective
node benchmark.js --no-diffusion      // sans résistance diffuse (retour lowYieldMap DVPA)
node benchmark.js --no-surprise       // sans surprise prédictive
node benchmark.js --baseline-dvpa     // DVPA v1.26 pur (référence)
node benchmark.js --full              // tous modules actifs
```

### 8.5 Seuils de validation par phase

| Phase | Condition de succès minimale |
|---|---|
| B | Survie ≥ DVPA sur topologies contraintes, N1/N2/N3 retirés |
| C | Variance de couverture inter-runs ↓ sans régression survie |
| D | Couverture ↑ sans overhead CPU > 15% |
| E | Énergie finale ↑ sur scénarios clusterisés |
| F | ARVE > DVPA sur ≥ 3 scénarios sur 5, toutes métriques principales |

---

## 9. Risques et limites anticipées

### 9.1 Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Oscillateur φ(t) → comportement périodique rigide | Moyenne | Moyen | Noise additif + dérive non-linéaire optionnelle |
| Diffusion ψ trop agressive → zones répulsives trop larges | Haute | Haut | λ faible par défaut + cap `diffusionMaxRadius` |
| Mémoire prospective → overhead CPU prohibitif | Faible | Haut | Benchmark systématique, fallback `prospectiveDepth=1` |
| Surprise prédictive → prior instable au début de run | Haute | Moyen | Prior uniforme jusqu'à N cellules découvertes |
| Accumulation de dette de modules → comportement imprévisible | Moyenne | Haut | Ablation systématique par phase avant intégration |

### 9.2 Limites inhérentes au modèle

- **Pas de garantie d'optimalité** : ARVE reste un système heuristique. Sur des topologies très fragmentées ou des configurations adversariales, le comportement peut dégrader.
- **Sensibilité aux pondérations** : la fonction U(a) a maintenant 6 poids. Le risque d'overfitting sur les scénarios de benchmark est réel. Les presets (Agressif/Équilibré/Conservateur) doivent être maintenus.
- **Oscillateur non-adaptatif** : φ(t) bat à fréquence fixe. Si la topologie est particulièrement défavorable pendant une phase de consolidation, l'agent ne peut pas accélérer son cycle.
- **Modèle de surprise simplifié** : le prior local n'est pas bayésien. Il peut être trompé par des distributions de récompenses atypiques.

---

## 10. Références et positionnement académique

### 10.1 Composants et références

| Composant ARVE | Travaux de référence |
|---|---|
| Exploration par frontières | Yamauchi, B. (1997). *A frontier-based approach for autonomous exploration.* CIRA. |
| Propagation de valeurs | Bellman, R. (1957). *Dynamic programming.* Princeton UP. |
| Budget énergétique continu | Laporte, G. et al. (1995). *The vehicle routing problem with stochastic demands.* Annals of OR. |
| Champs potentiels répulsifs | Khatib, O. (1986). *Real-time obstacle avoidance for manipulators and mobile robots.* IJRR. |
| Curiosité / surprise prédictive | Pathak et al. (2017). *Curiosity-driven exploration by self-supervised prediction.* ICML. |
| Exploration sans carte | Thrun, S. (1992). *The role of exploration in learning control.* Handbook of Intelligent Control. |
| MPC / planification courte | Camacho, E., Bordons, C. (2004). *Model Predictive Control.* Springer. |
| Rythmes endogènes en robotique | Cyr, A., Thériault, F. (2013). *Artificial circadian rhythms for autonomous agents.* ICDL-Epirob. |

### 10.2 Positionnement

ARVE n'est pas une contribution théorique au sens strict. Sa contribution défendable est :

> *Un assemblage minimal viable d'heuristiques connues — oscillateur endogène, diffusion spatiale de résistance, mémoire prospective légère, surprise prédictive — produisant un comportement adaptatif émergent continu dans un agent sans apprentissage, évalué empiriquement sur un protocole reproductible avec ablation systématique.*

Ce positionnement est cohérent avec les travaux de la communauté **behavior-based robotics** (Brooks, 1991) et des **light-weight autonomous agents** pour systèmes embarqués.

### 10.3 Différence avec le deep RL

ARVE fait le choix inverse du deep reinforcement learning : pas de réseau, pas d'apprentissage offline, pas de replay buffer. L'intelligence est dans la structure des champs de pression, pas dans des poids appris. Ce choix limite les performances sur des environnements complexes mais garantit l'interprétabilité, la légèreté, et la capacité à fonctionner dès le premier tick sans phase de training.

---

## Annexe A — Arborescence cible du projet

```
arve/
├── index.html                  # Interface principale
├── world.js                    # Carte, découverte, propagation (évolué)
├── frontier-manager.js         # Frontières (hérité DVPA, inchangé)
├── budget-manager.js           # Budget énergie (hérité DVPA, inchangé)
├── threshold-manager.js        # Seuil adaptatif (référence, non actif)
├── clock-manager.js            # [NOUVEAU] Horloge interne φ(t)
├── prospective-memory.js       # [NOUVEAU] Mémoire prospective π̂
├── diffusion-manager.js        # [NOUVEAU] Résistance spatiale diffuse
├── surprise-estimator.js       # [NOUVEAU] Surprise prédictive η(a)
├── arve-agent.js               # [REFACTORISÉ] Agent ARVE
├── benchmark.js                # Benchmark (évolué, flags ablation ARVE)
├── compare-benchmarks.js       # Comparaison ARVE vs DVPA (hérité)
├── compare-three-way.js        # Comparaison 3 voies (hérité)
├── export-paper-table.js       # Export tableau (hérité)
├── random-walk-benchmark.js    # Baseline naive (hérité)
├── README.md                   # Documentation ARVE
└── CHANGELOG.md                # Historique
```

## Annexe B — Glossaire

| Terme | Définition |
|---|---|
| φ(t) | Phase de l'oscillateur interne, ∈ [0, 2π], croît à chaque tick |
| α(t) | Arousal dérivé de φ(t), scalaire ∈ [arousalMin, arousalMax] |
| ĉ(t) | Coût de retour BFS normalisé par maxHealth |
| ψ(s) | Pénalité de résistance de zone à la position s, avec diffusion spatiale |
| η(a) | Surprise prédictive de l'action a — divergence prior local vs uniforme |
| κ(a) | Bonus de cohérence de trajectoire — alignement avec direction récente |
| π̂ | Ensemble des séquences candidates de la mémoire prospective |
| V(s) | Valeur d'état à la position s — propagation BFS depuis récompenses |
| U(a) | Utilité continue de l'action a — fonction de décision unifiée |
| λ | Facteur d'atténuation spatiale dans la diffusion de ψ |

---

*Document vivant — à mettre à jour à chaque livrable de phase.*
