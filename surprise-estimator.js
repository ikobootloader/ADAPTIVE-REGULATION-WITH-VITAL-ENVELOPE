/**
 * ARVE SURPRISE ESTIMATOR
 *
 * Estimation predictive eta(a) a partir d'un prior local.
 */
class ARVESurpriseEstimator {
    constructor(config, world) {
        this.config = config;
        this.world = world;
        this.localPriorByCell = new Map();
    }

    updateModel(position) {
        if (!position) {
            return;
        }
        const radius = Math.max(1, this.config.surpriseRadius || 5);
        const decay = Number.isFinite(this.config.surpriseDecay) ? this.config.surpriseDecay : 0.95;
        const key = this.world.toKey(position.x, position.y);
        const prior = this.computeLocalPrior(position, radius);
        const previous = this.localPriorByCell.get(key);

        if (!previous) {
            this.localPriorByCell.set(key, prior);
            return;
        }

        this.localPriorByCell.set(key, {
            reward: (previous.reward * decay) + (prior.reward * (1 - decay)),
            obstacle: (previous.obstacle * decay) + (prior.obstacle * (1 - decay)),
            empty: (previous.empty * decay) + (prior.empty * (1 - decay))
        });
    }

    computeSurprise(actionPosition, originPosition) {
        if (!actionPosition || !originPosition) {
            return 0;
        }

        const unknownNeighbors = this.countUnknownNeighbors(actionPosition);
        if (unknownNeighbors <= 0) {
            return 0;
        }
        const prior = this.getPriorForAction(originPosition);
        const rewardLift = Math.max(0, prior.reward - (1 / 3));
        const obstacleRisk = Math.max(0, prior.obstacle - (1 / 3));
        return unknownNeighbors * Math.max(0, rewardLift - (0.5 * obstacleRisk));
    }

    countUnknownNeighbors(position) {
        const step = this.config.stepSize;
        const neighbors = [
            { x: position.x, y: position.y - step },
            { x: position.x, y: position.y + step },
            { x: position.x - step, y: position.y },
            { x: position.x + step, y: position.y }
        ];
        let count = 0;
        for (const neighbor of neighbors) {
            if (!this.world.isInsideGrid(neighbor.x, neighbor.y)) {
                continue;
            }
            const key = this.world.toKey(neighbor.x, neighbor.y);
            if (!this.world.state.discoveredCells.has(key)) {
                count += 1;
            }
        }
        return count;
    }

    getPriorForAction(originPosition) {
        const originKey = this.world.toKey(originPosition.x, originPosition.y);
        const local = this.localPriorByCell.get(originKey);
        if (local) {
            return local;
        }
        return this.computeLocalPrior(originPosition, Math.max(1, this.config.surpriseRadius || 5));
    }

    computeLocalPrior(position, radius) {
        let rewardCount = 0;
        let obstacleCount = 0;
        let emptyCount = 0;
        const step = this.config.stepSize;
        const obstacleKeys = new Set(
            this.world.state.discoveredObstacles.map((obs) => this.world.toKey(obs.x, obs.y))
        );
        const rewardKeys = new Set(
            this.world.state.discoveredRewards.map((reward) => this.world.toKey(reward.x, reward.y))
        );

        for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dy = -radius; dy <= radius; dy += 1) {
                const distance = Math.abs(dx) + Math.abs(dy);
                if (distance > radius) {
                    continue;
                }
                const x = position.x + (dx * step);
                const y = position.y + (dy * step);
                if (!this.world.isInsideGrid(x, y)) {
                    continue;
                }
                const key = this.world.toKey(x, y);
                if (!this.world.state.discoveredCells.has(key)) {
                    continue;
                }
                if (obstacleKeys.has(key)) {
                    obstacleCount += 1;
                } else if (rewardKeys.has(key)) {
                    rewardCount += 1;
                } else {
                    emptyCount += 1;
                }
            }
        }

        const total = rewardCount + obstacleCount + emptyCount;
        if (total <= 0) {
            return { reward: 1 / 3, obstacle: 1 / 3, empty: 1 / 3 };
        }

        return {
            reward: rewardCount / total,
            obstacle: obstacleCount / total,
            empty: emptyCount / total
        };
    }
}

if (typeof window !== 'undefined') {
    window.ARVESurpriseEstimator = ARVESurpriseEstimator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARVESurpriseEstimator };
}
