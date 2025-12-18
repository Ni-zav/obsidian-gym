/**
 * Recalculate workout metrics script
 * Triggered when user manually edits or deletes exercises/start/end times
 * Intelligently updates: ExercisesSummary, Total Volume, duration, ExerciseCounts
 */

module.exports = async function recalculateMetrics() {
    try {
        const activeFile = app.workspace.getActiveFile();
        
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('No active markdown file found');
            return;
        }
        
        const metadata = app.metadataCache.getFileCache(activeFile);
        if (!metadata?.frontmatter?.id) {
            new Notice('This does not appear to be a workout file (no ID found)');
            return;
        }
        
        // Check if this is a workout file (has id and exercises)
        if (!metadata.frontmatter.exercises) {
            new Notice('This does not appear to be a workout file');
            return;
        }
        
        // Import the workout class
        const { workout } = window.customJS;
        if (!workout) {
            new Notice('Workout utilities not loaded. Please reload Obsidian.');
            return;
        }
        
        // Create a temporary instance to use the recalculation method
        const workoutInstance = new workout();
        
        // Call the recalculation method
        await workoutInstance.recalculateWorkoutMetrics(activeFile);
        
        new Notice('✅ Metrics recalculated successfully!');
        
    } catch (error) {
        console.error('Error during recalculation:', error);
        new Notice('Error recalculating metrics: ' + error.message);
    }
}
