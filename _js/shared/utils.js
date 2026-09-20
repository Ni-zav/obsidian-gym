class utils {
    get app() {
        return globalThis.customJS?.app || globalThis.app;
    }

    filterFiles(filterFunction, files) {
        return (files || []).filter(file => {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter) return false;
            const tags = Array.isArray(metadata.frontmatter.tags) ? metadata.frontmatter.tags.map(t => "#" + String(t).replace(/^#/, "")) : [];
            return filterFunction(metadata.frontmatter, tags);
        });
    }

    addTagsAndFrontmatter(files) {
        return (files || []).map(file => {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter) return null;
            return { file, frontmatter: metadata.frontmatter, tags: metadata.frontmatter.tags || [] };
        }).filter(Boolean);
    }

    calculateVolume(weight, reps) {
        const w = Number(weight), r = Number(reps);
        return Number.isFinite(w) && Number.isFinite(r) && w >= 0 && r >= 0 ? w * r : 0;
    }

    formatDate(date) {
        if (!date) return "";
        return typeof moment !== "undefined" ? moment(date).format("YYYY-MM-DD") : String(date).slice(0, 10);
    }

    calculateOneRepMax(weight, reps) {
        const w = Number(weight), r = Number(reps);
        if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0 || r >= 37) return 0;
        return w * (36 / (37 - r));
    }

    roundToNearest(value, nearest = 2.5) {
        const n = Number(value), step = Number(nearest);
        if (!Number.isFinite(n) || !Number.isFinite(step) || step <= 0) return 0;
        return Math.round(n / step) * step;
    }

    async getExerciseHistory(exerciseName) {
        const core = globalThis.customJS?.gymCore;
        return core ? core.getPreviousSets(null, exerciseName).map(item => item.fm) : [];
    }

    sanitizeInput(input) {
        return input == null ? "" : String(input).replace(/[<>]/g, "").trim();
    }
}
