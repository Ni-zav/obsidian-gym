class pathConfig {
    get defaults() {
        return {
            exercisesRoot: "Templates/exercises",
            templateNotesRoot: "Templates/exercises",
            workoutTemplatesRoot: "Templates/Workouts",
            workoutsRoot: "Workouts"
        };
    }

    normalizePath(value) {
        if (!value || typeof value !== "string") return "";
        return value.replace(/\\/g, "/").trim().replace(/^\\/+/, "").replace(/\\/+$/, "");
    }

    joinVaultPath(...segments) {
        return segments.filter(Boolean).map((segment, index) => {
            const value = String(segment);
            return index === 0 ? value.replace(/\\/+$/, "") : value.replace(/^\\/+/, "").replace(/\\/+$/, "");
        }).join("/");
    }

    getPathConfig() {
        const overrides = globalThis.obsidianGymPaths || {};
        const exercisesRoot = this.normalizePath(overrides.exercisesRoot) || this.defaults.exercisesRoot;
        const templateNotesRoot = this.normalizePath(overrides.templateNotesRoot) || exercisesRoot;
        const workoutTemplatesRoot = this.normalizePath(overrides.workoutTemplatesRoot) || this.defaults.workoutTemplatesRoot;
        const workoutsRoot = this.normalizePath(overrides.workoutsRoot) || this.defaults.workoutsRoot;
        return {
            exercisesRoot,
            templateNotesRoot,
            workoutTemplatesRoot,
            workoutsRoot,
            exerciseCategoriesPath: this.joinVaultPath(exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: this.joinVaultPath(exercisesRoot, "_library/workout_categories.json"),
            startTemplatePath: this.joinVaultPath(templateNotesRoot, "Start.md"),
            endTemplatePath: this.joinVaultPath(templateNotesRoot, "End.md"),
            customTemplatePath: this.joinVaultPath(templateNotesRoot, "Custom.md")
        };
    }

    getTemplateFilePath(fileName, config = this.getPathConfig()) {
        const lowered = String(fileName || "").toLowerCase();
        if (lowered === "start.md") return config.startTemplatePath;
        if (lowered === "end.md") return config.endTemplatePath;
        if (lowered === "custom.md") return config.customTemplatePath;
        return this.joinVaultPath(config.exercisesRoot, fileName);
    }

    getExerciseLibraryPath(fileName, config = this.getPathConfig()) {
        const lowered = String(fileName || "").toLowerCase();
        if (lowered === "categories.json") return config.exerciseCategoriesPath;
        if (lowered === "workout_categories.json") return config.workoutCategoriesPath;
        return this.joinVaultPath(config.exercisesRoot, "_library", fileName);
    }
}
