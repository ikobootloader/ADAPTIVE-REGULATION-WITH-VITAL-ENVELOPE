/**
 * ARVE AGENT
 *
 * Unified continuous decision:
 * - diffusion psi(s)
 * - internal clock phi(t) with arousal alpha(t)
 * - prospective memory pi-hat
 * - predictive surprise eta(a)
 */
class ARVEAgent {
    constructor(
        x, y, health, color, config, width, height, world, elements, drawAgent, clearAgent,
        discoverSurroundings, stopSimulation, budgetManager, thresholdManager, frontierManager,
        diffusionManager, clockManager, prospectiveMemory, surpriseEstimator
    ) {
        this.x = x;
        this.y = y;
        this.health = health;
        this.color = color;
        this.config = config;
        this.width = width;
        this.height = height;
        this.world = world;
        this.state = world.state;
        this.elements = elements;
        this.drawAgent = drawAgent;
        this.clearAgent = clearAgent;
        this.discoverSurroundings = discoverSurroundings;
        this.stopSimulation = stopSimulation;
        this.budgetManager = budgetManager;
        this.thresholdManager = thresholdManager;
        this.frontierManager = frontierManager;
        this.diffusionManager = diffusionManager;
        this.clockManager = clockManager;
        this.prospectiveMemory = prospectiveMemory;
        this.surpriseEstimator = surpriseEstimator;
        this.lastMoveDirection = null;
        this.lastRankedFrontiers = [];
    }

    move() {
        if (this.health <= 0) {
            this.stopSimulation();
            return;
        }

        this.health -= 1;
        this.elements.healthDisplay.textContent = this.health;
        const tickStartPosition = { x: this.x, y: this.y };

        this.clearAgent(this.x, this.y);
        this.world.beginTick();
        const discoveries = this.discoverSurroundings();
        this.world.propagateValues();

        if (this.config.enableDiffusion !== false && this.diffusionManager) {
            this.diffusionManager.diffuseStep();
        }
        if (this.config.enableClock !== false && this.clockManager) {
            this.clockManager.tick();
        }
        if (this.config.enableSurprise !== false && this.surpriseEstimator) {
            this.surpriseEstimator.updateModel({ x: this.x, y: this.y });
        }

        if (this.world.state.tickId % this.config.frontierRecomputeEvery === 0 || this.lastRankedFrontiers.length === 0) {
            this.lastRankedFrontiers = this.frontierManager.rankFrontiers({ x: this.x, y: this.y });
        }
        this.state.frontierCount = this.lastRankedFrontiers.length;
        if (this.elements.frontierDisplay) {
            this.elements.frontierDisplay.textContent = String(this.state.frontierCount);
        }

        const budgetStatus = this.budgetManager.getKnownRewardBudgetStatus(
            { x: this.x, y: this.y },
            this.health,
            this.state.discoveredRewards,
            this.state.discoveredObstacles
        );

        this.state.safeDirections = budgetStatus.safeDirections;
        this.state.adaptiveThreshold = this.thresholdManager.computeAdaptiveThreshold(
            budgetStatus,
            this.state.discoveredRewards.length
        );

        const shouldUseSurvivalMode = (
            this.health <= this.state.adaptiveThreshold * this.config.maxHealth ||
            budgetStatus.shouldForceSurvival
        );
        this.state.modeSurvival = shouldUseSurvivalMode;
        this.elements.directionDisplay.textContent = shouldUseSurvivalMode ? "Diag:Survie" : "Diag:Exploration";
        this.color = shouldUseSurvivalMode ? "black" : "blue";

        const emergencyDirection = this.getEmergencyReturnDirection(budgetStatus);
        const direction = emergencyDirection || this.chooseContinuousDirection(budgetStatus);

        if (direction) {
            this.x += direction.x;
            this.y += direction.y;
            this.elements.directionDisplay.textContent = `${direction.name} (${this.state.modeSurvival ? "Diag:Survie" : "Diag:Exploration"})`;
            this.world.updateVisitedPositions(this.x, this.y);
            this.lastMoveDirection = { x: direction.x, y: direction.y, name: direction.name };
            this.updatePath();
        }

        if (this.world.isReward(this.x, this.y)) {
            this.health = this.config.maxHealth;
            this.elements.healthDisplay.textContent = this.health;
            this.state.modeSurvival = false;
            this.elements.directionDisplay.textContent = "Diag:Exploration";
            if (this.config.enableDiffusion !== false && this.diffusionManager) {
                this.diffusionManager.updateFromPosition(tickStartPosition, {
                    newCellsCount: discoveries && Number.isFinite(discoveries.newCellsCount) ? discoveries.newCellsCount : 0,
                    collectedReward: true
                });
            }
        } else if (this.config.enableDiffusion !== false && this.diffusionManager) {
            this.diffusionManager.updateFromPosition(tickStartPosition, {
                newCellsCount: discoveries && Number.isFinite(discoveries.newCellsCount) ? discoveries.newCellsCount : 0,
                collectedReward: false
            });
        }

        const stateValue = this.state.stateValues[this.x / this.config.stepSize][this.y / this.config.stepSize];
        this.elements.stateValueDisplay.textContent = stateValue.toFixed(2);

        if (this.elements.arousalDisplay && this.clockManager && this.config.enableClock !== false) {
            this.elements.arousalDisplay.textContent = this.clockManager.getArousal().toFixed(2);
        }
        if (this.elements.phaseDisplay && this.clockManager && this.config.enableClock !== false) {
            this.elements.phaseDisplay.textContent = this.clockManager.getPhase().toFixed(2);
        }
        if (this.elements.prospectiveDisplay && this.prospectiveMemory && this.config.enableProspective !== false) {
            const head = this.prospectiveMemory.getBestHead();
            this.elements.prospectiveDisplay.textContent = head ? head.name : "-";
        }

        this.drawAgent(this.x, this.y);
    }

    chooseContinuousDirection(budgetStatus) {
        const validDirections = this.getValidDirections();
        if (validDirections.length === 0) {
            return null;
        }

        const currentPosition = { x: this.x, y: this.y };
        const frontiers = this.frontierManager.computeFrontiers();
        const currentDistances = this.world.getDiscoveredDistancesFrom(currentPosition);
        const currentFrontier = this.frontierManager.getBestFrontierFromDistances(currentDistances, frontiers);
        const currentFrontierDistance = currentFrontier && Number.isFinite(currentFrontier.distance) ? currentFrontier.distance : Infinity;
        const arousal = (this.config.enableClock !== false && this.clockManager) ? this.clockManager.getArousal() : 1;

        const utilityEvaluator = (nextPosition, direction, originPosition, options = {}) => {
            const gainInfo = this.computeInformationGain(nextPosition, currentFrontierDistance, frontiers);
            const returnDebt = this.computeReturnDebt(nextPosition, budgetStatus);
            const diffusionPenalty = (this.config.enableDiffusion !== false && this.diffusionManager) ? this.diffusionManager.getPenalty(nextPosition) : 0;
            const surprise = (this.config.enableSurprise !== false && this.surpriseEstimator)
                ? this.surpriseEstimator.computeSurprise(nextPosition, originPosition || currentPosition)
                : 0;
            const previousDirectionName = options.previousDirectionName || (this.lastMoveDirection ? this.lastMoveDirection.name : null);
            const coherence = this.computeCoherenceBonus(direction, previousDirectionName);

            let utility = (arousal * ((this.config.utilityInfoWeight * gainInfo) + (this.config.utilitySurpriseWeight * surprise)))
                - (this.config.utilityCostWeight * 1)
                - (this.config.utilityReturnDebtWeight * returnDebt)
                - (this.config.utilityLowYieldWeight * diffusionPenalty)
                + (this.config.utilityCoherenceWeight * coherence);

            if (this.config.enableProspective !== false && options.includeProspectiveBias !== false && this.prospectiveMemory) {
                const bestHead = this.prospectiveMemory.getBestHead();
                if (bestHead && bestHead.name === direction.name) {
                    utility += this.config.utilityProspectiveHeadBias;
                }
            }

            return utility;
        };

        if (this.config.enableProspective !== false && this.prospectiveMemory) {
            this.prospectiveMemory.update(currentPosition, {
                lastMoveDirection: this.lastMoveDirection,
                getValidDirectionsFrom: (position) => this.getValidDirectionsFrom(position),
                utilityEvaluator
            });
        }

        const scoredDirections = validDirections.map((direction) => {
            const nextPosition = { x: this.x + direction.x, y: this.y + direction.y };
            const utility = utilityEvaluator(nextPosition, direction, currentPosition, { includeProspectiveBias: true });
            return { ...direction, utility };
        }).sort((a, b) => b.utility - a.utility);

        return scoredDirections[0];
    }

    computeInformationGain(nextPosition, currentFrontierDistance, frontiers) {
        const unknownNeighbors = this.frontierManager.countUnknownNeighbors(nextPosition.x, nextPosition.y);
        const nextKey = this.world.toKey(nextPosition.x, nextPosition.y);
        const noveltyBonus = this.state.discoveredCells.has(nextKey) ? 0 : 1;
        const nextDistances = this.world.getDiscoveredDistancesFrom(nextPosition);
        const nextFrontier = this.frontierManager.getBestFrontierFromDistances(nextDistances, frontiers);
        const nextFrontierDistance = nextFrontier && Number.isFinite(nextFrontier.distance) ? nextFrontier.distance : Infinity;
        const frontierProgress = Number.isFinite(currentFrontierDistance) && Number.isFinite(nextFrontierDistance)
            ? Math.max(0, currentFrontierDistance - nextFrontierDistance)
            : 0;
        return unknownNeighbors + noveltyBonus + frontierProgress;
    }

    computeReturnDebt(nextPosition, budgetStatus) {
        if (!budgetStatus || !budgetStatus.hasKnownReward) {
            return 0;
        }
        const nearestFromNext = this.budgetManager.findNearestReachableReward(nextPosition, this.state.discoveredRewards);
        if (!nearestFromNext || !Number.isFinite(nearestFromNext.distance)) {
            return 1;
        }
        const requiredEnergy = nearestFromNext.distance * this.config.energyCostPerStep * this.config.returnSafetyFactor;
        return Math.max(0, (requiredEnergy - this.health) / this.config.maxHealth);
    }

    computeCoherenceBonus(direction, previousDirectionName) {
        if (!previousDirectionName) {
            return 0;
        }
        return direction.name === previousDirectionName ? 1 : 0;
    }

    getEmergencyReturnDirection(budgetStatus) {
        if (!budgetStatus || !budgetStatus.hasKnownReward || !budgetStatus.nearestReward) {
            return null;
        }
        const requiredEnergy = budgetStatus.distanceToNearestReward * this.config.energyCostPerStep * this.config.returnSafetyFactor;
        const isCritical = budgetStatus.shouldForceSurvival || this.health <= (requiredEnergy + this.config.returnEmergencyMargin);
        if (!isCritical) {
            return null;
        }
        const path = this.findOptimalPath({ x: this.x, y: this.y }, budgetStatus.nearestReward, { forceFullPath: true });
        if (path.length === 0) {
            return null;
        }
        const next = path[0];
        return {
            x: next.x - this.x,
            y: next.y - this.y,
            name: this.getDirectionName(next.x - this.x, next.y - this.y)
        };
    }

    getValidDirections() {
        return this.getValidDirectionsFrom({ x: this.x, y: this.y });
    }

    getValidDirectionsFrom(originPosition) {
        const directions = [
            { x: 0, y: -this.config.stepSize, name: "Haut" },
            { x: 0, y: this.config.stepSize, name: "Bas" },
            { x: -this.config.stepSize, y: 0, name: "Gauche" },
            { x: this.config.stepSize, y: 0, name: "Droite" }
        ];
        return directions.filter((direction) => {
            const newX = originPosition.x + direction.x;
            const newY = originPosition.y + direction.y;
            return newX >= 0 && newX < this.width && newY >= 0 && newY < this.height &&
                !this.state.discoveredObstacles.some((obstacle) => obstacle.x === newX && obstacle.y === newY);
        });
    }

    findOptimalPath(startPosition, endPosition, options = {}) {
        if (!endPosition) return [];
        const shouldForceFullPath = options.forceFullPath === true;
        return this.world.bfsPath(startPosition, endPosition, {
            maxPathLength: shouldForceFullPath ? Infinity : this.config.maxSegmentLength
        });
    }

    getDirectionName(dx, dy) {
        if (dx === 0 && dy === -this.config.stepSize) return "Haut";
        if (dx === 0 && dy === this.config.stepSize) return "Bas";
        if (dx === -this.config.stepSize && dy === 0) return "Gauche";
        if (dx === this.config.stepSize && dy === 0) return "Droite";
        return "Inconnu";
    }

    updatePath() {
        if (this.state.modeSurvival && this.state.currentPath.length > 0) {
            this.state.currentPath.shift();
        } else {
            this.state.currentPath = [];
        }
    }
}

if (typeof window !== "undefined") {
    window.ARVEAgent = ARVEAgent;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ARVEAgent };
}
