module.exports = async function addExerciseToLibrary(params) {
    try {
        const { app, quickAddApi: { suggester, inputPrompt } } = params;

        // Load categories
        const categoriesPath = "Templates/exercises/_library/categories.json";
        const categoriesFile = await app.vault.adapter.read(categoriesPath);
        const categories = JSON.parse(categoriesFile);

        // Get exercise details
        const exerciseName = await inputPrompt("Exercise Name");
        if (!exerciseName) return;

        // Select muscle group
        const muscleGroups = Object.keys(categories.muscleGroups);
        const muscleGroup = await suggester(muscleGroups, muscleGroups);
        if (!muscleGroup) return;

        // Select equipment
        const equipment = await suggester(categories.equipment, categories.equipment);
        if (!equipment) return;

        // Get exercise description
        const description = await inputPrompt("Exercise Description (instructions)");
        if (!description) return;

        // Get video URL (optional)
        const videoUrl = await inputPrompt("Video URL (optional)");

        // Get default reps
        const defaultReps = await inputPrompt("Default Reps", "6");
        if (!defaultReps) return;

        // Setup target path
        const targetPath = `Templates/exercises/${muscleGroup}`;

        // Create muscle group folder if it doesn't exist
        if (!await app.vault.adapter.exists(targetPath)) {
            await app.vault.createFolder(targetPath);
        }

        // Create new exercise file
        const fileName = `${muscleGroup} - ${exerciseName}.md`;
        const filePath = `${targetPath}/${fileName}`;
        
        // Generate exercise content
        const content = [            "---",
            `id: ${Math.floor(Math.random() * 900000) + 100000}`,
            `date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>`,
            `time: <% tp.date.now("HH:mm") %>`,
            `weight: <% await tp.system.prompt("Weight", "", true) %>`,
            `reps: <% await tp.system.prompt("Reps", "${defaultReps}", true) %>`,
            `effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>`,
            `exercise: ${muscleGroup} - ${exerciseName}`,
            `muscle_group: ${muscleGroup}`,            `equipment: ${equipment}`,
            `note: <% await tp.system.prompt("Note", "", true) %>`,
            videoUrl ? `video_url: "${videoUrl}"` : null,
            `instructions: '${description}'`,
            "tags:",
            " - exercise",
            "---",
            "",
            "```dataviewjs",
            "const {exercise} = customJS;",
            "const note = {dv: dv, container: this.container, window: window};",
            "",
            "exercise.renderDescription(note);",
            "exercise.renderEffortWeightChart(note);",
            "```"
        ].filter(line => line !== null).join("\n");

        // Create the file with content
        await app.vault.create(filePath, content);

        // Return the path
        params.variables = { exercisePath: filePath };
        
        new Notice(`Exercise template created: ${exerciseName}`);
    } catch (error) {
        console.error("Error creating exercise:", error);
        new Notice("Error creating exercise template. Check console for details.");
        throw error;
    }
}
