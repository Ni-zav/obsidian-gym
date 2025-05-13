class exerciseLibrary {
    constructor() {
        this.categories = null;
        this.loadCategories();
    }

    async loadCategories() {
        try {
            const categoriesPath = 'Templates/exercises/_library/categories.json';
            const categoriesContent = await app.vault.adapter.read(categoriesPath);
            this.categories = JSON.parse(categoriesContent);
        } catch (error) {
            console.error("Failed to load categories:", error);
            this.categories = { muscleGroups: {} };
        }
    }

    async renderExerciseSelector(context) {
        if (!this.categories) {
            await this.loadCategories();
        }
        
        if (!context?.container) {
            console.error("Invalid context for exercise selector");
            return;
        }

        const container = context.container;
        const table = container.createEl("table");
        const headers = table.createEl("tr");
        
        ["Muscle Group", "Exercises"].forEach(header => {
            const th = headers.createEl("th");
            th.textContent = header;
        });

        Object.entries(this.categories.muscleGroups).forEach(([key, group]) => {
            const exercises = this.getExercisesForGroup(group.name);
            if (exercises.length === 0) return;

            const row = table.createEl("tr");
            const groupCell = row.createEl("td");
            groupCell.textContent = group.name;
            
            const exerciseCell = row.createEl("td");
            exerciseCell.textContent = exercises.map(e => e.name).join(", ");
        });
    }

    getExercisesForGroup(groupName) {
        return app.vault.getMarkdownFiles()
            .map(file => {
                const cache = app.metadataCache.getFileCache(file);
                if (!cache?.frontmatter?.tags?.includes('exercise')) return null;
                if (cache.frontmatter.muscle_group?.toLowerCase() !== groupName.toLowerCase()) return null;
                
                return {
                    name: cache.frontmatter.exercise || file.basename,
                    id: cache.frontmatter.id,
                    equipment: cache.frontmatter.equipment
                };
            })
            .filter(e => e !== null);
    }
}
