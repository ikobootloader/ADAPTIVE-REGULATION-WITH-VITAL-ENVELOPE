/**
 * ARVE Threshold Manager
 * Module metier: calcule un seuil de survie dynamique.
 */
(function attachThresholdManager(globalScope) {
    class ThresholdManager {
        constructor(config) {
            this.config = config;
        }

        computeAdaptiveThreshold(budgetStatus, discoveredRewardsCount) {
            if (this.config.enableL3 === false) {
                return this.config.criticalHealthThreshold;
            }
            if (!budgetStatus || !budgetStatus.hasKnownReward || !Number.isFinite(budgetStatus.distanceToNearestReward)) {
                return this.config.criticalHealthThreshold;
            }

            const baseThreshold = (
                budgetStatus.distanceToNearestReward *
                this.config.energyCostPerStep *
                this.config.returnSafetyFactor
            ) / this.config.maxHealth;

            // Plus l'agent connait de recompenses, moins il doit etre conservateur.
            const densityDiscount = Math.min(this.config.maxThresholdDensityDiscount, Math.max(0, discoveredRewardsCount - 1) * this.config.thresholdDensityStep);
            const adjustedThreshold = baseThreshold * (1 - densityDiscount);

            return this.clamp(
                adjustedThreshold,
                this.config.minAdaptiveThreshold,
                this.config.maxAdaptiveThreshold
            );
        }

        clamp(value, minValue, maxValue) {
            return Math.max(minValue, Math.min(maxValue, value));
        }
    }

    globalScope.ARVEThresholdManager = ThresholdManager;
}(typeof window !== "undefined" ? window : globalThis));


