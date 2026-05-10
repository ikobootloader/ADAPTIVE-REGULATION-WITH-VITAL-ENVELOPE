/**
 * ARVE DIFFUSION MANAGER
 *
 * Gestion de la résistance spatiale diffuse ψ(s)
 * Remplace la pénalité low-yield cellule par cellule par une diffusion spatiale atténuée
 *
 * @author Frédérick Murat
 * @license MIT
 * @version 0.1-B
 */

/**
 * Classe ARVEDiffusionManager
 *
 * Responsabilité : propager la pénalité de zone froide ψ(s) vers les cellules voisines
 * avec atténuation λ, remplaçant la lowYieldMap cellule par cellule de DVPA.
 *
 * Algorithme de diffusion :
 * Pour chaque cellule c avec ψ(c) > seuil_diffusion :
 *   Pour chaque voisin v de c :
 *     ψ(v) = max(ψ(v), ψ(c) × λ_diffusion)
 *
 * Exécuté une fois par tick, lazy (seulement les cellules actives).
 */
class ARVEDiffusionManager {
    /**
     * @param {Object} config - Configuration globale
     * @param {Object} world - Instance du monde DVPA
     */
    constructor(config, world) {
        this.config = config;
        this.world = world;

        // Paramètres de diffusion
        this.diffusionLambda = config.diffusionLambda || 0.4;
        this.diffusionThreshold = config.diffusionThreshold || 0.1;
        this.diffusionMaxRadius = config.diffusionMaxRadius || 3;

        // Carte de résistance diffuse ψ(s)
        // Structure : Map<key, { value, lastUpdatedTick }>
        this.diffusionMap = new Map();

        // File de propagation (cellules actives à diffuser)
        this.activeCells = new Set();
    }

    /**
     * Mise à jour de la pénalité à une position et marquage pour diffusion
     *
     * @param {Object} position - Position {x, y}
     * @param {Object} context - Contexte de mise à jour {newCellsCount, collectedReward}
     */
    updateFromPosition(position, context) {
        const key = this.world.toKey(position.x, position.y);
        const tickId = this.world.state.tickId;

        // Récupérer la valeur actuelle décayée
        const current = this.getDecayedValue(key, tickId);

        // Calculer la nouvelle valeur selon le contexte
        let newValue = current;

        if (context.collectedReward) {
            // Récompense collectée : soulagement fort
            newValue = Math.max(0, current - this.config.lowYieldRewardRelief);
        } else if (context.newCellsCount === 0) {
            // Aucune nouvelle cellule : incrément de pénalité
            newValue = Math.min(
                this.config.lowYieldMaxPenalty,
                current + this.config.lowYieldIncrement
            );
        } else {
            // Nouvelles cellules découvertes : allègement
            newValue = Math.max(0, current - this.config.lowYieldRelief);
        }

        // Mettre à jour la carte
        this.diffusionMap.set(key, {
            value: newValue,
            lastUpdatedTick: tickId
        });

        // Marquer pour diffusion si au-dessus du seuil
        if (newValue > this.diffusionThreshold) {
            this.activeCells.add(key);
        }
    }

    /**
     * Diffusion spatiale des pénalités vers les voisins
     * Appelée une fois par tick par le monde
     */
    diffuseStep() {
        if (this.activeCells.size === 0) {
            return;
        }

        const tickId = this.world.state.tickId;
        const newActiveCells = new Set();
        const stepSize = this.config.stepSize;

        // Pour chaque cellule active
        for (const key of this.activeCells) {
            const sourceValue = this.getDecayedValue(key, tickId);
            if (sourceValue < this.diffusionThreshold) continue;
            newActiveCells.add(key);
            const [px, py] = this.world.fromKey(key);

            // Diffuser vers les 4 voisins cardinaux
            const neighbors = [
                { x: px, y: py - stepSize },
                { x: px, y: py + stepSize },
                { x: px - stepSize, y: py },
                { x: px + stepSize, y: py }
            ];

            for (const neighbor of neighbors) {
                // Vérifier que le voisin est dans la grille
                if (!this.world.isInsideGrid(neighbor.x, neighbor.y)) {
                    continue;
                }

                const neighborKey = this.world.toKey(neighbor.x, neighbor.y);

                // Vérifier que le voisin n'est pas un obstacle
                if (this.world.state.discoveredObstacles.some(obs => obs.x === neighbor.x && obs.y === neighbor.y)) {
                    continue;
                }

                // Calculer la valeur diffusée
                const diffusedValue = sourceValue * this.diffusionLambda;

                // Récupérer la valeur actuelle du voisin
                const currentNeighborValue = this.getDecayedValue(neighborKey, tickId);

                // Appliquer la diffusion (prendre le max)
                if (diffusedValue > currentNeighborValue) {
                    this.diffusionMap.set(neighborKey, {
                        value: diffusedValue,
                        lastUpdatedTick: tickId
                    });

                    // Marquer le voisin comme actif si au-dessus du seuil
                    if (diffusedValue > this.diffusionThreshold) {
                        newActiveCells.add(neighborKey);
                    }
                }
            }
        }

        // Remplacer les cellules actives par les nouvelles
        this.activeCells = newActiveCells;
    }

    /**
     * Récupération de la pénalité diffuse à une position (avec decay temporel)
     *
     * @param {Object} position - Position {x, y}
     * @returns {number} - Pénalité ψ(s) décayée
     */
    getPenalty(position) {
        const key = this.world.toKey(position.x, position.y);
        const tickId = this.world.state.tickId;
        return this.getDecayedValue(key, tickId);
    }

    /**
     * Récupération de la valeur décayée par tick
     * Réutilise la logique de decay passif de DVPA
     *
     * @param {string} key - Clé de position
     * @param {number} currentTick - Tick actuel
     * @returns {number} - Valeur décayée
     */
    getDecayedValue(key, currentTick) {
        const entry = this.diffusionMap.get(key);
        if (!entry) return 0;

        const ticksElapsed = currentTick - entry.lastUpdatedTick;
        const decayFactor = Math.pow(
            1 - this.config.lowYieldPassiveDecay,
            ticksElapsed
        );

        return entry.value * decayFactor;
    }

    /**
     * Récupération du nombre de cellules actives (diagnostic)
     *
     * @returns {number} - Nombre de cellules avec ψ > seuil
     */
    getActiveCellsCount() {
        return this.activeCells.size;
    }

    /**
     * Récupération de toutes les cellules avec pénalité (pour visualisation)
     *
     * @returns {Map<string, number>} - Map de clés vers valeurs ψ
     */
    getAllPenalties() {
        const tickId = this.world.state.tickId;
        const penalties = new Map();

        for (const [key, entry] of this.diffusionMap.entries()) {
            const decayedValue = this.getDecayedValue(key, tickId);
            if (decayedValue > 0.01) {
                penalties.set(key, decayedValue);
            }
        }

        return penalties;
    }

    /**
     * Réinitialisation de la carte de diffusion
     */
    reset() {
        this.diffusionMap.clear();
        this.activeCells.clear();
    }
}

// Export pour environnement navigateur
if (typeof window !== 'undefined') {
    window.ARVEDiffusionManager = ARVEDiffusionManager;
}

// Export pour environnement Node.js (benchmark)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARVEDiffusionManager };
}
