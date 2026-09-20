class prTracker {
    constructor() {
        this.prTypes = ["weight", "reps", "volume"];
    }

    async checkForPR(exercise, currentSet) {
        const core = globalThis.customJS?.gymCore;
        if (!core) return null;
        const previous = core.getPreviousSets(currentSet.exercise_id, exercise, currentSet.filePath);
        const types = core.detectPR(currentSet, previous);
        if (!types.length) return null;
        return Object.fromEntries(types.map(type => {
            if (type === "weight") return [type, Number(currentSet.weight_kg || currentSet.weight || 0)];
            if (type === "reps") return [type, Number(currentSet.reps || 0)];
            return [type, Number(currentSet.weight_kg || currentSet.weight || 0) * Number(currentSet.reps || 0)];
        }));
    }

    async getPreviousSets(exercise) {
        const core = globalThis.customJS?.gymCore;
        return core ? core.getPreviousSets(null, exercise).map(item => item.fm) : [];
    }

    isPR(currentSet, previousSets, type) {
        const value = type === "volume"
            ? Number(currentSet.weight_kg || currentSet.weight || 0) * Number(currentSet.reps || 0)
            : Number(currentSet[type === "weight" ? "weight_kg" : type] ?? currentSet[type] ?? 0);
        if (!(value > 0) || !previousSets?.length) return false;
        const oldValues = previousSets.map(set => type === "volume"
            ? Number(set.weight_kg || set.weight || 0) * Number(set.reps || 0)
            : Number(set[type === "weight" ? "weight_kg" : type] ?? set[type] ?? 0));
        return value > Math.max(...oldValues);
    }
}
