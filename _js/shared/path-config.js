class pathConfig {
    get defaults() {
        return {
            exercisesRoot: "Templates/exercises",
            workoutTemplatesRoot: "Templates/Workouts",
            workoutsRoot: "Workouts"
        };
    }

    normalizePath(value) {
        if (!value || typeof value !== "string") return "";
        let normalized = value.split(String.fromCharCode(92)).join("/").trim();
        while (normalized.startsWith("/")) normalized = normalized.slice(1);
        while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
        return normalized;
    }

    joinVaultPath(...segments) {
        return segments.filter(Boolean).map((segment, index) => {
            let value = String(segment);
            if (index === 0) {
                while (value.endsWith("/")) value = value.slice(0, -1);
            } else {
                while (value.startsWith("/")) value = value.slice(1);
                while (value.endsWith("/")) value = value.slice(0, -1);
            }
            return value;
        }).join("/");
    }

    getPathConfig() {
        const overrides = globalThis.obsidianGymPaths || {};
        const exercisesRoot = this.normalizePath(overrides.exercisesRoot) || this.defaults.exercisesRoot;
        const workoutTemplatesRoot = this.normalizePath(overrides.workoutTemplatesRoot) || this.defaults.workoutTemplatesRoot;
        const workoutsRoot = this.normalizePath(overrides.workoutsRoot) || this.defaults.workoutsRoot;
        return {
            exercisesRoot,
            workoutTemplatesRoot,
            workoutsRoot,
            exerciseCategoriesPath: this.joinVaultPath(exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: this.joinVaultPath(exercisesRoot, "_library/workout_categories.json"),
        };
    }

    getTemplateFilePath(fileName, config = this.getPathConfig()) {
        const lowered = String(fileName || "").toLowerCase();
        return this.joinVaultPath(config.exercisesRoot, fileName);
    }

    getExerciseLibraryPath(fileName, config = this.getPathConfig()) {
        const lowered = String(fileName || "").toLowerCase();
        if (lowered === "categories.json") return config.exerciseCategoriesPath;
        if (lowered === "workout_categories.json") return config.workoutCategoriesPath;
        return this.joinVaultPath(config.exercisesRoot, "_library", fileName);
    }
}
