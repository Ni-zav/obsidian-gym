class WorkoutBuilder {
    constructor(app, quickAdd) {
        if (!app || !quickAdd) {
            throw new Error("WorkoutBuilder requires app and quickAdd parameters");
        }
        this.app = app;
        this.quickAdd = quickAdd;
        this.categories = null;
        this.workoutCategories = null;
        this.exercises = {};
        this.initialized = false;
    }    async init() {
        if (this.initialized) return;
        
        try {
            await this.loadCategories();
            await this.loadWorkoutCategories();
            await this.loadExercises();
            this.initialized = true;
        } catch (error) {
            console.error("Failed to initialize WorkoutBuilder:", error);
            throw new Error("Failed to initialize workout builder: " + error.message);
        }
    }

    async loadWorkoutCategories() {
        try {
            const categoriesPath = "Templates/exercises/_library/workout_categories.json";
            if (!await this.app.vault.adapter.exists(categoriesPath)) {
                throw new Error("Workout categories file not found at: " + categoriesPath);
            }

            const categoriesContent = await this.app.vault.adapter.read(categoriesPath);
            if (!categoriesContent) {
                throw new Error("Workout categories file is empty");
            }

            try {
                this.workoutCategories = JSON.parse(categoriesContent);
                if (!this.workoutCategories || !this.workoutCategories.workoutTypes || !this.workoutCategories.places) {
                    throw new Error("Invalid workout categories format");
                }
            } catch (e) {
                throw new Error("Failed to parse workout categories JSON: " + e.message);
            }
        } catch (error) {
            console.error("Error loading workout categories:", error);
            throw error;
        }
    }

    async selectWorkoutType() {
        if (!this.initialized || !this.workoutCategories) {
            throw new Error("WorkoutBuilder must be initialized before use");
        }

        const types = Object.entries(this.workoutCategories.workoutTypes).map(([key, type]) => ({
            key,
            name: type.name,
            description: type.description
        }));

        return await this.quickAdd.suggester(
            type => `${type.name} - ${type.description}`,
            types,
            "Select workout type"
        );
    }

    async selectWorkoutPlace() {
        if (!this.initialized || !this.workoutCategories) {
            throw new Error("WorkoutBuilder must be initialized before use");
        }

        const places = Object.entries(this.workoutCategories.places).map(([key, place]) => ({
            key,
            name: place.name,
            description: place.description
        }));

        return await this.quickAdd.suggester(
            place => `${place.name} - ${place.description}`,
            places,
            "Select workout place"
        );
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

        return await this.quickAdd.suggester(
            group => `${group.name} (${group.count} exercises)`,
            availableGroups,
            "Select muscle group"
        );
    }

    async selectExercise(muscleGroup) {
        if (!muscleGroup || !muscleGroup.name) {
            return null;
        }

        const exercises = this.exercises[muscleGroup.name];
        if (!exercises || exercises.length === 0) {
            throw new Error(`No exercises found for muscle group: ${muscleGroup.name}`);
        }

        return await this.quickAdd.suggester(
            exercise => `${exercise.name} (${exercise.equipment})`,
            exercises,
            "Select exercise"
        );
    }

    async selectExerciseDirect() {
        if (!this.initialized) {
            throw new Error("WorkoutBuilder must be initialized before use");
        }
        // Flatten all exercises into a single array
        const allExercises = Object.values(this.exercises).flat();
        if (allExercises.length === 0) {
            throw new Error("No exercises found");
        }
        return await this.quickAdd.suggester(
            exercise => `${exercise.name} (${exercise.equipment})`,
            allExercises,
            "Select exercise"
        );
    }

    async getSetsCount() {
        const sets = await this.quickAdd.inputPrompt("Number of sets", "3");
        if (!sets) {
            return null;
        }

        const setsNum = parseInt(sets);
        if (isNaN(setsNum) || setsNum < 1) {
            new Notice("Please enter a valid number of sets (must be 1 or greater)");
            return null;
        }

        return setsNum;
    }    generateWorkoutContent(name, exercises, workoutType, workoutPlace) {
        const exerciseIds = exercises
            .map(e => Array(e.sets).fill(e.id))
            .flat();

        return [
            "---",
            `workout_title: ${name}`,
            `date: <% tp.date.now("YYYY-MM-DD") %>`,
            `time: <% tp.date.now("HH:mm") %>`,
            `exercises: [${exerciseIds.join(", ")}]`,
            `workout_order: [${exerciseIds.join(", ")}]`,
            `workout_type: ${workoutType.name}`,
            `workout_place: ${workoutPlace.name}`,
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
        if (!workoutName) {
            console.log("Workout creation cancelled - no name provided");
            return;
        }

        // Build workout
        const selectedExercises = [];
        let addingExercises = true;

        while (addingExercises) {
            // Directly select exercise from all available
            const exercise = await builder.selectExerciseDirect();
            if (!exercise) {
                console.log("Exercise selection cancelled");
                break;
            }

            // Get sets
            const sets = await builder.getSetsCount();
            if (!sets) {
                console.log("Sets input cancelled");
                break;
            }

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
            
            if (!continueChoice) {
                console.log("Continue choice cancelled");
                break;
            }
            addingExercises = continueChoice === "continue";
        }

        // Only proceed if we have exercises to save
        if (selectedExercises.length === 0) {
            console.log("No exercises were selected, workout not created");
            return;
        }
        // Select workout type and place
        const workoutType = await builder.selectWorkoutType();
        if (!workoutType) {
            console.log("Workout type selection cancelled");
            return;
        }

        const workoutPlace = await builder.selectWorkoutPlace();
        if (!workoutPlace) {
            console.log("Workout place selection cancelled");
            return;
        }

        // Generate and save workout
        const content = builder.generateWorkoutContent(workoutName, selectedExercises, workoutType, workoutPlace);
        const file = await builder.saveWorkout(workoutName, content);// Show success message
        const summary = selectedExercises.map(e => `${e.name} (${e.sets} sets)`).join('\n- ');
        new Notice(`Workout '${workoutName}' created successfully!\n\nExercises:\n- ${summary}`);

        // Return the path without opening the file
        params.variables = { workoutPath: file.path };

    } catch (error) {
        if (error.message.includes('already exists')) {
            new Notice(error.message);
        } else {
            console.error("Unexpected error:", error);
            new Notice("An unexpected error occurred");
        }
    }
}
