module.exports = async function createTodaysWorkout(params) {
    const core = globalThis.customJS?.gymCore;
    if (!core) throw new Error("Gym core is not loaded. Reload Obsidian.");
    const workouts = core.getWorkoutTemplates().sort((a, b) =>
        a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: "base" })
    );
    const selected = await params.quickAddApi.suggester(file => file.basename, workouts, "Start workout");
    if (!selected) {
        params.variables = { notePath: "" };
        return;
    }
    const session = await core.createWorkoutSession(selected);
    await core.app.workspace.getLeaf(false).openFile(session);
    params.variables = { notePath: session.path };
};
