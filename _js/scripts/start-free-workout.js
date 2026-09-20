module.exports = async function startFreeWorkout(params) {
    const core = globalThis.customJS?.gymCore;
    if (!core) throw new Error("Gym core is not loaded. Reload Obsidian.");

    try {
        const session = await core.createWorkoutSession(null, { free: true });
        await core.app.workspace.getLeaf(false).openFile(session);
        params.variables = { notePath: session.path };
        new Notice("Free workout started");
    } catch (error) {
        console.error("Failed to start free workout", error);
        new Notice("Could not start free workout: " + error.message);
        params.variables = { notePath: "" };
    }
};
