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