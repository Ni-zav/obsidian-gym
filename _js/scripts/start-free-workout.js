module.exports = async function startFreeWorkout(params) {
    try {
        // Validate required parameters
        if (!params || !params.obsidian || !app.plugins.plugins["templater-obsidian"]) {
            throw new Error("Missing required dependencies");
        }

        console.log("Script: Starting free workout.");

        const obsidian = params.obsidian;
        const templater = app.plugins.plugins["templater-obsidian"].templater;

        let now = moment(new Date());
        const workoutName = "Free Workout";
        let targetPath = 'Workouts/' + now.format("YYYY-MM-DD") + ' - ' + workoutName;
        
        // Create folders if they don't exist
        if (!await app.vault.exists(targetPath)) {
            await app.vault.createFolder(targetPath);
            await app.vault.createFolder(targetPath + '/Log');
        }

        let targetFolder = app.vault.getAbstractFileByPath(targetPath);
        if (!targetFolder) {
            throw new Error("Failed to create or access target folder: " + targetPath);
        }

        // Create new file with default free workout content
        let fileName = "Free Workout.md";
        let newNote;

        if (!await app.vault.exists(targetPath + '/' + fileName)) {
            // Create file with basic free workout template
            let content = `---
id: ${generateGuid()}
workout_title: Free Workout
date: ${now.format("YYYY-MM-DD")}
time: ${now.format("HH:mm")}
exercises: []
workout_order: []
workout_type: Custom
workout_place: 
tags:
  - workout
Logs: []
ExerciseCounts: {}
ExercisesSummary: ""
Total Volume: 0
duration: 0 Minutes
---

\`\`\`dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderHeader(note);
\`\`\`

## Rest Timer
---
\`\`\`meta-bind-button
label: Start Timer
icon: ""
style: default
class: ""
cssStyle: ""
backgroundImage: ""
tooltip: ""
id: ""
hidden: false
actions:
  - type: command
    command: quickadd:choice:a9b81cef-90e8-4dce-a426-791f54e2a43d
\`\`\`

\`\`\`dataviewjs
const {timer} = customJS;
await timer.renderTimerControls(this);
\`\`\`

## Log Exercise
---
\`\`\`meta-bind-button
label: Log Exercise
icon: ""
style: primary
class: ""
cssStyle: ""
backgroundImage: ""
tooltip: ""
id: ""
hidden: false
actions:
  - type: command
    command: quickadd:choice:d5df32b0-6a04-481d-9a8d-b9bd1b2f0ea7
\`\`\`

## Exercises Logged
---
\`\`\`dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderPerformed(note);
workout.renderEffortChart(note);
\`\`\``;

            newNote = await app.vault.create(targetPath + '/' + fileName, content);
        } else {
            new Notice("Free workout already exists for today");
            params.variables = { notePath: "" };
            return;
        }

        // Open the new note
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(newNote);

        params.variables = { notePath: newNote.path };
        console.log("Successfully created free workout: " + newNote.path);
        new Notice("Free Workout started! Click 'Log Exercise' to add exercises.");

    } catch (error) {
        console.error("Error starting free workout:", error);
        new Notice("Error starting free workout: " + error.message);
        params.variables = { notePath: "" };
    }
};

function generateGuid() {
    return Math.random().toString(16).slice(2, 8);
}
