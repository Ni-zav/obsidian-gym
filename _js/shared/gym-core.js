class gymCore {
    get app() {
        return globalThis.customJS?.app || globalThis.app;
    }

    get paths() {
        const shared = globalThis.customJS?.pathConfig;
        if (shared?.getPathConfig) return shared.getPathConfig();
        const overrides = globalThis.obsidianGymPaths || {};
        const exercisesRoot = this.normalizePath(overrides.exercisesRoot) || "Templates/exercises";
        const templateNotesRoot = this.normalizePath(overrides.templateNotesRoot) || exercisesRoot;
        return {
            exercisesRoot,
            templateNotesRoot,
            workoutTemplatesRoot: this.normalizePath(overrides.workoutTemplatesRoot) || "Templates/Workouts",
            workoutsRoot: this.normalizePath(overrides.workoutsRoot) || "Workouts",
            exerciseCategoriesPath: this.joinPath(exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: this.joinPath(exercisesRoot, "_library/workout_categories.json"),
            startTemplatePath: this.joinPath(templateNotesRoot, "Start.md"),
            endTemplatePath: this.joinPath(templateNotesRoot, "End.md")
        };
    }

    normalizePath(value) {
        if (!value || typeof value !== "string") return "";
        return value.replace(/\\/g, "/").trim().replace(/^\\/+/, "").replace(/\\/+$/, "");
    }

    joinPath(...parts) {
        return parts.filter(Boolean).map((part, index) => {
            const value = String(part);
            return index === 0 ? value.replace(/\\/+$/, "") : value.replace(/^\\/+/, "").replace(/\\/+$/, "");
        }).join("/");
    }

    uuid() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        const bytes = new Uint8Array(16);
        globalThis.crypto?.getRandomValues?.(bytes);
        if (!bytes.some(Boolean)) {
            for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
    }

    nowTimestamp() {
        if (typeof moment !== "undefined") return moment().format("YYYY-MM-DDTHH:mm:ss");
        const d = new Date();
        const pad = n => String(n).padStart(2, "0");
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    today() {
        return this.nowTimestamp().slice(0, 10);
    }

    yaml(value) {
        if (value === null || value === undefined) return '""';
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        return JSON.stringify(String(value));
    }

    frontmatter(file) {
        if (!file) return {};
        return this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    }

    tags(fileOrFm) {
        const fm = fileOrFm?.path ? this.frontmatter(fileOrFm) : (fileOrFm || {});
        const tags = fm.tags || [];
        return Array.isArray(tags) ? tags : [tags];
    }

    async updateFrontmatter(file, patch) {
        if (!file) throw new Error("File is required");
        await this.app.fileManager.processFrontMatter(file, fm => {
            for (const [key, value] of Object.entries(patch || {})) {
                if (value === undefined) delete fm[key];
                else fm[key] = value;
            }
        });
    }

    async ensureFolder(folderPath) {
        const normalized = this.normalizePath(folderPath);
        if (!normalized) return null;
        const existing = this.app.vault.getAbstractFileByPath(normalized);
        if (existing) return existing;
        const parts = normalized.split("/");
        let current = "";
        for (const part of parts) {
            current = current ? current + "/" + part : part;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                await this.app.vault.createFolder(current);
            }
        }
        return this.app.vault.getAbstractFileByPath(normalized);
    }

    getExerciseDefinitions() {
        const root = this.paths.exercisesRoot + "/";
        return this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(root))
            .map(file => ({ file, fm: this.frontmatter(file) }))
            .filter(item => {
                const tags = Array.isArray(item.fm.tags) ? item.fm.tags : [item.fm.tags].filter(Boolean);
                return tags.includes("exercise") &&
                    !item.fm.workout_id &&
                    item.fm.exercise !== "Workout start" &&
                    item.fm.exercise !== "Workout end" &&
                    item.file.basename !== "Custom";
            });
    }

    getExerciseById(id) {
        return this.getExerciseDefinitions().find(item => String(item.fm.id) === String(id)) || null;
    }

    getExerciseByName(name) {
        return this.getExerciseDefinitions().find(item => item.fm.exercise === name || item.file.basename === name) || null;
    }

    getWorkoutTemplates() {
        const root = this.paths.workoutTemplatesRoot + "/";
        return this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(root))
            .filter(file => this.tags(file).includes("workout"));
    }

    getWorkoutFileFromAny(file) {
        if (!file) return null;
        const fm = this.frontmatter(file);
        if (fm.id && this.tags(fm).includes("workout")) return file;
        if (fm.workout_id) {
            const root = this.paths.workoutsRoot + "/";
            return this.app.vault.getMarkdownFiles().find(candidate => {
                if (!candidate.path.startsWith(root) || candidate.path.includes("/Log/")) return false;
                return String(this.frontmatter(candidate).id || "") === String(fm.workout_id);
            }) || null;
        }
        return null;
    }

    getLogFolder(workoutFile) {
        return workoutFile?.parent ? this.app.vault.getAbstractFileByPath(this.joinPath(workoutFile.parent.path, "Log")) : null;
    }

    getWorkoutLogs(workoutFile) {
        const workoutId = this.frontmatter(workoutFile).id;
        const folder = this.getLogFolder(workoutFile);
        if (!folder?.children) return [];
        return folder.children
            .filter(file => file.extension === "md")
            .filter(file => String(this.frontmatter(file).workout_id || "") === String(workoutId || ""))
            .sort((a, b) => {
                const an = Number(a.basename);
                const bn = Number(b.basename);
                if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                return a.basename.localeCompare(b.basename, undefined, { numeric: true });
            });
    }

    async nextLogPath(workoutFile) {
        const folderPath = this.joinPath(workoutFile.parent.path, "Log");
        const folder = await this.ensureFolder(folderPath);
        const nums = (folder.children || [])
            .filter(file => file.extension === "md")
            .map(file => Number(file.basename))
            .filter(Number.isFinite);
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        return this.joinPath(folderPath, String(next).padStart(3, "0") + ".md");
    }

    logFrontmatter(file) {
        const fm = this.frontmatter(file);
        return {
            ...fm,
            weight_kg: this.numberOrNull(fm.weight_kg ?? fm.weight),
            reps: this.numberOrNull(fm.reps),
            duration_seconds: this.numberOrNull(fm.duration_seconds ?? fm.duration),
            effort: this.numberOrNull(fm.effort),
            exercise_id: fm.exercise_id ?? fm.id ?? null
        };
    }

    numberOrNull(value) {
        if (value === "" || value === null || value === undefined) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    async createLog(workoutFile, payload) {
        if (!workoutFile) throw new Error("Workout file not found");
        const workoutId = this.frontmatter(workoutFile).id;
        if (!workoutId) throw new Error("Workout has no id");

        const timestamp = payload.performed_at || this.nowTimestamp();
        const path = await this.nextLogPath(workoutFile);
        const isTimed = Boolean(payload.timed);
        const lines = [
            "---",
            "schema_version: 2",
            "id: " + this.yaml(this.uuid()),
            "workout_id: " + this.yaml(workoutId),
            payload.exercise_id ? "exercise_id: " + this.yaml(payload.exercise_id) : null,
            "exercise: " + this.yaml(payload.exercise),
            "performed_at: " + this.yaml(timestamp),
            "date: " + this.yaml(timestamp),
            "timed: " + String(isTimed),
            payload.weight_kg !== null && payload.weight_kg !== undefined ? "weight_kg: " + Number(payload.weight_kg) : null,
            payload.weight_kg !== null && payload.weight_kg !== undefined ? "weight: " + Number(payload.weight_kg) : null,
            !isTimed && payload.reps !== null && payload.reps !== undefined ? "reps: " + Number(payload.reps) : null,
            isTimed && payload.duration_seconds !== null && payload.duration_seconds !== undefined ? "duration_seconds: " + Number(payload.duration_seconds) : null,
            isTimed && payload.duration_seconds !== null && payload.duration_seconds !== undefined ? "duration: " + Number(payload.duration_seconds) : null,
            payload.effort !== null && payload.effort !== undefined ? "effort: " + Number(payload.effort) : null,
            payload.note ? "note: " + this.yaml(payload.note) : 'note: ""',
            "tags:",
            "  - exercise",
            "  - log",
            payload.exercise === "Workout start" ? "  - start" : null,
            payload.exercise === "Workout end" ? "  - end" : null,
            "---",
            "",
            payload.exercise
        ].filter(line => line !== null).join("\n");

        const file = await this.app.vault.create(path, lines);
        await this.recalculateWorkoutMetrics(workoutFile);
        return file;
    }

    async createStartLog(workoutFile) {
        const fm = this.frontmatter(workoutFile);
        if (this.getWorkoutLogs(workoutFile).some(file => this.frontmatter(file).exercise === "Workout start")) return null;
        const timestamp = fm.started_at || this.nowTimestamp();
        await this.updateFrontmatter(workoutFile, { status: "active", started_at: timestamp, ended_at: null });
        return this.createLog(workoutFile, { exercise: "Workout start", performed_at: timestamp, timed: false });
    }

    async finishWorkout(workoutFile) {
        const fm = this.frontmatter(workoutFile);
        if (fm.status === "completed") return null;
        const timestamp = this.nowTimestamp();
        const file = await this.createLog(workoutFile, { exercise: "Workout end", performed_at: timestamp, timed: false });
        await this.updateFrontmatter(workoutFile, { status: "completed", ended_at: timestamp });
        await this.recalculateWorkoutMetrics(workoutFile);
        return file;
    }

    async deleteLastSet(workoutFile) {
        const regular = this.getWorkoutLogs(workoutFile).filter(file => {
            const ex = this.frontmatter(file).exercise;
            return ex && ex !== "Workout start" && ex !== "Workout end";
        });
        const last = regular.at(-1);
        if (!last) return null;
        await this.app.vault.delete(last);
        await this.recalculateWorkoutMetrics(workoutFile);
        return last.path;
    }

    async repeatSet(workoutFile, logFile) {
        const fm = this.logFrontmatter(logFile);
        return this.createLog(workoutFile, {
            exercise_id: fm.exercise_id,
            exercise: fm.exercise,
            timed: fm.timed === true || fm.timed === "true",
            weight_kg: fm.weight_kg,
            reps: fm.reps,
            duration_seconds: fm.duration_seconds,
            effort: fm.effort,
            note: fm.note || ""
        });
    }

    async skipExercise(workoutFile, exerciseId) {
        const fm = this.frontmatter(workoutFile);
        const skipped = Array.isArray(fm.skipped_exercises) ? fm.skipped_exercises.map(String) : [];
        if (!skipped.includes(String(exerciseId))) skipped.push(String(exerciseId));
        await this.updateFrontmatter(workoutFile, { skipped_exercises: skipped });
    }

    async replaceExercise(workoutFile, fromId, toId) {
        const fm = this.frontmatter(workoutFile);
        const ids = Array.isArray(fm.exercises) ? fm.exercises : [];
        const logs = this.getWorkoutLogs(workoutFile).map(file => this.logFrontmatter(file));
        const performed = logs.filter(log => String(log.exercise_id || "") === String(fromId)).length;
        let seen = 0;
        const next = ids.map(id => {
            if (String(id) !== String(fromId)) return id;
            seen += 1;
            return seen > performed ? toId : id;
        });
        const order = Array.isArray(fm.workout_order) ? fm.workout_order.map(id => String(id) === String(fromId) ? toId : id) : next;
        await this.updateFrontmatter(workoutFile, { exercises: next, workout_order: order });
    }

    async setNextExercise(workoutFile, exerciseId) {
        const fm = this.frontmatter(workoutFile);
        const order = Array.isArray(fm.workout_order) ? [...fm.workout_order] : [...(fm.exercises || [])];
        const index = order.findIndex(id => String(id) === String(exerciseId));
        if (index > 0) {
            const [picked] = order.splice(index, 1);
            order.unshift(picked);
            await this.updateFrontmatter(workoutFile, { workout_order: order });
        }
    }

    getPreviousSets(exerciseId, exerciseName, excludeFilePath) {
        const root = this.paths.workoutsRoot + "/";
        return this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(root) && file.path.includes("/Log/"))
            .filter(file => file.path !== excludeFilePath)
            .map(file => ({ file, fm: this.logFrontmatter(file) }))
            .filter(item => {
                if (item.fm.exercise === "Workout start" || item.fm.exercise === "Workout end") return false;
                if (exerciseId && item.fm.exercise_id) return String(item.fm.exercise_id) === String(exerciseId);
                return item.fm.exercise === exerciseName;
            })
            .sort((a, b) => new Date(a.fm.performed_at || a.fm.date || 0) - new Date(b.fm.performed_at || b.fm.date || 0));
    }

    getLatestSet(exerciseId, exerciseName) {
        return this.getPreviousSets(exerciseId, exerciseName).at(-1) || null;
    }

    detectPR(current, previous) {
        if (!previous?.length) return [];
        const result = [];
        const maxWeight = Math.max(...previous.map(item => item.fm.weight_kg || 0));
        const maxReps = Math.max(...previous.map(item => item.fm.reps || 0));
        const maxVolume = Math.max(...previous.map(item => (item.fm.weight_kg || 0) * (item.fm.reps || 0)));
        const weight = Number(current.weight_kg || 0);
        const reps = Number(current.reps || 0);
        const volume = weight * reps;
        if (weight > maxWeight) result.push("weight");
        if (reps > maxReps) result.push("reps");
        if (volume > maxVolume) result.push("volume");
        return result;
    }

    getRemainingExerciseIds(workoutFile) {
        const fm = this.frontmatter(workoutFile);
        const planned = Array.isArray(fm.exercises) ? fm.exercises.map(String) : [];
        const skipped = new Set((Array.isArray(fm.skipped_exercises) ? fm.skipped_exercises : []).map(String));
        const counts = {};
        for (const logFile of this.getWorkoutLogs(workoutFile)) {
            const log = this.logFrontmatter(logFile);
            if (log.exercise_id) counts[String(log.exercise_id)] = (counts[String(log.exercise_id)] || 0) + 1;
        }
        const remaining = [];
        const consumed = {};
        for (const id of planned) {
            if (skipped.has(id)) continue;
            consumed[id] = (consumed[id] || 0) + 1;
            if (consumed[id] > (counts[id] || 0)) remaining.push(id);
        }
        const order = Array.isArray(fm.workout_order) ? fm.workout_order.map(String) : planned;
        remaining.sort((a, b) => {
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
        });
        return remaining;
    }

    async recalculateWorkoutMetrics(workoutFile) {
        const logs = this.getWorkoutLogs(workoutFile);
        const regular = logs.map(file => ({ file, fm: this.logFrontmatter(file) }))
            .filter(item => item.fm.exercise !== "Workout start" && item.fm.exercise !== "Workout end");

        const counts = {};
        let totalVolume = 0;
        let timedLoad = 0;
        const logPaths = [];
        for (const file of logs) logPaths.push(file.path);
        for (const item of regular) {
            const name = item.fm.exercise || "Unknown";
            counts[name] = (counts[name] || 0) + 1;
            if (item.fm.timed === true || item.fm.timed === "true") {
                timedLoad += (item.fm.weight_kg || 0) * (item.fm.duration_seconds || 0);
            } else {
                totalVolume += (item.fm.weight_kg || 0) * (item.fm.reps || 0);
            }
        }

        const start = logs.map(file => this.frontmatter(file)).find(fm => fm.exercise === "Workout start");
        const end = [...logs].reverse().map(file => this.frontmatter(file)).find(fm => fm.exercise === "Workout end");
        const startAt = this.frontmatter(workoutFile).started_at || start?.performed_at || start?.date || null;
        const endAt = this.frontmatter(workoutFile).ended_at || end?.performed_at || end?.date || null;
        let durationMinutes = null;
        if (startAt) {
            const endDate = endAt ? new Date(endAt) : new Date();
            const ms = endDate - new Date(startAt);
            if (Number.isFinite(ms) && ms >= 0) durationMinutes = Math.floor(ms / 60000);
        }

        const summary = Object.entries(counts).map(([name, count]) => name + " x" + count).join(", ");
        const duration = durationMinutes === null ? "" : (endAt ? this.formatDuration(durationMinutes) : "Ongoing");
        await this.updateFrontmatter(workoutFile, {
            Logs: logPaths,
            ExerciseCounts: counts,
            ExercisesSummary: summary,
            "Total Volume": Math.round(totalVolume * 100) / 100,
            timed_load: Math.round(timedLoad * 100) / 100,
            duration_minutes: durationMinutes,
            duration,
            status: endAt ? "completed" : "active",
            started_at: startAt || this.frontmatter(workoutFile).started_at || null,
            ended_at: endAt || null
        });
    }

    formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (!hours) return mins + " " + (mins === 1 ? "Minute" : "Minutes");
        return hours + " " + (hours === 1 ? "Hour" : "Hours") + " " + mins + " " + (mins === 1 ? "Minute" : "Minutes");
    }

    getActiveWorkouts() {
        const root = this.paths.workoutsRoot + "/";
        return this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(root) && !file.path.includes("/Log/"))
            .filter(file => this.tags(file).includes("workout"))
            .filter(file => {
                const fm = this.frontmatter(file);
                return fm.status === "active" || (!fm.ended_at && fm.started_at);
            })
            .sort((a, b) => new Date(this.frontmatter(b).started_at || 0) - new Date(this.frontmatter(a).started_at || 0));
    }

    buildWorkoutBody() {
        return [
            "## Session",
            "",
            "~~~dataviewjs",
            "const {workout} = customJS;",
            "workout.renderHeader({dv, container: this.container, window});",
            "~~~",
            "",
            "## Rest",
            "",
            "~~~dataviewjs",
            "const {timer} = customJS;",
            "await timer.renderTimerControls(this);",
            "~~~",
            "",
            "## Log",
            "",
            "~~~meta-bind-button",
            "label: Log / Manage Exercise",
            "style: primary",
            "actions:",
            "  - type: command",
            "    command: quickadd:choice:d5df32b0-6a04-481d-9a8d-b9bd1b2f0ea7",
            "~~~",
            "",
            "## Remaining",
            "",
            "~~~dataviewjs",
            "const {workout} = customJS;",
            "workout.renderRemaining({dv, container: this.container, window});",
            "~~~",
            "",
            "## Performed",
            "",
            "~~~dataviewjs",
            "const {workout} = customJS;",
            "workout.renderPerformed({dv, container: this.container, window});",
            "workout.renderEffortChart({dv, container: this.container, window});",
            "~~~"
        ].join("\n").replaceAll("~~~", "```");
    }

    async createWorkoutSession(templateFile, options = {}) {
        const templateFm = templateFile ? this.frontmatter(templateFile) : {};
        const free = Boolean(options.free);
        const title = free ? "Free Workout" : (templateFm.workout_title || templateFile?.basename || "Workout");
        const slug = templateFile?.basename || title;
        const root = this.paths.workoutsRoot;
        await this.ensureFolder(root);

        let folderName = this.today() + " - " + slug;
        let folderPath = this.joinPath(root, folderName);
        let counter = 2;
        while (this.app.vault.getAbstractFileByPath(folderPath)) {
            folderName = this.today() + " - " + slug + " (" + counter + ")";
            folderPath = this.joinPath(root, folderName);
            counter += 1;
        }
        await this.ensureFolder(folderPath);
        await this.ensureFolder(this.joinPath(folderPath, "Log"));

        const id = this.uuid();
        const startedAt = this.nowTimestamp();
        const exercises = free ? [] : (Array.isArray(templateFm.exercises) ? templateFm.exercises : []);
        const order = free ? [] : (Array.isArray(templateFm.workout_order) ? templateFm.workout_order : [...exercises]);
        const fm = [
            "---",
            "schema_version: 2",
            "id: " + this.yaml(id),
            "workout_title: " + this.yaml(title),
            "date: " + this.yaml(this.today()),
            "started_at: " + this.yaml(startedAt),
            "ended_at: null",
            "status: active",
            "exercises: " + JSON.stringify(exercises),
            "workout_order: " + JSON.stringify(order),
            "skipped_exercises: []",
            "workout_type: " + this.yaml(free ? "Custom" : (templateFm.workout_type || "")),
            "workout_place: " + this.yaml(free ? "" : (templateFm.workout_place || "")),
            "Logs: []",
            "ExerciseCounts: {}",
            'ExercisesSummary: ""',
            "Total Volume: 0",
            "timed_load: 0",
            "duration_minutes: 0",
            'duration: "Ongoing"',
            "tags:",
            "  - workout",
            "---",
            ""
        ].join("\n");
        const sessionPath = this.joinPath(folderPath, slug + ".md");
        const file = await this.app.vault.create(sessionPath, fm + this.buildWorkoutBody());
        await this.createStartLog(file);
        return file;
    }
}
