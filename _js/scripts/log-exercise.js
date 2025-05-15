let obsidian = null;

// Helper function to filter files
function filterFiles(filter, files) {
    return files.filter(file => {
        const cache = app.metadataCache.getFileCache(file);
        const tags = obsidian.getAllTags(cache);
        return filter(cache?.frontmatter, tags, file);
    });
}

module.exports = async function listFiles(params) {
    try {
        console.log("Script: Create exercise.");
        
        if (!params?.obsidian) {
            throw new Error("Missing required parameters");
        }

        obsidian = params.obsidian;
        const templater = app.plugins.plugins["templater-obsidian"]?.templater;
        if (!templater) {
            throw new Error("Templater plugin is required but not found");
        }

        const cache = this.app.metadataCache;
        let allFiles = this.app.vault.getMarkdownFiles();

        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) {
            throw new Error("No active file found");
        }

        let metadata = cache.getFileCache(activeFile);
        if (!metadata?.frontmatter) {
            throw new Error("No frontmatter found in active file");
        }

        const exerciseIds = metadata.frontmatter['exercises'] || [];
        const workout_id = metadata.frontmatter['id'];

        if (!workout_id) {
            throw new Error("No workout ID found in active file");
        }

        // Count how many times each exercise should be performed
        const exerciseCounts = {};
        exerciseIds.forEach(id => {
            exerciseCounts[id] = (exerciseCounts[id] || 0) + 1;
        });

        // Count performed exercises 
        const performedEx = allFiles.filter(file => {
            const cache = app.metadataCache.getFileCache(file);
            const tags = obsidian.getAllTags(cache);
            return (tags?.includes('#exercise') || tags?.includes('#start')) && 
                   cache?.frontmatter?.workout_id === workout_id;
        });
        let performedExerciseCount = performedEx.length;

        // Count how many times each exercise has been performed
        const performedCounts = {};
        performedEx.forEach(performed => {
            const performedMetadata = cache.getFileCache(performed);
            const id = performedMetadata?.frontmatter?.id;
            if (id) {
                performedCounts[id] = (performedCounts[id] || 0) + 1;
            }
        });

        // Helper function to check if an exercise is completed
        const isExerciseCompleted = (exerciseId) => {
            return (performedCounts[exerciseId] || 0) >= (exerciseCounts[exerciseId] || 0);
        };

        const exercises = [];

        // If no exercises have been performed, add "Start"
        if (performedExerciseCount === 0) {
            console.log("No exercises performed yet, looking for Start template...");
            
            // Look specifically for the Start template in the Templates root
            const startTemplate = app.vault.getAbstractFileByPath('Templates/Start.md');
            if (startTemplate) {
                console.log("Found Start template, adding to exercise list");
                exercises.push(startTemplate);
            } else {
                console.log("No Start template found in Templates/Start.md");
            }
        } else {
            // Get all exercises for this workout that aren't completed
            console.log("Finding incomplete exercises for workout...");
            const workoutEx = allFiles.filter(file => {
                if (!file.path.startsWith('Templates/exercises/')) return false;
                
                const cache = app.metadataCache.getFileCache(file);
                const tags = obsidian.getAllTags(cache);
                const fm = cache?.frontmatter;
                
                return tags?.includes('#exercise') && 
                       !fm?.workout_id && 
                       fm?.id && 
                       exerciseIds?.includes(fm.id) &&
                       !isExerciseCompleted(fm.id);
            });

            exercises.push(...workoutEx);
        }

        // Sort exercises by basename
        const sortedExercises = exercises
            .filter(Boolean)
            .sort((a, b) => {
                if (!a?.basename || !b?.basename) return 0;
                return a.basename.toLowerCase().localeCompare(b.basename.toLowerCase());
            });

        if (performedExerciseCount > 0) {
            // Add custom at bottom
            const custom = filterFiles((fm, tags) => {
                return tags?.includes('#custom') && !fm?.workout_id;
            }, allFiles);
            if (custom[0]) {
                sortedExercises.push(custom[0]);
            }
            // Add option to show all exercises if there are any incomplete exercises
            if (Object.keys(exerciseCounts).some(id => !isExerciseCompleted(id))) {
                sortedExercises.push({ basename: 'Show all exercises' });
            }
            // Add 'End Workout' option if workout has started
            sortedExercises.push({ basename: 'End Workout' });
        }

        if (sortedExercises.length === 0) {
            console.log("No exercises available to log");
            params.variables = { notePath: "" };
            return;
        }

        // Display files to select
        let notesDisplay = await params.quickAddApi.suggester(
            (file) => {
                if (!file?.basename) return 'Unknown';
                if (file.basename === 'Show all exercises') return file.basename;
                if (file.basename === 'End Workout') return file.basename;
                const id = cache.getFileCache(file)?.frontmatter?.id;
                if (id) {
                    const performed = performedCounts[id] || 0;
                    const total = exerciseCounts[id] || 0;
                    return `${file.basename} (${performed + 1}/${total})`;
                }
                return file.basename;
            },
            sortedExercises
        );

        if (!notesDisplay) {
            console.log("Exercise selection cancelled");
            params.variables = { notePath: "" };
            return;
        }

        // Handle End Workout selection
        if (notesDisplay.basename === 'End Workout') {
            // Log End.md in Log folder
            const endTemplate = app.vault.getAbstractFileByPath('Templates/End.md');
            if (!endTemplate) {
                throw new Error('Templates/End.md not found');
            }
            const parentFolder = app.vault.getAbstractFileByPath(activeFile.path).parent;
            if (!parentFolder) {
                throw new Error('Could not find parent folder of active file');
            }
            let targetFolder = app.vault.getAbstractFileByPath(parentFolder.path + "/Log");
            if (!targetFolder) {
                await app.vault.createFolder(parentFolder.path + "/Log");
                targetFolder = app.vault.getAbstractFileByPath(parentFolder.path + "/Log");
            }
            const fileName = ((targetFolder.children?.length || 0) + 1).toString();
            const newNote = await templater.create_new_note_from_template(
                endTemplate,
                targetFolder,
                fileName,
                false
            );
            if (!newNote) {
                console.log("End note creation cancelled");
                params.variables = { notePath: "" };
                return;
            }
            // Add workout_id to frontmatter
            let content = await app.vault.read(newNote);
            content = content.replace(/---\n+/m, `---\nworkout_id: ${newId}\n`);
            await app.vault.modify(newNote, content);
            params.variables = { notePath: newNote.path };
            return;
        }

        if (notesDisplay.basename === 'Show all exercises') {
            // Show all non-completed exercises
            const allExercises = filterFiles((fm, tags) => {
                return tags?.includes("#exercise") && 
                       !fm?.workout_id && 
                       (!fm?.id || !isExerciseCompleted(fm.id));
            }, allFiles);
            
            notesDisplay = await params.quickAddApi.suggester(
                (file) => {
                    const id = cache.getFileCache(file)?.frontmatter?.id;
                    if (id && exerciseCounts[id]) {
                        const performed = performedCounts[id] || 0;
                        const total = exerciseCounts[id] || 0;
                        return `${file.basename} (${performed + 1}/${total})`;
                    }
                    return file.basename;
                },
                allExercises
            );

            if (!notesDisplay) {
                console.log("Exercise selection cancelled from all exercises view");
                params.variables = { notePath: "" };
                return;
            }
        }

        // Get or create new ID if needed
        const newId = metadata.frontmatter['id'] || generateGuid();
        if (!metadata.frontmatter['id']) {
            await update('id', newId, activeFile.path);
        }

        try {
            // Create exercise log
            const templateFile = app.vault.getAbstractFileByPath(notesDisplay.path);
            if (!templateFile) {
                throw new Error(`Template file not found: ${notesDisplay.path}`);
            }

            const parentFolder = app.vault.getAbstractFileByPath(activeFile.path).parent;
            if (!parentFolder) {
                throw new Error('Could not find parent folder of active file');
            }

            let targetFolder = app.vault.getAbstractFileByPath(parentFolder.path + "/Log");
            if (!targetFolder) {
                await app.vault.createFolder(parentFolder.path + "/Log");
                targetFolder = app.vault.getAbstractFileByPath(parentFolder.path + "/Log");
            }

            const fileName = ((targetFolder.children?.length || 0) + 1).toString();
            const newNote = await templater.create_new_note_from_template(
                templateFile, 
                targetFolder, 
                fileName, 
                false
            );

            if (!newNote) {
                console.log("Note creation cancelled");
                params.variables = { notePath: "" };
                return;
            }

            // Add workout_id to frontmatter
            let content = await app.vault.read(newNote);
            content = content.replace(/---\n+/m, `---\nworkout_id: ${newId}\n`);
            await app.vault.modify(newNote, content);

            params.variables = { notePath: newNote.path };

        } catch (error) {
            console.log("Exercise log creation cancelled:", error.message);
            params.variables = { notePath: "" };
            return;
        }

    } catch (error) {
        if (error.message.includes("No workout ID found")) {
            console.log("No workout ID found in active file");
        } else {
            console.error("Error in listFiles function:", error);
        }
        params.variables = { notePath: "" };
        return;
    }
}

function filterFiles(filterFunction, files) {
    return files.filter(file => {
        // Only include exercise templates from Templates/exercises folder
        if (file.path.startsWith('Templates/exercises/') || file.path.startsWith('Templates/Workouts/')) {
            const cache = app.metadataCache.getFileCache(file);
            const tags = obsidian.getAllTags(cache);
            return filterFunction(cache?.frontmatter, tags);
        }
        return false;
    });
}

async function update(property, value, filePath) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) return;

    let content = await app.vault.read(file);
    const regex = new RegExp(`^${property}:.*$`, 'm');
    
    if (regex.test(content)) {
        content = content.replace(regex, `${property}: ${value}`);
    } else {
        content = content.replace(/---\n+/m, `---\n${property}: ${value}\n`);
    }
    
    await app.vault.modify(file, content);
}

function generateGuid() {
    let result = '';
    for (let j = 0; j < 32; j++) {
        if (j === 8 || j === 12 || j === 16 || j === 20) {
            result += '-';
        }
        result += Math.floor(Math.random() * 16).toString(16).toUpperCase();
    }
    return result;
}
