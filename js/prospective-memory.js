/**
 * ARVE PROSPECTIVE MEMORY
 *
 * Memoire prospective legere (N-step) basee sur quelques sequences candidates.
 * Note: la projection utilise les obstacles connus uniquement.
 * En zone inexploree, une sequence peut rencontrer un obstacle inconnu.
 */
class ARVEProspectiveMemory {
    constructor(config, world) {
        this.config = config;
        this.world = world;
        this.candidates = [];
        this.lastUpdateTick = -1;
    }

    update(agentPosition, context) {
        const tickId = this.world.state.tickId;
        const every = Math.max(1, this.config.prospectiveRecomputeEvery || 3);
        if (this.lastUpdateTick >= 0 && (tickId - this.lastUpdateTick) < every) {
            return;
        }
        this.lastUpdateTick = tickId;

        const branches = Math.max(1, this.config.prospectiveBranches || 4);
        const depth = Math.max(1, this.config.prospectiveDepth || 3);
        const gamma = Number.isFinite(this.config.prospectiveGamma) ? this.config.prospectiveGamma : 0.8;
        const sequenceSet = new Set();
        const generated = [];

        for (let i = 0; i < branches; i += 1) {
            const sequence = this.buildSequence(agentPosition, depth, context, i);
            if (sequence.length === 0) {
                continue;
            }
            const signature = sequence.map((step) => step.name).join('>');
            if (sequenceSet.has(signature)) {
                continue;
            }
            sequenceSet.add(signature);
            const score = this.scoreSequence(agentPosition, sequence, context, gamma);
            generated.push({ sequence, score });
        }

        generated.sort((a, b) => b.score - a.score);
        this.candidates = generated;
    }

    buildSequence(origin, depth, context, branchIndex) {
        const steps = [];
        let position = { x: origin.x, y: origin.y };
        let previousDirectionName = context.lastMoveDirection ? context.lastMoveDirection.name : null;

        for (let stepIndex = 0; stepIndex < depth; stepIndex += 1) {
            const validDirections = context.getValidDirectionsFrom(position);
            if (validDirections.length === 0) {
                break;
            }
            const scored = validDirections.map((direction) => {
                const nextPosition = {
                    x: position.x + direction.x,
                    y: position.y + direction.y
                };
                const utility = context.utilityEvaluator(nextPosition, direction, position, {
                    previousDirectionName,
                    includeProspectiveBias: false
                });
                return { direction, utility };
            }).sort((a, b) => b.utility - a.utility);

            const pickIndex = stepIndex === 0 ? Math.min(branchIndex, scored.length - 1) : 0;
            const pick = scored[pickIndex];
            if (!pick) {
                break;
            }

            steps.push(pick.direction);
            position = { x: position.x + pick.direction.x, y: position.y + pick.direction.y };
            previousDirectionName = pick.direction.name;
        }

        return steps;
    }

    scoreSequence(origin, sequence, context, gamma) {
        let score = 0;
        let discount = 1;
        let position = { x: origin.x, y: origin.y };
        let previousDirectionName = context.lastMoveDirection ? context.lastMoveDirection.name : null;

        for (const direction of sequence) {
            const nextPosition = { x: position.x + direction.x, y: position.y + direction.y };
            const utility = context.utilityEvaluator(nextPosition, direction, position, {
                previousDirectionName,
                includeProspectiveBias: false
            });
            score += discount * utility;
            discount *= gamma;
            position = nextPosition;
            previousDirectionName = direction.name;
        }

        return score;
    }

    getBestHead() {
        if (this.candidates.length === 0) {
            return null;
        }
        const best = this.candidates[0];
        if (!best || !best.sequence || best.sequence.length === 0) {
            return null;
        }
        return best.sequence[0];
    }

    getCandidates() {
        return this.candidates;
    }
}

if (typeof window !== 'undefined') {
    window.ARVEProspectiveMemory = ARVEProspectiveMemory;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARVEProspectiveMemory };
}
