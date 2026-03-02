const PATH_CONFIG = {
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
    const templateNotesRoot = normalizePath(overrides.templateNotesRoot) || legacyTemplateNotesRoot;

    const legacyProgramsRoot = normalizePath(overrides.programsRoot) || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "programs") : "");
    const programsRoot = normalizePath(overrides.programsRoot) || normalizePath(overrides.programsOutputRoot) || legacyProgramsRoot;
    const exercisesRoot = normalizePath(overrides.exercisesRoot);

    return {
        exercisesRoot,
        templateNotesRoot,
        workoutTemplatesRoot: normalizePath(overrides.workoutTemplatesRoot),
        workoutsRoot: normalizePath(overrides.workoutsRoot),
        programsRoot,
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
    const templateNotesRoot = overrides.templateNotesRoot || PATH_CONFIG.templateNotesRoot || exercisesRoot;
    const legacyProgramsRoot = overrides.legacyProgramsRoot || "";
    const programsRoot = overrides.programsRoot || PATH_CONFIG.programsRoot || legacyProgramsRoot;

    return {
        exercisesRoot,
        templateNotesRoot,
        workoutTemplatesRoot: overrides.workoutTemplatesRoot || PATH_CONFIG.workoutTemplatesRoot,
        workoutsRoot: overrides.workoutsRoot || PATH_CONFIG.workoutsRoot,
        programsRoot,
        exerciseCategoriesPath: joinVaultPath(exercisesRoot, "_library/categories.json"),
        workoutCategoriesPath: joinVaultPath(exercisesRoot, "_library/workout_categories.json"),
        programTemplatePath: overrides.programTemplatePath || (legacyProgramsRoot ? joinVaultPath(legacyProgramsRoot, "_templates/program-template.md") : joinVaultPath(programsRoot, "program-template.md")),
        programsOutputRoot: programsRoot,
        startTemplatePath: joinVaultPath(templateNotesRoot, "Start.md"),
        endTemplatePath: joinVaultPath(templateNotesRoot, "End.md"),
        customTemplatePath: joinVaultPath(templateNotesRoot, "Custom.md")
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
    return joinVaultPath(config.programsRoot, "program-template.md");
}

function getProgramsActiveRoot(config = getPathConfig()) {
    return config.programsRoot;
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
