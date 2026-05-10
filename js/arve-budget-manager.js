/**
 * ARVE Budget Manager
 * Module metier: protege l'agent contre les sorties hors budget energie.
 */
(function attachBudgetManager(globalScope) {
    class BudgetManager {
        constructor(config, width, height, world) {
            this.config = config;
            this.width = width;
            this.height = height;
            this.world = world;
        }

        getKnownRewardBudgetStatus(agentPosition, health, discoveredRewards, discoveredObstacles) {
            if (!discoveredRewards || discoveredRewards.length === 0) {
                return {
                    hasKnownReward: false,
                    shouldForceSurvival: false,
                    safeDirections: null,
                    nearestReward: null,
                    distanceToNearestReward: Infinity
                };
            }

            const nearestReward = this.findNearestReachableReward(agentPosition, discoveredRewards);
            if (!nearestReward || nearestReward.distance === Infinity) {
                return {
                    hasKnownReward: false,
                    shouldForceSurvival: false,
                    safeDirections: null,
                    nearestReward: null,
                    distanceToNearestReward: Infinity
                };
            }

            if (this.config.enableL1 === false) {
                return {
                    hasKnownReward: true,
                    shouldForceSurvival: false,
                    safeDirections: null,
                    nearestReward: nearestReward.reward,
                    distanceToNearestReward: nearestReward.distance
                };
            }

            const safetyCost = nearestReward.distance * this.config.energyCostPerStep * this.config.returnSafetyFactor;
            const shouldForceSurvival = health <= safetyCost;
            const safeDirections = this.computeSafeDirections(agentPosition, health, discoveredRewards, discoveredObstacles);

            return {
                hasKnownReward: true,
                shouldForceSurvival,
                safeDirections,
                nearestReward: nearestReward.reward,
                distanceToNearestReward: nearestReward.distance
            };
        }

        findNearestReachableReward(agentPosition, discoveredRewards) {
            let best = { reward: null, distance: Infinity };
            const rewardDistances = this.world.getRewardDistancesFrom(agentPosition, discoveredRewards);
            for (const reward of discoveredRewards) {
                const rewardKey = this.world.toKey(reward.x, reward.y);
                const distance = rewardDistances.has(rewardKey)
                    ? rewardDistances.get(rewardKey)
                    : this.computeDistance(agentPosition, reward);
                if (distance < best.distance) {
                    best = { reward, distance };
                }
            }
            return best;
        }

        computeSafeDirections(agentPosition, health, discoveredRewards, discoveredObstacles) {
            const directions = [
                { x: 0, y: -this.config.stepSize, name: 'Haut' },
                { x: 0, y: this.config.stepSize, name: 'Bas' },
                { x: -this.config.stepSize, y: 0, name: 'Gauche' },
                { x: this.config.stepSize, y: 0, name: 'Droite' }
            ];

            return directions
                .map((direction) => {
                    const nextPosition = {
                        x: agentPosition.x + direction.x,
                        y: agentPosition.y + direction.y
                    };
                    if (!this.isInsideGrid(nextPosition) || this.isObstacle(nextPosition, discoveredObstacles)) {
                        return null;
                    }

                    const nearestFromNext = this.findNearestReachableReward(nextPosition, discoveredRewards);
                    if (!nearestFromNext.reward || nearestFromNext.distance === Infinity) {
                        return null;
                    }

                    const required = nearestFromNext.distance * this.config.energyCostPerStep * this.config.returnSafetyFactor;
                    if (health <= required) {
                        return null;
                    }

                    return direction;
                })
                .filter(Boolean);
        }

        computeDistance(start, end) {
            if (this.config.enableL2 === false) {
                return (Math.abs(end.x - start.x) + Math.abs(end.y - start.y)) / this.config.stepSize;
            }
            return this.world.bfsDistance(start, end);
        }

        isObstacle(position, discoveredObstacles) {
            return discoveredObstacles.some((obstacle) => obstacle.x === position.x && obstacle.y === position.y);
        }

        isInsideGrid(position) {
            return (
                position.x >= 0 &&
                position.x < this.width &&
                position.y >= 0 &&
                position.y < this.height
            );
        }
    }

    globalScope.ARVEBudgetManager = BudgetManager;
}(typeof window !== "undefined" ? window : globalThis));


