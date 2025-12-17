class workout {
    constructor() {
        // Get utils and exercise-library from customJS if available
        this.utils = window.customJS?.utils || new utils();
        this.exerciseLibrary = window.customJS?.exerciseLibrary || new exerciseLibrary();
    }    renderHeader(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        
        // Get the workout metadata
        const metadata = app.metadataCache.getFileCache(current.file);
        const workoutTitle = metadata?.frontmatter?.workout_title || '';
        const workoutType = metadata?.frontmatter?.workout_type;
        const workoutPlace = metadata?.frontmatter?.workout_place;
        
        // If we have a date, show it with relative formatting
        let headerText = workoutTitle;
        if (current.date) {
            const timeStamp = moment(new Date(current.date));
            const diff_days = timeStamp.diff(new Date(), "days");
            
            headerText += ' - ' + timeStamp.format('YYYY-MM-DD');
            if (diff_days === 0) headerText += " (today)";
            else if (diff_days === -1) headerText += " (yesterday)";
            else if (diff_days === -2) headerText += " (day before yesterday)";
        }

        // Render the main header
        context.dv.header(1, headerText);
        
        // Add workout type and place info if available
        if (workoutType || workoutPlace) {
            const details = [];
            if (workoutType) details.push(`Type: ${workoutType}`);
            if (workoutPlace) details.push(`Location: ${workoutPlace}`);
            context.dv.paragraph(details.join(' | '));
        }
    }

    renderRemaining(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        const metadata = app.metadataCache.getFileCache(current.file);
        if (!metadata?.frontmatter) return;

        const exerciseIds = metadata.frontmatter.exercises || [];
        const workoutId = metadata.frontmatter.id;

        // Debug: Log all #exercise pages for this workout
        const allExercisePages = context.dv.pages("#exercise").where(e => e.workout_id === workoutId).array();
        console.log('All #exercise pages for workoutId', workoutId, allExercisePages);
        // Hide remaining exercises if workout has ended
        const hasEndedArr = context.dv.pages("#exercise")
            .where(e => e.workout_id === workoutId && e.exercise === 'Workout end').array();
        console.log('Workout end entries found:', hasEndedArr);
        const hasEnded = hasEndedArr.length > 0;
        if (hasEnded) {
            context.container.createEl("p", { text: "Workout ended. No exercises remaining!" });
            return;
        }

        // Count how many times each exercise ID appears in the planned workout
        const plannedCounts = {};
        exerciseIds.forEach(id => {
            plannedCounts[id] = (plannedCounts[id] || 0) + 1;
        });

        // Get performed exercises and calculate volumes
        const performedCounts = {};
        const exerciseVolumes = {};
        
        context.dv.pages("#exercise")
            .where(e => e.workout_id === workoutId)
            .forEach(e => {
                const id = app.metadataCache.getFileCache(e.file)?.frontmatter?.id;
                if (id) {
                    performedCounts[id] = (performedCounts[id] || 0) + 1;
                    // Calculate volume if we have both weight and reps
                    if (e.weight && e.reps) {
                        exerciseVolumes[id] = (exerciseVolumes[id] || 0) + (Number(e.weight) * Number(e.reps));
                    }
                }
            });

        // Create one entry per unique exercise that still has remaining sets
        const remainingExercises = [];
        
        // Get unique exercise IDs
        const uniqueIds = [...new Set(exerciseIds)];
        
        for (const id of uniqueIds) {
            const performedCount = performedCounts[id] || 0;
            const plannedCount = plannedCounts[id] || 0;
            const remainingCount = Math.max(0, plannedCount - performedCount);
            
            if (remainingCount === 0) continue; // Skip if all sets are done

            // Find exercise template
            const exerciseFile = app.vault.getMarkdownFiles()
                .find(file => {
                    const cache = app.metadataCache.getFileCache(file);
                    return cache?.frontmatter?.id === id;
                });

            if (!exerciseFile) continue;

            const cache = app.metadataCache.getFileCache(exerciseFile);
            if (!cache?.frontmatter) continue;

            const volume = exerciseVolumes[id] || 0;

            // Get exercise info (timed or not)
            const exInfo = this.getExerciseInfo(id);
            const isTimed = exInfo && (exInfo.timed === true || exInfo.timed === 'true');

            remainingExercises.push({
                name: exInfo ? exInfo.name : id,
                muscleGroup: exInfo ? exInfo.muscleGroup : '',
                equipment: exInfo ? exInfo.equipment : '',
                repsOrDuration: isTimed ? (exInfo.duration ? `${exInfo.duration} sec` : "~") : (exInfo.reps || "~"),
                weight: exInfo && exInfo.weight ? `${exInfo.weight} kg` : "~",
                remainingSets: plannedCounts[id] - (performedCounts[id] || 0)
            });
        }

        if (remainingExercises.length === 0) {
            context.container.createEl("p", { text: "No exercises remaining!" });
            return;
        }

        const tableData = remainingExercises.map(ex => [
            ex.name === "Workout start" ? ex.name : `[[${ex.name}]]`,
            ex.muscleGroup,
            ex.equipment,
            ex.repsOrDuration,
            ex.weight,
            ex.remainingSets
        ]);

        context.dv.table(
            ["Exercise", "💪🏻-group", "🏋🏼", "Reps/Sec", "Weight", "Sets"],
            tableData
        );
    }

    renderPerformed(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        const metadata = app.metadataCache.getFileCache(current.file);
        if (!metadata?.frontmatter?.id) return;

        const performed = context.dv.pages("#exercise")
            .where(e => e.workout_id === metadata.frontmatter.id)
            .sort(e => e.date);

        // Debug: Log all performed exercises
        console.log('Performed exercises for workout', metadata.frontmatter.id, performed.array ? performed.array() : performed);

        if (performed.length === 0) {
            context.container.createEl("p", { text: "No exercises performed yet" });
            return;
        }
        // Table: for timed exercises, show duration and volume is duration*weight
        const tableData = performed.map(e => {
            const isTimed = e.timed === true || e.timed === 'true';
            const duration = isTimed ? (Number(e.duration) || 0) : null;
            const reps = !isTimed ? (e.reps || "~") : null;
            const weight = e.weight ? `${e.weight} kg` : "~";
            const volume = isTimed
                ? (e.weight && duration ? `${e.weight * duration} sec×kg` : "~")
                : (e.weight && e.reps ? `${e.weight * e.reps} kg×reps` : "~");
            
            return [
                (e.exercise === "Workout start" || e.exercise === "Workout end") ? e.exercise : `[[${e.exercise}]]`,
                weight,
                isTimed ? (duration ? duration + ' sec' : '~') : reps,
                e.effort || "~",
                moment(e.date).format("HH:mm"),
                volume
            ];
        });

        context.dv.table(
            ["Exercise", "Weight", "Reps/Sec", "Effort", "Time", "Volume"],
            tableData
        );
        
        // Add inline icon buttons using event delegation
        const table = context.container.querySelector('table');
        if (table) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                
                rows.forEach((row, index) => {
                    const exercise = performed.array()[index];
                    if (!exercise) return;
                    
                    const isStartOrEnd = exercise.exercise === "Workout start" || exercise.exercise === "Workout end";
                    
                    // Create button cell
                    const buttonCell = document.createElement('td');
                    buttonCell.style.cssText = `
                        display: flex;
                        gap: 6px;
                        align-items: center;
                        white-space: nowrap;
                    `;
                    
                    // Edit button (only for regular exercises)
                    if (!isStartOrEnd) {
                        const editBtn = document.createElement('button');
                        editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
                        editBtn.setAttribute('data-file', exercise.file.path);
                        editBtn.setAttribute('data-action', 'edit');
                        editBtn.style.cssText = `
                            background: none;
                            border: none;
                            cursor: pointer;
                            padding: 4px;
                            display: flex;
                            align-items: center;
                            color: var(--text-normal);
                            opacity: 0.7;
                            transition: opacity 0.2s;
                        `;
                        editBtn.onmouseover = () => editBtn.style.opacity = '1';
                        editBtn.onmouseout = () => editBtn.style.opacity = '0.7';
                        editBtn.onclick = async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await this.editLogFile(editBtn.getAttribute('data-file'), current.file);
                        };
                        buttonCell.appendChild(editBtn);
                    }
                    
                    // Delete button (for all)
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"/></svg>';
                    deleteBtn.setAttribute('data-file', exercise.file.path);
                    deleteBtn.setAttribute('data-action', 'delete');
                    deleteBtn.style.cssText = `
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        color: var(--text-normal);
                        opacity: 0.7;
                        transition: opacity 0.2s;
                    `;
                    deleteBtn.onmouseover = () => deleteBtn.style.opacity = '1';
                    deleteBtn.onmouseout = () => deleteBtn.style.opacity = '0.7';
                    deleteBtn.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await this.deleteLogFile(deleteBtn.getAttribute('data-file'), current.file);
                    };
                    buttonCell.appendChild(deleteBtn);
                    
                    // Append button cell to row
                    row.appendChild(buttonCell);
                });
            }
        }
    }
    
    async editLogFile(logFilePath, workoutFile) {
        try {
            const file = app.vault.getAbstractFileByPath(logFilePath);
            if (!file) return;
            
            // Read the current log file
            const content = await app.vault.read(file);
            
            // Extract current values from frontmatter
            const weightMatch = content.match(/^weight:\s*(\d+(?:\.\d+)?)/m);
            const repsMatch = content.match(/^reps:\s*(\d+)/m);
            const effortMatch = content.match(/^effort:\s*(\d+)/m);
            
            const currentWeight = weightMatch ? weightMatch[1] : '';
            const currentReps = repsMatch ? repsMatch[1] : '';
            const currentEffort = effortMatch ? effortMatch[1] : '';
            
            // Create a custom modal dialog using Obsidian's native styles
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
                z-index: 1000;
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
            `;
            
            const title = document.createElement('h2');
            title.textContent = 'Edit Exercise';
            title.style.marginTop = '0';
            title.style.marginBottom = '16px';
            modalBox.appendChild(title);
            
            const form = document.createElement('form');
            form.style.display = 'flex';
            form.style.flexDirection = 'column';
            form.style.gap = '12px';
            
            // Weight input
            const weightLabel = document.createElement('label');
            weightLabel.addClass('setting-item');
            const weightLabelText = document.createElement('span');
            weightLabelText.textContent = 'Weight (kg):';
            weightLabelText.style.fontWeight = '600';
            weightLabelText.style.display = 'block';
            weightLabelText.style.marginBottom = '4px';
            weightLabel.appendChild(weightLabelText);
            const weightInput = document.createElement('input');
            weightInput.type = 'number';
            weightInput.value = currentWeight;
            weightInput.step = '0.5';
            weightInput.placeholder = 'Enter weight';
            weightInput.addClass('setting-item-control');
            weightLabel.appendChild(weightInput);
            form.appendChild(weightLabel);
            
            // Reps input
            const repsLabel = document.createElement('label');
            repsLabel.addClass('setting-item');
            const repsLabelText = document.createElement('span');
            repsLabelText.textContent = 'Reps:';
            repsLabelText.style.fontWeight = '600';
            repsLabelText.style.display = 'block';
            repsLabelText.style.marginBottom = '4px';
            repsLabel.appendChild(repsLabelText);
            const repsInput = document.createElement('input');
            repsInput.type = 'number';
            repsInput.value = currentReps;
            repsInput.placeholder = 'Enter reps';
            repsInput.addClass('setting-item-control');
            repsLabel.appendChild(repsInput);
            form.appendChild(repsLabel);
            
            // Effort input
            const effortLabel = document.createElement('label');
            effortLabel.addClass('setting-item');
            const effortLabelText = document.createElement('span');
            effortLabelText.textContent = 'Effort (1-5):';
            effortLabelText.style.fontWeight = '600';
            effortLabelText.style.display = 'block';
            effortLabelText.style.marginBottom = '4px';
            effortLabel.appendChild(effortLabelText);
            const effortInput = document.createElement('input');
            effortInput.type = 'number';
            effortInput.value = currentEffort;
            effortInput.min = '1';
            effortInput.max = '5';
            effortInput.placeholder = 'Enter effort';
            effortInput.addClass('setting-item-control');
            effortLabel.appendChild(effortInput);
            form.appendChild(effortLabel);
            
            // Notes input
            const notesMatch = content.match(/^note:\s*(.*)$/m);
            const currentNotes = notesMatch ? notesMatch[1].trim() : '';
            
            const notesLabel = document.createElement('label');
            notesLabel.addClass('setting-item');
            const notesLabelText = document.createElement('span');
            notesLabelText.textContent = 'Notes:';
            notesLabelText.style.fontWeight = '600';
            notesLabelText.style.display = 'block';
            notesLabelText.style.marginBottom = '4px';
            notesLabel.appendChild(notesLabelText);
            const notesInput = document.createElement('textarea');
            notesInput.value = currentNotes;
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
            `;
            notesLabel.appendChild(notesInput);
            form.appendChild(notesLabel);
            
            // Buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 16px;
                justify-content: flex-end;
            `;
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.type = 'button';
            saveBtn.addClass('mod-cta');
            saveBtn.addClass('button');
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.type = 'button';
            cancelBtn.addClass('button');
            
            buttonContainer.appendChild(saveBtn);
            buttonContainer.appendChild(cancelBtn);
            form.appendChild(buttonContainer);
            
            modalBox.appendChild(form);
            modalBackdrop.appendChild(modalBox);
            
            // Close modal when clicking outside
            modalBackdrop.onclick = (e) => {
                if (e.target === modalBackdrop) {
                    document.body.removeChild(modalBackdrop);
                }
            };
            
            saveBtn.onclick = async (e) => {
                e.preventDefault();
                
                // Update the log file with new values
                const newWeight = weightInput.value || '';
                const newReps = repsInput.value || '';
                const newEffort = effortInput.value || '';
                
                let updatedContent = content;
                
                // Update or add weight
                if (updatedContent.includes('weight:')) {
                    updatedContent = updatedContent.replace(/^weight:\s*.+$/m, `weight: ${newWeight}`);
                } else if (newWeight) {
                    updatedContent = updatedContent.replace(/^reps:/m, `weight: ${newWeight}\nreps:`);
                }
                
                // Update or add reps
                if (updatedContent.includes('reps:')) {
                    updatedContent = updatedContent.replace(/^reps:\s*.+$/m, `reps: ${newReps}`);
                } else if (newReps) {
                    updatedContent = updatedContent.replace(/^effort:/m, `reps: ${newReps}\neffort:`);
                }
                
                // Update or add effort
                if (updatedContent.includes('effort:')) {
                    updatedContent = updatedContent.replace(/^effort:\s*.+$/m, `effort: ${newEffort}`);
                }
                
                // Update or add notes
                const newNotes = notesInput.value || '';
                if (updatedContent.includes('note:')) {
                    updatedContent = updatedContent.replace(/^note:\s*.*/m, `note: ${newNotes}`);
                } else if (newNotes) {
                    updatedContent = updatedContent.replace(/^effort:/m, `note: ${newNotes}\neffort:`);
                }
                
                // Calculate volume
                if (newWeight && newReps) {
                    const volume = parseFloat(newWeight) * parseInt(newReps);
                    if (updatedContent.includes('volume:')) {
                        updatedContent = updatedContent.replace(/^volume:\s*.+$/m, `volume: ${volume}`);
                    } else {
                        updatedContent = updatedContent.replace(/^weight:/m, `volume: ${volume}\nweight:`);
                    }
                }
                
                await app.vault.modify(file, updatedContent);
                
                // Recalculate all metrics
                await this.recalculateWorkoutMetrics(workoutFile);
                
                document.body.removeChild(modalBackdrop);
                
                // Reload the active view
                const activeView = app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    activeView.previewMode.rerender(true);
                }
            };
            
            cancelBtn.onclick = (e) => {
                e.preventDefault();
                document.body.removeChild(modalBackdrop);
            };
            
            document.body.appendChild(modalBackdrop);
            
            // Focus on weight input
            weightInput.focus();
            
        } catch (error) {
            console.error('Error editing log file:', error);
            new Notice('Error editing exercise: ' + error.message);
        }
    }
    
    async deleteLogFile(logFilePath, workoutFile) {
        try {
            const file = app.vault.getAbstractFileByPath(logFilePath);
            if (!file) return;
            
            // Read the file to check if it's a start log
            const content = await app.vault.read(file);
            const isStartLog = content.includes('Workout start');
            
            if (isStartLog) {
                // If deleting start, ask for confirmation and delete all logs
                if (!confirm('Delete workout start? This will delete ALL exercise logs for this workout.')) {
                    return;
                }
                
                // Delete all files in the Log folder
                const logFolder = file.parent;
                const allFiles = logFolder.children.filter(f => f.extension === 'md');
                
                for (const logFile of allFiles) {
                    await app.vault.delete(logFile);
                }
                
                // Reset workout metrics
                await app.fileManager.processFrontMatter(workoutFile, (fm) => {
                    fm['Logs'] = [];
                    fm['ExerciseCounts'] = {};
                    fm['ExercisesSummary'] = '';
                    fm['duration'] = '';
                });
                
                new Notice('Workout cleared - all logs deleted');
            } else {
                // Normal delete for regular exercises
                if (!confirm('Delete this exercise log?')) {
                    return;
                }
                
                await app.vault.delete(file);
                
                // Recalculate metrics
                await this.recalculateWorkoutMetrics(workoutFile);
                
                new Notice('Exercise log deleted and metrics recalculated');
            }
            
        } catch (error) {
            console.error('Error deleting log file:', error);
            new Notice('Error deleting exercise');
        }
    }
    
    async recalculateWorkoutMetrics(workoutFile) {
        try {
            const logFolderPath = workoutFile.parent.path + "/Log";
            const logFolder = app.vault.getAbstractFileByPath(logFolderPath);
            
            if (!logFolder || !logFolder.children) {
                return;
            }
            
            // Get all log files sorted by name
            const logFiles = logFolder.children
                .filter(f => f.extension === 'md')
                .sort((a, b) => parseInt(a.basename) - parseInt(b.basename));
            
            // Update Logs property in frontmatter
            const logPaths = logFiles.map(f => f.path);
            
            // Recalculate exercise counts and volume
            let exerciseCounts = {};
            let totalVolume = 0;
            
            for (const logFile of logFiles) {
                const content = await app.vault.read(logFile);
                
                // Extract exercise name
                const exerciseMatch = content.match(/^exercise:\s*(.+)$/m);
                const exerciseName = exerciseMatch ? exerciseMatch[1].trim() : '';
                
                // Extract weight and reps for volume calculation
                const weightMatch = content.match(/^weight:\s*(\d+(?:\.\d+)?)/m);
                const repsMatch = content.match(/^reps:\s*(\d+)/m);
                const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
                const reps = repsMatch ? parseInt(repsMatch[1]) : 0;
                
                // Update exercise counts
                if (exerciseName && !exerciseName.includes('Workout')) {
                    exerciseCounts[exerciseName] = (exerciseCounts[exerciseName] || 0) + 1;
                }
                
                // Update total volume
                if (weight && reps) {
                    totalVolume += weight * reps;
                }
            }
            
            // Create exercise summary
            const exercisesSummary = Object.entries(exerciseCounts)
                .map(([name, count]) => `${name} x${count}`)
                .join(", ");
            
            // Calculate duration if there are start and end files
            let duration = '';
            if (logFiles.length >= 2) {
                const startContent = await app.vault.read(logFiles[0]);
                const endContent = await app.vault.read(logFiles[logFiles.length - 1]);
                
                const startMatch = startContent.match(/^date:\s*(.+)$/m);
                const endMatch = endContent.match(/^date:\s*(.+)$/m);
                
                if (startMatch && endMatch) {
                    const startDate = new Date(startMatch[1]);
                    const endDate = new Date(endMatch[1]);
                    const durationMs = endDate - startDate;
                    const totalMinutes = Math.floor(durationMs / 60000);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    
                    if (hours > 0) {
                        const hourStr = hours === 1 ? 'Hour' : 'Hours';
                        const minuteStr = minutes === 1 ? 'Minute' : 'Minutes';
                        duration = `${hours} ${hourStr} ${minutes} ${minuteStr}`;
                    } else {
                        const minuteStr = minutes === 1 ? 'Minute' : 'Minutes';
                        duration = `${minutes} ${minuteStr}`;
                    }
                }
            }
            
            // Update the workout file with recalculated metrics
            await app.fileManager.processFrontMatter(workoutFile, (fm) => {
                fm['Logs'] = logPaths;
                fm['ExerciseCounts'] = exerciseCounts;
                fm['ExercisesSummary'] = exercisesSummary;
                fm['duration'] = duration;
            });
            
        } catch (error) {
            console.error('Error recalculating workout metrics:', error);
        }
    }

    async renderWorkoutSummary(context) {
        if (!context?.dv) return;

        const current = context.dv.current();
        const metadata = app.metadataCache.getFileCache(current.file);

        if (!metadata?.frontmatter) return;

        const date = metadata.frontmatter.date;
        const duration = metadata.frontmatter.duration;
        const exercises = metadata.frontmatter.exercises || [];

        context.dv.header(2, "Workout Summary");

        if (date) {
            context.dv.el('b', 'Date: ');
            context.dv.span(this.utils.formatDate(date));
            context.dv.el('br', '');
        }

        if (duration) {
            context.dv.el('b', 'Duration: ');
            context.dv.span(`${duration} minutes`);
            context.dv.el('br', '');
        }

        if (exercises.length > 0) {
            context.dv.header(3, "Exercises");
            const table = context.dv.table(
                ["Exercise", "Sets", "Weight", "Reps", "Volume"],
                exercises.map(e => [
                    e.name,
                    e.sets || '~',
                    e.weight || '~',
                    e.reps || '~',
                    this.utils.calculateVolume(e.weight, e.reps) || '~'
                ])
            );
        }
    }

    async renderExerciseProgress(context, exerciseName) {
        if (!context?.dv || !exerciseName) return;

        const history = await this.utils.getExerciseHistory(exerciseName);
        if (history.length === 0) return;

        context.dv.header(3, "Progress Chart");

        // Create progress chart using dv.execute
        context.dv.execute('```chart\ntype: line\ndata:\n  labels: ' + 
            JSON.stringify(history.map(h => this.utils.formatDate(h.date))) + '\n  datasets:\n    - label: Weight\n      data: ' + 
            JSON.stringify(history.map(h => h.weight)) + '\n```');
    }

    renderEffortChart(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        const metadata = app.metadataCache.getFileCache(current.file);
        if (!metadata?.frontmatter?.id) return;

        // Get all performed exercises for this workout
        const performed = context.dv.pages("#exercise")
            .where(e => e.workout_id === metadata.frontmatter.id)
            .sort(e => e.time || e.date);

        // Debug: Log all performed exercises and workout end time
        console.log('EffortChart performed:', performed.array ? performed.array() : performed);

        if (performed.length === 0) return;

        // Find workout start and end times
        const startLog = performed.find(e => e.exercise === "Workout start");
        const endLog = performed.find(e => e.exercise === "Workout end");
        const workoutStartTime = startLog ? (startLog.time ? `${metadata.frontmatter.date}T${startLog.time}` : startLog.date) : null;
        const workoutEndTime = endLog ? (endLog.time ? `${metadata.frontmatter.date}T${endLog.time}` : endLog.date) : null;
        console.log('workoutStartTime:', workoutStartTime, 'workoutEndTime:', workoutEndTime);

        // Group exercises by their name/type (excluding start/end)
        const exerciseGroups = {};
        performed.forEach(p => {
            if ((p.time || p.date) && (p.effort || (p.weight && (p.reps || p.duration))) && p.exercise !== "Workout start" && p.exercise !== "Workout end") {
                if (!exerciseGroups[p.exercise]) {
                    exerciseGroups[p.exercise] = {
                        times: [],
                        efforts: [],
                        volumes: [],
                        weights: [],
                        repsOrDur: []
                    };
                }
                // Use ISO string for x-axis
                const label = p.time ? `${metadata.frontmatter.date}T${p.time}` : p.date;
                exerciseGroups[p.exercise].times.push(label);
                exerciseGroups[p.exercise].efforts.push(Number(p.effort) || 0);
                exerciseGroups[p.exercise].weights.push(Number(p.weight) || 1);
                const isTimed = p.timed === true || p.timed === 'true';
                const repsOrDur = isTimed ? (Number(p.duration) || 0) : (Number(p.reps) || 0);
                exerciseGroups[p.exercise].repsOrDur.push(repsOrDur);
                const volume = (Number(p.weight) || 1) * repsOrDur;
                exerciseGroups[p.exercise].volumes.push(volume);
            }
        });

        // Generate colors for each exercise (unchanged)
        const colors = {
            'Triceps - Push up': { base: 'rgb(153, 102, 255)', light: 'rgba(153, 102, 255, 0.6)' }
        };

        // Create datasets for each exercise
        const datasets = [];
        let maxVolume = 0;
        Object.entries(exerciseGroups).forEach(([exercise, data]) => {
            const isTimed = performed.find(p => p.exercise === exercise && (p.timed === true || p.timed === 'true'));
            const color = colors[exercise] || { 
                base: `hsl(${Math.random() * 360}, 70%, 50%)`,
                light: `hsla(${Math.random() * 360}, 70%, 50%, 0.6)`
            };
            // Volume dataset
            const volumes = data.volumes;
            maxVolume = Math.max(maxVolume, ...volumes);
            datasets.push({
                label: isTimed ? `${exercise} (Duration×Weight)` : `${exercise} (Volume)`,
                data: data.times.map((t, i) => ({ x: t, y: volumes[i] })),
                fill: false,
                borderColor: color.light,
                backgroundColor: color.light,
                borderWidth: 2,
                borderDash: isTimed ? [] : [5, 5],
                tension: 0.3,
                pointRadius: isTimed ? 0 : 4,
                pointHitRadius: 10,
                pointHoverRadius: 6,
                yAxisID: 'y'
            });
            // Effort dataset
            datasets.push({
                label: `${exercise} (Effort)` ,
                data: data.times.map((t, i) => ({ x: t, y: data.efforts[i] })),
                fill: false,
                borderColor: color.base,
                backgroundColor: color.base,
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHitRadius: 10,
                pointHoverRadius: 6,
                yAxisID: 'y1'
            });
        });

        // Chart.js annotation for workout start/end
        const annotations = {};
        if (workoutStartTime) {
            annotations.workoutStart = {
                type: 'line',
                xMin: workoutStartTime,
                xMax: workoutStartTime,
                borderColor: 'red',
                borderWidth: 2,
                label: {
                    content: 'Workout Start',
                    enabled: true,
                    position: 'start'
                }
            };
        }
        if (workoutEndTime) {
            annotations.workoutEnd = {
                type: 'line',
                xMin: workoutEndTime,
                xMax: workoutEndTime,
                borderColor: 'red',
                borderWidth: 2,
                label: {
                    content: 'Workout End',
                    enabled: true,
                    position: 'end',
                    color: 'red',
                    backgroundColor: 'white',
                    font: { weight: 'bold' }
                }
            };
        }

        try {
            if (!exerciseGroups || Object.values(exerciseGroups).length === 0) {
                console.warn('No exercise groups found to render chart');
                return;
            }
            const chartData = {
                type: 'line',
                data: {
                    labels: [], // not used with time scale
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                                displayFormats: {
                                    minute: 'HH:mm:ss'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            beginAtZero: true,
                            suggestedMax: maxVolume * 1.2, // Add 20% space at the top
                            title: {
                                display: true,
                                text: 'Volume (kg×reps) / Duration×Weight (sec×kg)'
                            },
                            grid: {
                                drawOnChartArea: true
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            beginAtZero: true,
                            min: 0,
                            max: 5.5, // Add space at the top
                            title: {
                                display: true,
                                text: 'Effort (1-5)'
                            },
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    if (value === 0) return '';
                                    return value <= 5 ? value : '';
                                }
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        annotation: {
                            annotations: annotations
                        },
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y;
                                    if (label.includes('Volume') || label.includes('Duration×Weight')) {
                                        return `${label}: ${value} (kg×reps/sec×kg)`;
                                    }
                                    return `${label}: ${value}`;
                                }
                            }
                            }
                        }
                    }
                };
            // Create a div for the chart with a fixed height
            const chartDiv = context.container.createEl('div');
            chartDiv.style.height = '300px';
            chartDiv.style.marginBottom = '20px';
            chartDiv.style.marginTop = '20px';

            context.window.renderChart(chartData, chartDiv);
        } catch (error) {
            console.error('Error rendering chart:', error);
            context.container.createEl('p', { text: 'Error rendering chart' });
        }
    }

    async renderTimerOrStopwatch(context) {
        if (!context?.container) return;
        // Selector UI
        const selectorDiv = context.container.createEl("div", { cls: "timer-selector" });
        selectorDiv.style.marginBottom = "10px";
        const select = selectorDiv.createEl("select");
        select.style.marginRight = "10px";
        select.innerHTML = `<option value="timer">Timer</option><option value="stopwatch">Stopwatch</option>`;
        // Timer and stopwatch containers
        const timerDiv = context.container.createEl("div", { cls: "timer-ui" });
        const stopwatchDiv = context.container.createEl("div", { cls: "stopwatch-ui" });
        stopwatchDiv.style.display = "none";
        // Render timer and stopwatch controls
        if (window.customJS?.timer) {
            await window.customJS.timer.renderTimerControls({ ...context, container: timerDiv });
        }
        if (window.customJS?.stopwatch) {
            await window.customJS.stopwatch.renderStopwatchControls({ ...context, container: stopwatchDiv });
        }
        // Switch UI on selector change
        select.addEventListener("change", (e) => {
            if (select.value === "timer") {
                timerDiv.style.display = "";
                stopwatchDiv.style.display = "none";
            } else {
                timerDiv.style.display = "none";
                stopwatchDiv.style.display = "";
            }
        });
    }

    getExerciseInfo(exerciseId) {
        const exercise = app.vault.getMarkdownFiles()
            .map(file => ({
                file,
                cache: app.metadataCache.getFileCache(file)
            }))
            .find(({ file, cache }) => 
                cache?.frontmatter?.id === exerciseId || 
                file.basename === exerciseId
            );

        if (!exercise) return {
            name: exerciseId,
            muscleGroup: "~",
            lastWeight: "~",
            lastEffort: "~"
        };

        const { file, cache } = exercise;
        return {
            name: cache.frontmatter?.exercise || file.basename,
            muscleGroup: cache.frontmatter?.muscle_group || "~",
            equipment: cache.frontmatter?.equipment || "~",
            lastWeight: "~",
            lastEffort: "~"
        };
    }
}