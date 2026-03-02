const PATH_CONFIG = {
    templatesRoot: "Templates",
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
    return {
        templatesRoot: normalizePath(overrides.templatesRoot),
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
        templatesRoot: overrides.templatesRoot || PATH_CONFIG.templatesRoot,
        exercisesRoot: overrides.exercisesRoot || PATH_CONFIG.exercisesRoot,
        workoutTemplatesRoot: overrides.workoutTemplatesRoot || PATH_CONFIG.workoutTemplatesRoot,
        workoutsRoot: overrides.workoutsRoot || PATH_CONFIG.workoutsRoot
    };
}

function getTemplateFilePath(fileName, config = getPathConfig()) {
    return joinVaultPath(config.templatesRoot, fileName);
}

function getExerciseLibraryPath(fileName, config = getPathConfig()) {
    return joinVaultPath(config.exercisesRoot, '_library', fileName);
}

module.exports = {
    PATH_CONFIG,
    joinVaultPath,
    getPathConfig,
    getTemplateFilePath,
    getExerciseLibraryPath
};

if (typeof globalThis !== "undefined") {
    globalThis.obsidianGymPaths = {
        ...(globalThis.obsidianGymPaths || {}),
        ...getPathConfig()
    };
}
