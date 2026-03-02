class pathConfig {
    get PATH_CONFIG() {
        return {
            exercisesRoot: "Templates/exercises",
            templateNotesRoot: "Templates/exercises",
            workoutTemplatesRoot: "Templates/Workouts",
            workoutsRoot: "Workouts",
            programsRoot: "Templates/programs",
            exerciseCategoriesPath: "Templates/exercises/_library/categories.json",
            workoutCategoriesPath: "Templates/exercises/_library/workout_categories.json",
            programTemplatePath: "Templates/programs/program-template.md",
            programsOutputRoot: "Templates/programs",
            startTemplatePath: "Templates/exercises/Start.md",
            endTemplatePath: "Templates/exercises/End.md",
            customTemplatePath: "Templates/exercises/Custom.md"
        };
    }

    normalizePath(pathValue) {
        if (!pathValue || typeof pathValue !== "string") return "";
        return pathValue.replace(/\\/g, '/').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    }

    getGlobalPathOverrides() {
        if (typeof globalThis === "undefined" || !globalThis.obsidianGymPaths) {
            return {};
        }

        const overrides = globalThis.obsidianGymPaths;
        const legacyTemplatesRoot = this.normalizePath(overrides.templatesRoot);
        const legacyTemplateNotesRoot = this.normalizePath(overrides.templateNotesRoot) || legacyTemplatesRoot;
        const templateNotesRoot = this.normalizePath(overrides.templateNotesRoot) || legacyTemplateNotesRoot;

        const legacyProgramsRoot = this.normalizePath(overrides.programsRoot) || (legacyTemplateNotesRoot ? this.joinVaultPath(legacyTemplateNotesRoot, "programs") : "");
        const programsRoot = this.normalizePath(overrides.programsRoot) || this.normalizePath(overrides.programsOutputRoot) || legacyProgramsRoot;
        const exercisesRoot = this.normalizePath(overrides.exercisesRoot);

        return {
            exercisesRoot,
            templateNotesRoot,
            workoutTemplatesRoot: this.normalizePath(overrides.workoutTemplatesRoot),
            workoutsRoot: this.normalizePath(overrides.workoutsRoot),
            programsRoot,
            programTemplatePath: this.normalizePath(overrides.programTemplatePath),
            programsOutputRoot: this.normalizePath(overrides.programsOutputRoot),
            startTemplatePath: this.normalizePath(overrides.startTemplatePath),
            endTemplatePath: this.normalizePath(overrides.endTemplatePath),
            customTemplatePath: this.normalizePath(overrides.customTemplatePath),

            legacyTemplateNotesRoot,
            legacyProgramsRoot
        };
    }

    joinVaultPath(...segments) {
        return segments
            .filter(Boolean)
            .map((segment, index) => {
                const value = String(segment);
                if (index === 0) return value.replace(/\/+$/, '');
                return value.replace(/^\/+/, '').replace(/\/+$/, '');
            })
            .join('/');
    }

    getPathConfig() {
        const overrides = this.getGlobalPathOverrides();
        const exercisesRoot = overrides.exercisesRoot || this.PATH_CONFIG.exercisesRoot;
        const templateNotesRoot = overrides.templateNotesRoot || this.PATH_CONFIG.templateNotesRoot || exercisesRoot;
        const legacyProgramsRoot = overrides.legacyProgramsRoot || "";
        const programsRoot = overrides.programsRoot || this.PATH_CONFIG.programsRoot || legacyProgramsRoot;

        return {
            exercisesRoot,
            templateNotesRoot,
            workoutTemplatesRoot: overrides.workoutTemplatesRoot || this.PATH_CONFIG.workoutTemplatesRoot,
            workoutsRoot: overrides.workoutsRoot || this.PATH_CONFIG.workoutsRoot,
            programsRoot,
            exerciseCategoriesPath: this.joinVaultPath(exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: this.joinVaultPath(exercisesRoot, "_library/workout_categories.json"),
            programTemplatePath: overrides.programTemplatePath || (legacyProgramsRoot ? this.joinVaultPath(legacyProgramsRoot, "_templates/program-template.md") : this.joinVaultPath(programsRoot, "program-template.md")),
            programsOutputRoot: programsRoot,
            startTemplatePath: this.joinVaultPath(templateNotesRoot, "Start.md"),
            endTemplatePath: this.joinVaultPath(templateNotesRoot, "End.md"),
            customTemplatePath: this.joinVaultPath(templateNotesRoot, "Custom.md")
        };
    }

    getTemplateFilePath(fileName, config) {
        if (!config) config = this.getPathConfig();
        const lowered = String(fileName || "").toLowerCase();
        if (lowered === "start.md") return config.startTemplatePath;
        if (lowered === "end.md") return config.endTemplatePath;
        if (lowered === "custom.md") return config.customTemplatePath;
        return this.joinVaultPath(config.exercisesRoot, fileName);
    }

    getExerciseLibraryPath(fileName, config) {
        if (!config) config = this.getPathConfig();
        const lowered = String(fileName || "").toLowerCase();
        if (lowered === "categories.json") return config.exerciseCategoriesPath;
        if (lowered === "workout_categories.json") return config.workoutCategoriesPath;
        return this.joinVaultPath(config.exercisesRoot, "_library", fileName);
    }

    getProgramTemplatePath(config) {
        if (!config) config = this.getPathConfig();
        return this.joinVaultPath(config.programsRoot, "program-template.md");
    }

    getProgramsActiveRoot(config) {
        if (!config) config = this.getPathConfig();
        return config.programsRoot;
    }
}
