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
    skipped.add(String(exerci