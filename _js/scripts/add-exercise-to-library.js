module.exports = async function addExerciseToLibrary(params) {
    const core = globalThis.customJS?.gymCore;
    if (!core) throw new Error("Gym core is not loaded. Reload Obsidian.");

    const { suggester, inputPrompt } = params.quickAddApi;
    try {
        const categoriesRaw = await core.app.vault.adapter.read(core.paths.exerciseCategoriesPath);
        const categories = JSON.parse(categoriesRaw);
        const exerciseName = (await inputPrompt("Exercise name"))?.trim();
        if (!exerciseName) return;

        const isTimed = await suggester(
            ["Reps-based exercise", "Timed exercise"],
            [false, true],
            "Exercise type"
        );
        if (isTimed === undefined) return;

        const groupOptions = Object.values(categories.muscleGroups || {}).map(group => group.name);
        const muscleGroup = await suggester(groupOptions, groupOptions, "Primary muscle group");
        if (!muscleGroup) return;

        const equipmentOptions = categories.equipment || [];
        const equipment = await suggester(equipmentOptions, equipmentOptions, "Equipment");
        if (!equipment) return;

        const instructions = (await inputPrompt("Instructions", "")) || "";
        const videoUrl = (await inputPrompt("Video URL (optional)", "")) || "";
        const defaultWeight = core.numberOrNull(await inputPrompt("Default weight kg (optional)", ""));
        const defaultRest = core.numberOrNull(await inputPrompt("Default rest seconds", "60"));

        let defaultReps = null;
        let defaultDuration = null;
        if (isTimed) {
            defaultDuration = core.numberOrNull(await inputPrompt("Default duration seconds", "30"));
            if (!(defaultDuration > 0)) return;
        } else {
            defaultReps = core.numberOrNull(await inputPrompt("Default reps", "8"));
            if (!(defaultReps > 0)) return;
        }

        const folder = core.joinPath(core.paths.exercisesRoot, muscleGroup);
        await core.ensureFolder(folder);
        const fullName = muscleGroup + " - " + exerciseName;
        const path = core.joinPath(folder, fullName.replace(/[\\/:*?"<>|]/g, "-") + ".md");
        if (core.app.vault.getAbstractFileByPath(path)) {
            new Notice("Exercise already exists: " + fullName);
            return;
        }

        const lines = [
            "---",
            "schema_version: 2",
            "id: " + core.yaml(core.uuid()),
            "exercise: " + core.yaml(fullName),
            "muscle_group: " + core.yaml(muscleGroup),
            "equipment: " + core.yaml(equipment),
            "timed: " + String(Boolean(isTimed)),
            defaultReps != null ? "default_reps: " + defaultReps : null,
            defaultDuration != null ? "default_duration_seconds: " + defaultDuration : null,
            defaultWeight != null ? "default_weight_kg: " + defaultWeight : null,
            "default_rest_seconds: " + Math.max(0, defaultRest ?? 60),
            "instructions: " + core.yaml(instructions),
            videoUrl ? "video_url: " + core.yaml(videoUrl) : null,
            "tags:",
            "  - exercise",
            "---",
            "",
            "~~~dataviewjs",
            "const {exercise} = customJS;",
            "exercise.renderDescription({dv, container: this.container, window});",
            "exercise.renderEffortWeightChart({dv, container: this.container, window});",
            "~~~"
        ].filter(line => line !== null).join("\n").replaceAll("~~~", "```");

        const file = await core.app.vault.create(path, lines);
        params.variables = { exercisePath: file.path };
        new Notice("Exercise added: " + fullName);
    } catch (error) {
        console.error("Error creating exercise", error);
        new Notice("Could not create exercise: " + error.message);
        throw error;
    }
};
