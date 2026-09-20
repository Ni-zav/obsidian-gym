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

  async createEvent(workoutFile: TFile, eventType: