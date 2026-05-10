# Changelog

Toutes les modifications notables du projet ARVE sont documentÃ©es ici.

Le format est basÃ© sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non publiÃ©]

### En cours
- Phase F â€” IntÃ©gration et benchmark comparatif (Ã  venir)

---

## [0.1-F] - 2026-05-10

### Phase F â€” IntÃ©gration finale (consolidation)

### ModifiÃ©
- `arve-agent.js` :
  - intÃ©gration des flags dâ€™ablation runtime `enableDiffusion`, `enableClock`, `enableProspective`, `enableSurprise`
  - activation conditionnelle des modules C/D/E dans la boucle de dÃ©cision
  - affichage stats conditionnel cohÃ©rent avec les modules actifs
- `index.html` :
  - ajout des toggles UI dâ€™ablation pour diffusion, horloge, prospective et surprise
  - cÃ¢blage config runtime des toggles dans lâ€™orchestrateur
  - overlay diffusion et compteur diffusion conditionnÃ©s par `enableDiffusion`
  - titre de section fonctionnelle alignÃ© sur la Phase F
- enchmark.js :
  - rÃ©Ã©criture compatible ARVE Phase F (modules DVPA + ARVE)
  - support des flags --full, --no-clock, --no-prospective, --no-diffusion, --no-surprise, --baseline-dvpa

### Impact
- IntÃ©gration C/D/E stabilisÃ©e dans un mode full et un mode ablation, sans changement dâ€™architecture locale
- CohÃ©rence UI Phase F (badge + explication + formule) restaurÃ©e
- CoÃ»t de `computeLocalPrior()` rÃ©duit via indexation par ensembles (`Set`)

---

## [0.1-E] - 2026-05-10

### Phases C/D/E â€” Horloge, prospective, surprise

### AjoutÃ©
- `clock-manager.js` : horloge interne `phi(t)` et arousal `alpha(t)`
- `prospective-memory.js` : mÃ©moire prospective lÃ©gÃ¨re N-step (`pi-hat`)
- `surprise-estimator.js` : estimation de surprise prÃ©dictive `eta(a)` par prior local

### ModifiÃ©
- `arve-agent.js` : intÃ©gration unifiÃ©e des modules C/D/E dans `chooseContinuousDirection()`
- `index.html` :
  - chargement des modules C/D/E
  - nouveaux indicateurs runtime `Arousal alpha`, `Phase phi`, `Head prospective`
  - badge de version mis Ã  jour en `Phase E`
  - nouveaux paramÃ¨tres de configuration (`clock*`, `arousal*`, `prospective*`, `surprise*`, poids utilitÃ©)

### Technique
- UtilitÃ© continue Ã©tendue avec arousal, surprise, cohÃ©rence et biais prospectif
- Retour d'urgence Ã©nergÃ©tique conservÃ©
- Architecture locale inchangÃ©e (sans serveur, sans npm)

### Impact
- Rythme interne endogÃ¨ne actif
- Projection locale multi-pas pour orienter la premiÃ¨re action
- Bonus de nouveautÃ© contextuelle via surprise prÃ©dictive

---

## [0.1-B] - 2026-05-10

### Phase B â€” Diffusion spatiale

**Objectif** : rÃ©sistance spatiale diffuse Ïˆ(s) remplaÃ§ant l'anti-impasse N1/N2/N3.

### AjoutÃ©
- `diffusion-manager.js` : Gestionnaire de diffusion spatiale Ïˆ(s)
- Propagation lazy des pÃ©nalitÃ©s vers voisins avec attÃ©nuation Î»
- Visualisation overlay rouge de la carte Ïˆ(s) (intensitÃ© proportionnelle)
- Slider contrÃ´le `diffusionLambda` (0-1, dÃ©faut 0.4)
- Checkbox activation/dÃ©sactivation visualisation diffusion
- Stat runtime "Zones diffusÃ©es" (nombre de cellules actives)

### ModifiÃ©
- `arve-agent.js` : intÃ©gration diffusion-manager
  - Constructeur accepte diffusionManager comme paramÃ¨tre
  - `chooseContinuousDirection()` utilise Ïˆ(nextPos) au lieu de lowYieldPenalty
  - `move()` appelle `diffusionManager.diffuseStep()` aprÃ¨s propagation
  - Mise Ã  jour rÃ©sistance via `diffusionManager.updateFromPosition()`
- `index.html` : interface Phase B
  - Badge version "Phase B"
  - Description fonctionnement diffusion spatiale
  - ContrÃ´les diffusion et visualisation

### Technique
- Diffusion spatiale : `Ïˆ(voisin) = max(Ïˆ(voisin), Ïˆ(source) Ã— Î»)`
- ParamÃ¨tres : `diffusionLambda` (0.4), `diffusionThreshold` (0.1), `diffusionMaxRadius` (3)
- DÃ©croissance temporelle passive conservÃ©e (lowYieldPassiveDecay)
- File de cellules actives pour diffusion lazy (performance optimisÃ©e)

### Impact
- Anti-impasse Ã©mergent : zones rÃ©pulsives Ã©tendues sans rÃ¨gles explicites
- Remplacement complet de la logique N1/N2/N3 par champs de pression continus

---

## [0.1-A] - 2026-05-10

### Phase A â€” Fondations et nettoyage

**Objectif** : DVPA v1.29 nettoyÃ©, sans logique N1/N2/N3, dÃ©cision continue pure.

### AjoutÃ©
- `arve-agent.js` : Agent ARVE Phase A sans mÃ©canismes anti-impasse N1/N2/N3
- `index.html` : Interface ARVE Phase A avec badge de version
- DÃ©cision continue unifiÃ©e sans branchement binaire exploration/survie
- Diagnostic passif (modeSurvival conservÃ© pour observabilitÃ©)

### SupprimÃ©
- Logique anti-impasse N1/N2/N3 (sera remplacÃ©e par diffusion spatiale en Phase B)
- MÃ©thodes : `updateEscapeMode()`, `applyEscapePolicy()`, `findWallFollowerDirection()`
- MÃ©thodes : `findDirectionTowardFrontier()`, `findDirectionTowardFrontierCentroid()`
- MÃ©thodes : `isLocallyStuck()`, `isCoverageStagnating()`, `hasNoNewCells()`
- Variables : `escapeMode` dans le constructeur
- ParamÃ¨tres config : `stuckLevel1Duration`, `stuckLevel2Duration`, `stuckLevel3Duration`, `stuckCoverageWindow`, `stuckNoNewCellsWindow`

### ConservÃ©
- Modules DVPA : `world.js`, `frontier-manager.js`, `budget-manager.js`, `threshold-manager.js`
- Retour d'urgence Ã©nergÃ©tique (`getEmergencyReturnDirection()`)
- Fonction d'utilitÃ© continue de base
- MÃ©moire low-yield (sans diffusion spatiale)

### Technique
- Architecture modulaire : orchestrateur HTML + modules mÃ©tier distincts
- CompatibilitÃ© navigateur et Node.js pour arve-agent.js
- Code commentÃ© selon principes CLEAN CODE

---

## [0.1.0] - 2026-05-10

### AjoutÃ©
- CrÃ©ation du projet ARVE (Adaptive Regulation with Vital Envelope)
- Documentation initiale (README.md, CHANGELOG.md)
- Plan de projet dÃ©taillÃ© (ARVE_project_plan.md)
- Base DVPA v1.29 intÃ©grÃ©e dans sous-rÃ©pertoire DVPA/

### SpÃ©cifications
- Architecture modulaire dÃ©finie (6 modules mÃ©tier)
- Fonction d'utilitÃ© unifiÃ©e spÃ©cifiÃ©e
- Protocole d'Ã©valuation Ã©tabli
- Plan de dÃ©veloppement en 6 phases (A-F)


