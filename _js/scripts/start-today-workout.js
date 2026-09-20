module.exports = async function startTodaysWorkout(params) {
    const core = globalThis.customJS?.gymCore;
    if (!core) throw new Error("Gym core is not loaded. Reload Obsidian.");

    try {
        const workouts = core.getWorkoutTemplates().sort((a, b) =>
            a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: "base" })
        );
        if (!workouts.length) {
            new Notice("No workout routines found in " + core.paths.workoutTemplatesRoot);
            return;
        }

        const selected = await params.quickAddApi.suggester(
            file => {
                const fm = core.frontmatter(file);
                const detail = [fm.workout_type, fm.workout_place].filter(Boolean).join(" · ");
                return file.basename + (detail ? " — " + detail : "");
            },
            workouts,
            "Start workout"
        );
        if (!selected) return;

        const session = await core.createWorkoutSession(selected);
        await core.app.workspace.getLeaf(false).openFile(session);
        params.variables = { notePath: session.path };
        new Notice("Workout started");
    } catch (error) {
        console.error("Failed to start workout", error);
        new Notice("Could not start workout: " + error.message);
        params.variables = { notePath: "" };
    }
};
