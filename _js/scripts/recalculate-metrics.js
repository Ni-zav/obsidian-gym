module.exports = async function recalculateMetrics() {
    const core = globalThis.customJS?.gymCore;
    if (!core) {
        new Notice("Gym core is not loaded. Reload Obsidian.");
        return;
    }
    try {
        const active = core.app.workspace.getActiveFile();
        const workoutFile = core.getWorkoutFileFromAny(active);
        if (!workoutFile) {
            new Notice("Open a workout session first");
            return;
        }
        await core.recalculateWorkoutMetrics(workoutFile);
        new Notice("Workout metrics recalculated");
    } catch (error) {
        console.error("Metric recalculation failed", error);
        new Notice("Could not recalculate metrics: " + error.message);
    }
};
