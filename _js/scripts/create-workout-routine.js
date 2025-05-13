class WorkoutBuilder {
    constructor(app, quickAdd) {
        if (!app || !quickAdd) {
            throw new Error("WorkoutBuilder requires app and quickAdd parameters");
        }
        this.app = app;
        this.quickAdd = quickAdd;
        this.categories = null;
        this.exercises = {};
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            await this.loadCategories();
            await this.loadExercises();
            this.initialized = true;
        } catch (error) {
            console.error("Failed to initialize WorkoutBuilder:", error);
            throw new Error("Failed to initialize workout builder: " + error.message);
        }
    }

    async loadCategories() {
        try {
            const categoriesPath = "Templates/exercises/_library/categories.json";
            if (!await this.app.vault.adapter.exists(categoriesPath)) {
                throw new Error("Categories file not found at: " + categoriesPath);
            }

            const categoriesContent = await this.app.vault.adapter.read(categoriesPath);
            if (!categoriesContent) {
                throw new Error("Categories file is empty");
            }

            try {
                this.categories = JSON.parse(categoriesContent);
                if (!this.categories || !this.categories.muscleGroups) {
                    throw new Error("Invalid categories format");
                }
            } catch (e) {
                throw new Error("Failed to parse categories JSON: " + e.message);
            }
        } catch (error) {
            console.error("Error loading categories:", error);
            throw error;
        }
    }

    async loadExercises() {
        if (!this.categories) {
            throw new Error("Categories must be loaded before exercises");
        }

        try {
            // Initialize exercise groups
            Object.keys(this.categories.muscleGroups).forEach(key => {
                const groupName = this.categories.muscleGroups[key].name;
                this.exercises[groupName] = [];
            });

            // Load only exercise files from Templates/exercises
            const exerciseFiles = this.app.vault.getMarkdownFiles()
                .filter(file => {
                    // Only include files from Templates/exercises folder
                    if (!file.path.startsWith('Templates/exercises/')) return false;
                    
                    const cache = this.app.metadataCache.getFileCache(file);
                    return cache?.frontmatter?.tags?.includes('exercise');
                });

            if (exerciseFiles.length === 0) {
                throw new Error("No exercise templates found in Templates/exercises/");
            }

            // Group exercises by muscle group
            exerciseFiles.forEach(file => {
                const cache = this.app.metadataCache.getFileCache(file);
                if (!cache?.frontmatter?.muscle_group) return;

                const muscleGroup = cache.frontmatter.muscle_group;
                const groupKey = Object.keys(this.categories.muscleGroups)
                    .find(key => this.categories.muscleGroups[key].name.toLowerCase() === muscleGroup.toLowerCase());

                if (groupKey) {
                    const groupName = this.categories.muscleGroups[groupKey].name;
                    this.exercises[groupName].push({
                        name: cache.frontmatter.exercise || file.basename,
                        id: cache.frontmatter.id,
                        equipment: cache.frontmatter.equipment || 'No equipment specified',
                        file: file
                    });
                }
            });

            // Validate that we have at least one exercise loaded
            const totalExercises = Object.values(this.exercises)
                .reduce((sum, exercises) => sum + exercises.length, 0);
            
            if (totalExercises === 0) {
                throw new Error("No valid exercise templates found in Templates/exercises/");
            }

        } catch (error) {
            console.error("Error loading exercises:", error);
            throw error;
        }
    }

    async selectMuscleGroup() {
        if (!this.initialized) {
            throw new Error("WorkoutBuilder must be initialized before use");
        }

        try {
            // Get groups that have exercises
            const availableGroups = Object.entries(this.exercises)
                .filter(([_, exercises]) => exercises.length > 0)
                .map(([group, exercises]) => ({
                    name: group,
                    count: exercises.length
                }));

            if (availableGroups.length === 0) {
                throw new Error("No exercises found in any muscle group");
            }

            const selected = await this.quickAdd.suggester(
                group => `${group.name} (${group.count} exercises)`,
                availableGroups,
                "Select muscle group"
            );

            if (!selected) {
                throw new Error("No muscle group selected");
            }

            return selected;
        } catch (error) {
            console.error("Error selecting muscle group:", error);
            throw error;
        }
    }

    async selectExercise(muscleGroup) {
        if (!muscleGroup || !muscleGroup.name) {
            throw new Error("Invalid muscle group");
        }

        try {
            const exercises = this.exercises[muscleGroup.name];
            if (!exercises || exercises.length === 0) {
                throw new Error(`No exercises found for muscle group: ${muscleGroup.name}`);
            }

            const selected = await this.quickAdd.suggester(
                exercise => `${exercise.name} (${exercise.equipment})`,
                exercises,
                "Select exercise"
            );

            if (!selected) {
                throw new Error("No exercise selected");
            }

            return selected;
        } catch (error) {
            console.error("Error selecting exercise:", error);
            throw error;
        }
    }

    async getSetsCount() {
        try {
            const sets = await this.quickAdd.inputPrompt("Number of sets", "3");
            if (!sets) {
                throw new Error("Sets count is required");
            }

            const setsNum = parseInt(sets);
            if (isNaN(setsNum) || setsNum < 1) {
                throw new Error("Please enter a valid number of sets (must be 1 or greater)");
            }

            return setsNum;
        } catch (error) {
            console.error("Error getting sets count:", error);
            throw error;
        }
    }

    generateWorkoutContent(name, exercises) {
        const exerciseIds = exercises
            .map(e => Array(e.sets).fill(e.id))
            .flat();

        return [
            "---",
            `workout_title: ${name}`,
            `exercises: [${exerciseIds.join(", ")}]`,
            `workout_order: [${exerciseIds.join(", ")}]`,
            "type: custom",
            "tags:",
            " - workout",
            "---",
            "",
            "```dataviewjs",
            "const {workout} = customJS;",
            "const note = {dv: dv, container: this.container, window: window};",
            "workout.renderHeader(note);",
            "```",
            "",
            "## Rest Timer",
            "---",
            "```meta-bind-button",
            "label: Start Timer",
            "icon: \"\"",
            "style: default",
            "class: \"\"",
            "cssStyle: \"\"",
            "backgroundImage: \"\"",
            "tooltip: \"\"",
            "id: \"\"",
            "hidden: false",
            "actions:",
            "  - type: command",
            "    command: quickadd:choice:a9b81cef-90e8-4dce-a426-791f54e2a43d",
            "```",
            "",
            "```dataviewjs",
            "const {timer} = customJS;",
            "await timer.renderTimerControls(this);",
            "```",
            "",
            "## Log Exercise",
            "---",
            "```meta-bind-button",
            "label: Log Exercise",
            "icon: \"\"",
            "style: primary",
            "class: \"\"",
            "cssStyle: \"\"",
            "backgroundImage: \"\"",
            "tooltip: \"\"",
            "id: \"\"",
            "hidden: false",
            "actions:",
            "  - type: command",
            "    command: quickadd:choice:d5df32b0-6a04-481d-9a8d-b9bd1b2f0ea7",
            "```",
            "",
            "## Remaining Exercises",
            "---",
            "```dataviewjs",
            "const {workout} = customJS;",
            "const note = {dv: dv, container: this.container, window: window};",
            "workout.renderRemaining(note);",
            "```",
            "",
            "## Performed Exercises",
            "---",
            "```dataviewjs",
            "const {workout} = customJS;",
            "const note = {dv: dv, container: this.container, window: window};",
            "workout.renderPerformed(note);",
            "workout.renderEffortChart(note);",
            "```"
        ].join("\n");
    }

    async saveWorkout(name, content) {
        const targetPath = "Templates/Workouts/gym";
        
        // Ensure target directory exists
        if (!await this.app.vault.adapter.exists(targetPath)) {
            await this.app.vault.createFolder(targetPath);
        }

        // Clean up filename, removing invalid characters and convert spaces to hyphens
        const fileName = `${name.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '-')}.md`;
        const filePath = `${targetPath}/${fileName}`;
        
        // Don't overwrite existing files
        if (await this.app.vault.adapter.exists(filePath)) {
            throw new Error(`A workout routine named '${name}' already exists. Please choose a different name.`);
        }
        
        const file = await this.app.vault.create(filePath, content);
        return file;
    }
}

module.exports = async function createWorkoutRoutine(params) {
    const { app, quickAddApi } = params;

    try {
        // Initialize workout builder
        const builder = new WorkoutBuilder(app, quickAddApi);
        await builder.init();

        // Get workout name
        const workoutName = await quickAddApi.inputPrompt("Enter workout name (e.g., Push Day, Leg Day)");
        if (!workoutName) return;

        // Build workout
        const selectedExercises = [];
        let addingExercises = true;

        while (addingExercises) {
            // Select muscle group
            const muscleGroup = await builder.selectMuscleGroup();
            if (!muscleGroup) break;

            // Select exercise
            const exercise = await builder.selectExercise(muscleGroup);
            if (!exercise) break;

            // Get sets
            const sets = await builder.getSetsCount();
            if (!sets) break;

            // Add to selected exercises
            selectedExercises.push({
                id: exercise.id,
                name: exercise.name,
                sets: sets
            });

            // Ask to continue
            const continueChoice = await quickAddApi.suggester(
                ["Add another exercise", "Finish and save workout"],
                ["continue", "finish"],
                "What would you like to do?"
            );
            
            if (!continueChoice) return;
            addingExercises = continueChoice === "continue";
        }

        if (selectedExercises.length === 0) {
            new Notice("No exercises were selected. Workout not created.");
            return;
        }

        // Generate and save workout
        const content = builder.generateWorkoutContent(workoutName, selectedExercises);
        const file = await builder.saveWorkout(workoutName, content);

        // Show success message
        const summary = selectedExercises.map(e => `${e.name} (${e.sets} sets)`).join('\n- ');
        new Notice(`Workout '${workoutName}' created successfully!\n\nExercises:\n- ${summary}`);

        // Open the new workout
        if (file) {
            await app.workspace.activeLeaf.openFile(file);
        }

        // Return the path
        params.variables = { workoutPath: file.path };

    } catch (error) {
        console.error("Error creating workout:", error);
        new Notice(`Error: ${error.message}`);
    }
}
