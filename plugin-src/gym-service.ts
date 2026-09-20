import { TFile } from "obsidian";
import type { App } from "obsidian";
import { IndexService } from "./index-service";
import type { ExerciseRecord, GymSettings, PRResult, RoutinePlanItem, SetPayload, SetType, TrackingMode } from "./types";
import { joinPath, normalizePlan, nowTimestamp, numberOrNull, oneRepMax, parentPath, setVolume, tagsOf, today, trackingModeOf, uuid } from "./utils";

type SettingsGetter = () => GymSettings;

export class GymService {
  readonly app: App;
  readonly index: IndexService;
  private getSettings: SettingsGetter;
  private queues = new Map<string, Promise<unknown>>();

  constructor(app: App, index: IndexService, getSettings: SettingsGetter) {
    this.app = app;
    this.index = index;
    this.getSettings = getSettings;
  }

  get settings(): GymSettings { return this.getSettings(); }

  async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? current + "/" + part : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }

  async updateFrontmatter(file: TFile, patch: Record<string, any>, deleteKeys: string[] = []): Promise<void> {
    const next = { ...this.index.frontmatter(file), ...patch };
    for (const key of deleteKeys) delete next[key];
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, any>) => {
      for (const key of deleteKeys) delete fm[key];
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete fm[key];
        else fm[key] = value;
      }
    });
    this.index.reindexFile(file, next);
  }

  async createMarkdown(path: string, fm: Record<string, any>, body = ""): Promise<TFile> {
    await this.ensureFolder(parentPath(path));
    const file = await this.app.vault.create(path, "---\n---\n\n" + body.trim() + "\n");
    await this.app.fileManager.processFrontMatter(file, (target: Record<string, any>) => Object.assign(target, fm));
    this.index.reindexFile(file, fm);
    return file as TFile;
  }

  getSessionFileFromAny(file: TFile | null): TFile | null {
    if (!file) return null;
    const fm = this.index.frontmatter(file);
    if (tagsOf(fm).includes("workout") && !file.path.includes("/Log/")) return file;
    if (fm.workout_id) return this.index.getSessionById(fm.workout_id)?.file || null;
    return null;
  }

  getPlan(fileOrRecord: any): RoutinePlanItem[] {
    const fm = fileOrRecord?.fm || this.index.frontmatter(fileOrRecord);
    return normalizePlan(fm || {});
  }

  getRemainingPlan(workoutFile: TFile): Array<{ exercise: ExerciseRecord | null; exercise_id: string; planned: number; completed: number; remaining: number }> {
    const fm = this.index.frontmatter(workoutFile);
    const skipped = new Set((Array.isArray(fm.skipped_exercises) ? fm.skipped_exercises : []).map(String));
    const counts = new Map<string, number>();
    for (const log of this.index.getLogsForWorkout(fm.id, false)) {
      if (!log.exerciseId || String(log.fm.set_type || "working") === "warmup") continue;
      counts.set(log.exerciseId, (counts.get(log.exerciseId) || 0) + 1);
    }
    return normalizePlan(fm).map((item) => {
      const completed = counts.get(item.exercise_id) || 0;
      return {
        exercise: this.index.getExerciseById(item.exercise_id),
        exercise_id: item.exercise_id,
        planned: item.sets,
        completed,
        remaining: skipped.has(item.exercise_id) ? 0 : Math.max(0, item.sets - completed),
      };
    }).filter((item) => item.remaining > 0);
  }

  async createSession(templateFile?: TFile | null): Promise<TFile> {
    const tfm = templateFile ? this.index.frontmatter(templateFile) : {};
    const title = templateFile ? String(tfm.workout_title || templateFile.basename) : "Free Workout";
    const slug = String(templateFile?.basename || title).replace(/[\\/:*?"<>|]/g, "-");
    let folder = joinPath(this.settings.workoutsRoot, today() + " - " + slug);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(folder)) folder = joinPath(this.settings.workoutsRoot, today() + " - " + slug + " (" + counter++ + ")");
    await this.ensureFolder(joinPath(folder, "Log"));
    const id = uuid();
    const startedAt = nowTimestamp();
    const file = await this.createMarkdown(joinPath(folder, slug + ".md"), {
      schema_version: 3,
      id,
      workout_title: title,
      date: today(),
      started_at: startedAt,
      ended_at: null,
      status: "active",
      exercise_plan: templateFile ? normalizePlan(tfm) : [],
      skipped_exercises: [],
      workout_type: templateFile ? String(tfm.workout_type || "") : "Custom",
      workout_place: templateFile ? String(tfm.workout_place || "") : "",
      set_count: 0,
      working_set_count: 0,
      exercise_counts: {},
      total_volume: 0,
      timed_seconds: 0,
      distance_km: 0,
      pr_count: 0,
      duration_minutes: 0,
      cssclasses: ["gym-workout"],
      tags: ["workout"],
    }, "```obsidian-gym-session\n```");
    await this.createEvent(file, "workout_start", startedAt);
    return file;
  }

  async createEvent(workoutFile: TFile, eventType: "workout_start" | "workout_end", performedAt = nowTimestamp()): Promise<TFile> {
    return this.enqueue(workoutFile, async () => {
      const path = await this.nextLogPath(workoutFile);
      return this.createMarkdown(path, {
        schema_version: 3,
        id: uuid(),
        workout_id: String(this.index.frontmatter(workoutFile).id),
        event_type: eventType,
        performed_at: performedAt,
        tags: ["log", "event", eventType === "workout_start" ? "start" : "end"],
      }, "# " + (eventType === "workout_start" ? "Workout start" : "Workout end"));
    });
  }

  async logSet(workoutFile: TFile, payload: SetPayload): Promise<{ file: TFile; prs: PRResult[] }> {
    return this.enqueue(workoutFile, async () => {
      const sessionFm = this.index.frontmatter(workoutFile);
      if (sessionFm.status === "completed") throw new Error("This workout is already completed.");
      const history = this.index.getHistory(payload.exercise_id, payload.exercise).map((record) => record.fm);
      const prs = payload.set_type === "warmup" ? [] : this.detectPR(payload, history);
      const existing = this.index.getLogsForWorkout(sessionFm.id, false);
      const setIndex = existing.length + 1;
      const path = await this.nextLogPath(workoutFile);
      const fm: Record<string, any> = {
        schema_version: 3,
        id: uuid(),
        workout_id: String(sessionFm.id),
        set_index: setIndex,
        exercise_id: String(payload.exercise_id),
        exercise: payload.exercise,
        performed_at: nowTimestamp(),
        tracking_mode: payload.tracking_mode,
        set_type: payload.set_type,
        effort: payload.effort ?? null,
        note: payload.note || "",
        prs: prs.map((item) => item.key),
        tags: ["exercise", "log", "set"],
      };
      if (payload.weight_kg != null) fm.weight_kg = Number(payload.weight_kg);
      if (payload.reps != null) fm.reps = Number(payload.reps);
      if (payload.duration_seconds != null) fm.duration_seconds = Number(payload.duration_seconds);
      if (payload.distance_km != null) fm.distance_km = Number(payload.distance_km);
      const file = await this.createMarkdown(path, fm, "```obsidian-gym-log\n```");
      await this.applySetDelta(workoutFile, fm, prs);
      return { file, prs };
    });
  }

  async repeatSet(workoutFile: TFile, logFile: TFile): Promise<{ file: TFile; prs: PRResult[] }> {
    const fm = this.index.frontmatter(logFile);
    const definition = this.index.getExerciseById(fm.exercise_id) || this.index.getExerciseByName(fm.exercise);
    if (!definition) throw new Error("Exercise definition not found.");
    return this.logSet(workoutFile, {
      exercise_id: definition.id,
      exercise: definition.name,
      tracking_mode: trackingModeOf(fm),
      set_type: (fm.set_type || "working") as SetType,
      weight_kg: numberOrNull(fm.weight_kg),
      reps: numberOrNull(fm.reps),
      duration_seconds: numberOrNull(fm.duration_seconds),
      distance_km: numberOrNull(fm.distance_km),
      effort: numberOrNull(fm.effort),
      note: String(fm.note || ""),
    });
  }

  async editSet(workoutFile: TFile, logFile: TFile, patch: Record<string, any>): Promise<void> {
    await this.enqueue(workoutFile, async () => {
      await this.updateFrontmatter(logFile, patch, ["weight", "duration", "date"]);
      await this.recalculateMetrics(workoutFile);
    });
  }

  async deleteSet(workoutFile: TFile, logFile: TFile): Promise<void> {
    await this.enqueue(workoutFile, async () => {
      const oldPath = logFile.path;
      await this.app.vault.trash(logFile, false);
      this.index.removePath(oldPath);
      await this.recalculateMetrics(workoutFile);
    });
  }

  async undoLastSet(workoutFile: TFile): Promise<TFile | null> {
    const fm = this.index.frontmatter(workoutFile);
    const sets = this.index.getLogsForWorkout(fm.id, false);
    const last = sets.at(-1);
    if (!last) return null;
    await this.deleteSet(workoutFile, last.file);
    return last.file;
  }

  async finishWorkout(workoutFile: TFile): Promise<void> {
    await this.enqueue(workoutFile, async () => {
      const fm = this.index.frontmatter(workoutFile);
      if (fm.status === "completed") return;
      const endedAt = nowTimestamp();
      const path = await this.nextLogPath(workoutFile);
      await this.createMarkdown(path, {
        schema_version: 3,
        id: uuid(),
        workout_id: String(fm.id),
        event_type: "workout_end",
        performed_at: endedAt,
        tags: ["log", "event", "end"],
      }, "# Workout end");
      const start = new Date(String(fm.started_at || endedAt)).getTime();
      const end = new Date(endedAt).getTime();
      const durationMinutes = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 60000)) : 0;
      await this.updateFrontmatter(workoutFile, { status: "completed", ended_at: endedAt, duration_minutes: durationMinutes });
    });
  }

  async skipExercise(workoutFile: TFile, exerciseId: string): Promise<void> {
    const fm = this.index.frontmatter(workoutFile);
    const skipped = new Set((Array.isArray(fm.skipped_exercises) ? fm.skipped_exercises : []).map(String));
    skipped.add(String(exerciseId));
    await this.updateFrontmatter(workoutFile, { skipped_exercises: [...skipped] });
  }

  async setNextExercise(workoutFile: TFile, exerciseId: string): Promise<void> {
    const fm = this.index.frontmatter(workoutFile);
    const plan = normalizePlan(fm);
    const index = plan.findIndex((item) => item.exercise_id === String(exerciseId));
    if (index <= 0) return;
    const [item] = plan.splice(index, 1);
    plan.unshift(item);
    await this.updateFrontmatter(workoutFile, { exercise_plan: plan });
  }

  async replaceExercise(workoutFile: TFile, fromId: string, toId: string): Promise<void> {
    const fm = this.index.frontmatter(workoutFile);
    const counts = new Map<string, number>();
    for (const log of this.index.getLogsForWorkout(fm.id, false)) {
      if (log.exerciseId && String(log.fm.set_type || "working") !== "warmup") counts.set(log.exerciseId, (counts.get(log.exerciseId) || 0) + 1);
    }
    const next: RoutinePlanItem[] = [];
    let replacementSets = 0;
    for (const item of normalizePlan(fm)) {
      if (item.exercise_id !== String(fromId)) { next.push(item); continue; }
      const completed = Math.min(item.sets, counts.get(item.exercise_id) || 0);
      if (completed) next.push({ exercise_id: item.exercise_id, sets: completed });
      replacementSets += Math.max(0, item.sets - completed);
    }
    if (replacementSets) {
      const existing = next.find((item) => item.exercise_id === String(toId));
      if (existing) existing.sets += replacementSets;
      else next.push({ exercise_id: String(toId), sets: replacementSets });
    }
    await this.updateFrontmatter(workoutFile, { exercise_plan: next });
  }

  async createExercise(input: {
    name: string; muscleGroup: string; equipment: string; trackingMode: TrackingMode;
    defaultReps?: number | null; defaultWeightKg?: number | null; defaultDurationSeconds?: number | null;
    defaultDistanceKm?: number | null; defaultRestSeconds?: number | null; instructions?: string; videoUrl?: string; aliases?: string[];
  }): Promise<TFile> {
    const fullName = input.name.includes(" - ") ? input.name : input.muscleGroup + " - " + input.name;
    const path = joinPath(this.settings.exercisesRoot, input.muscleGroup, fullName.replace(/[\\/:*?"<>|]/g, "-") + ".md");
    if (this.app.vault.getAbstractFileByPath(path)) throw new Error("Exercise already exists: " + fullName);
    const fm: Record<string, any> = {
      schema_version: 3, id: uuid(), exercise: fullName, muscle_group: input.muscleGroup,
      equipment: input.equipment, tracking_mode: input.trackingMode,
      default_rest_seconds: Math.max(0, Number(input.defaultRestSeconds ?? this.settings.defaultRestSeconds)),
      instructions: input.instructions || "", aliases: input.aliases || [], tags: ["exercise"],
    };
    if (input.defaultReps != null) fm.default_reps = Number(input.defaultReps);
    if (input.defaultWeightKg != null) fm.default_weight_kg = Number(input.defaultWeightKg);
    if (input.defaultDurationSeconds != null) fm.default_duration_seconds = Number(input.defaultDurationSeconds);
    if (input.defaultDistanceKm != null) fm.default_distance_km = Number(input.defaultDistanceKm);
    if (input.videoUrl) fm.video_url = input.videoUrl;
    return this.createMarkdown(path, fm, "```obsidian-gym-exercise\n```");
  }

  async createRoutine(input: { name: string; workoutType: string; workoutPlace: string; plan: RoutinePlanItem[] }): Promise<TFile> {
    const folder = joinPath(this.settings.workoutTemplatesRoot, "gym");
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workout";
    const path = joinPath(folder, slug + ".md");
    if (this.app.vault.getAbstractFileByPath(path)) throw new Error("Routine already exists: " + input.name);
    return this.createMarkdown(path, {
      schema_version: 3, workout_title: input.name,
      exercise_plan: input.plan.map((item) => ({ exercise_id: String(item.exercise_id), sets: Math.max(1, Math.floor(item.sets)) })),
      workout_type: input.workoutType, workout_place: input.workoutPlace, tags: ["workout"],
    }, "# " + input.name + "\n\n```obsidian-gym-routine\n```");
  }

  async loadCategories(): Promise<{ muscleGroups: string[]; equipment: string[]; workoutTypes: string[]; places: string[] }> {
    const exerciseRaw = await this.app.vault.adapter.read(joinPath(this.settings.exercisesRoot, "_library/categories.json"));
    const workoutRaw = await this.app.vault.adapter.read(joinPath(this.settings.exercisesRoot, "_library/workout_categories.json"));
    const exercise = JSON.parse(exerciseRaw || "{}");
    const workout = JSON.parse(workoutRaw || "{}");
    return {
      muscleGroups: Object.values(exercise.muscleGroups || {}).map((item: any) => String(item.name || "")).filter(Boolean),
      equipment: (exercise.equipment || []).map(String),
      workoutTypes: Object.values(workout.workoutTypes || {}).map((item: any) => String(item.name || "")).filter(Boolean),
      places: Object.values(workout.places || {}).map((item: any) => String(item.name || "")).filter(Boolean),
    };
  }

  detectPR(current: SetPayload, previous: Record<string, any>[]): PRResult[] {
    if (current.set_type === "warmup") return [];
    const history = previous.filter((fm) => String(fm.set_type || "working") !== "warmup");
    if (!history.length) return [];
    const result: PRResult[] = [];
    const mode = current.tracking_mode;
    const weight = numberOrNull(current.weight_kg) || 0;
    const reps = numberOrNull(current.reps) || 0;
    if (mode === "strength" || mode === "bodyweight") {
      const weights = history.map((fm) => numberOrNull(fm.weight_kg) || 0);
      if (weight > Math.max(0, ...weights)) result.push({ key: "weight", label: "Weight PR", value: weight });
      const sameWeight = history.filter((fm) => Math.abs((numberOrNull(fm.weight_kg) || 0) - weight) < 0.001);
      if (reps > Math.max(0, ...sameWeight.map((fm) => numberOrNull(fm.reps) || 0))) result.push({ key: "reps_at_weight", label: weight ? "Reps-at-weight PR" : "Reps PR", value: reps });
      const volume = setVolume(weight, reps);
      if (volume > Math.max(0, ...history.map((fm) => setVolume(fm.weight_kg, fm.reps)))) result.push({ key: "set_volume", label: "Set-volume PR", value: volume });
      const estimated = oneRepMax(weight, reps);
      if (estimated > Math.max(0, ...history.map((fm) => oneRepMax(fm.weight_kg, fm.reps)))) result.push({ key: "estimated_1rm", label: "Estimated 1RM PR", value: estimated });
    } else if (mode === "duration") {
      const duration = numberOrNull(current.duration_seconds) || 0;
      if (duration > Math.max(0, ...history.map((fm) => numberOrNull(fm.duration_seconds ?? fm.duration) || 0))) result.push({ key: "duration", label: "Duration PR", value: duration });
    } else if (mode === "distance_time") {
      const distance = numberOrNull(current.distance_km) || 0;
      const duration = numberOrNull(current.duration_seconds) || 0;
      if (distance > Math.max(0, ...history.map((fm) => numberOrNull(fm.distance_km) || 0))) result.push({ key: "distance", label: "Distance PR", value: distance });
      if (distance > 0 && duration > 0) {
        const pace = duration / distance;
        const previousPaces = history.map((fm) => {
          const d = numberOrNull(fm.distance_km) || 0, t = numberOrNull(fm.duration_seconds) || 0;
          return d > 0 && t > 0 ? t / d : Infinity;
        }).filter(Number.isFinite);
        if (previousPaces.length && pace < Math.min(...previousPaces)) result.push({ key: "pace", label: "Pace PR", value: pace });
      }
    }
    return result;
  }

  async recalculateMetrics(workoutFile: TFile): Promise<void> {
    const fm = this.index.frontmatter(workoutFile);
    const logs = this.index.getLogsForWorkout(fm.id, true);
    const sets = logs.filter((log) => !log.eventType);
    const counts: Record<string, number> = {};
    let working = 0, volume = 0, timedSeconds = 0, distanceKm = 0, prCount = 0;
    for (const log of sets) {
      const lfm = log.fm;
      if (String(lfm.set_type || "working") !== "warmup") {
        working += 1;
        const name = String(lfm.exercise || "Unknown");
        counts[name] = (counts[name] || 0) + 1; 1;
        volume += setVolume(lfm.weight_kg, lfm.reps);
        timedSeconds += numberOrNull(lfm.duration_seconds ?? lfm.duration) || 0;
        distanceKm += numberOrNull(lfm.distance_km) || 0;
      }
      prCount += Array.isArray(lfm.prs) ? lfm.prs.length : 0;
    }
    const start = logs.find((log) => log.eventType === "workout_start")?.performedAt || fm.started_at;
    const end = [...logs].reverse().find((log) => log.eventType === "workout_end")?.performedAt || fm.ended_at;
    const durationMinutes = start ? Math.max(0, Math.round(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 60000)) : 0;
    await this.updateFrontmatter(workoutFile, {
      set_count: sets.length, working_set_count: working, exercise_counts: counts,
      total_volume: Math.round(volume * 100) / 100, timed_seconds: Math.round(timedSeconds),
      distance_km: Math.round(distanceKm * 1000) / 1000, pr_count: prCount,
      duration_minutes: durationMinutes, status: end ? "completed" : "active",
      started_at: start || fm.started_at || null, ended_at: end || null,
    }, ["Logs", "ExerciseCounts", "ExercisesSummary", "Total Volume", "timed_load", "duration"]);
  }

  private async applySetDelta(workoutFile: TFile, setFm: Record<string, any>, prs: PRResult[]): Promise<void> {
    const fm = this.index.frontmatter(workoutFile);
    const working = String(setFm.set_type || "working") !== "warmup";
    const counts = { ...(fm.exercise_counts || {}) };
    if (working) counts[setFm.exercise] = Number(counts[setFm.exercise] || 0) + 1;
    await this.updateFrontmatter(workoutFile, {
      set_count: Number(fm.set_count || 0) + 1,
      working_set_count: Number(fm.working_set_count || 0) + (working ? 1 : 0),
      exercise_counts: counts,
      total_volume: Number(fm.total_volume || 0) + (working ? setVolume(setFm.weight_kg, setFm.reps) : 0),
      timed_seconds: Number(fm.timed_seconds || 0) + (working ? (numberOrNull(setFm.duration_seconds) || 0) : 0),
      distance_km: Number(fm.distance_km || 0) + (working ? (numberOrNull(setFm.distance_km) || 0) : 0),
      pr_count: Number(fm.pr_count || 0) + prs.length,
    });
  }

  private async nextLogPath(workoutFile: TFile): Promise<string> {
    const folder = joinPath(parentPath(workoutFile.path), "Log");
    await this.ensureFolder(folder);
    const entries = this.index.getLogsForWorkout(this.index.frontmatter(workoutFile).id, true);
    let next = Math.max(0, ...entries.map((record) => Number(record.file.basename)).filter(Number.isFinite)) + 1;
    for (;;) {
      const candidate = joinPath(folder, String(next).padStart(3, "0") + ".md");
      if (!this.app.vault.getAbstractFileByPath(candidate)) return candidate;
      next += 1;
    }
  }

  private async enqueue<T>(workoutFile: TFile, operation: () => Promise<T>): Promise<T> {
    const key = String(this.index.frontmatter(workoutFile).id || workoutFile.path);
    const previous = this.queues.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.queues.set(key, next.then(() => undefined, () => undefined));
    try { return await next; }
    finally { if (this.queues.get(key) === next) this.queues.delete(key); }
  }
}
