class prTracker {
    constructor() {
        this.prTypes = ['weight', 'reps', 'volume'];
    }

    async checkForPR(exercise, currentSet) {
        const previousSets = await this.getPreviousSets(exercise);
        const prs = {};

        for (const type of this.prTypes) {
            const isPR = this.isPR(currentSet, previousSets, type);
            if (isPR) {
                prs[type] = currentSet[type];
            }
        }

        return Object.keys(prs).length > 0 ? prs : null;
    }

    async getPreviousSets(exercise) {
        const allSets = app.vault.getMarkdownFiles()
            .filter(file => {
                const cache = app.metadataCache.getFileCache(file);
                return cache?.frontmatter?.exercise === exercise;
            })
            .map(file => {
                const cache = app.metadataCache.getFileCache(file);
                return {
                    weight: cache.frontmatter.weight,
                    reps: cache.frontmatter.reps,
                    volume: (cache.frontmatter.weight || 0) * (cache.frontmatter.reps || 0),
                    date: cache.frontmatter.date
                };
            });

        return allSets;
    }    isPR(currentSet, previousSets, type) {
        if (!currentSet[type]) return false;
        return !previousSets.some(set => (set[type] || 0) > currentSet[type]);
    }
}
