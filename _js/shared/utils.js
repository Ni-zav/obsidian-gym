class utils {
    filterFiles(filterFunction, files) {
        const cache = app.metadataCache;
        const result = [];
        for (let f of files) {
            const metadata = cache.getFileCache(f);
            const tags = obsidian.getAllTags(metadata);
            if (filterFunction(metadata.frontmatter, tags)) {
                result.push(f);
            }
        }
        return result;
    }

    addTagsAndFrontmatter(files) {
        const cache = app.metadataCache;
        const result = [];
        for (let f of files) {
            const metadata = cache.getFileCache(f);
            if (!metadata || !metadata.frontmatter) continue;
            
            result.push({
                file: f,
                frontmatter: metadata.frontmatter,
                tags: obsidian.getAllTags(metadata)
            });
        }
        return result;
    }

    calculateVolume(weight, reps) {
        if (!weight || !reps) return 0;
        return weight * reps;
    }

    formatDate(date) {
        if (!date) return '';
        return moment(date).format('YYYY-MM-DD');
    }

    calculateOneRepMax(weight, reps) {
        if (!weight || !reps) return 0;
        // Brzycki formula
        return weight * (36 / (37 - reps));
    }

    roundToNearest(value, nearest = 5) {
        if (!value) return 0;
        return Math.round(value / nearest) * nearest;
    }

    async getExerciseHistory(exerciseName) {
        if (!exerciseName) return [];
        
        return app.vault.getMarkdownFiles()
            .filter(file => {
                const cache = app.metadataCache.getFileCache(file);
                return cache?.frontmatter?.exercise === exerciseName;
            })
            .map(file => {
                const cache = app.metadataCache.getFileCache(file);
                return {
                    date: cache.frontmatter.date,
                    weight: cache.frontmatter.weight,
                    reps: cache.frontmatter.reps,
                    effort: cache.frontmatter.effort
                };
            })
            .sort((a, b) => moment(a.date).diff(moment(b.date)));
    }

    sanitizeInput(input) {
        if (!input) return '';
        return String(input)
            .replace(/[<>]/g, '')
            .trim();
    }
}
