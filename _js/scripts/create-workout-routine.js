module.exports = async function createWorkoutRoutine(params) {
    const core = globalThis.customJS?.gymCore;
    if (!core) throw new Error("Gym core is not loaded. Reload Obsidian.");
    const { suggester, inputPrompt } = params.quickAddApi;

    try {
        const name = (await inputPrompt("Workout name", ""))?.trim();
        if (!name) return;

        const exercises = core.getExerciseDefinitions().sort((a, b) =>
            (a.fm.exercise || a.file.basename).localeCompare(b.fm.exercise || b.file.basename)
        );
        if (!exercises.length) {
            new Notice("No exercises found");
            return;
        }

        const selected = [];
        while (true) {
            const choice = await suggester(
                item => {
                    const label = item.fm.exercise || item.file.basename;
                    const last = core.getLatestSet(item.fm.id, label);
                    const history = last ? " · last " + (last.fm.weight_kg ?? "—") + "kg × " + (last.fm.reps ?? (last.fm.duration_seconds ? last.fm.duration_seconds + "s" : "—")) : "";
                    return label + " · " + (item.fm.equipment || "") + history;
                },
                exercises,
                selected.length ? "Add another exercise" : "Choose first exercise"
            );
            if (!choice) break;
            const sets = Number(await inputPrompt("Sets for " + (choice.fm.exercise || choice.file.basename), "3"));
            if (!Number.isInteger(sets) || sets < 1) {
                new Notice("Sets must be a positive whole number");
                continue;
            }
            selected.push({ id: choice.fm.id, name: choice.fm.exercise || choice.file.basename, sets });
            const action = await suggester(["Add another", "Finish routine"], ["continue", "finish"]);
            if (action !== "continue") break;
        }
        if (!selected.length) return;

        const categoriesRaw = await core.app.vault.adapter.read(core.paths.workoutCategoriesPath);
        const categories = JSON.parse(categoriesRaw);
        const types = Object.values(categories.workoutTypes || {});
        const places = Object.values(categories.places || {});
        const type = await suggester(item => item.name + " — " + (item.description || ""), types, "Workout type");
        if (!type) return;
        const place = await suggester(item => item.name + " — " + (item.description || ""), places, "Workout place");
        if (!place) return;

        const ids = selected.flatMap(item => Array(item.sets).fill(item.id));
        const folder = core.joinPath(core.paths.workoutTemplatesRoot, "gym");
        await core.ensureFolder(folder);
        const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".md";
        const path = core.joinPath(folder, filename);
        if (core.app.vault.getAbstractFileByPath(path)) {
            new Notice("Routine already exists: " + name);
            return;
        }

        const content = [
            "---",
            "schema_version: 2",
            "workout_title: " + core.yaml(name),
            "exercises: " + JSON.stringify(ids),
            "workout_order: " + JSON.stringify(ids),
            "workout_type: " + core.yaml(type.name),
            "workout_place: " + core.yaml(place.name),
            "tags:",
            "  - workout",
            "---",
            "",
            "# " + name,
            "",
            selected.map(item => "- " + item.name + " × " + item.sets + " sets").join("\n")
        ].join("\n");

        const file = await core.app.vault.create(path, content);
        core.invalidateForFile(file);
        params.variables = { workoutPath: file.path };
        new Notice("Routine created: " + name);
    } catch (error) {
        console.error("Routine creation failed", error);
        new Notice("Could not create routine: " + error.message);
    }
};
