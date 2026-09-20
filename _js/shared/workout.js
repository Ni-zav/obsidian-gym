class workout {
    get app() {
        return globalThis.customJS?.app || globalThis.app;
    }

    get core() {
        return globalThis.customJS?.gymCore;
    }

    renderHeader(context) {
        if (!context?.dv || !this.core) return;
        const current = context.dv.current();
        const file = this.app.vault.getAbstractFileByPath(current.file.path || current.file);
        const fm = this.core.frontmatter(file);
        const title = fm.workout_title || file?.basename || "Workout";
        const date = fm.date || "";
        context.dv.header(1, date ? title + " · " + date : title);

        const details = [];
        if (fm.workout_type) details.push(fm.workout_type);
        if (fm.workout_place) details.push(fm.workout_place);
        if (fm.duration) details.push(fm.duration);
        if (details.length) context.dv.paragraph(details.join(" · "));

        const remaining = this.core.getRemainingExerciseIds(file).length;
        const completed = (Array.isArray(fm.exercises) ? fm.exercises.length : 0) - remaining;
        if (Array.isArray(fm.exercises) && fm.exercises.length) {
            context.dv.paragraph("Progress: " + completed + "/" + fm.exercises.length + " sets");
        }

        if (context.container) {
            const actions = context.container.createEl("div", { cls: "workout-actions-row" });
            if (fm.status !== "completed") {
                const finish = actions.createEl("button", { text: "Finish workout", cls: "mod-cta" });
                finish.addEventListener("click", async () => {
                    await this.core.finishWorkout(file);
                    new Notice("Workout finished");
                });
                const undo = actions.createEl("button", { text: "Undo last set" });
                undo.addEventListener("click", async () => {
                    const removed = await this.core.deleteLastSet(file);
                    new Notice(removed ? "Last set removed" : "No set to undo");
                });
            } else {
                actions.createEl("span", { text: "Completed", cls: "gym-status-complete" });
            }
        }
    }

    renderHomeActions(context) {
        if (!context?.container || !this.core) return;
        const container = context.container;
        const active = this.core.getActiveWorkouts();
        const actions = container.createEl("div", { cls: "gym-home-actions" });

        if (active.length) {
            const latest = active[0];
            const fm = this.core.frontmatter(latest);
            const resume = actions.createEl("button", {
                text: "▶ Resume " + (fm.workout_title || latest.basename),
                cls: "mod-cta gym-primary-action"
            });
            resume.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(latest));
            if (active.length > 1) {
                actions.createEl("span", { text: active.length + " active workouts", cls: "gym-muted" });
            }
        } else {
            const start = actions.createEl("button", { text: "▶ Start workout", cls: "mod-cta gym-primary-action" });
            start.addEventListener("click", () => this.app.commands.executeCommandById("quickadd:choice:c547bcae-f9e1-462e-be41-5c729807d8ac"));
        }

        const free = actions.createEl("button", { text: "＋ Free workout" });
        free.addEventListener("click", () => this.app.commands.executeCommandById("quickadd:choice:f7e2c8d1-8a9c-4b5d-9e7f-3c1a2b4d6e8f"));
        this.renderHomeSummary(context);
    }

    renderHomeSummary(context) {
        const sessions = this.core.getSessionIndex().items;

        const weekAgo = Date.now() - 7 * 86400000;
        const week = sessions.filter(item => new Date(item.fm.started_at || item.fm.date || 0).getTime() >= weekAgo);
        const totalSets = week.reduce((sum, item) => sum + Object.values(item.fm.ExerciseCounts || {}).reduce((a, b) => a + Number(b || 0), 0), 0);
        const totalVolume = week.reduce((sum, item) => sum + Number(item.fm["Total Volume"] || 0), 0);
        const totalMinutes = week.reduce((sum, item) => sum + Number(item.fm.duration_minutes || 0), 0);

        context.dv.header(3, "This week");
        context.dv.table(["Sessions", "Sets", "Volume", "Time"], [[
            week.length,
            totalSets,
            Math.round(totalVolume) + " kg×reps",
            totalMinutes + " min"
        ]]);

        if (sessions.length) {
            context.dv.header(3, "Recent");
            context.dv.table(["Workout", "Date", "Duration", "Volume"], sessions.slice(0, 5).map(item => [
                context.dv.fileLink(item.file.path),
                item.fm.date || "",
                item.fm.duration || "",
                Math.round(Number(item.fm["Total Volume"] || 0))
            ]));
        }
    }

    renderRemaining(context) {
        if (!context?.dv || !this.core) return;
        const current = context.dv.current();
        const file = this.app.vault.getAbstractFileByPath(current.file.path || current.file);
        const fm = this.core.frontmatter(file);
        if (fm.status === "completed") {
            context.dv.paragraph("Workout completed.");
            return;
        }

        const remaining = this.core.getRemainingExerciseIds(file);
        if (!remaining.length) {
            context.dv.paragraph(Array.isArray(fm.exercises) && fm.exercises.length ? "All planned sets completed." : "Free workout: choose any exercise.");
            return;
        }

        const counts = {};
        for (const id of remaining) counts[id] = (counts[id] || 0) + 1;
        const orderedUnique = [...new Set(remaining)];
        const rows = orderedUnique.map(id => {
            const item = this.core.getExerciseById(id);
            const ex = item?.fm || {};
            const timed = ex.timed === true || ex.timed === "true";
            const target = timed
                ? (this.core.numberOrNull(ex.default_duration_seconds ?? ex.duration) ? this.core.numberOrNull(ex.default_duration_seconds ?? ex.duration) + " sec" : "—")
                : (this.core.numberOrNull(ex.default_reps ?? ex.reps) ?? "—");
            const weight = this.core.numberOrNull(ex.default_weight_kg ?? ex.weight);
            return [
                item?.file ? context.dv.fileLink(item.file.path) : (ex.exercise || id),
                ex.muscle_group || "",
                ex.equipment || "",
                target,
                weight != null ? weight + " kg" : "—",
                counts[id]
            ];
        });
        context.dv.table(["Exercise", "Group", "Equipment", "Target", "Weight", "Sets left"], rows);
    }

    renderPerformed(context) {
        if (!context?.dv || !this.core) return;
        const current = context.dv.current();
        const workoutFile = this.app.vault.getAbstractFileByPath(current.file.path || current.file);
        const logs = this.core.getWorkoutLogEntries(workoutFile)
            .filter(item => item.fm.exercise !== "Workout start" && item.fm.exercise !== "Workout end");

        if (!logs.length) {
            context.dv.paragraph("No sets logged yet.");
            return;
        }

        const rows = logs.map(item => {
            const fm = item.fm;
            const timed = fm.timed === true || fm.timed === "true";
            const metric = timed ? ((fm.duration_seconds ?? "—") + " sec") : (fm.reps ?? "—");
            const volume = timed ? "—" : Math.round((fm.weight_kg || 0) * (fm.reps || 0) * 100) / 100;
            const when = fm.performed_at || fm.date;
            return [
                fm.exercise || item.file.basename,
                fm.weight_kg != null ? fm.weight_kg + " kg" : "—",
                metric,
                fm.effort ?? "—",
                when && typeof moment !== "undefined" ? moment(when).format("HH:mm") : "",
                volume || "—",
                ""
            ];
        });
        context.dv.table(["Exercise", "Weight", "Reps / Time", "Effort", "Time", "Volume", "Actions"], rows);

        const table = context.container.querySelector("table:last-of-type");
        const bodyRows = table?.querySelectorAll("tbody tr") || [];
        bodyRows.forEach((row, index) => {
            const item = logs[index];
            if (!item) return;
            const cell = row.lastElementChild;
            cell?.addClass("gym-row-actions");

            const repeat = document.createElement("button");
            repeat.textContent = "↻";
            repeat.setAttribute("aria-label", "Repeat set");
            repeat.title = "Repeat set";
            repeat.addEventListener("click", async event => {
                event.preventDefault();
                await this.core.repeatSet(workoutFile, item.file);
                const rest = this.getRestSeconds(item.fm.exercise_id, item.fm.exercise);
                if (rest > 0) globalThis.customJS?.timer?.start(rest);
                new Notice("Set repeated");
            });
            cell?.appendChild(repeat);

            const edit = document.createElement("button");
            edit.textContent = "✎";
            edit.setAttribute("aria-label", "Edit set");
            edit.title = "Edit set";
            edit.addEventListener("click", event => {
                event.preventDefault();
                this.editLogFile(item.file, workoutFile);
            });
            cell?.appendChild(edit);

            const remove = document.createElement("button");
            remove.textContent = "×";
            remove.setAttribute("aria-label", "Delete set");
            remove.title = "Delete set";
            remove.addEventListener("click", async event => {
                event.preventDefault();
                await this.app.vault.delete(item.file);
                this.core.invalidateCaches();
                await this.core.recalculateWorkoutMetrics(workoutFile);
                new Notice("Set deleted");
            });
            cell?.appendChild(remove);
        });
    }

    getRestSeconds(exerciseId, exerciseName) {
        const ex = exerciseId ? this.core.getExerciseById(exerciseId) : this.core.getExerciseByName(exerciseName);
        const value = this.core.numberOrNull(ex?.fm?.default_rest_seconds);
        return value == null ? 60 : Math.max(0, value);
    }

    editLogFile(logFile, workoutFile) {
        const fm = this.core.logFrontmatter(logFile);
        const timed = fm.timed === true || fm.timed === "true";
        const backdrop = document.body.createDiv({ cls: "gym-modal-backdrop" });
        backdrop.setAttribute("role", "presentation");
        const dialog = backdrop.createDiv({ cls: "gym-modal" });
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-label", "Edit exercise set");
        dialog.createEl("h3", { text: "Edit " + (fm.exercise || "set") });

        const makeField = (label, value, type = "number") => {
            const wrapper = dialog.createDiv({ cls: "gym-field" });
            wrapper.createEl("label", { text: label });
            const input = type === "textarea" ? wrapper.createEl("textarea") : wrapper.createEl("input", { attr: { type } });
            input.value = value ?? "";
            return input;
        };

        const weight = makeField("Weight (kg)", fm.weight_kg ?? "");
        const reps = timed ? null : makeField("Reps", fm.reps ?? "");
        const duration = timed ? makeField("Duration (seconds)", fm.duration_seconds ?? "") : null;
        const effort = makeField("Effort (1–5)", fm.effort ?? "");
        effort.min = "1"; effort.max = "5";
        const note = makeField("Notes", fm.note || "", "textarea");

        const actions = dialog.createDiv({ cls: "gym-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel" });
        const save = actions.createEl("button", { text: "Save", cls: "mod-cta" });
        const close = () => backdrop.remove();
        cancel.addEventListener("click", close);
        backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
        dialog.addEventListener("keydown", event => { if (event.key === "Escape") close(); });

        save.addEventListener("click", async () => {
            await this.core.updateFrontmatter(logFile, {
                weight_kg: this.core.numberOrNull(weight.value),
                weight: this.core.numberOrNull(weight.value),
                reps: reps ? this.core.numberOrNull(reps.value) : undefined,
                duration_seconds: duration ? this.core.numberOrNull(duration.value) : undefined,
                duration: duration ? this.core.numberOrNull(duration.value) : undefined,
                effort: this.core.numberOrNull(effort.value),
                note: note.value.trim()
            });
            await this.core.recalculateWorkoutMetrics(workoutFile);
            close();
            new Notice("Set updated");
        });
        weight.focus();
    }

    renderEffortChart(context) {
        if (!context?.dv || !this.core || typeof context.window?.renderChart !== "function") return;
        const current = context.dv.current();
        const workoutFile = this.app.vault.getAbstractFileByPath(current.file.path || current.file);
        const logs = this.core.getWorkoutLogEntries(workoutFile)
            .map(item => item.fm)
            .filter(fm => fm.exercise !== "Workout start" && fm.exercise !== "Workout end" && fm.effort != null);
        if (logs.length < 2) return;

        const host = context.container.createEl("div", { cls: "gym-chart gym-session-chart" });
        context.window.renderChart({
            type: "line",
            data: {
                labels: logs.map((fm, index) => (index + 1) + ". " + fm.exercise),
                datasets: [{ label: "Effort", data: logs.map(fm => Number(fm.effort || 0)), tension: 0.25 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 5, ticks: { stepSize: 1 } } }
            }
        }, host);
    }

    async recalculateWorkoutMetrics(workoutFile) {
        if (!this.core) throw new Error("Gym core is not loaded");
        return this.core.recalculateWorkoutMetrics(workoutFile);
    }

    getExerciseInfo(exerciseId) {
        const item = this.core?.getExerciseById(exerciseId);
        if (!item) return null;
        const fm = item.fm;
        return {
            id: fm.id,
            name: fm.exercise || item.file.basename,
            muscleGroup: fm.muscle_group || "",
            equipment: fm.equipment || "",
            timed: fm.timed,
            duration: fm.default_duration_seconds ?? fm.duration,
            reps: fm.default_reps ?? fm.reps,
            weight: fm.default_weight_kg ?? fm.weight
        };
    }
}
