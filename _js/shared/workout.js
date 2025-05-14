class workout {
    constructor() {
        // Get utils from customJS if available, otherwise create new instance
        this.utils = window.customJS?.utils || new utils();
    }

    renderHeader(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        
        // Get the workout title and ID
        const metadata = app.metadataCache.getFileCache(current.file);
        const workoutTitle = metadata?.frontmatter?.workout_title || '';
        
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

        context.dv.header(1, headerText);
    }

    renderRemaining(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        const metadata = app.metadataCache.getFileCache(current.file);
        if (!metadata?.frontmatter) return;

        const exerciseIds = metadata.frontmatter.exercises || [];
        const workoutId = metadata.frontmatter.id;

        // Count how many times each exercise ID appears in the planned workout
        const plannedCounts = {};
        exerciseIds.forEach(id => {
            plannedCounts[id] = (plannedCounts[id] || 0) + 1;
        });

        // Count performed exercises
        const performedCounts = {};
        context.dv.pages("#exercise")
            .where(e => e.workout_id === workoutId)
            .forEach(e => {
                const id = app.metadataCache.getFileCache(e.file)?.frontmatter?.id;
                if (id) {
                    performedCounts[id] = (performedCounts[id] || 0) + 1;
                }
            });

        // Create one entry per unique exercise that still has remaining sets
        const remainingExercises = Object.entries(plannedCounts)
            .map(([id, plannedCount]) => {
                const performedCount = performedCounts[id] || 0;
                const remainingCount = Math.max(0, plannedCount - performedCount);
                if (remainingCount === 0) return null; // Skip if all sets are done
                
                const exerciseInfo = this.getExerciseInfo(id);
                return {
                    id,
                    info: exerciseInfo,
                    remainingCount,
                    planned: plannedCount
                };
            })
            .filter(ex => ex !== null); // Remove exercises with no remaining sets

        const tableData = remainingExercises.map(ex => [
            // Wrap exercise name in [[]] if it's not "Workout start"
            ex.info.name === "Workout start" ? ex.info.name : `[[${ex.info.name}]]`,
            ex.info.muscleGroup || "~",
            ex.info.equipment || "~",
            `${ex.remainingCount} sets`
        ]);

        context.dv.table(
            ["Exercise", "💪🏻-group", "🏋🏼", "Sets"],
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

        if (performed.length === 0) {
            context.container.createEl("p", { text: "No exercises performed yet" });
            return;
        }        const tableData = performed.map(e => [
            e.exercise === "Workout start" ? e.exercise : `[[${e.exercise}]]`,
            e.weight ? `${e.weight} kg` : "~",
            e.reps || "~",
            e.effort || "~",
            moment(e.date).format("HH:mm"),
            e.weight && e.reps ? `${e.weight * e.reps} kg×reps` : "~"
        ]);

        context.dv.table(
            ["Exercise", "Weight", "Reps", "Effort", "Time", "Volume"],
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

        const performed = context.dv.pages("#exercise")
            .where(e => e.workout_id === metadata.frontmatter.id)
            .sort(e => e.date);

        if (performed.length === 0) return;

        // Group exercises by their name/type
        const exerciseGroups = {};
        performed.forEach(p => {
            if (p.date && (p.effort || (p.weight && p.reps))) {
                if (!exerciseGroups[p.exercise]) {
                    exerciseGroups[p.exercise] = {
                        dates: [],
                        efforts: [],
                        volumes: [],
                        weights: [],
                        reps: []
                    };
                }
                exerciseGroups[p.exercise].dates.push(moment(new Date(p.date)).format('HH:mm'));
                exerciseGroups[p.exercise].efforts.push(Number(p.effort) || 0);
                exerciseGroups[p.exercise].weights.push(Number(p.weight) || 0);
                exerciseGroups[p.exercise].reps.push(Number(p.reps) || 0);
                // Calculate volume (weight × reps)
                const volume = (Number(p.weight) || 0) * (Number(p.reps) || 0);
                exerciseGroups[p.exercise].volumes.push(volume);
            }
        });

        // Generate colors for each exercise
        const colors = {
            'Triceps - Push up': { base: 'rgb(153, 102, 255)', light: 'rgba(153, 102, 255, 0.6)' }
        };

        // Create datasets for each exercise
        const datasets = [];
        let maxVolume = 0;

        Object.entries(exerciseGroups).forEach(([exercise, data]) => {
            const color = colors[exercise] || { 
                base: `hsl(${Math.random() * 360}, 70%, 50%)`,
                light: `hsla(${Math.random() * 360}, 70%, 50%, 0.6)`
            };

            // Add volume dataset
            const volumes = data.volumes;
            maxVolume = Math.max(maxVolume, ...volumes);

            datasets.push({
                label: `${exercise} (Volume)`,
                data: volumes,
                fill: false,
                borderColor: color.light,
                backgroundColor: color.light,
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.3,
                pointRadius: 4,
                pointHitRadius: 10,
                pointHoverRadius: 6,
                yAxisID: 'y'
            });

            // Add effort dataset
            datasets.push({
                label: `${exercise} (Effort)`,
                data: data.efforts,
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

        try {
            // Check if exerciseGroups exists and has values
            if (!exerciseGroups || Object.values(exerciseGroups).length === 0) {
                console.warn('No exercise groups found to render chart');
                return;
            }

            const chartData = {
                type: 'line',
                data: {
                    labels: Object.values(exerciseGroups)[0].dates,
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
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            beginAtZero: true,
                            suggestedMax: maxVolume * 1.2, // Add 20% space at the top
                            title: {
                                display: true,
                                text: 'Volume (kg×reps)'
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
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y;
                                    if (label.includes('Volume')) {
                                        return `${label}: ${value} (kg×reps)`;
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