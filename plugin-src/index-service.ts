import type { App } from "obsidian";
import type { ExerciseRecord, GymSettings, LogRecord, SessionRecord } from "./types";
import { isInside, tagsOf, trackingModeOf } from "./utils";

type SettingsGetter = () => GymSettings;

type RoutineRecord = { file: any; fm: Record<string, any> };

type IndexedKind = "exercise" | "routine" | "session" | "log";

export class IndexService {
  private app: App;
  private getSettings: SettingsGetter;
  private built = false;
  private exercises = new Map<string, ExerciseRecord>();
  private exerciseById = new Map<string, ExerciseRecord>();
  private exerciseByName = new Map<string, ExerciseRecord>();
  private routines = new Map<string, RoutineRecord>();
  private sessions = new Map<string, SessionRecord>();
  private sessionById = new Map<string, SessionRecord>();
  private logs = new Map<string, LogRecord>();
  private logsByWorkout = new Map<string, Map<string, LogRecord>>();
  private logsByExerciseId = new Map<string, Map<string, LogRecord>>();
  private logsByExerciseName = new Map<string, Map<string, LogRecord>>();
  private kindByPath = new Map<string, IndexedKind>();

  constructor(app: App, getSettings: SettingsGetter) {
    this.app = app;
    this.getSettings = getSettings;
  }

  ensureBuilt(): void {
    if (!this.built) this.rebuild();
  }

  rebuild(): void {
    this.clear();
    for (const file of this.app.vault.getMarkdownFiles()) this.reindexFile(file);
    this.built = true;
  }

  clear(): void {
    this.exercises.clear();
    this.exerciseById.clear();
    this.exerciseByName.clear();
    this.routines.clear();
    this.sessions.clear();
    this.sessionById.clear();
    this.logs.clear();
    this.logsByWorkout.clear();
    this.logsByExerciseId.clear();
    this.logsByExerciseName.clear();
    this.kindByPath.clear();
  }

  registerEvents(plugin: any): void {
    plugin.registerEvent(this.app.metadataCache.on("changed", (file: any, _data: any, cache: any) => {
      this.reindexFile(file, cache?.frontmatter || {});
    }));
    plugin.registerEvent(this.app.vault.on("delete", (file: any) => this.removePath(file.path)));
    plugin.registerEvent(this.app.vault.on("rename", (file: any, oldPath: string) => {
      this.removePath(oldPath);
      if (file?.extension === "md") this.reindexFile(file);
    }));
  }

  frontmatter(file: any): Record<string, any> {
    return this.app.metadataCache.getFileCache(file)?.frontmatter || {};
  }

  reindexFile(file: any, knownFrontmatter?: Record<string, any>): void {
    if (!file || file.extension !== "md") return;
    this.removePath(file.path);
    const fm = knownFrontmatter || this.frontmatter(file);
    const settings = this.getSettings();
    const tags = tagsOf(fm);

    if (isInside(file.path, settings.exercisesRoot) && tags.includes("exercise") && !fm.workout_id && !fm.event_type) {
      const id = String(fm.id ?? "");
      if (!id) return;
      const name = String(fm.exercise || file.basename);
      const aliases = Array.isArray(fm.aliases) ? fm.aliases.map(String) : [];
      const record: ExerciseRecord = { file, fm, id, name, aliases, trackingMode: trackingModeOf(fm) };
      this.exercises.set(file.path, record);
      this.exerciseById.set(id, record);
      for (const key of [name, file.basename, ...aliases].filter(Boolean)) this.exerciseByName.set(String(key), record);
      this.kindByPath.set(file.path, "exercise");
      return;
    }

    if (isInside(file.path, settings.workoutTemplatesRoot) && tags.includes("workout")) {
      this.routines.set(file.path, { file, fm });
      this.kindByPath.set(file.path, "routine");
      return;
    }

    if (isInside(file.path, settings.workoutsRoot) && !file.path.includes("/Log/") && tags.includes("workout")) {
      const id = String(fm.id ?? "");
      if (!id) return;
      const record: SessionRecord = { file, fm, id };
      this.sessions.set(file.path, record);
      this.sessionById.set(id, record);
      this.kindByPath.set(file.path, "session");
      return;
    }

    if (isInside(file.path, settings.workoutsRoot) && (file.path.includes("/Log/") || fm.workout_id || tags.includes("log"))) {
      const workoutId = String(fm.workout_id ?? "");
      if (!workoutId) return;
      const eventType = fm.event_type || (fm.exercise === "Workout start" ? "workout_start" : fm.exercise === "Workout end" ? "workout_end" : undefined);
      const exerciseId = fm.exercise_id != null ? String(fm.exercise_id) : fm.id != null && !eventType ? String(fm.id) : undefined;
      const exerciseName = eventType ? undefined : String(fm.exercise || "") || undefined;
      const performedAt = String(fm.performed_at || fm.date || "");
      const record: LogRecord = {
        file,
        fm,
        id: String(fm.id ?? file.path),
        workoutId,
        exerciseId,
        exerciseName,
        eventType,
        trackingMode: eventType ? undefined : trackingModeOf(fm),
        performedAt,
      };
      this.logs.set(file.path, record);
      this.addNested(this.logsByWorkout, workoutId, file.path, record);
      if (exerciseId) this.addNested(this.logsByExerciseId, exerciseId, file.path, record);
      if (exerciseName) this.addNested(this.logsByExerciseName, exerciseName, file.path, record);
      this.kindByPath.set(file.path, "log");
    }
  }

  private addNested(target: Map<string, Map<string, LogRecord>>, key: string, path: string, record: LogRecord): void {
    if (!target.has(key)) target.set(key, new Map());
    target.get(key)!.set(path, record);
  }

  removePath(path: string): void {
    const kind = this.kindByPath.get(path);
    if (!kind) return;
    if (kind === "exercise") {
      const record = this.exercises.get(path);
      this.exercises.delete(path);
      if (record) {
        if (this.exerciseById.get(record.id)?.file?.path === path) this.exerciseById.delete(record.id);
        for (const key of [record.name, record.file.basename, ...record.aliases].filter(Boolean)) {
          if (this.exerciseByName.get(String(key))?.file?.path === path) this.exerciseByName.delete(String(key));
        }
      }
    } else if (kind === "routine") {
      this.routines.delete(path);
    } else if (kind === "session") {
      const record = this.sessions.get(path);
      this.sessions.delete(path);
      if (record && this.sessionById.get(record.id)?.file?.path === path) this.sessionById.delete(record.id);
    } else if (kind === "log") {
      const record = this.logs.get(path);
      this.logs.delete(path);
      if (record) {
        this.removeNested(this.logsByWorkout, record.workoutId, path);
        if (record.exerciseId) this.removeNested(this.logsByExerciseId, record.exerciseId, path);
        if (record.exerciseName) this.removeNested(this.logsByExerciseName, record.exerciseName, path);
      }
    }
    this.kindByPath.delete(path);
  }

  private removeNested(target: Map<string, Map<string, LogRecord>>, key: string, path: string): void {
    const group = target.get(key);
    if (!group) return;
    group.delete(path);
    if (!group.size) target.delete(key);
  }

  getExercises(): ExerciseRecord[] {
    this.ensureBuilt();
    return [...this.exercises.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getExerciseById(id: unknown): ExerciseRecord | null {
    this.ensureBuilt();
    return id == null ? null : this.exerciseById.get(String(id)) || null;
  }

  getExerciseByName(name: unknown): ExerciseRecord | null {
    this.ensureBuilt();
    return name == null ? null : this.exerciseByName.get(String(name)) || null;
  }

  getRoutines(): RoutineRecord[] {
    this.ensureBuilt();
    return [...this.routines.values()].sort((a, b) => String(a.fm.workout_title || a.file.basename).localeCompare(String(b.fm.workout_title || b.file.basename)));
  }

  getSessions(): SessionRecord[] {
    this.ensureBuilt();
    return [...this.sessions.values()].sort((a, b) => this.timeOf(b.fm.started_at || b.fm.date) - this.timeOf(a.fm.started_at || a.fm.date));
  }

  getActiveSessions(): SessionRecord[] {
    return this.getSessions().filter((record) => record.fm.status === "active" || (!record.fm.ended_at && record.fm.started_at));
  }

  getSessionById(id: unknown): SessionRecord | null {
    this.ensureBuilt();
    return id == null ? null : this.sessionById.get(String(id)) || null;
  }

  getLogsForWorkout(workoutId: unknown, includeEvents = true): LogRecord[] {
    this.ensureBuilt();
    if (workoutId == null) return [];
    const records = [...(this.logsByWorkout.get(String(workoutId))?.values() || [])];
    return records.filter((record) => includeEvents || !record.eventType).sort((a, b) => this.timeOf(a.performedAt) - this.timeOf(b.performedAt));
  }

  getHistory(exerciseId?: unknown, exerciseName?: unknown, excludePath?: string): LogRecord[] {
    this.ensureBuilt();
    const merged = new Map<string, LogRecord>();
    if (exerciseId != null) for (const record of this.logsByExerciseId.get(String(exerciseId))?.values() || []) merged.set(record.file.path, record);
    const definition = exerciseId != null ? this.getExerciseById(exerciseId) : this.getExerciseByName(exerciseName);
    const names = [exerciseName, ...(definition?.aliases || [])].filter(Boolean).map(String);
    for (const name of names) for (const record of this.logsByExerciseName.get(name)?.values() || []) merged.set(record.file.path, record);
    let result = [...merged.values()];
    if (excludePath) result = result.filter((record) => record.file.path !== excludePath);
    return result.sort((a, b) => this.timeOf(a.performedAt) - this.timeOf(b.performedAt));
  }

  getLatestSet(exerciseId?: unknown, exerciseName?: unknown): LogRecord | null {
    const history = this.getHistory(exerciseId, exerciseName);
    return history.length ? history[history.length - 1] : null;
  }

  getAllLogs(includeEvents = false): LogRecord[] {
    this.ensureBuilt();
    return [...this.logs.values()].filter((record) => includeEvents || !record.eventType).sort((a, b) => this.timeOf(a.performedAt) - this.timeOf(b.performedAt));
  }

  private timeOf(value: unknown): number {
    const time = new Date(String(value || 0)).getTime();
    return Number.isFinite(time) ? time : 0;
  }
}
