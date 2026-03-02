const PATH_CONFIG = {
    templatesRoot: "Templates",
    exercisesRoot: "Templates/exercises",
    workoutTemplatesRoot: "Templates/Workouts",
    workoutsRoot: "Workouts"
};

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
    return { ...PATH_CONFIG };
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
    globalThis.obsidianGymPaths = getPathConfig();
}
