const PATH_CONFIG = {
    exercisesRoot: "Templates/exercises",
    exerciseCategoriesPath: "Templates/exercises/_library/categories.json",
    workoutCategoriesPath: "Templates/exercises/_library/workout_categories.json",
    workoutTemplatesRoot: "Templates/Workouts",
    workoutsRoot: "Workouts",
    programTemplatePath: "Templates/programs/_templates/program-template.md",
    programsOutputRoot: "Templates/programs/active-programs",
    startTemplatePath: "Templates/exercises/Start.md",
    endTemplatePath: "Templates/exercises/End.md",
    customTemplatePath: "Templates/exercises/Custom.md"
};

function normalizePath(pathValue) {
    if (!pathValue || typeof pathValue !== "string") return "";
    return pathValue.replace(/\\/g, '/').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function getGlobalPathOverrides() {
    if (typeof globalThis === "undefined" || !globalThis.obsidianGymPaths) {
        return {};
    }

    const overrides = globalThis.obsidianGymPaths;
    const legacyTemplatesRoot = normalizePath(overrides.templatesRoot);
    const legacyTemplateNotesRoot = normalizePath(overrides.templateNotesRoot) || legacyTemplatesRoot;
    const legacyProgramsRoot = normalizePath(overrides.programsRoot) || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "programs") : "");
    const exercisesRoot = normalizePath(overrides.exercisesRoot);

    return {
        exercisesRoot,
        exerciseCategoriesPath: normalizePath(overrides.exerciseCategoriesPath),
        workoutCategoriesPath: normalizePath(overrides.workoutCategoriesPath),
        workoutTemplatesRoot: normalizePath(overrides.workoutTemplatesRoot),
        workoutsRoot: normalizePath(overrides.workoutsRoot),
        programTemplatePath: normalizePath(overrides.programTemplatePath),
        programsOutputRoot: normalizePath(overrides.programsOutputRoot),
        startTemplatePath: normalizePath(overrides.startTemplatePath),
        endTemplatePath: normalizePath(overrides.endTemplatePath),
        customTemplatePath: normalizePath(overrides.customTemplatePath),

        legacyTemplateNotesRoot,
        legacyProgramsRoot
    };
}

function joinVaultPath(...segments) {
    return segments
        .filter(Boolean)
        .map((segment, index) => {
            const value = String(segment);
            if (index === 0) return value.replace(/\/+$/, '');
            return value.replace(/^\/+/, '').replace(/\/+$/, '');
        })
        .join('/');
}

function getPathConfig() {
    const overrides = getGlobalPathOverrides();
    const exercisesRoot = overrides.exercisesRoot || PATH_CONFIG.exercisesRoot;
    const legacyTemplateNotesRoot = overrides.legacyTemplateNotesRoot || "";
    const legacyProgramsRoot = overrides.legacyProgramsRoot || "";

    return {
        exercisesRoot,
        exerciseCategoriesPath: overrides.exerciseCategoriesPath || joinVaultPath(exercisesRoot, "_library/categories.json"),
        workoutCategoriesPath: overrides.workoutCategoriesPath || joinVaultPath(exercisesRoot, "_library/workout_categories.json"),
        workoutTemplatesRoot: overrides.workoutTemplatesRoot || PATH_CONFIG.workoutTemplatesRoot,
        workoutsRoot: overrides.workoutsRoot || PATH_CONFIG.workoutsRoot,
        programTemplatePath: overrides.programTemplatePath || (legacyProgramsRoot ? joinVaultPath(legacyProgramsRoot, "_templates/program-template.md") : PATH_CONFIG.programTemplatePath),
        programsOutputRoot: overrides.programsOutputRoot || (legacyProgramsRoot ? joinVaultPath(legacyProgramsRoot, "active-programs") : PATH_CONFIG.programsOutputRoot),
        startTemplatePath: overrides.startTemplatePath || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "Start.md") : joinVaultPath(exercisesRoot, "Start.md")),
        endTemplatePath: overrides.endTemplatePath || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "End.md") : joinVaultPath(exercisesRoot, "End.md")),
        customTemplatePath: overrides.customTemplatePath || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "Custom.md") : joinVaultPath(exercisesRoot, "Custom.md"))
    };
}

function getTemplateFilePath(fileName, config = getPathConfig()) {
    const lowered = String(fileName || "").toLowerCase();
    if (lowered === "start.md") return config.startTemplatePath;
    if (lowered === "end.md") return config.endTemplatePath;
    if (lowered === "custom.md") return config.customTemplatePath;
    return joinVaultPath(config.exercisesRoot, fileName);
}

function getExerciseLibraryPath(fileName, config = getPathConfig()) {
    const lowered = String(fileName || "").toLowerCase();
    if (lowered === "categories.json") return config.exerciseCategoriesPath;
    if (lowered === "workout_categories.json") return config.workoutCategoriesPath;
    return joinVaultPath(config.exercisesRoot, "_library", fileName);
}

function getProgramTemplatePath(config = getPathConfig()) {
    return config.programTemplatePath;
}

function getProgramsActiveRoot(config = getPathConfig()) {
    return config.programsOutputRoot;
}

module.exports = {
    PATH_CONFIG,
    joinVaultPath,
    getPathConfig,
    getTemplateFilePath,
    getExerciseLibraryPath,
    getProgramTemplatePath,
    getProgramsActiveRoot
};

if (typeof globalThis !== "undefined") {
    globalThis.obsidianGymPaths = {
        ...(globalThis.obsidianGymPaths || {}),
        ...getPathConfig()
    };
}
