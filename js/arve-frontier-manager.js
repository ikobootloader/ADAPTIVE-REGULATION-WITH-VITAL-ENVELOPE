/**
 * ARVE Frontier Manager
 * Module metier: calcule et classe les frontieres d'exploration.
 */
(function attachFrontierManager(globalScope) {
    class FrontierManager {
        constructor(config, world) {
            this.config = config;
            this.world = world;
        }

        computeFrontiers() {
            const frontiers = [];
            const seen = new Set();
            const state = this.world.state;
            const obstacleKeys = new Set(
                state.discoveredObstacles.map((obstacle) => this.world.toKey(obstacle.x, obstacle.y))
            );

            state.discoveredCells.forEach((cellKey) => {
                if (obstacleKeys.has(cellKey) || seen.has(cellKey)) {
                    return;
                }
                const [x, y] = this.world.fromKey(cellKey);
                const unknownNeighbors = this.countUnknownNeighbors(x, y);
                if (unknownNeighbors > 0) {
                    seen.add(cellKey);
                    frontiers.push({ x, y, unknownNeighbors });
                }
            });

            return frontiers;
        }

        rankFrontiers(agentPosition) {
            const discoveredDistances = this.world.getDiscoveredDistancesFrom(agentPosition);
            return this.rankFrontiersFromDistances(discoveredDistances);
        }

        rankFrontiersFromDistances(discoveredDistances, frontiers) {
            const sourceFrontiers = Array.isArray(frontiers) ? frontiers : this.computeFrontiers();
            return sourceFrontiers
                .map((frontier) => {
                    const frontierKey = this.world.toKey(frontier.x, frontier.y);
                    const distance = discoveredDistances.has(frontierKey)
                        ? discoveredDistances.get(frontierKey)
                        : Infinity;
                    const traversalCost = Number.isFinite(distance) ? distance : Infinity;
                    const score = Number.isFinite(traversalCost)
                        ? frontier.unknownNeighbors / (traversalCost + 1)
                        : -Infinity;
                    return {
                        ...frontier,
                        distance: traversalCost,
                        score
                    };
                })
                .filter((item) => Number.isFinite(item.distance))
                .sort((a, b) => b.score - a.score);
        }

        getBestFrontier(agentPosition) {
            const ranked = this.rankFrontiers(agentPosition);
            return ranked.length > 0 ? ranked[0] : null;
        }

        getBestFrontierFromDistances(discoveredDistances, frontiers) {
            const ranked = this.rankFrontiersFromDistances(discoveredDistances, frontiers);
            return ranked.length > 0 ? ranked[0] : null;
        }

        countUnknownNeighbors(x, y) {
            const neighbors = this.world.getNeighborCells(x, y);
            let count = 0;
            neighbors.forEach((neighbor) => {
                const key = this.world.toKey(neighbor.x, neighbor.y);
                if (!this.world.state.discoveredCells.has(key)) {
                    count += 1;
                }
            });
            return count;
        }
    }

    globalScope.ARVEFrontierManager = FrontierManager;
}(typeof window !== "undefined" ? window : globalThis));

