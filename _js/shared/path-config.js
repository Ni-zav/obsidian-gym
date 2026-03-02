const PATH_CONFIG = {
    templateNotesRoot: "Templates",
    programsRoot: "Templates/programs",
    exercisesRoot: "Templates/exercises",
    workoutTemplatesRoot: "Templates/Workouts",
    workoutsRoot: "Workouts"
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
    const templateNotesRoot = normalizePath(overrides.templateNotesRoot) || legacyTemplatesRoot;
    const programsRoot = normalizePath(overrides.programsRoot) || (templateNotesRoot ? joinVaultPath(templateNotesRoot, "programs") : "");

    return {
        templateNotesRoot,
        programsRoot,
        exercisesRoot: normalizePath(overrides.exercisesRoot),
        workoutTemplatesRoot: normalizePath(overrides.workoutTemplatesRoot),
        workoutsRoot: normalizePath(overrides.workoutsRoot)
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
    return {
        templateNotesRoot: overrides.templateNotesRoot || PATH_CONFIG.templateNotesRoot,
        programsRoot: overrides.programsRoot || PATH_CONFIG.programsRoot,
        exercisesRoot: overrides.exercisesRoot || PATH_CONFIG.exercisesRoot,
        workoutTemplatesRoot: overrides.workoutTemplatesRoot || PATH_CONFIG.workoutTemplatesRoot,
        workoutsRoot: overrides.workoutsRoot || PATH_CONFIG.workoutsRoot
    };
}

function getTemplateFilePath(fileName, config = getPathConfig()) {
    return joinVaultPath(config.templateNotesRoot, fileName);
}

function getExerciseLibraryPath(fileName, config = getPathConfig()) {
    return joinVaultPath(config.exercisesRoot, '_library', fileName);
}

function getProgramTemplatePath(config = getPathConfig()) {
    return joinVaultPath(config.programsRoot, "_templates/program-template.md");
}

function getProgramsActiveRoot(config = getPathConfig()) {
    return joinVaultPath(config.programsRoot, "active-programs");
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
