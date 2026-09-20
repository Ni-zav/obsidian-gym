function asNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

async function chooseAdjustedNumber(quickAdd, label, previous, step, fallback, allowEmpty = true) {
    if (previous !== null && previous !== undefined && Number.isFinite(Number(previous))) {
        const base = Number(previous);
        const choices = [
            { label: "Same · " + base, value: base },
            { label: "+" + step + " · " + (base + step), value: base + step },
            { label: "-" + step + " · " + Math.max(0, base - step), value: Math.max(0, base - step) },
            { label: "Custom…", value: "custom" }
        ];
        if (allowEmpty) choices.push({ label: "None / bodyweight", value: null });
        const selected = await quickAdd.suggester(item => item.label, choices, label);
        if (!selected) return undefined;
        if (selected.value !== "custom") return selected.value;
    }
    const raw = await quickAdd.inputPrompt(label, fallback == null ? "" : String(fallback));
    if (raw === null || raw === undefined) return undefined;
    if (raw === "" && allowEmpty) return null;
    return asNumber(raw);
}

function exerciseLabel(core, item) {
    const fm = item.fm;
    const name = fm.exercise || item.file.basename;
    const latest = core.getLatestSet(fm.id, name);
    if (!latest) return name + (fm.equipment ? " · " + fm.equipment : "");
    const last = latest.fm;
    const metric = last.timed === true || last.timed === "true"
        ? (last.duration_seconds ?? "—") + "s"
        : (last.weight_kg ?? "—") + "kg × " + (last.reps ?? "—");
    return name + " · last " + metric;
}

async function pickExercise(core, quickAdd, workoutFile, plannedOnly) {
    let definitions = core.getExerciseDefinitions();
    if (plannedOnly) {
        const remaining = [...new Set(core.getRemainingExerciseIds(workoutFile))];
        const byId = new Map(definitions.map(item => [String(item.fm.id), item]));
        definitions = remaining.map(id => byId.get(String(id))).filter(Boolean);
    }
    definitions.sort((a, b) => (a.fm.exercise || a.file.basename).localeCompare(b.fm.exercise || b.file.basename));
    if (!definitions.length) return null;
    return quickAdd.suggester(item => exerciseLabel(core, item), definitions, plannedOnly ? "Choose planned exercise" : "Choose exercise");
}

module.exports = async function logExercise(params) {
    const core = globalThis.customJS?.gymCore;
    if (!core) throw new Error("Gym core is not loaded. Reload Obsidian.");
    const quickAdd = params.quickAddApi;

    try {
        const active = core.app.workspace.getActiveFile();
        const workoutFile = core.getWorkoutFileFromAny(active);
        if (!workoutFile) {
            new Notice("Open a workout session first");
            return;
        }

        const workoutFm = core.frontmatter(workoutFile);
        if (workoutFm.status === "completed") {
            new Notice("This workout is already completed");
            return;
        }

        const logs = core.getWorkoutLogs(workoutFile)
            .map(file => ({ file, fm: core.logFrontmatter(file) }))
            .filter(item => item.fm.exercise !== "Workout start" && item.fm.exercise !== "Workout end");
        const last = logs.at(-1);
        const planned = Array.isArray(workoutFm.exercises) && workoutFm.exercises.length > 0;
        const remaining = core.getRemainingExerciseIds(workoutFile);

        const actions = [
            { type: "log", label: planned && remaining.length ? "＋ Log planned exercise" : "＋ Log exercise" }
        ];
        if (planned) actions.push({ type: "log-any", label: "＋ Log extra / any exercise" });
        if (last) actions.push({ type: "repeat", label: "↻ Repeat last set · " + last.fm.exercise });
        if (last) actions.push({ type: "undo", label: "Undo last set · " + last.fm.exercise });
        if (planned && remaining.length) {
            actions.push({ type: "next", label: "Set next exercise" });
            actions.push({ type: "skip", label: "Skip exercise for today" });
            actions.push({ type: "replace", label: "Replace exercise for today" });
        }
        actions.push({ type: "finish", label: "✓ Finish workout" });

        const action = await quickAdd.suggester(item => item.label, actions, "Workout action");
        if (!action) return;

        if (action.type === "finish") {
            await core.finishWorkout(workoutFile);
            new Notice("Workout finished");
            return;
        }
        if (action.type === "undo") {
            const removed = await core.deleteLastSet(workoutFile);
            new Notice(removed ? "Last set removed" : "No set to undo");
            return;
        }
        if (action.type === "repeat") {
            await core.repeatSet(workoutFile, last.file);
            const ex = last.fm.exercise_id ? core.getExerciseById(last.fm.exercise_id) : core.getExerciseByName(last.fm.exercise);
            const rest = core.numberOrNull(ex?.fm?.default_rest_seconds);
            if ((rest ?? 60) > 0) globalThis.customJS?.timer?.start(rest ?? 60);
            new Notice("Set repeated");
            return;
        }
        if (action.type === "next" || action.type === "skip" || action.type === "replace") {
            const from = await pickExercise(core, quickAdd, workoutFile, true);
            if (!from) return;
            if (action.type === "next") {
                await core.setNextExercise(workoutFile, from.fm.id);
                new Notice("Next exercise: " + (from.fm.exercise || from.file.basename));
                return;
            }
            if (action.type === "skip") {
                await core.skipExercise(workoutFile, from.fm.id);
                new Notice("Skipped for this workout: " + (from.fm.exercise || from.file.basename));
                return;
            }
            const to = await pickExercise(core, quickAdd, workoutFile, false);
            if (!to || String(to.fm.id) === String(from.fm.id)) return;
            await core.replaceExercise(workoutFile, from.fm.id, to.fm.id);
            new Notice("Replaced with " + (to.fm.exercise || to.file.basename));
            return;
        }

        const plannedOnly = action.type === "log" && planned && remaining.length > 0;
        const selected = await pickExercise(core, quickAdd, workoutFile, plannedOnly);
        if (!selected) return;
        const fm = selected.fm;
        const name = fm.exercise || selected.file.basename;
        const timed = fm.timed === true || fm.timed === "true";
        const previousHistory = core.getPreviousSets(fm.id, name);
        const latest = previousHistory.at(-1)?.fm || {};

        let weight = await chooseAdjustedNumber(
            quickAdd,
            "Weight (kg)",
            latest.weight_kg,
            2.5,
            core.numberOrNull(fm.default_weight_kg ?? fm.weight),
            true
        );
        if (weight === undefined) return;

        let reps = null;
        let duration = null;
        if (timed) {
            duration = await chooseAdjustedNumber(
                quickAdd,
                "Duration (seconds)",
                latest.duration_seconds,
                15,
                core.numberOrNull(fm.default_duration_seconds ?? fm.duration) ?? 30,
                false
            );
            if (duration === undefined || !(duration > 0)) return;
        } else {
            reps = await chooseAdjustedNumber(
                quickAdd,
                "Reps",
                latest.reps,
                1,
                core.numberOrNull(fm.default_reps ?? fm.reps) ?? 8,
                false
            );
            if (reps === undefined || !(reps > 0)) return;
        }

        const effortOptions = [
            { label: "1 · easy", value: 1 },
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
            { label: "5 · failure", value: 5 },
            { label: "Skip effort", value: null }
        ];
        const effortChoice = await quickAdd.suggester(item => item.label, effortOptions, "Effort");
        if (!effortChoice) return;
        const note = (await quickAdd.inputPrompt("Notes (optional)", "")) || "";

        const currentSet = {
            exercise_id: fm.id,
            exercise: name,
            timed,
            weight_kg: weight,
            reps,
            duration_seconds: duration,
            effort: effortChoice.value,
            note
        };
        const prs = timed ? [] : core.detectPR(currentSet, previousHistory);
        await core.createLog(workoutFile, currentSet);

        const rest = Math.max(0, core.numberOrNull(fm.default_rest_seconds) ?? 60);
        if (rest > 0) globalThis.customJS?.timer?.start(rest);

        const parts = ["Logged " + name];
        if (prs.length) parts.push("PR: " + prs.join(", "));
        if (rest > 0) parts.push("rest " + rest + "s");
        new Notice(parts.join(" · "));
        params.variables = { notePath: workoutFile.path };
    } catch (error) {
        console.error("Exercise logging failed", error);
        new Notice("Could not log exercise: " + error.message);
        params.variables = { notePath: "" };
    }
};
