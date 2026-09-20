class gymCore {
    constructor() {
        this._cache = new Map();
        this._cacheTtlMs = 1500;
    }

    get app() {
        return globalThis.customJS?.app || globalThis.app;
    }

    get paths() {
        const shared = globalThis.customJS?.pathConfig;
        if (shared?.getPathConfig) return shared.getPathConfig();
        const overrides = globalThis.obsidianGymPaths || {};
        const exercisesRoot = this.normalizePath(overrides.exercisesRoot) || "Templates/exercises";
        return {
            exercisesRoot,
            workoutTemplatesRoot: this.normalizePath(overrides.workoutTemplatesRoot) || "Templates/Workouts",
            workoutsRoot: this.normalizePath(overrides.workoutsRoot) || "Workouts",
            exerciseCategoriesPath: this.joinPath(exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: this.joinPath(exercisesRoot, "_library/workout_categories.json"),
        };
    }

    normalizePath(value) {
        if (!value || typeof value !== "string") return "";
        let normalized = value.split(String.fromCharCode(92)).join("/").trim();
        while (normalized.startsWith("/")) normalized = normalized.slice(1);
        while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
        return normalized;
    }

    joinPath(...parts) {
        return parts.filter(Boolean).map((part, index) => {
            let value = String(part);
            if (index === 0) {
                while (value.endsWith("/")) value = value.slice(0, -1);
            } else {
                while (value.startsWith("/")) value = value.slice(1);
                while (value.endsWith("/")) value = value.slice(0, -1);
            }
            return value;
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

    _cached(key, builder, ttl = this._cacheTtlMs) {
        const now = Date.now();
        const hit = this._cache.get(key);
        if (hit && now - hit.at < ttl) return hit.value;
        const value = builder();
        this._cache.set(key, { at: now, value });
        return value;
    }

    invalidateCaches(...keys) {
        if (!keys.length) {
            this._cache.clear();
            return;
        }
        for (const key of keys) this._cache.delete(key);
    }

    invalidateCachePrefix(prefix) {
        for (const key of [...this._cache.keys()]) {
            if (key.startsWith(prefix)) this._cache.delete(key);
        }
    }

    invalidateForFile(file, workoutFile = null) {
        const path = file?.path || "";
        const paths = this.paths;

        if (path === paths.exercisesRoot || path.startsWith(paths.exercisesRoot + "/")) {
            this.invalidateCaches("exerciseIndex");
        }

        if (path === paths.workoutTemplatesRoot || path.startsWith(paths.workoutTemplatesRoot + "/")) {
            this.invalidateCaches("workoutTemplates");
        }

        if (path === paths.workoutsRoot || path.startsWith(paths.workoutsRoot + "/")) {
            if (path.includes("/Log/")) {
                this.invalidateCaches("logHistoryIndex");
                if (workoutFile?.path) this.invalidateCaches("workoutLogs:" + workoutFile.path);
                else this.invalidateCachePrefix("workoutLogs:");
            } else {
                this.invalidateCaches("sessionIndex");
            }
        }
    }

    async updateFrontmatter(file, patch) {
        if (!file) throw new Error("File is required");
        await this.app.fileManager.processFrontMatter(file, fm => {
            for (const [key, value] of Object.entries(patch || {})) {
                if (value === undefined) delete fm[key];
                else fm[key] = value;
            }
        });
        this.invalidateForFile(file);
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

    getExerciseIndex() {
        return this._cached("exerciseIndex", () => {
            const root = this.paths.exercisesRoot + "/";
            const items = this.app.vault.getMarkdownFiles()
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

            const byId = new Map();
            const byName = new Map();
            for (const item of items) {
                if (item.fm.id !== null && item.fm.id !== undefined && item.fm.id !== "") {
                    byId.set(String(item.fm.id), item);
                }
                const names = [item.fm.exercise, item.file.basename, ...(Array.isArray(item.fm.aliases) ? item.fm.aliases : [])]
                    .filter(Boolean);
                for (const name of names) byName.set(String(name), item);
            }
            return { items, byId, byName };
        });
    }

    getExerciseDefinitions() {
        return this.getExerciseIndex().items;
    }

    getExerciseById(id) {
        if (id === null || id === undefined) return null;
        return this.getExerciseIndex().byId.get(String(id)) || null;
    }

    getExerciseByName(name) {
        if (!name) return null;
        return this.getExerciseIndex().byName.get(String(name)) || null;
    }

    getWorkoutTemplates() {
        return this._cached("workoutTemplates", () => {
            const root = this.paths.workoutTemplatesRoot + "/";
            return this.app.vault.getMarkdownFiles()
                .filter(file => file.path.startsWith(root))
                .filter(file => this.tags(file).includes("workout"));
        });
    }

    getSessionIndex() {
        return this._cached("sessionIndex", () => {
            const root = this.paths.workoutsRoot + "/";
            const items = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.startsWith(root) && !file.path.includes("/Log/"))
                .map(file => ({ file, fm: this.frontmatter(file) }))
                .filter(item => this.tags(item.fm).includes("workout"))
                .sort((a, b) => new Date(b.fm.started_at || b.fm.date || 0) - new Date(a.fm.started_at || a.fm.date || 0));

            const byId = new Map();
            const active = [];
            for (const item of items) {
                if (item.fm.id) byId.set(String(item.fm.id), item.file);
                if (item.fm.status === "active" || (!item.fm.ended_at && item.fm.started_at)) active.push(item.file);
            }
            return { items, byId, active };
        });
    }

    getWorkoutFileFromAny(file) {
        if (!file) return null;
        const fm = this.frontmatter(file);
        if (fm.id && this.tags(fm).includes("workout")) return file;
        if (fm.workout_id) return this.getSessionIndex().byId.get(String(fm.workout_id)) || null;
        return null;
    }

    getLogFolder(workoutFile) {
        return workoutFile?.parent ? this.app.vault.getAbstractFileByPath(this.joinPath(workoutFile.parent.path, "Log")) : null;
    }

    getWorkoutLogEntries(workoutFile) {
        if (!workoutFile) return [];
        const key = "workoutLogs:" + workoutFile.path;
        return this._cached(key, () => {
            const workoutId = this.frontmatter(workoutFile).id;
            const folder = this.getLogFolder(workoutFile);
            if (!folder?.children) return [];
            return folder.children
                .filter(file => file.extension === "md")
                .map(file => ({ file, fm: this.logFrontmatter(file) }))
                .filter(item => String(item.fm.workout_id || "") === String(workoutId || ""))
                .sort((a, b) => {
                    const an = Number(a.file.basename);
                    const bn = Number(b.file.basename);
                    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                    return a.file.basename.localeCompare(b.file.basename, undefined, { numeric: true });
                });
        }, 750);
    }

    getWorkoutLogs(workoutFile) {
        return this.getWorkoutLogEntries(workoutFile).map(item => item.file);
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

    async createLog(workoutFile, payload, options = {}) {
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
        this.invalidateForFile(file, workoutFile);
        if (options.recalculate !== false) await this.recalculateWorkoutMetrics(workoutFile);
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
        const file = await this.createLog(
            workoutFile,
            { exercise: "Workout end", performed_at: timestamp, timed: false },
            { recalculate: false }
        );
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
        this.invalidateForFile(last, workoutFile);
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

    getLogHistoryIndex() {
        return this._cached("logHistoryIndex", () => {
            const root = this.paths.workoutsRoot + "/";
            const all = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.startsWith(root) && file.path.includes("/Log/"))
                .map(file => ({ file, fm: this.logFrontmatter(file) }))
                .filter(item => item.fm.exercise !== "Workout start" && item.fm.exercise !== "Workout end")
                .sort((a, b) => new Date(a.fm.performed_at || a.fm.date || 0) - new Date(b.fm.performed_at || b.fm.date || 0));

            const byId = new Map();
            const byName = new Map();
            for (const item of all) {
                if (item.fm.exercise_id !== null && item.fm.exercise_id !== undefined && item.fm.exercise_id !== "") {
                    const key = String(item.fm.exercise_id);
                    if (!byId.has(key)) byId.set(key, []);
                    byId.get(key).push(item);
                }
                if (item.fm.exercise) {
                    const key = String(item.fm.exercise);
                    if (!byName.has(key)) byName.set(key, []);
                    byName.get(key).push(item);
                }
            }
            return { all, byId, byName };
        });
    }

    getAllLogEntries() {
        return this.getLogHistoryIndex().all;
    }

    getPreviousSets(exerciseId, exerciseName, excludeFilePath) {
        const index = this.getLogHistoryIndex();
        const results = new Map();

        if (exerciseId !== null && exerciseId !== undefined) {
            for (const item of index.byId.get(String(exerciseId)) || []) results.set(item.file.path, item);
        }

        const definition = exerciseId !== null && exerciseId !== undefined ? this.getExerciseById(exerciseId) : this.getExerciseByName(exerciseName);
        const names = new Set([exerciseName, ...(Array.isArray(definition?.fm?.aliases) ? definition.fm.aliases : [])].filter(Boolean));
        for (const name of names) {
            for (const item of index.byName.get(String(name)) || []) results.set(item.file.path, item);
        }

        let items = [...results.values()];
        if (excludeFilePath) items = items.filter(item => item.file.path !== excludeFilePath);
        return items.sort((a, b) =>
            new Date(a.fm.performed_at || a.fm.date || 0) - new Date(b.fm.performed_at || b.fm.date || 0)
        );
    }

    getLatestSet(exerciseId, exerciseName) {
        const index = this.getLogHistoryIndex();
        let latest = null;
        const consider = item => {
            if (!item) return;
            if (!latest) {
                latest = item;
                return;
            }
            const currentTime = new Date(item.fm.performed_at || item.fm.date || 0).getTime();
            const latestTime = new Date(latest.fm.performed_at || latest.fm.date || 0).getTime();
            if (currentTime >= latestTime) latest = item;
        };

        if (exerciseId !== null && exerciseId !== undefined) {
            const byId = index.byId.get(String(exerciseId));
            if (byId?.length) consider(byId[byId.length - 1]);
        }

        const definition = exerciseId !== null && exerciseId !== undefined ? this.getExerciseById(exerciseId) : this.getExerciseByName(exerciseName);
        const names = [exerciseName, ...(Array.isArray(definition?.fm?.aliases) ? definition.fm.aliases : [])].filter(Boolean);
        for (const name of names) {
            const byName = index.byName.get(String(name));
            if (byName?.length) consider(byName[byName.length - 1]);
        }
        return latest;
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
        for (const { fm: log } of this.getWorkoutLogEntries(workoutFile)) {
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
        const rank = new Map();
        order.forEach((id, index) => {
            if (!rank.has(id)) rank.set(id, index);
        });
        remaining.sort((a, b) => (rank.get(a) ?? 9999) - (rank.get(b) ?? 9999));
        return remaining;
    }

    async recalculateWorkoutMetrics(workoutFile) {
        const entries = this.getWorkoutLogEntries(workoutFile);
        const regular = entries.filter(item => item.fm.exercise !== "Workout start" && item.fm.exercise !== "Workout end");

        const counts = {};
        let totalVolume = 0;
        let timedLoad = 0;
        for (const item of regular) {
            const name = item.fm.exercise || "Unknown";
            counts[name] = (counts[name] || 0) + 1;
            if (item.fm.timed === true || item.fm.timed === "true") {
                timedLoad += (item.fm.weight_kg || 0) * (item.fm.duration_seconds || 0);
            } else {
                totalVolume += (item.fm.weight_kg || 0) * (item.fm.reps || 0);
            }
        }

        const start = entries.find(item => item.fm.exercise === "Workout start")?.fm;
        const end = [...entries].reverse().find(item => item.fm.exercise === "Workout end")?.fm;
        const workoutFm = this.frontmatter(workoutFile);
        const startAt = workoutFm.started_at || start?.performed_at || start?.date || null;
        const endAt = workoutFm.ended_at || end?.performed_at || end?.date || null;
        let durationMinutes = null;
        if (startAt) {
            const endDate = endAt ? new Date(endAt) : new Date();
            const ms = endDate - new Date(startAt);
            if (Number.isFinite(ms) && ms >= 0) durationMinutes = Math.floor(ms / 60000);
        }

        const summary = Object.entries(counts).map(([name, count]) => name + " x" + count).join(", ");
        const duration = durationMinutes === null ? "" : (endAt ? this.formatDuration(durationMinutes) : "Ongoing");
        await this.updateFrontmatter(workoutFile, {
            Logs: entries.map(item => item.file.path),
            ExerciseCounts: counts,
            ExercisesSummary: summary,
            "Total Volume": Math.round(totalVolume * 100) / 100,
            timed_load: Math.round(timedLoad * 100) / 100,
            duration_minutes: durationMinutes,
            duration,
            status: endAt ? "completed" : "active",
            started_at: startAt || workoutFm.started_at || null,
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
        return this.getSessionIndex().active;
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
            "~~~dataviewjs",
            "const button = this.container.createEl('button', { text: 'Log / Manage Exercise', cls: 'mod-cta' });",
            "button.addEventListener('click', () => app.commands.executeCommandById('quickadd:choice:d5df32b0-6a04-481d-9a8d-b9bd1b2f0ea7'));",
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
            "cssclasses:",
            "  - gym-workout",
            "tags:",
            "  - workout",
            "---",
            ""
        ].join("\n");
        const sessionPath = this.joinPath(folderPath, slug + ".md");
        const file = await this.app.vault.create(sessionPath, fm + this.buildWorkoutBody());
        this.invalidateForFile(file);
        await this.createStartLog(file);
        return file;
    }
}
