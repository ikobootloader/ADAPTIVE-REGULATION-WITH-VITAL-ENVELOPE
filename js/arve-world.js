/**
 * ARVE World
 * Module metier: encapsule la carte, la decouverte et les valeurs d'etat.
 */
(function attachWorld(globalScope) {
    class ARVEWorld {
        constructor(config, width, height) {
            this.config = config;
            this.width = width;
            this.height = height;
            this.state = {
                currentPath: [],
                modeSurvival: false,
                safeDirections: null,
                obstacles: [],
                rewards: [],
                discoveredObstacles: [],
                discoveredRewards: [],
                discoveredCells: new Set(),
                lastDiscoveredCells: [],
                stateValues: Array(width / config.stepSize).fill().map(() => Array(height / config.stepSize).fill(0)),
                visitedPositions: new Map(),
                lastPosition: null,
                recentPositions: [],
                frontierCount: 0,
                discoveredFreeCount: 0,
                coverageHistory: [],
                lowYieldMap: new Map(),
                lowYieldWriteBufferTick: -1,
                lowYieldWriteBuffer: new Map(),
                keyCoordCache: new Map(),
                tickId: 0,
                distanceCacheTick: -1,
                distanceCacheByOrigin: new Map()
            };
        }

        beginTick() {
            this.state.tickId += 1;
        }

        isObstacle(x, y) {
            return this.state.obstacles.some((obstacle) => obstacle.x === x && obstacle.y === y);
        }

        isReward(x, y) {
            return this.state.rewards.some((reward) => reward.x === x && reward.y === y);
        }

        updateVisitedPositions(x, y) {
            const posKey = `${x},${y}`;
            const currentTick = this.state.tickId;
            const previousEntry = this.state.visitedPositions.get(posKey);
            // Lazy decay exact: on reconstruit la valeur "réelle" au moment où la cellule est revisitée.
            const previousValue = this.getVisitedPositionValueForKey(posKey, previousEntry, currentTick, posKey);
            this.state.visitedPositions.set(posKey, {
                value: previousValue + 1,
                lastVisitedTick: currentTick
            });
            this.state.recentPositions.push(posKey);
            if (this.state.recentPositions.length > 40) {
                this.state.recentPositions.shift();
            }
            this.state.lastPosition = posKey;
        }

        forEachVisitedPosition(visitor) {
            if (typeof visitor !== 'function') {
                return;
            }
            const currentTick = this.state.tickId;
            const currentPositionKey = this.state.lastPosition;

            // Parcours de lecture avec décroissance calculée à la demande.
            // On purge aussi les entrées mortes pour contenir la taille de la map.
            for (const [key, entry] of this.state.visitedPositions.entries()) {
                const value = this.getVisitedPositionValueForKey(key, entry, currentTick, currentPositionKey);
                if (value <= 0) {
                    if (key !== currentPositionKey) {
                        this.state.visitedPositions.delete(key);
                    }
                    continue;
                }
                visitor(key, value);
            }
        }

        getVisitedPositionValueForKey(key, entry, currentTick, currentPositionKey) {
            const normalizedEntry = this.normalizeVisitedEntry(entry, currentTick);
            if (!normalizedEntry || !Number.isFinite(normalizedEntry.value) || normalizedEntry.value <= 0) {
                return 0;
            }
            const decayPerTick = 0.1;
            const isCurrentPosition = key === currentPositionKey;
            // La position courante ne doit pas subir de décroissance sur le tick où elle est écrite.
            const skipCurrentTickDecay = isCurrentPosition ? 1 : 0;
            const elapsedTicks = Math.max(0, currentTick - normalizedEntry.lastVisitedTick - skipCurrentTickDecay);
            return Math.max(0, normalizedEntry.value - (elapsedTicks * decayPerTick));
        }

        normalizeVisitedEntry(entry, currentTick) {
            // Compatibilité: accepte l'ancien format numérique et le nouveau format objet.
            if (entry && typeof entry === 'object') {
                const value = Number(entry.value);
                const lastVisitedTick = Number(entry.lastVisitedTick);
                if (Number.isFinite(value) && Number.isFinite(lastVisitedTick)) {
                    return { value, lastVisitedTick };
                }
            }
            if (Number.isFinite(entry)) {
                return { value: Number(entry), lastVisitedTick: currentTick };
            }
            return null;
        }

        generateObstaclesAndRewards() {
            const occupiedCells = new Set();

            for (let i = 0; i < this.config.numObstacles; i++) {
                let cellX;
                let cellY;
                do {
                    cellX = Math.floor(Math.random() * (this.width / this.config.stepSize)) * this.config.stepSize;
                    cellY = Math.floor(Math.random() * (this.height / this.config.stepSize)) * this.config.stepSize;
                } while (occupiedCells.has(`${cellX},${cellY}`));

                this.state.obstacles.push({ x: cellX, y: cellY });
                occupiedCells.add(`${cellX},${cellY}`);
            }

            for (let i = 0; i < this.config.numRewards; i++) {
                let cellX;
                let cellY;
                do {
                    cellX = Math.floor(Math.random() * (this.width / this.config.stepSize)) * this.config.stepSize;
                    cellY = Math.floor(Math.random() * (this.height / this.config.stepSize)) * this.config.stepSize;
                } while (occupiedCells.has(`${cellX},${cellY}`));

                this.state.rewards.push({ x: cellX, y: cellY, value: 1 });
                occupiedCells.add(`${cellX},${cellY}`);
            }
        }

        discoverSurroundings(agentPosition) {
            const surroundingCells = [
                { x: agentPosition.x, y: agentPosition.y },
                { x: agentPosition.x + this.config.stepSize, y: agentPosition.y },
                { x: agentPosition.x - this.config.stepSize, y: agentPosition.y },
                { x: agentPosition.x, y: agentPosition.y + this.config.stepSize },
                { x: agentPosition.x, y: agentPosition.y - this.config.stepSize }
            ];

            const discovered = { rewards: [], obstacles: [], newCellKeys: [] };
            this.state.lastDiscoveredCells = [];
            const discoveredBefore = this.state.discoveredCells.size;
            surroundingCells.forEach((cell) => {
                if (!this.isInsideGrid(cell.x, cell.y)) {
                    return;
                }

                const cellKey = this.toKey(cell.x, cell.y);
                const wasKnown = this.state.discoveredCells.has(cellKey);
                this.state.discoveredCells.add(cellKey);
                if (!wasKnown) {
                    discovered.newCellKeys.push(cellKey);
                    this.state.lastDiscoveredCells.push(cellKey);
                }

                if (this.isReward(cell.x, cell.y) && !this.state.discoveredRewards.some((reward) => reward.x === cell.x && reward.y === cell.y)) {
                    const reward = this.state.rewards.find((candidate) => candidate.x === cell.x && candidate.y === cell.y);
                    if (reward) {
                        this.state.discoveredRewards.push(reward);
                        discovered.rewards.push(reward);
                    }
                }

                if (this.isObstacle(cell.x, cell.y) && !this.state.discoveredObstacles.some((obstacle) => obstacle.x === cell.x && obstacle.y === cell.y)) {
                    const obstacle = this.state.obstacles.find((candidate) => candidate.x === cell.x && candidate.y === cell.y);
                    if (obstacle) {
                        this.state.discoveredObstacles.push(obstacle);
                        discovered.obstacles.push(obstacle);
                    }
                }
            });
            const discoveredAfter = this.state.discoveredCells.size;
            this.state.discoveredFreeCount = Math.max(0, this.state.discoveredCells.size - this.state.discoveredObstacles.length);
            this.state.coverageHistory.push(this.state.discoveredFreeCount);
            if (this.state.coverageHistory.length > 160) {
                this.state.coverageHistory.shift();
            }
            discovered.newCellsCount = Math.max(0, discoveredAfter - discoveredBefore);

            return discovered;
        }

        propagateValues() {
            this.state.stateValues.forEach((row) => row.fill(0));
            const useTopologicalPropagation = this.config.enableL2 !== false;
            const obstacleKeys = new Set(this.state.discoveredObstacles.map((obstacle) => this.toKey(obstacle.x, obstacle.y)));

            this.state.discoveredRewards.forEach((reward) => {
                this.state.stateValues[reward.x / this.config.stepSize][reward.y / this.config.stepSize] = Infinity;
                if (useTopologicalPropagation) {
                    this.propagateRewardTopological(reward, obstacleKeys);
                    return;
                }

                this.state.discoveredCells.forEach((cellKey) => {
                    const [x, y] = this.fromKey(cellKey);
                    if (x === reward.x && y === reward.y) {
                        return;
                    }
                    const col = x / this.config.stepSize;
                    const row = y / this.config.stepSize;
                    if (this.state.stateValues[col][row] < 0) {
                        return;
                    }
                    const manhattanDistance = (Math.abs(reward.x - x) + Math.abs(reward.y - y)) / this.config.stepSize;
                    const value = Math.pow(this.config.gamma, manhattanDistance) * reward.value;
                    this.state.stateValues[col][row] = Math.max(this.state.stateValues[col][row], value);
                });
            });

            this.state.discoveredObstacles.forEach((obstacle) => {
                this.state.stateValues[obstacle.x / this.config.stepSize][obstacle.y / this.config.stepSize] = -1;
            });
        }

        propagateRewardTopological(reward, obstacleKeys) {
            const queue = [{ x: reward.x, y: reward.y, distance: 0 }];
            let head = 0;
            const visited = new Set([this.toKey(reward.x, reward.y)]);

            while (head < queue.length) {
                const current = queue[head++];
                if (current.distance > 0) {
                    const col = current.x / this.config.stepSize;
                    const row = current.y / this.config.stepSize;
                    const value = Math.pow(this.config.gamma, current.distance) * reward.value;
                    this.state.stateValues[col][row] = Math.max(this.state.stateValues[col][row], value);
                }

                const neighbors = this.getNeighborCells(current.x, current.y);
                for (const neighbor of neighbors) {
                    const key = this.toKey(neighbor.x, neighbor.y);
                    if (visited.has(key) || obstacleKeys.has(key) || !this.state.discoveredCells.has(key)) {
                        continue;
                    }
                    visited.add(key);
                    queue.push({ x: neighbor.x, y: neighbor.y, distance: current.distance + 1 });
                }
            }
        }

        computeTopologicalDistancesFromReward(reward) {
            const queue = [{ x: reward.x, y: reward.y, distance: 0 }];
            let head = 0;
            const distances = new Map();
            const obstacleKeys = new Set(this.state.discoveredObstacles.map((obstacle) => this.toKey(obstacle.x, obstacle.y)));

            distances.set(this.toKey(reward.x, reward.y), 0);

            while (head < queue.length) {
                const current = queue[head++];
                const neighbors = this.getNeighborCells(current.x, current.y);
                neighbors.forEach((neighbor) => {
                    const key = this.toKey(neighbor.x, neighbor.y);
                    if (!this.state.discoveredCells.has(key) || obstacleKeys.has(key) || distances.has(key)) {
                        return;
                    }
                    distances.set(key, current.distance + 1);
                    queue.push({ x: neighbor.x, y: neighbor.y, distance: current.distance + 1 });
                });
            }

            return distances;
        }

        getRewardDistancesFrom(originPosition, rewards) {
            if (!originPosition || !Array.isArray(rewards) || rewards.length === 0) {
                return new Map();
            }
            const discoveredDistances = this.getDiscoveredDistancesFrom(originPosition);
            const rewardDistances = new Map();
            rewards.forEach((reward) => {
                const rewardKey = this.toKey(reward.x, reward.y);
                rewardDistances.set(rewardKey, discoveredDistances.has(rewardKey) ? discoveredDistances.get(rewardKey) : Infinity);
            });
            return rewardDistances;
        }

        getDiscoveredDistancesFrom(originPosition) {
            if (!originPosition) {
                return new Map();
            }
            if (this.state.distanceCacheTick !== this.state.tickId) {
                this.state.distanceCacheTick = this.state.tickId;
                this.state.distanceCacheByOrigin = new Map();
            }

            const originKey = this.toKey(originPosition.x, originPosition.y);
            if (this.state.distanceCacheByOrigin.has(originKey)) {
                return this.state.distanceCacheByOrigin.get(originKey);
            }

            const discoveredDistances = this.computeDiscoveredDistancesFrom(originPosition);
            this.state.distanceCacheByOrigin.set(originKey, discoveredDistances);
            return discoveredDistances;
        }

        computeDiscoveredDistancesFrom(start) {
            const distances = new Map();
            const queue = [{ x: start.x, y: start.y, distance: 0 }];
            let head = 0;
            const obstacleKeys = new Set(this.state.discoveredObstacles.map((obstacle) => this.toKey(obstacle.x, obstacle.y)));
            const startKey = this.toKey(start.x, start.y);
            distances.set(startKey, 0);

            while (head < queue.length) {
                const current = queue[head++];
                const neighbors = this.getNeighborCells(current.x, current.y);
                neighbors.forEach((neighbor) => {
                    const key = this.toKey(neighbor.x, neighbor.y);
                    if (distances.has(key) || obstacleKeys.has(key) || !this.state.discoveredCells.has(key)) {
                        return;
                    }
                    distances.set(key, current.distance + 1);
                    queue.push({ x: neighbor.x, y: neighbor.y, distance: current.distance + 1 });
                });
            }

            return distances;
        }

        bfsDistance(start, end) {
            if (!start || !end) return Infinity;
            if (start.x === end.x && start.y === end.y) return 0;

            const obstacleKeys = new Set(
                this.state.discoveredObstacles.map((obstacle) => this.toKey(obstacle.x, obstacle.y))
            );
            const visited = new Set([this.toKey(start.x, start.y)]);
            const queue = [{ x: start.x, y: start.y, distance: 0 }];
            let head = 0;
            const endKey = this.toKey(end.x, end.y);

            while (head < queue.length) {
                const current = queue[head++];
                const neighbors = this.getNeighborCells(current.x, current.y);
                for (const neighbor of neighbors) {
                    const key = this.toKey(neighbor.x, neighbor.y);
                    const isKnownCell = this.state.discoveredCells.has(key) || key === endKey;
                    if (visited.has(key) || obstacleKeys.has(key) || !isKnownCell) {
                        continue;
                    }
                    if (neighbor.x === end.x && neighbor.y === end.y) {
                        return current.distance + 1;
                    }
                    visited.add(key);
                    queue.push({ x: neighbor.x, y: neighbor.y, distance: current.distance + 1 });
                }
            }

            return Infinity;
        }

        bfsPath(start, end, options = {}) {
            if (!start || !end) return [];
            if (start.x === end.x && start.y === end.y) return [];

            const maxPathLength = Number.isFinite(options.maxPathLength)
                ? Math.max(0, options.maxPathLength)
                : Infinity;
            const obstacleKeys = new Set(
                this.state.discoveredObstacles.map((obstacle) => this.toKey(obstacle.x, obstacle.y))
            );
            const endKey = this.toKey(end.x, end.y);
            const startKey = this.toKey(start.x, start.y);
            const visited = new Set([startKey]);
            const parents = new Map();
            const distances = new Map([[startKey, 0]]);
            const queue = [{ x: start.x, y: start.y }];
            let head = 0;

            while (head < queue.length) {
                const current = queue[head++];
                const currentKey = this.toKey(current.x, current.y);
                const currentDistance = distances.get(currentKey) || 0;
                const neighbors = this.getNeighborCells(current.x, current.y);

                for (const neighbor of neighbors) {
                    const key = this.toKey(neighbor.x, neighbor.y);
                    const isKnownCell = this.state.discoveredCells.has(key) || key === endKey;
                    if (visited.has(key) || obstacleKeys.has(key) || !isKnownCell) {
                        continue;
                    }

                    visited.add(key);
                    parents.set(key, currentKey);
                    distances.set(key, currentDistance + 1);

                    if (key === endKey) {
                        return this.reconstructPath(parents, startKey, endKey, maxPathLength);
                    }

                    if ((currentDistance + 1) < maxPathLength) {
                        queue.push({ x: neighbor.x, y: neighbor.y });
                    }
                }
            }

            return [];
        }

        reconstructPath(parents, startKey, endKey, maxPathLength) {
            const pathReversed = [];
            let currentKey = endKey;

            while (currentKey !== startKey) {
                const [x, y] = this.fromKey(currentKey);
                pathReversed.push({ x, y });
                const parentKey = parents.get(currentKey);
                if (!parentKey) {
                    return [];
                }
                currentKey = parentKey;
            }

            pathReversed.reverse();
            if (Number.isFinite(maxPathLength) && pathReversed.length > maxPathLength) {
                return pathReversed.slice(0, maxPathLength);
            }
            return pathReversed;
        }

        updateLowYieldMemory(position, context = {}) {
            if (!position) return;
            const key = this.toKey(position.x, position.y);
            if (this.state.lowYieldWriteBufferTick !== this.state.tickId) {
                this.state.lowYieldWriteBufferTick = this.state.tickId;
                this.state.lowYieldWriteBuffer = new Map();
            }
            let previous = this.state.lowYieldWriteBuffer.get(key);
            if (!Number.isFinite(previous)) {
                const entry = this.state.lowYieldMap.get(key);
                previous = this.getDecayedLowYieldValue(entry);
            }
            const newCellsCount = Number.isFinite(context.newCellsCount) ? context.newCellsCount : 0;
            const collectedReward = context.collectedReward === true;

            let nextValue = previous;
            if (newCellsCount <= 0 && !collectedReward) {
                nextValue += this.config.lowYieldIncrement;
            } else {
                nextValue -= this.config.lowYieldRelief * Math.max(1, newCellsCount);
            }
            if (collectedReward) {
                nextValue -= this.config.lowYieldRewardRelief;
            }

            const boundedValue = Math.max(0, Math.min(this.config.lowYieldMaxPenalty, nextValue));
            this.state.lowYieldWriteBuffer.set(key, boundedValue);
            if (boundedValue <= 0) {
                this.state.lowYieldMap.delete(key);
                return;
            }
            this.state.lowYieldMap.set(key, {
                value: boundedValue,
                lastUpdatedTick: this.state.tickId
            });
        }

        getLowYieldPenalty(position) {
            if (!position) return 0;
            const key = this.toKey(position.x, position.y);
            const entry = this.state.lowYieldMap.get(key);
            const decayedValue = this.getDecayedLowYieldValue(entry);
            if (decayedValue <= 0) {
                this.state.lowYieldMap.delete(key);
                return 0;
            }
            if (entry && decayedValue !== entry.value) {
                this.state.lowYieldMap.set(key, {
                    value: decayedValue,
                    lastUpdatedTick: this.state.tickId
                });
            }
            return decayedValue;
        }

        getDecayedLowYieldValue(entry) {
            if (!entry || !Number.isFinite(entry.value) || entry.value <= 0) {
                return 0;
            }
            const decay = Number.isFinite(this.config.lowYieldPassiveDecay)
                ? Math.max(0, this.config.lowYieldPassiveDecay)
                : 0;
            if (decay <= 0) return entry.value;
            const elapsedTicks = Math.max(0, this.state.tickId - (entry.lastUpdatedTick || 0));
            return Math.max(0, entry.value - (elapsedTicks * decay));
        }

        getNeighborCells(x, y) {
            return [
                { x, y: y - this.config.stepSize },
                { x, y: y + this.config.stepSize },
                { x: x - this.config.stepSize, y },
                { x: x + this.config.stepSize, y }
            ].filter((cell) => this.isInsideGrid(cell.x, cell.y));
        }

        isInsideGrid(x, y) {
            return x >= 0 && x < this.width && y >= 0 && y < this.height;
        }

        toKey(x, y) {
            return `${x},${y}`;
        }

        fromKey(key) {
            if (this.state.keyCoordCache.has(key)) {
                return this.state.keyCoordCache.get(key);
            }
            const separatorIndex = key.indexOf(',');
            const x = Number(key.slice(0, separatorIndex));
            const y = Number(key.slice(separatorIndex + 1));
            const coords = [x, y];
            this.state.keyCoordCache.set(key, coords);
            return coords;
        }
    }

    globalScope.ARVEWorld = ARVEWorld;
}(typeof window !== "undefined" ? window : globalThis));


