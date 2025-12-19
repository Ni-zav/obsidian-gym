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

        // Always define newId and update workout file if needed, before any use
        const newId = metadata.frontmatter['id'] || generateGuid();
        if (!metadata.frontmatter['id']) {
            await update('id', newId, activeFile.path);
        }

        const exerciseIds = metadata.frontmatter['exercises'] || [];
        const workout_id = metadata.frontmatter['id'];

        if (!workout_id) {
            throw new Error("No workout ID found in active file");
        }

        // Check if this is a free workout (empty exercises array)
        const isFreeWorkout = exerciseIds.length === 0;

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

        // Check if workout has already ended
        const workoutEnded = performedEx.some(file => {
            const cache = app.metadataCache.getFileCache(file);
            return cache?.frontmatter?.exercise === 'Workout end';
        });

        if (workoutEnded) {
            await showWorkoutEndedModal();
            params.variables = { notePath: "" };
            return;
        }

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
            // Check if this is a free workout - if so, show all exercises
            if (isFreeWorkout) {
                console.log("Free workout detected - showing all exercises");
                const allExercises = filterFiles((fm, tags) => {
                    return tags?.includes("#exercise") && !fm?.workout_id;
                }, allFiles);
                exercises.push(...allExercises);
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
            // Add option to show all exercises if there are any incomplete exercises (routine-based only)
            if (!isFreeWorkout && Object.keys(exerciseCounts).some(id => !isExerciseCompleted(id))) {
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
                
                // For free workouts, don't show counts
                if (isFreeWorkout) {
                    return file.basename;
                }
                
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
            // Add workout_id to frontmatter (ensure it is present, not duplicated, and after ---)
            let content = await app.vault.read(newNote);
            // Remove any existing workout_id line
            content = content.replace(/^workout_id:.*\r?\n?/m, '');
            // Insert workout_id after --- (handle both \n and \r\n)
            content = content.replace(/---\r?\n/, `---\nworkout_id: ${newId}\n`);
            await app.vault.modify(newNote, content);
            
            // Update parent workout file with Logs property (no exercise name for End)
            await updateWorkoutLogs(activeFile, newNote, '');
            
            // Calculate and store workout duration
            await calculateAndStoreDuration(activeFile, targetFolder);
            
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
            
            // Parse frontmatter to get exercise name
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let exerciseName = '';
            
            if (fmMatch) {
                const fmContent = fmMatch[1];
                const exerciseMatch = fmContent.match(/^exercise:\s*(.+)$/m);
                
                if (exerciseMatch) exerciseName = exerciseMatch[1].trim();
            }
            
            // Skip modal for start/end logs
            if (exerciseName.includes("Workout")) {
                content = content.replace(/---\n+/m, `---\nworkout_id: ${newId}\n`);
                await app.vault.modify(newNote, content);
                await updateWorkoutLogs(activeFile, newNote, '');
                params.variables = { notePath: newNote.path };
                return;
            }
            
            // Show modal for exercise input
            await showExerciseInputModal(newNote, activeFile, content, newId, exerciseName);
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

async function updateWorkoutLogs(workoutFile, logFile, exerciseName = '') {
    try {
        const logFolder = logFile.parent;
        const logFiles = logFolder.children
            .filter(f => f.extension === 'md')
            .sort((a, b) => parseInt(a.basename) - parseInt(b.basename));
        
        // Find the latest "Workout start" index
        let latestStartIndex = -1;
        for (let i = logFiles.length - 1; i >= 0; i--) {
            const content = await app.vault.read(logFiles[i]);
            const exerciseMatch = content.match(/^exercise:\s*(.+)$/m);
            const exercise = exerciseMatch ? exerciseMatch[1].trim() : '';
            if (exercise === 'Workout start') {
                latestStartIndex = i;
                break;
            }
        }
        
        // Only include logs after the latest start
        const relevantLogs = logFiles.filter((f, idx) => idx >= latestStartIndex && f.extension === 'md');
        
        // Read and calculate exercise counts BEFORE updating frontmatter
        const exerciseCounts = {};
        let totalVolume = 0;
        
        for (const logFileObj of relevantLogs) {
            const content = await app.vault.read(logFileObj);
            const exerciseMatch = content.match(/^exercise:\s*(.+)$/m);
            const volumeMatch = content.match(/^volume:\s*(\d+(?:\.\d+)?)/m);
            
            const ex = exerciseMatch ? exerciseMatch[1].trim() : '';
            const vol = volumeMatch ? parseFloat(volumeMatch[1]) : 0;
            
            if (ex && !ex.includes('Workout')) {
                exerciseCounts[ex] = (exerciseCounts[ex] || 0) + 1;
                totalVolume += vol;
            }
        }
        
        // Now update frontmatter with the calculated values
        await app.fileManager.processFrontMatter(workoutFile, (fm) => {
            // Initialize Logs array if it doesn't exist
            if (!fm['Logs']) {
                fm['Logs'] = [];
            }
            // Store only relevant log file paths
            fm['Logs'] = relevantLogs.map(f => f.path);
            
            // Set the exercise counts
            fm['ExerciseCounts'] = exerciseCounts;
            
            // Create summary
            const summary = Object.entries(exerciseCounts)
                .map(([name, count]) => `${name} x${count}`)
                .join(", ");
            fm['ExercisesSummary'] = summary;
            fm['Total Volume'] = totalVolume;
        });
        
        // Recalculate duration from latest start/end
        await calculateAndStoreDuration(workoutFile, logFolder);
        
    } catch (error) {
        console.error("Error updating workout logs:", error);
    }
}

async function calculateAndStoreDuration(workoutFile, logFolder) {
    try {
        // Get all files in the Log folder
        const logFiles = logFolder.children
            .filter(f => f.extension === 'md')
            .sort((a, b) => {
                // Sort by file name (numeric)
                return parseInt(a.basename) - parseInt(b.basename);
            });
        
        if (logFiles.length === 0) {
            return; // No logs at all
        }
        
        // Find the LATEST workout start and end
        let latestStartFile = null;
        let latestEndFile = null;
        
        for (let i = logFiles.length - 1; i >= 0; i--) {
            const content = await app.vault.read(logFiles[i]);
            const exerciseMatch = content.match(/^exercise:\s*(.+)$/m);
            const exercise = exerciseMatch ? exerciseMatch[1].trim() : '';
            
            if (!latestEndFile && exercise === 'Workout end') {
                latestEndFile = logFiles[i];
            }
            if (!latestStartFile && exercise === 'Workout start') {
                latestStartFile = logFiles[i];
            }
            
            if (latestStartFile && latestEndFile) break;
        }
        
        // SPECIAL CASE: If no workout start found, clear duration
        if (!latestStartFile) {
            await app.fileManager.processFrontMatter(workoutFile, (fm) => {
                fm['duration'] = '';
            });
            return;
        }
        
        // Read the date from start file
        const startContent = await app.vault.read(latestStartFile);
        const startMatch = startContent.match(/^date:\s*(.+)$/m);
        
        if (!startMatch) {
            return;
        }
        
        const startDate = new Date(startMatch[1]);
        
        let durationStr = '';
        
        if (latestEndFile) {
            // Both start and end exist - calculate full duration
            const endContent = await app.vault.read(latestEndFile);
            const endMatch = endContent.match(/^date:\s*(.+)$/m);
            
            if (endMatch) {
                const endDate = new Date(endMatch[1]);
                
                // Calculate duration in milliseconds
                const durationMs = endDate - startDate;
                
                // Convert to hours and minutes
                const totalMinutes = Math.floor(durationMs / 60000);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                
                // Format with proper pluralization
                if (hours > 0) {
                    const hourStr = hours === 1 ? 'Hour' : 'Hours';
                    const minuteStr = minutes === 1 ? 'Minute' : 'Minutes';
                    durationStr = `${hours} ${hourStr} ${minutes} ${minuteStr}`;
                } else {
                    const minuteStr = minutes === 1 ? 'Minute' : 'Minutes';
                    durationStr = `${minutes} ${minuteStr}`;
                }
            }
        } else {
            // Only start exists - show "Ongoing" status
            durationStr = 'Ongoing';
        }
        
        // Store duration in the workout file
        await app.fileManager.processFrontMatter(workoutFile, (fm) => {
            fm['duration'] = durationStr;
        });
        
    } catch (error) {
        console.error("Error calculating duration:", error);
    }
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

async function showExerciseInputModal(newNote, workoutFile, content, newId, exerciseName) {
    return new Promise((resolve) => {
        // Create modal backdrop
        const modalBackdrop = document.createElement('div');
        modalBackdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            pointer-events: auto;
        `;
        
        const modalBox = document.createElement('div');
        modalBox.style.cssText = `
            background-color: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            padding: 16px;
            max-width: 300px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: auto;
        `;
        
        const title = document.createElement('h3');
        title.textContent = `Log: ${exerciseName}`;
        title.style.marginTop = '0';
        title.style.marginBottom = '12px';
        modalBox.appendChild(title);
        
        const form = document.createElement('form');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '12px';
        
        // Weight input
        const weightLabel = document.createElement('label');
        const weightLabelText = document.createElement('span');
        weightLabelText.textContent = 'Weight (kg):';
        weightLabelText.style.fontWeight = '600';
        weightLabelText.style.display = 'block';
        weightLabelText.style.marginBottom = '4px';
        weightLabel.appendChild(weightLabelText);
        const weightInput = document.createElement('input');
        weightInput.type = 'number';
        weightInput.step = '0.5';
        weightInput.placeholder = 'Enter weight';
        weightInput.style.cssText = `
            padding: 8px;
            background-color: var(--background-primary-alt);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            width: 100%;
            box-sizing: border-box;
            pointer-events: auto;
        `;
        weightInput.disabled = false;
        weightLabel.appendChild(weightInput);
        form.appendChild(weightLabel);
        
        // Reps input
        const repsLabel = document.createElement('label');
        const repsLabelText = document.createElement('span');
        repsLabelText.textContent = 'Reps:';
        repsLabelText.style.fontWeight = '600';
        repsLabelText.style.display = 'block';
        repsLabelText.style.marginBottom = '4px';
        repsLabel.appendChild(repsLabelText);
        const repsInput = document.createElement('input');
        repsInput.type = 'number';
        repsInput.placeholder = 'Enter reps';
        repsInput.style.cssText = `
            padding: 8px;
            background-color: var(--background-primary-alt);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            width: 100%;
            box-sizing: border-box;
            pointer-events: auto;
        `;
        repsInput.disabled = false;
        repsLabel.appendChild(repsInput);
        form.appendChild(repsLabel);
        
        // Effort input
        const effortLabel = document.createElement('label');
        const effortLabelText = document.createElement('span');
        effortLabelText.textContent = 'Effort (1-5):';
        effortLabelText.style.fontWeight = '600';
        effortLabelText.style.display = 'block';
        effortLabelText.style.marginBottom = '4px';
        effortLabel.appendChild(effortLabelText);
        const effortInput = document.createElement('input');
        effortInput.type = 'number';
        effortInput.min = '1';
        effortInput.max = '5';
        effortInput.placeholder = 'Enter effort';
        effortInput.style.cssText = `
            padding: 8px;
            background-color: var(--background-primary-alt);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            width: 100%;
            box-sizing: border-box;
            pointer-events: auto;
        `;
        effortInput.disabled = false;
        effortLabel.appendChild(effortInput);
        form.appendChild(effortLabel);
        
        // Notes input
        const notesLabel = document.createElement('label');
        const notesLabelText = document.createElement('span');
        notesLabelText.textContent = 'Notes:';
        notesLabelText.style.fontWeight = '600';
        notesLabelText.style.display = 'block';
        notesLabelText.style.marginBottom = '4px';
        notesLabel.appendChild(notesLabelText);
        const notesInput = document.createElement('textarea');
        notesInput.placeholder = 'Add notes...';
        notesInput.rows = '2';
        notesInput.style.cssText = `
            padding: 8px;
            background-color: var(--background-primary-alt);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            color: var(--text-normal);
            width: 100%;
            box-sizing: border-box;
            font-family: inherit;
            resize: vertical;
            pointer-events: auto;
        `;
        notesInput.disabled = false;
        notesLabel.appendChild(notesInput);
        form.appendChild(notesLabel);
        
        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-top: 12px;
            justify-content: flex-end;
        `;
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.type = 'button';
        saveBtn.style.cssText = `
            padding: 6px 12px;
            background-color: var(--interactive-accent);
            color: var(--text-on-accent);
            border: 1px solid var(--interactive-accent);
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        cancelBtn.style.cssText = `
            padding: 6px 12px;
            background-color: var(--button-background);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            color: var(--text-normal);
        `;
        
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        form.appendChild(buttonContainer);
        
        modalBox.appendChild(form);
        modalBackdrop.appendChild(modalBox);
        
        const cleanup = () => {
            document.body.removeChild(modalBackdrop);
        };
        
        saveBtn.onclick = async (e) => {
            e.preventDefault();
            
            const weight = weightInput.value || '';
            const reps = repsInput.value || '';
            const effort = effortInput.value || '';
            const notes = notesInput.value || '';
            
            // Use processFrontMatter to safely update the file
            await app.fileManager.processFrontMatter(newNote, (fm) => {
                fm['workout_id'] = newId;
                if (weight) fm['weight'] = weight;
                if (reps) fm['reps'] = reps;
                if (effort) fm['effort'] = effort;
                if (notes) fm['note'] = notes;
                
                // Calculate volume
                if (weight && reps) {
                    fm['volume'] = parseFloat(weight) * parseInt(reps);
                }
            });
            
            // Update parent workout
            await updateWorkoutLogs(workoutFile, newNote, exerciseName);
            
            cleanup();
            resolve();
        };
        
        cancelBtn.onclick = (e) => {
            e.preventDefault();
            // Delete the created note since user cancelled
            app.vault.delete(newNote);
            cleanup();
            resolve();
        };
        
        // Close when clicking outside
        modalBackdrop.onclick = (e) => {
            if (e.target === modalBackdrop) {
                app.vault.delete(newNote);
                cleanup();
                resolve();
            }
        };
        
        document.body.appendChild(modalBackdrop);
        
        // Focus on weight input
        weightInput.focus();
    });
}
async function showWorkoutEndedModal() {
    return new Promise((resolve) => {
        // Create modal backdrop
        const modalBackdrop = document.createElement('div');
        modalBackdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            pointer-events: auto;
        `;
        
        const modalBox = document.createElement('div');
        modalBox.style.cssText = `
            background-color: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: auto;
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'Workout Ended';
        title.style.marginTop = '0';
        title.style.marginBottom = '12px';
        title.style.color = 'var(--text-normal)';
        modalBox.appendChild(title);
        
        const message = document.createElement('p');
        message.textContent = 'This workout has already ended. Please delete the end workout log from the Log folder if you want to add more exercises.';
        message.style.marginBottom = '20px';
        message.style.color = 'var(--text-muted)';
        message.style.lineHeight = '1.5';
        modalBox.appendChild(message);
        
        // OK button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
        `;
        
        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.type = 'button';
        okBtn.style.cssText = `
            padding: 6px 16px;
            background-color: var(--interactive-accent);
            color: var(--text-on-accent);
            border: 1px solid var(--interactive-accent);
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        buttonContainer.appendChild(okBtn);
        modalBox.appendChild(buttonContainer);
        modalBackdrop.appendChild(modalBox);
        
        const cleanup = () => {
            document.body.removeChild(modalBackdrop);
        };
        
        okBtn.onclick = (e) => {
            e.preventDefault();
            cleanup();
            resolve();
        };
        
        // Close when clicking outside
        modalBackdrop.onclick = (e) => {
            if (e.target === modalBackdrop) {
                cleanup();
                resolve();
            }
        };
        
        document.body.appendChild(modalBackdrop);
    });
}