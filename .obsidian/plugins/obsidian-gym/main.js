var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin-src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObsidianGym
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// plugin-src/utils.ts
var import_obsidian = require("obsidian");
var FENCE = String.fromCharCode(96).repeat(3);
var DEFAULTS = {
  exercisesRoot: "Templates/exercises",
  workoutTemplatesRoot: "Templates/Workouts",
  workoutsRoot: "Workouts",
  homeNote: "Home.md",
  openHomeOnStartup: true,
  defaultRestSeconds: 60,
  weightStepKg: 2.5,
  schemaVersion: 3
};
function norm(v) {
  if (typeof v !== "string") return "";
  return (0, import_obsidian.normalizePath)(v.trim()).replace(/^\/+|\/+$/g, "");
}
function join(...parts) {
  return parts.filter(Boolean).map((x, i) => i ? String(x).replace(/^\/+|\/+$/g, "") : String(x).replace(/\/+$/g, "")).join("/");
}
function parent(p) {
  p = norm(p);
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}
function inside(p, r) {
  p = norm(p);
  r = norm(r);
  return !!(p && r && (p === r || p.startsWith(r + "/")));
}
function tags(f) {
  const v = f && f.tags != null ? f.tags : [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean).map((x) => String(x).replace(/^#/, ""));
}
function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function now() {
  return (0, import_obsidian.moment)().format("YYYY-MM-DDTHH:mm:ss");
}
function day() {
  return (0, import_obsidian.moment)().format("YYYY-MM-DD");
}
function modeOf(f) {
  const m = f && f.tracking_mode;
  if (["strength", "bodyweight", "duration", "distance_time"].includes(m)) return m;
  if (f && (f.distance_km != null || f.default_distance_km != null)) return "distance_time";
  if (f && (f.timed === true || f.timed === "true" || f.duration != null || f.default_duration_seconds != null)) return "duration";
  return String(f && f.equipment || "").toLowerCase().includes("bodyweight") ? "bodyweight" : "strength";
}
function planOf(f) {
  if (Array.isArray(f && f.exercise_plan)) return f.exercise_plan.map((x) => ({ exercise_id: String(x.exercise_id || x.id || ""), sets: Math.max(1, Math.floor(Number(x.sets) || 1)) })).filter((x) => x.exercise_id);
  const ids = Array.isArray(f && f.exercises) ? f.exercises.map(String) : [], counts = /* @__PURE__ */ new Map(), order = [];
  ids.forEach((id) => {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return order.map((id) => ({ exercise_id: id, sets: counts.get(id) || 1 }));
}
function volume(w, r) {
  return Math.max(0, num(w) || 0) * Math.max(0, num(r) || 0);
}
function e1rm(w, r) {
  w = num(w) || 0;
  r = num(r) || 0;
  return w > 0 && r > 0 && r < 37 ? w * (36 / (37 - r)) : 0;
}
function parseLegacy(v) {
  const n = num(v);
  if (n != null) return n;
  if (typeof v !== "string") return null;
  const m = [...v.matchAll(/["'](-?\d+(?:\.\d+)?)["']/g)];
  return m.length ? num(m[m.length - 1][1]) : null;
}
function formatSeconds(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

// plugin-src/index-service.ts
var IndexService = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.clear();
  }
  clear() {
    this.exercises = /* @__PURE__ */ new Map();
    this.byExerciseId = /* @__PURE__ */ new Map();
    this.byExerciseName = /* @__PURE__ */ new Map();
    this.routines = /* @__PURE__ */ new Map();
    this.sessions = /* @__PURE__ */ new Map();
    this.bySessionId = /* @__PURE__ */ new Map();
    this.logs = /* @__PURE__ */ new Map();
    this.byWorkout = /* @__PURE__ */ new Map();
    this.byLogExerciseId = /* @__PURE__ */ new Map();
    this.byLogExerciseName = /* @__PURE__ */ new Map();
    this.kind = /* @__PURE__ */ new Map();
  }
  fm(file) {
    return this.app.metadataCache.getFileCache(file)?.frontmatter || {};
  }
  rebuild() {
    this.clear();
    this.app.vault.getMarkdownFiles().forEach((f) => this.reindex(f));
  }
  register() {
    this.plugin.registerEvent(this.app.metadataCache.on("changed", (f, _d, c) => this.reindex(f, c && c.frontmatter || {})));
    this.plugin.registerEvent(this.app.vault.on("delete", (f) => this.remove(f.path)));
    this.plugin.registerEvent(this.app.vault.on("rename", (f, old) => {
      this.remove(old);
      if (f.extension === "md") this.reindex(f);
    }));
  }
  addNested(map, key, path, rec) {
    if (!map.has(key)) map.set(key, /* @__PURE__ */ new Map());
    map.get(key).set(path, rec);
  }
  delNested(map, key, path) {
    const g = map.get(key);
    if (!g) return;
    g.delete(path);
    if (!g.size) map.delete(key);
  }
  remove(path) {
    const k = this.kind.get(path);
    if (!k) return;
    if (k === "exercise") {
      const r = this.exercises.get(path);
      this.exercises.delete(path);
      if (r) {
        if (this.byExerciseId.get(r.id)?.file.path === path) this.byExerciseId.delete(r.id);
        [r.name, r.file.basename, ...r.aliases].forEach((n) => {
          if (this.byExerciseName.get(String(n))?.file.path === path) this.byExerciseName.delete(String(n));
        });
      }
    } else if (k === "routine") this.routines.delete(path);
    else if (k === "session") {
      const r = this.sessions.get(path);
      this.sessions.delete(path);
      if (r && this.bySessionId.get(r.id)?.file.path === path) this.bySessionId.delete(r.id);
    } else if (k === "log") {
      const r = this.logs.get(path);
      this.logs.delete(path);
      if (r) {
        this.delNested(this.byWorkout, r.workoutId, path);
        if (r.exerciseId) this.delNested(this.byLogExerciseId, r.exerciseId, path);
        if (r.exerciseName) this.delNested(this.byLogExerciseName, r.exerciseName, path);
      }
    }
    this.kind.delete(path);
  }
  reindex(file, known = null) {
    if (!file || file.extension !== "md") return;
    this.remove(file.path);
    const f = known || this.fm(file), s = this.plugin.settings, ts = tags(f);
    if (inside(file.path, s.exercisesRoot) && ts.includes("exercise") && !f.workout_id && !f.event_type) {
      const id = String(f.id || "");
      if (!id) return;
      const r = { file, fm: f, id, name: String(f.exercise || file.basename), aliases: Array.isArray(f.aliases) ? f.aliases.map(String) : [], trackingMode: modeOf(f) };
      this.exercises.set(file.path, r);
      this.byExerciseId.set(id, r);
      [r.name, file.basename, ...r.aliases].forEach((n) => this.byExerciseName.set(String(n), r));
      this.kind.set(file.path, "exercise");
      return;
    }
    if (inside(file.path, s.workoutTemplatesRoot) && ts.includes("workout")) {
      this.routines.set(file.path, { file, fm: f });
      this.kind.set(file.path, "routine");
      return;
    }
    if (inside(file.path, s.workoutsRoot) && !file.path.includes("/Log/") && ts.includes("workout")) {
      const id = String(f.id || "");
      if (!id) return;
      const r = { file, fm: f, id };
      this.sessions.set(file.path, r);
      this.bySessionId.set(id, r);
      this.kind.set(file.path, "session");
      return;
    }
    if (inside(file.path, s.workoutsRoot) && (file.path.includes("/Log/") || f.workout_id || ts.includes("log"))) {
      const wid = String(f.workout_id || "");
      if (!wid) return;
      const event = f.event_type || (f.exercise === "Workout start" ? "workout_start" : f.exercise === "Workout end" ? "workout_end" : null);
      const r = { file, fm: f, id: String(f.id || file.path), workoutId: wid, exerciseId: event ? null : f.exercise_id != null ? String(f.exercise_id) : null, exerciseName: event ? null : f.exercise ? String(f.exercise) : null, eventType: event, performedAt: String(f.performed_at || f.date || "") };
      this.logs.set(file.path, r);
      this.addNested(this.byWorkout, wid, file.path, r);
      if (r.exerciseId) this.addNested(this.byLogExerciseId, r.exerciseId, file.path, r);
      if (r.exerciseName) this.addNested(this.byLogExerciseName, r.exerciseName, file.path, r);
      this.kind.set(file.path, "log");
    }
  }
  exercisesList() {
    return [...this.exercises.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  exerciseById(id) {
    return id == null ? null : this.byExerciseId.get(String(id)) || null;
  }
  exerciseByName(n) {
    return n == null ? null : this.byExerciseName.get(String(n)) || null;
  }
  routinesList() {
    return [...this.routines.values()].sort((a, b) => String(a.fm.workout_title || a.file.basename).localeCompare(String(b.fm.workout_title || b.file.basename)));
  }
  sessionsList() {
    return [...this.sessions.values()].sort((a, b) => new Date(b.fm.started_at || b.fm.date || 0).getTime() - new Date(a.fm.started_at || a.fm.date || 0).getTime());
  }
  activeSessions() {
    return this.sessionsList().filter((r) => r.fm.status === "active" || !r.fm.ended_at && r.fm.started_at);
  }
  sessionById(id) {
    return id == null ? null : this.bySessionId.get(String(id)) || null;
  }
  workoutLogs(id, events = true) {
    return [...this.byWorkout.get(String(id))?.values() || []].filter((r) => events || !r.eventType).sort((a, b) => new Date(a.performedAt || 0).getTime() - new Date(b.performedAt || 0).getTime());
  }
  history(id, name) {
    const m = /* @__PURE__ */ new Map();
    if (id != null) for (const r of this.byLogExerciseId.get(String(id))?.values() || []) m.set(r.file.path, r);
    const def = id != null ? this.exerciseById(id) : this.exerciseByName(name), names = [name, ...def?.aliases || []].filter(Boolean).map(String);
    names.forEach((n) => {
      for (const r of this.byLogExerciseName.get(n)?.values() || []) m.set(r.file.path, r);
    });
    return [...m.values()].sort((a, b) => new Date(a.performedAt || 0).getTime() - new Date(b.performedAt || 0).getTime());
  }
  latest(id, name) {
    const h = this.history(id, name);
    return h.at(-1) || null;
  }
  allLogs() {
    return [...this.logs.values()].filter((r) => !r.eventType).sort((a, b) => new Date(a.performedAt || 0).getTime() - new Date(b.performedAt || 0).getTime());
  }
};

// plugin-src/timer-service.ts
var TimerService = class {
  constructor(done) {
    this.done = done;
    this.listeners = /* @__PURE__ */ new Set();
    this.reset();
  }
  reset() {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
    this.mode = "countdown";
    this.seconds = 0;
    this.running = false;
    this.paused = false;
    this.target = 0;
    this.started = 0;
    this.emit();
  }
  start(sec) {
    this.reset();
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    if (!sec) return;
    this.mode = "countdown";
    this.seconds = sec;
    this.running = true;
    this.target = Date.now() + sec * 1e3;
    this.tick();
  }
  stopwatch() {
    this.reset();
    this.mode = "stopwatch";
    this.running = true;
    this.started = Date.now();
    this.tick();
  }
  pause() {
    if (!this.running || this.paused) return;
    this.sync();
    clearInterval(this.handle);
    this.handle = null;
    this.paused = true;
    this.emit();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.mode === "countdown") this.target = Date.now() + this.seconds * 1e3;
    else this.started = Date.now() - this.seconds * 1e3;
    this.tick();
  }
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }
  snapshot() {
    this.sync();
    return { mode: this.mode, seconds: this.seconds, running: this.running, paused: this.paused };
  }
  sync() {
    if (!this.running || this.paused) return;
    if (this.mode === "countdown") this.seconds = Math.max(0, Math.ceil((this.target - Date.now()) / 1e3));
    else this.seconds = Math.max(0, Math.floor((Date.now() - this.started) / 1e3));
  }
  tick() {
    this.sync();
    this.emit();
    this.handle = setInterval(() => {
      this.sync();
      this.emit();
      if (this.mode === "countdown" && this.running && !this.paused && this.seconds <= 0) {
        clearInterval(this.handle);
        this.handle = null;
        this.running = false;
        this.done();
        this.emit();
      }
    }, 250);
  }
  emit() {
    const s = { mode: this.mode, seconds: this.seconds, running: this.running, paused: this.paused };
    [...this.listeners].forEach((fn) => fn(s));
  }
  destroy() {
    if (this.handle) clearInterval(this.handle);
    this.listeners.clear();
  }
};

// plugin-src/gym-service.ts
var GymService = class {
  constructor(plugin, index) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.index = index;
    this.queues = /* @__PURE__ */ new Map();
  }
  async ensureFolder(p) {
    let cur = "";
    for (const part of norm(p).split("/").filter(Boolean)) {
      cur = cur ? cur + "/" + part : part;
      if (!this.app.vault.getAbstractFileByPath(cur)) await this.app.vault.createFolder(cur);
    }
  }
  async update(file, patch, del = []) {
    const next = { ...this.index.fm(file), ...patch };
    del.forEach((k) => delete next[k]);
    await this.app.fileManager.processFrontMatter(file, (f) => {
      del.forEach((k) => delete f[k]);
      Object.entries(patch).forEach(([k, v]) => v === void 0 ? delete f[k] : f[k] = v);
    });
    this.index.reindex(file, next);
  }
  async create(path, fm, body) {
    await this.ensureFolder(parent(path));
    const file = await this.app.vault.create(path, "---\n---\n\n" + (body || "").trim() + "\n");
    await this.app.fileManager.processFrontMatter(file, (f) => Object.assign(f, fm));
    this.index.reindex(file, fm);
    return file;
  }
  sessionFrom(file) {
    if (!file) return null;
    const f = this.index.fm(file);
    if (tags(f).includes("workout") && !file.path.includes("/Log/")) return file;
    return f.workout_id ? this.index.sessionById(f.workout_id)?.file || null : null;
  }
  remaining(file) {
    const f = this.index.fm(file), skipped = new Set((Array.isArray(f.skipped_exercises) ? f.skipped_exercises : []).map(String)), counts = /* @__PURE__ */ new Map();
    this.index.workoutLogs(f.id, false).forEach((l) => {
      if (l.exerciseId && String(l.fm.set_type || "working") !== "warmup") counts.set(l.exerciseId, (counts.get(l.exerciseId) || 0) + 1);
    });
    return planOf(f).map((p) => ({ exercise: this.index.exerciseById(p.exercise_id), ...p, completed: counts.get(p.exercise_id) || 0, remaining: skipped.has(p.exercise_id) ? 0 : Math.max(0, p.sets - (counts.get(p.exercise_id) || 0)) })).filter((x) => x.remaining > 0);
  }
  async createSession(template) {
    const tf = template ? this.index.fm(template) : {}, title = template ? String(tf.workout_title || template.basename) : "Free Workout", slug = String(template?.basename || title).replace(/[\\/:*?"<>|]/g, "-");
    let folder = join(this.plugin.settings.workoutsRoot, day() + " - " + slug), n = 2;
    while (this.app.vault.getAbstractFileByPath(folder)) folder = join(this.plugin.settings.workoutsRoot, day() + " - " + slug + " (" + n++ + ")");
    await this.ensureFolder(join(folder, "Log"));
    const id = uuid(), started = now();
    const file = await this.create(join(folder, slug + ".md"), { schema_version: 3, id, workout_title: title, date: day(), started_at: started, ended_at: null, status: "active", exercise_plan: template ? planOf(tf) : [], skipped_exercises: [], workout_type: template ? String(tf.workout_type || "") : "Custom", workout_place: template ? String(tf.workout_place || "") : "", set_count: 0, working_set_count: 0, exercise_counts: {}, total_volume: 0, timed_seconds: 0, distance_km: 0, pr_count: 0, duration_minutes: 0, cssclasses: ["gym-workout"], tags: ["workout"] }, FENCE + "obsidian-gym-session\n" + FENCE);
    await this.event(file, "workout_start", started);
    return file;
  }
  async event(file, type, at) {
    return this.queue(file, async () => this.create(await this.nextLog(file), { schema_version: 3, id: uuid(), workout_id: String(this.index.fm(file).id), event_type: type, performed_at: at || now(), tags: ["log", "event", type === "workout_start" ? "start" : "end"] }, "# " + (type === "workout_start" ? "Workout start" : "Workout end")));
  }
  prs(cur, h) {
    if (cur.set_type === "warmup" || !h.length) return [];
    h = h.filter((f) => String(f.set_type || "working") !== "warmup");
    if (!h.length) return [];
    const out = [], m = cur.tracking_mode, w = num(cur.weight_kg) || 0, r = num(cur.reps) || 0;
    if (m === "strength" || m === "bodyweight") {
      if (w > Math.max(0, ...h.map((f) => num(f.weight_kg) || 0))) out.push("weight");
      const same = h.filter((f) => Math.abs((num(f.weight_kg) || 0) - w) < 1e-3);
      if (r > Math.max(0, ...same.map((f) => num(f.reps) || 0))) out.push("reps_at_weight");
      if (volume(w, r) > Math.max(0, ...h.map((f) => volume(f.weight_kg, f.reps)))) out.push("set_volume");
      if (e1rm(w, r) > Math.max(0, ...h.map((f) => e1rm(f.weight_kg, f.reps)))) out.push("estimated_1rm");
    } else if (m === "duration" && (num(cur.duration_seconds) || 0) > Math.max(0, ...h.map((f) => num(f.duration_seconds ?? f.duration) || 0))) out.push("duration");
    else if (m === "distance_time") {
      const d = num(cur.distance_km) || 0, t = num(cur.duration_seconds) || 0;
      if (d > Math.max(0, ...h.map((f) => num(f.distance_km) || 0))) out.push("distance");
      const p = t && d ? t / d : Infinity, ps = h.map((f) => {
        const hd = num(f.distance_km) || 0, ht = num(f.duration_seconds) || 0;
        return hd && ht ? ht / hd : Infinity;
      }).filter(Number.isFinite);
      if (ps.length && p < Math.min(...ps)) out.push("pace");
    }
    return out;
  }
  async refreshExercisePrs(id, name, extraWorkoutIds = []) {
    const records = this.index.history(id, name), prior = [], workouts = new Set(extraWorkoutIds.filter(Boolean).map(String));
    for (const rec of records) {
      const x = rec.fm, next = String(x.set_type || "working") === "warmup" ? [] : this.prs(x, prior), old = Array.isArray(x.prs) ? x.prs : [];
      if (old.length !== next.length || old.some((v, i) => v !== next[i])) {
        await this.update(rec.file, { prs: next });
        if (rec.workoutId) workouts.add(String(rec.workoutId));
      }
      prior.push(x);
    }
    for (const wid of workouts) {
      const s = this.index.sessionById(wid);
      if (s) await this.recalc(s.file);
    }
  }
  validateSet(p) {
    const mode = modeOf(p);
    if ((mode === "strength" || mode === "bodyweight") && !(num(p.reps) > 0)) throw new Error("Reps must be greater than 0.");
    if (mode === "duration" && !(num(p.duration_seconds) > 0)) throw new Error("Duration must be greater than 0.");
    if (mode === "distance_time" && (!(num(p.distance_km) > 0) || !(num(p.duration_seconds) > 0))) throw new Error("Distance and duration must be greater than 0.");
  }
  async log(file, p) {
    return this.queue(file, async () => {
      this.validateSet(p);
      const sf = this.index.fm(file);
      if (sf.status === "completed") throw new Error("Workout is completed.");
      const h = this.index.history(p.exercise_id, p.exercise).map((x) => x.fm), pr = p.set_type === "warmup" ? [] : this.prs(p, h), existing = this.index.workoutLogs(sf.id, false);
      const setIndex = Math.max(0, ...existing.map((x) => Number(x.fm.set_index) || 0)) + 1;
      const fm = { schema_version: 3, id: uuid(), workout_id: String(sf.id), set_index: setIndex, exercise_id: String(p.exercise_id), exercise: p.exercise, performed_at: now(), tracking_mode: p.tracking_mode, set_type: p.set_type, effort: p.effort ?? null, note: p.note || "", prs: pr, tags: ["exercise", "log", "set"] };
      ["weight_kg", "reps", "duration_seconds", "distance_km"].forEach((k) => {
        if (p[k] != null) fm[k] = Number(p[k]);
      });
      const log = await this.create(await this.nextLog(file), fm, FENCE + "obsidian-gym-log\n" + FENCE);
      await this.delta(file, fm, pr);
      return { file: log, prs: pr };
    });
  }
  async delta(file, l, prs) {
    const f = this.index.fm(file), working = String(l.set_type || "working") !== "warmup", counts = { ...f.exercise_counts || {} };
    if (working) counts[l.exercise] = Number(counts[l.exercise] || 0) + 1;
    await this.update(file, { set_count: Number(f.set_count || 0) + 1, working_set_count: Number(f.working_set_count || 0) + (working ? 1 : 0), exercise_counts: counts, total_volume: Math.round((Number(f.total_volume || 0) + (working ? volume(l.weight_kg, l.reps) : 0)) * 100) / 100, timed_seconds: Number(f.timed_seconds || 0) + (working ? num(l.duration_seconds) || 0 : 0), distance_km: Math.round((Number(f.distance_km || 0) + (working ? num(l.distance_km) || 0 : 0)) * 1e3) / 1e3, pr_count: Number(f.pr_count || 0) + prs.length });
  }
  async recalc(file) {
    const f = this.index.fm(file), logs = this.index.workoutLogs(f.id, true), sets = logs.filter((l) => !l.eventType), counts = {};
    let work = 0, v = 0, t = 0, d = 0, pr = 0;
    sets.forEach((l) => {
      const x = l.fm;
      if (String(x.set_type || "working") !== "warmup") {
        work++;
        counts[x.exercise] = Number(counts[x.exercise] || 0) + 1;
        v += volume(x.weight_kg, x.reps);
        t += num(x.duration_seconds ?? x.duration) || 0;
        d += num(x.distance_km) || 0;
      }
      pr += Array.isArray(x.prs) ? x.prs.length : 0;
    });
    const start = logs.find((l) => l.eventType === "workout_start")?.performedAt || f.started_at, end = [...logs].reverse().find((l) => l.eventType === "workout_end")?.performedAt || f.ended_at, dur = start ? Math.max(0, Math.round(((end ? new Date(end) : /* @__PURE__ */ new Date()).getTime() - new Date(start).getTime()) / 6e4)) : 0;
    await this.update(file, { set_count: sets.length, working_set_count: work, exercise_counts: counts, total_volume: Math.round(v * 100) / 100, timed_seconds: Math.round(t), distance_km: Math.round(d * 1e3) / 1e3, pr_count: pr, duration_minutes: dur, status: end ? "completed" : "active", started_at: start || null, ended_at: end || null }, ["Logs", "ExerciseCounts", "ExercisesSummary", "Total Volume", "timed_load", "duration"]);
  }
  async finish(file) {
    return this.queue(file, async () => {
      const f = this.index.fm(file);
      if (f.status === "completed") return;
      const end = now();
      await this.create(await this.nextLog(file), { schema_version: 3, id: uuid(), workout_id: String(f.id), event_type: "workout_end", performed_at: end, tags: ["log", "event", "end"] }, "# Workout end");
      await this.update(file, { status: "completed", ended_at: end, duration_minutes: Math.max(0, Math.round((new Date(end).getTime() - new Date(f.started_at || end).getTime()) / 6e4)) });
    });
  }
  async delSet(file, log) {
    return this.queue(file, async () => {
      const x = this.index.fm(log), wid = String(this.index.fm(file).id || "");
      const p = log.path;
      await this.app.fileManager.trashFile(log);
      this.index.remove(p);
      await this.refreshExercisePrs(x.exercise_id, x.exercise, [wid]);
    });
  }
  async editSet(file, log, patch, del = []) {
    return this.queue(file, async () => {
      const current = this.index.fm(log), next = { ...current, ...patch };
      del.forEach((k) => delete next[k]);
      this.validateSet(next);
      const history = this.index.history(next.exercise_id, next.exercise).filter((x) => x.file.path !== log.path).map((x) => x.fm);
      const prs = String(next.set_type || "working") === "warmup" ? [] : this.prs(next, history);
      await this.update(log, { ...patch, prs }, del);
      await this.refreshExercisePrs(next.exercise_id, next.exercise, [String(this.index.fm(file).id || "")]);
    });
  }
  async undo(file) {
    return this.queue(file, async () => {
      const a = this.index.workoutLogs(this.index.fm(file).id, false), l = a.at(-1);
      if (!l) return false;
      const x = l.fm, wid = String(this.index.fm(file).id || ""), p = l.file.path;
      await this.app.fileManager.trashFile(l.file);
      this.index.remove(p);
      await this.refreshExercisePrs(x.exercise_id, x.exercise, [wid]);
      return true;
    });
  }
  async repeat(file, log) {
    const f = this.index.fm(log), e = this.index.exerciseById(f.exercise_id) || this.index.exerciseByName(f.exercise);
    if (!e) throw new Error("Exercise not found.");
    return this.log(file, { exercise_id: e.id, exercise: e.name, tracking_mode: modeOf(f), set_type: f.set_type || "working", weight_kg: num(f.weight_kg), reps: num(f.reps), duration_seconds: num(f.duration_seconds), distance_km: num(f.distance_km), effort: num(f.effort), note: String(f.note || "") });
  }
  async skip(file, id) {
    return this.queue(file, async () => {
      const f = this.index.fm(file), s = new Set((Array.isArray(f.skipped_exercises) ? f.skipped_exercises : []).map(String));
      s.add(String(id));
      await this.update(file, { skipped_exercises: [...s] });
    });
  }
  async next(file, id) {
    return this.queue(file, async () => {
      const f = this.index.fm(file), p = planOf(f), i = p.findIndex((x2) => x2.exercise_id === String(id));
      if (i <= 0) return;
      const x = p.splice(i, 1)[0];
      p.unshift(x);
      await this.update(file, { exercise_plan: p });
    });
  }
  async replace(file, from, to) {
    return this.queue(file, async () => {
      const f = this.index.fm(file), p = planOf(f), counts = /* @__PURE__ */ new Map();
      this.index.workoutLogs(f.id, false).forEach((l) => {
        if (l.exerciseId && String(l.fm.set_type || "working") !== "warmup") counts.set(l.exerciseId, (counts.get(l.exerciseId) || 0) + 1);
      });
      const out = [];
      let n = 0;
      p.forEach((x) => {
        if (x.exercise_id !== String(from)) {
          out.push(x);
          return;
        }
        const c = Math.min(x.sets, counts.get(x.exercise_id) || 0);
        if (c) out.push({ exercise_id: x.exercise_id, sets: c });
        n += Math.max(0, x.sets - c);
      });
      if (n) {
        const e = out.find((x) => x.exercise_id === String(to));
        if (e) e.sets += n;
        else out.push({ exercise_id: String(to), sets: n });
      }
      await this.update(file, { exercise_plan: out });
    });
  }
  async createExercise(x) {
    const name = x.name.includes(" - ") ? x.name : x.muscle + " - " + x.name, path = join(this.plugin.settings.exercisesRoot, x.muscle, name.replace(/[\\/:*?"<>|]/g, "-") + ".md");
    if (this.app.vault.getAbstractFileByPath(path)) throw new Error("Exercise already exists.");
    const f = { schema_version: 3, id: uuid(), exercise: name, muscle_group: x.muscle, equipment: x.equipment, tracking_mode: x.mode, default_rest_seconds: Math.max(0, Number(x.rest ?? this.plugin.settings.defaultRestSeconds)), instructions: x.instructions || "", aliases: [], tags: ["exercise"] };
    if (x.reps != null) f.default_reps = Number(x.reps);
    if (x.weight != null) f.default_weight_kg = Number(x.weight);
    if (x.duration != null) f.default_duration_seconds = Number(x.duration);
    if (x.distance != null) f.default_distance_km = Number(x.distance);
    return this.create(path, f, FENCE + "obsidian-gym-exercise\n" + FENCE);
  }
  async createRoutine(x) {
    const slug = x.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workout-" + uuid().slice(0, 8), path = join(this.plugin.settings.workoutTemplatesRoot, "gym", slug + ".md");
    if (this.app.vault.getAbstractFileByPath(path)) throw new Error("Routine already exists.");
    return this.create(path, { schema_version: 3, workout_title: x.name, exercise_plan: x.plan, workout_type: x.type, workout_place: x.place, tags: ["workout"] }, "# " + x.name + "\n\n" + FENCE + "obsidian-gym-routine\n" + FENCE);
  }
  async nextLog(file) {
    const folder = join(parent(file.path), "Log");
    await this.ensureFolder(folder);
    let n = Math.max(0, ...this.index.workoutLogs(this.index.fm(file).id, true).map((x) => Number(x.file.basename)).filter(Number.isFinite)) + 1;
    for (; ; n++) {
      const p = join(folder, String(n).padStart(3, "0") + ".md");
      if (!this.app.vault.getAbstractFileByPath(p)) return p;
    }
  }
  async queue(file, fn) {
    const key = String(this.index.fm(file).id || file.path), prev = this.queues.get(key) || Promise.resolve(), next = prev.catch(() => {
    }).then(fn), stored = next.then(() => {
    }, () => {
    });
    this.queues.set(key, stored);
    try {
      return await next;
    } finally {
      if (this.queues.get(key) === stored) this.queues.delete(key);
    }
  }
};

// plugin-src/ui.ts
var import_obsidian2 = require("obsidian");
var Choice = class extends import_obsidian2.FuzzySuggestModal {
  constructor(app, items, label, onChoose, text) {
    super(app);
    this.items = items;
    this.label = label;
    this.cb = onChoose;
    this.text = text || ((x) => String(x));
    this.setPlaceholder(label);
  }
  getItems() {
    return this.items;
  }
  getItemText(x) {
    return this.text(x);
  }
  onChooseItem(x) {
    this.cb(x);
  }
};
function field(root, label, value, type) {
  const wrap = root.createDiv({ cls: "gym-field" });
  wrap.createEl("label", { text: label });
  const input = type === "textarea" ? wrap.createEl("textarea") : wrap.createEl("input", { attr: { type: type || "text" } });
  input.value = value == null ? "" : String(value);
  return input;
}
function selectField(root, label, values, current) {
  const wrap = root.createDiv({ cls: "gym-field" });
  wrap.createEl("label", { text: label });
  const s = wrap.createEl("select");
  values.forEach((v) => {
    const o = s.createEl("option", { text: String(v) });
    o.value = String(v);
    if (String(v) === String(current)) o.selected = true;
  });
  return s;
}
var LogModal = class extends import_obsidian2.Modal {
  constructor(plugin, file, pre = null) {
    super(plugin.app);
    this.p = plugin;
    this.file = file;
    this.pre = pre;
  }
  onOpen() {
    this.render();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h2", { text: "Log set" });
    const ex = this.p.index.exercisesList(), remaining = this.p.gym.remaining(this.file), first = this.pre || remaining[0]?.exercise || ex[0];
    if (!first) {
      c.createEl("p", { text: "No exercises in library." });
      return;
    }
    const exSel = selectField(c, "Exercise", ex.map((x) => x.name), first.name), typeSel = selectField(c, "Set type", ["working", "warmup", "drop", "failure"], "working");
    const previous = c.createDiv({ cls: "gym-previous" }), metrics = c.createDiv();
    const effort = selectField(c, "Effort", ["", "1", "2", "3", "4", "5"], ""), note = field(c, "Note", "", "textarea");
    let controls = {};
    const build = () => {
      metrics.empty();
      previous.empty();
      const e = ex.find((x) => x.name === exSel.value) || first, last = this.p.index.latest(e.id, e.name)?.fm || {}, mode = e.trackingMode;
      previous.createEl("small", { text: last.exercise ? "Previous: " + metricText(last) : "No previous set" });
      controls = { exercise: e };
      if (mode === "strength" || mode === "bodyweight") {
        const w = field(metrics, "Weight (kg)", last.weight_kg ?? e.fm.default_weight_kg ?? "", "number"), r = field(metrics, "Reps", last.reps ?? e.fm.default_reps ?? "", "number");
        controls.weight = w;
        controls.reps = r;
        const row = metrics.createDiv({ cls: "gym-quick-row" });
        [-this.p.settings.weightStepKg, 0, this.p.settings.weightStepKg].forEach((delta) => {
          const b = row.createEl("button", { text: delta === 0 ? "Same" : (delta > 0 ? "+" : "") + delta + " kg" });
          b.onclick = () => {
            const base = num(last.weight_kg) ?? num(w.value) ?? 0;
            w.value = String(Math.max(0, base + delta));
          };
        });
        ["-1", "+1"].forEach((x) => {
          const b = row.createEl("button", { text: x + " rep" });
          b.onclick = () => {
            r.value = String(Math.max(1, (num(r.value) || num(last.reps) || 0) + (x === "+1" ? 1 : -1)));
          };
        });
      } else if (mode === "duration") {
        controls.duration = field(metrics, "Duration (seconds)", last.duration_seconds ?? e.fm.default_duration_seconds ?? 30, "number");
        if (e.fm.default_weight_kg != null) controls.weight = field(metrics, "Weight (kg)", last.weight_kg ?? e.fm.default_weight_kg, "number");
      } else {
        controls.distance = field(metrics, "Distance (km)", last.distance_km ?? e.fm.default_distance_km ?? "", "number");
        controls.duration = field(metrics, "Duration (seconds)", last.duration_seconds ?? e.fm.default_duration_seconds ?? "", "number");
      }
    };
    exSel.onchange = build;
    build();
    const actions = c.createDiv({ cls: "gym-actions" }), cancel = actions.createEl("button", { text: "Cancel" }), save = actions.createEl("button", { text: "Log set", cls: "mod-cta" });
    cancel.onclick = () => this.close();
    save.onclick = async () => {
      try {
        const e = controls.exercise, p = { exercise_id: e.id, exercise: e.name, tracking_mode: e.trackingMode, set_type: typeSel.value, weight_kg: controls.weight ? num(controls.weight.value) : null, reps: controls.reps ? num(controls.reps.value) : null, duration_seconds: controls.duration ? num(controls.duration.value) : null, distance_km: controls.distance ? num(controls.distance.value) : null, effort: num(effort.value), note: note.value.trim() };
        if ((e.trackingMode === "strength" || e.trackingMode === "bodyweight") && !(p.reps > 0)) throw new Error("Reps must be greater than 0.");
        if (e.trackingMode === "duration" && !(p.duration_seconds > 0)) throw new Error("Duration must be greater than 0.");
        if (e.trackingMode === "distance_time" && (!(p.distance_km > 0) || !(p.duration_seconds > 0))) throw new Error("Distance and duration must be greater than 0.");
        const result = await this.p.gym.log(this.file, p);
        const rest = Math.max(0, num(e.fm.default_rest_seconds) ?? this.p.settings.defaultRestSeconds);
        if (rest) this.p.timer.start(rest);
        new import_obsidian2.Notice("Logged " + e.name + (result.prs.length ? " \xB7 PR: " + result.prs.join(", ") : ""));
        this.close();
      } catch (e) {
        new import_obsidian2.Notice("Could not log set: " + e.message);
      }
    };
  }
};
var EditModal = class extends import_obsidian2.Modal {
  constructor(plugin, workout, log, onDone) {
    super(plugin.app);
    this.p = plugin;
    this.workout = workout;
    this.log = log;
    this.onDone = onDone;
  }
  onOpen() {
    const c = this.contentEl, f = this.p.index.fm(this.log), m = modeOf(f);
    c.empty();
    c.createEl("h2", { text: "Edit set" });
    const type = selectField(c, "Set type", ["working", "warmup", "drop", "failure"], f.set_type || "working"), effort = selectField(c, "Effort", ["", "1", "2", "3", "4", "5"], f.effort ?? ""), note = field(c, "Note", f.note || "", "textarea"), controls = {};
    if (m === "strength" || m === "bodyweight") {
      controls.weight = field(c, "Weight (kg)", f.weight_kg ?? "", "number");
      controls.reps = field(c, "Reps", f.reps ?? "", "number");
    } else if (m === "duration") {
      controls.duration = field(c, "Duration (seconds)", f.duration_seconds ?? f.duration ?? "", "number");
      if (f.weight_kg != null) controls.weight = field(c, "Weight (kg)", f.weight_kg, "number");
    } else {
      controls.distance = field(c, "Distance (km)", f.distance_km ?? "", "number");
      controls.duration = field(c, "Duration (seconds)", f.duration_seconds ?? "", "number");
    }
    const a = c.createDiv({ cls: "gym-actions" });
    a.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    a.createEl("button", { text: "Save", cls: "mod-cta" }).onclick = async () => {
      try {
        await this.p.gym.editSet(this.workout, this.log, { set_type: type.value, effort: num(effort.value), note: note.value.trim(), weight_kg: controls.weight ? num(controls.weight.value) : void 0, reps: controls.reps ? num(controls.reps.value) : void 0, duration_seconds: controls.duration ? num(controls.duration.value) : void 0, distance_km: controls.distance ? num(controls.distance.value) : void 0 }, ["weight", "duration", "date"]);
        this.close();
        if (this.onDone) this.onDone();
      } catch (e) {
        new import_obsidian2.Notice("Could not edit set: " + e.message);
      }
    };
  }
};
var ExerciseModal = class extends import_obsidian2.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.p = plugin;
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h2", { text: "Add exercise" });
    let cats = { muscleGroups: ["Others"], equipment: ["Bodyweight"] };
    try {
      const cf = this.app.vault.getAbstractFileByPath(join(this.p.settings.exercisesRoot, "_library/categories.json"));
      if (cf instanceof import_obsidian2.TFile) {
        const a2 = JSON.parse(await this.app.vault.cachedRead(cf));
        cats = { muscleGroups: Object.values(a2.muscleGroups || {}).map((x) => x.name), equipment: a2.equipment || [] };
      }
    } catch {
    }
    const name = field(c, "Name", ""), muscle = selectField(c, "Muscle group", cats.muscleGroups, "Others"), equipment = selectField(c, "Equipment", cats.equipment, "Bodyweight"), mode = selectField(c, "Tracking", ["strength", "bodyweight", "duration", "distance_time"], "strength"), defaults = c.createDiv(), rest = field(c, "Rest seconds", this.p.settings.defaultRestSeconds, "number"), instructions = field(c, "Instructions", "", "textarea");
    let d = {};
    const rebuild = () => {
      defaults.empty();
      d = {};
      if (mode.value === "strength" || mode.value === "bodyweight") {
        d.weight = field(defaults, "Default weight kg", "", "number");
        d.reps = field(defaults, "Default reps", 8, "number");
      } else if (mode.value === "duration") d.duration = field(defaults, "Default duration seconds", 30, "number");
      else {
        d.distance = field(defaults, "Default distance km", "", "number");
        d.duration = field(defaults, "Default duration seconds", "", "number");
      }
    };
    mode.onchange = rebuild;
    rebuild();
    const a = c.createDiv({ cls: "gym-actions" }), save = a.createEl("button", { text: "Create", cls: "mod-cta" });
    a.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    save.onclick = async () => {
      try {
        if (!name.value.trim()) throw new Error("Exercise name is required.");
        if (!muscle.value) throw new Error("Muscle group is required.");
        const f = await this.p.gym.createExercise({ name: name.value.trim(), muscle: muscle.value, equipment: equipment.value, mode: mode.value, weight: d.weight ? num(d.weight.value) : null, reps: d.reps ? num(d.reps.value) : null, duration: d.duration ? num(d.duration.value) : null, distance: d.distance ? num(d.distance.value) : null, rest: num(rest.value), instructions: instructions.value.trim() });
        this.close();
        await this.app.workspace.getLeaf(false).openFile(f);
      } catch (e) {
        new import_obsidian2.Notice(e.message);
      }
    };
  }
};
var RoutineModal = class extends import_obsidian2.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.p = plugin;
    this.rows = [];
  }
  onOpen() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h2", { text: "Create routine" });
    const name = field(c, "Name", ""), type = field(c, "Workout type", "Weight Training"), place = field(c, "Place", "Gym"), list = c.createDiv({ cls: "gym-routine-editor" });
    const draw = () => {
      list.empty();
      this.rows.forEach((r, i) => {
        const row = list.createDiv({ cls: "gym-routine-row" });
        row.createSpan({ text: r.exercise.name });
        const sets = row.createEl("input", { attr: { type: "number", min: "1" } });
        sets.value = String(r.sets);
        sets.onchange = () => r.sets = Math.max(1, Number(sets.value) || 1);
        row.createEl("button", { text: "\u2191" }).onclick = () => {
          if (i) {
            [this.rows[i - 1], this.rows[i]] = [this.rows[i], this.rows[i - 1]];
            draw();
          }
        };
        row.createEl("button", { text: "\u2193" }).onclick = () => {
          if (i < this.rows.length - 1) {
            [this.rows[i + 1], this.rows[i]] = [this.rows[i], this.rows[i + 1]];
            draw();
          }
        };
        row.createEl("button", { text: "\xD7" }).onclick = () => {
          this.rows.splice(i, 1);
          draw();
        };
      });
    };
    c.createEl("button", { text: "\uFF0B Add exercise" }).onclick = () => new Choice(this.app, this.p.index.exercisesList(), "Choose exercise", (e) => {
      const found = this.rows.find((r) => r.exercise.id === e.id);
      if (found) found.sets++;
      else this.rows.push({ exercise: e, sets: 3 });
      draw();
    }, (e) => e.name).open();
    draw();
    const a = c.createDiv({ cls: "gym-actions" });
    a.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    a.createEl("button", { text: "Save routine", cls: "mod-cta" }).onclick = async () => {
      try {
        if (!name.value.trim() || !this.rows.length) throw new Error("Name and at least one exercise are required.");
        const f = await this.p.gym.createRoutine({ name: name.value.trim(), type: type.value.trim(), place: place.value.trim(), plan: this.rows.map((r) => ({ exercise_id: r.exercise.id, sets: r.sets })) });
        this.close();
        await this.app.workspace.getLeaf(false).openFile(f);
      } catch (e) {
        new import_obsidian2.Notice(e.message);
      }
    };
  }
};
function metricText(f) {
  const m = modeOf(f);
  if (m === "strength" || m === "bodyweight") return (f.weight_kg != null ? f.weight_kg + " kg \xD7 " : "") + String(f.reps ?? "\u2014");
  if (m === "duration") return String(f.duration_seconds ?? f.duration ?? "\u2014") + " sec";
  return String(f.distance_km ?? "\u2014") + " km \xB7 " + String(f.duration_seconds ?? "\u2014") + " sec";
}
function button(root, text, fn, cta = false) {
  const b = root.createEl("button", { text, cls: cta ? "mod-cta" : "" });
  b.onclick = async () => {
    b.disabled = true;
    try {
      await fn();
    } finally {
      b.disabled = false;
    }
  };
  return b;
}
function table(root, headers, rows) {
  const t = root.createEl("table", { cls: "gym-table" }), h = t.createEl("thead").createEl("tr");
  headers.forEach((x) => h.createEl("th", { text: x }));
  const body = t.createEl("tbody");
  rows.forEach((r) => {
    const tr = body.createEl("tr");
    r.forEach((x) => {
      const td = tr.createEl("td");
      if (x instanceof Node) td.appendChild(x);
      else td.setText(String(x ?? ""));
    });
  });
  return t;
}

// plugin-src/main.ts
var SettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.p = plugin;
  }
  display() {
    const c = this.containerEl;
    c.empty();
    c.createEl("h2", { text: "Obsidian Gym" });
    const text = (name, desc, key) => new import_obsidian3.Setting(c).setName(name).setDesc(desc).addText((t) => t.setValue(String(this.p.settings[key])).onChange(async (v) => {
      if (["exercisesRoot", "workoutTemplatesRoot", "workoutsRoot"].includes(key) && !this.p.settings.previousPaths) this.p.settings.previousPaths = { exercisesRoot: this.p.settings.exercisesRoot, workoutTemplatesRoot: this.p.settings.workoutTemplatesRoot, workoutsRoot: this.p.settings.workoutsRoot };
      this.p.settings[key] = norm(v) || DEFAULTS[key];
      await this.p.saveSettings();
      this.p.index.rebuild();
    }));
    text("Exercises root", "Exercise definitions and category JSON.", "exercisesRoot");
    text("Workout templates root", "Saved routines.", "workoutTemplatesRoot");
    text("Workouts root", "Generated sessions and logs.", "workoutsRoot");
    text("Home note", "Note opened by Gym: Open home.", "homeNote");
    new import_obsidian3.Setting(c).setName("Open home on startup").addToggle((t) => t.setValue(!!this.p.settings.openHomeOnStartup).onChange(async (v) => {
      this.p.settings.openHomeOnStartup = v;
      await this.p.saveSettings();
    }));
    new import_obsidian3.Setting(c).setName("Default rest seconds").addText((t) => t.setValue(String(this.p.settings.defaultRestSeconds)).onChange(async (v) => {
      this.p.settings.defaultRestSeconds = Math.max(0, Number(v) || 0);
      await this.p.saveSettings();
    }));
    new import_obsidian3.Setting(c).setName("Weight adjustment step").addText((t) => t.setValue(String(this.p.settings.weightStepKg)).onChange(async (v) => {
      this.p.settings.weightStepKg = Math.max(0.1, Number(v) || 2.5);
      await this.p.saveSettings();
    }));
    new import_obsidian3.Setting(c).setName("Path migration").setDesc("Move existing files from the previously saved roots into the current roots.").addButton((b) => b.setButtonText("Preview").onClick(() => this.p.previewPathMigration())).addButton((b) => b.setButtonText("Migrate").setDestructive().onClick(() => this.p.migratePaths()));
    new import_obsidian3.Setting(c).setName("Data migration").setDesc("Creates a vault backup before rewriting legacy gym metadata to schema v3.").addButton((b) => b.setButtonText("Migrate to v3").setDestructive().onClick(() => this.p.migrateV3()));
  }
};
var ObsidianGym = class extends import_obsidian3.Plugin {
  async onload() {
    await this.loadSettings();
    this.index = new IndexService(this);
    this.gym = new GymService(this, this.index);
    this.timer = new TimerService(() => new import_obsidian3.Notice("Rest finished"));
    this.addSettingTab(new SettingsTab(this));
    this.registerCommands();
    this.registerRenderers();
    this.app.workspace.onLayoutReady(() => {
      this.index.rebuild();
      this.index.register();
      if (this.settings.openHomeOnStartup) this.openHome();
    });
  }
  onunload() {
    this.timer.destroy();
  }
  async loadSettings() {
    const raw = await this.loadData() || {};
    this.settings = { ...DEFAULTS, ...raw, exercisesRoot: norm(raw.exercisesRoot || DEFAULTS.exercisesRoot), workoutTemplatesRoot: norm(raw.workoutTemplatesRoot || DEFAULTS.workoutTemplatesRoot), workoutsRoot: norm(raw.workoutsRoot || DEFAULTS.workoutsRoot) };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async openHome() {
    const p = norm(this.settings.homeNote);
    const file = this.app.vault.getAbstractFileByPath(p.endsWith(".md") ? p : p + ".md");
    if (file instanceof import_obsidian3.TFile) await this.app.workspace.getLeaf(false).openFile(file);
  }
  activeWorkout() {
    return this.gym.sessionFrom(this.app.workspace.getActiveFile());
  }
  registerCommands() {
    this.addCommand({ id: "open-home", name: "Open home", callback: () => this.openHome() });
    this.addCommand({ id: "start-workout", name: "Start workout", callback: () => this.chooseRoutine() });
    this.addCommand({ id: "start-free-workout", name: "Start free workout", callback: async () => this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(null)) });
    this.addCommand({ id: "log-set", name: "Log set", checkCallback: (checking) => {
      const f = this.activeWorkout();
      if (!f) return false;
      if (!checking) new LogModal(this, f).open();
      return true;
    } });
    this.addCommand({ id: "create-exercise", name: "Create exercise", callback: () => new ExerciseModal(this).open() });
    this.addCommand({ id: "create-routine", name: "Create routine", callback: () => new RoutineModal(this).open() });
    this.addCommand({ id: "finish-workout", name: "Finish active workout", checkCallback: (checking) => {
      const f = this.activeWorkout();
      if (!f) return false;
      if (!checking) this.gym.finish(f).then(() => new import_obsidian3.Notice("Workout finished"));
      return true;
    } });
    this.addCommand({ id: "undo-last-set", name: "Undo last set", checkCallback: (checking) => {
      const f = this.activeWorkout();
      if (!f) return false;
      if (!checking) this.gym.undo(f).then((ok) => new import_obsidian3.Notice(ok ? "Last set removed" : "No set to undo"));
      return true;
    } });
    this.addCommand({ id: "recalculate-all", name: "Recalculate all workout metrics", callback: async () => {
      for (const s of this.index.sessionsList()) await this.gym.recalc(s.file);
      new import_obsidian3.Notice("Workout metrics rebuilt");
    } });
    this.addCommand({ id: "audit-data", name: "Audit gym data", callback: () => this.audit() });
    this.addCommand({ id: "migrate-schema-v3", name: "Migrate gym data to schema v3", callback: () => this.migrateV3() });
    this.addCommand({ id: "preview-path-migration", name: "Preview gym path migration", callback: () => this.previewPathMigration() });
    this.addCommand({ id: "migrate-paths", name: "Migrate gym paths", callback: () => this.migratePaths() });
  }
  chooseRoutine() {
    new Choice(this.app, this.index.routinesList(), "Start workout", async (r) => this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(r.file)), (r) => String(r.fm.workout_title || r.file.basename)).open();
  }
  registerRenderers() {
    const reg = (lang, fn) => this.registerMarkdownCodeBlockProcessor(lang, (_src, el, ctx) => fn.call(this, el, ctx.sourcePath));
    reg("obsidian-gym-home", this.renderHome);
    reg("obsidian-gym-create", this.renderCreate);
    reg("obsidian-gym-session", this.renderSession);
    reg("obsidian-gym-exercise", this.renderExercise);
    reg("obsidian-gym-analytics", this.renderAnalytics);
    reg("obsidian-gym-recovery", this.renderRecovery);
    reg("obsidian-gym-routine", this.renderRoutine);
    reg("obsidian-gym-log", this.renderLog);
    this.registerMarkdownCodeBlockProcessor("dataviewjs", (src, el, ctx) => {
      const lower = String(src || "").toLowerCase(), legacyGym = lower.includes("customjs") && (lower.includes("workout") || lower.includes("exercise") || lower.includes("stats") || lower.includes("timer"));
      if (!legacyGym) {
        const pre2 = el.createEl("pre"), code2 = pre2.createEl("code");
        code2.setText(src);
        return;
      }
      const f = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!(f instanceof import_obsidian3.TFile)) return;
      const fm = this.index.fm(f);
      if (ctx.sourcePath === "Home.md") return this.renderHome(el, ctx.sourcePath);
      if (ctx.sourcePath === "Data Visualization.md") return this.renderAnalytics(el, ctx.sourcePath);
      if (ctx.sourcePath === "Recovery.md") return this.renderRecovery(el, ctx.sourcePath);
      if (tags(fm).includes("workout") && inside(f.path, this.settings.workoutsRoot) && !f.path.includes("/Log/")) return this.renderSession(el, ctx.sourcePath);
      if (tags(fm).includes("exercise") && !fm.workout_id) return this.renderExercise(el, ctx.sourcePath);
      const pre = el.createEl("pre"), code = pre.createEl("code");
      code.setText(src);
    });
  }
  fileAt(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof import_obsidian3.TFile ? f : null;
  }
  renderCreate(el) {
    el.empty();
    const a = el.createDiv({ cls: "gym-actions" });
    button(a, "\uFF0B Add exercise", () => new ExerciseModal(this).open(), true);
    button(a, "\uFF0B Create routine", () => new RoutineModal(this).open(), true);
  }
  renderHome(el, _path = null) {
    el.empty();
    const active = this.index.activeSessions(), actions = el.createDiv({ cls: "gym-actions" });
    if (active.length) button(actions, "\u25B6 Resume " + String(active[0].fm.workout_title || active[0].file.basename), () => this.app.workspace.getLeaf(false).openFile(active[0].file), true);
    else button(actions, "\u25B6 Start workout", () => this.chooseRoutine(), true);
    button(actions, "\uFF0B Free workout", async () => this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(null)));
    button(actions, "\uFF0B Exercise", () => new ExerciseModal(this).open());
    button(actions, "\uFF0B Routine", () => new RoutineModal(this).open());
    const sessions = this.index.sessionsList(), week = Date.now() - 7 * 864e5, recentWeek = sessions.filter((s) => new Date(s.fm.started_at || s.fm.date || 0).getTime() >= week);
    el.createEl("h3", { text: "This week" });
    table(el, ["Sessions", "Working sets", "Volume", "Time"], [[recentWeek.length, recentWeek.reduce((a, s) => a + Number(s.fm.working_set_count || 0), 0), Math.round(recentWeek.reduce((a, s) => a + Number(s.fm.total_volume || s.fm["Total Volume"] || 0), 0)) + " kg\xD7reps", recentWeek.reduce((a, s) => a + Number(s.fm.duration_minutes || 0), 0) + " min"]]);
    el.createEl("h3", { text: "Recent" });
    table(el, ["Workout", "Date", "Sets", "Volume"], sessions.slice(0, 5).map((s) => [s.fm.workout_title || s.file.basename, s.fm.date || "", s.fm.working_set_count || 0, Math.round(Number(s.fm.total_volume || s.fm["Total Volume"] || 0))]));
  }
  renderTimer(root) {
    const box = root.createDiv({ cls: "gym-timer" }), display = box.createDiv({ cls: "gym-timer-display" }), controls = box.createDiv({ cls: "gym-actions" });
    [30, 60, 90, 120].forEach((s) => button(controls, s + "s", () => this.timer.start(s)));
    button(controls, "Stopwatch", () => this.timer.stopwatch());
    button(controls, "Pause / resume", () => {
      const s = this.timer.snapshot();
      s.paused ? this.timer.resume() : this.timer.pause();
    });
    button(controls, "Reset", () => this.timer.reset());
    let unsubscribe = () => {
    };
    const update = (s) => {
      if (!display.isConnected) {
        unsubscribe();
        return;
      }
      display.setText((s.mode === "stopwatch" ? "Stopwatch " : "Rest ") + formatSeconds(s.seconds));
    };
    unsubscribe = this.timer.subscribe(update);
  }
  renderSession(el, path) {
    const file = this.fileAt(path);
    if (!file) return;
    const draw = () => {
      el.empty();
      const f = this.index.fm(file);
      el.createEl("h2", { text: String(f.workout_title || file.basename) });
      el.createEl("p", { text: [f.status, f.workout_type, f.workout_place].filter(Boolean).join(" \xB7 "), cls: "gym-muted" });
      const a = el.createDiv({ cls: "gym-actions" });
      if (f.status !== "completed") {
        button(a, "Log set", () => new LogModal(this, file).open(), true);
        button(a, "Undo", async () => {
          await this.gym.undo(file);
          draw();
        });
        button(a, "Finish", async () => {
          await this.gym.finish(file);
          draw();
        });
      }
      this.renderTimer(el);
      const remaining = this.gym.remaining(file);
      el.createEl("h3", { text: "Remaining" });
      if (!remaining.length) el.createEl("p", { text: planOf(f).length ? "All planned sets complete." : "Free workout \u2014 choose any exercise." });
      else remaining.forEach((x) => {
        const row = el.createDiv({ cls: "gym-set-row" });
        row.createSpan({ text: (x.exercise?.name || x.exercise_id) + " \xB7 " + x.completed + "/" + x.sets + " \xB7 " + x.remaining + " left" });
        button(row, "Next", async () => {
          await this.gym.next(file, x.exercise_id);
          draw();
        });
        button(row, "Skip", async () => {
          await this.gym.skip(file, x.exercise_id);
          draw();
        });
        button(row, "Replace", () => new Choice(this.app, this.index.exercisesList(), "Replace with", async (e) => {
          await this.gym.replace(file, x.exercise_id, e.id);
          draw();
        }, (e) => e.name).open());
      });
      const logs = this.index.workoutLogs(f.id, false).slice().reverse();
      el.createEl("h3", { text: "Sets" });
      logs.slice(0, 30).forEach((l) => {
        const row = el.createDiv({ cls: "gym-set-row" });
        row.createSpan({ text: String(l.fm.exercise || "") + " \xB7 " + metricText(l.fm) + (l.fm.set_type && l.fm.set_type !== "working" ? " \xB7 " + l.fm.set_type : "") });
        button(row, "\u21BB", async () => {
          await this.gym.repeat(file, l.file);
          draw();
        });
        button(row, "Edit", () => new EditModal(this, file, l.file, draw).open());
        button(row, "\xD7", async () => {
          await this.gym.delSet(file, l.file);
          draw();
        });
      });
    };
    draw();
  }
  renderExercise(el, path) {
    const file = this.fileAt(path);
    if (!file) return;
    const f = this.index.fm(file), e = this.index.exerciseById(f.id) || this.index.exerciseByName(f.exercise), h = this.index.history(e?.id, f.exercise), working = h.filter((x) => String(x.fm.set_type || "working") !== "warmup");
    el.empty();
    if (f.instructions) {
      el.createEl("h3", { text: "Instructions" });
      el.createEl("p", { text: String(f.instructions) });
    }
    if (!working.length) return;
    const last = working.at(-1)?.fm || {}, week = Date.now() - 7 * 864e5, bestW = Math.max(0, ...working.map((x) => num(x.fm.weight_kg) || 0)), bestR = Math.max(0, ...working.map((x) => num(x.fm.reps) || 0)), best1 = Math.max(0, ...working.map((x) => e1rm(x.fm.weight_kg, x.fm.reps)));
    el.createEl("h3", { text: "Progress" });
    table(el, ["Last", "Best weight", "Best reps", "Est. 1RM", "Sets 7d"], [[metricText(last), bestW ? bestW + " kg" : "\u2014", bestR || "\u2014", best1 ? best1.toFixed(1) + " kg" : "\u2014", working.filter((x) => new Date(x.performedAt).getTime() >= week).length]]);
    el.createEl("h3", { text: "Recent" });
    table(el, ["When", "Set", "Type", "Effort"], working.slice(-10).reverse().map((x) => [(0, import_obsidian3.moment)(x.performedAt).format("YYYY-MM-DD HH:mm"), metricText(x.fm), x.fm.set_type || "working", x.fm.effort ?? "\u2014"]));
  }
  spark(root, title, values, labels) {
    root.createEl("h3", { text: title });
    if (values.length < 2) {
      root.createEl("p", { text: "Not enough data.", cls: "gym-muted" });
      return;
    }
    const w = 640, h = 180, p = 18, max = Math.max(...values, 1), min = Math.min(...values, 0), range = Math.max(1, max - min), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.classList.add("gym-chart");
    const pts = values.map((v, i) => {
      const x = p + (w - 2 * p) * (i / (values.length - 1)), y = h - p - (h - 2 * p) * ((v - min) / range);
      return x + "," + y;
    }).join(" ");
    const line = document.createElementNS(svg.namespaceURI, "polyline");
    line.setAttribute("points", pts);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
    root.appendChild(svg);
    root.createEl("small", { text: (labels[0] || "") + " \u2192 " + (labels.at(-1) || ""), cls: "gym-muted" });
  }
  renderAnalytics(el, _path = null) {
    el.empty();
    const s = [...this.index.sessionsList()].reverse(), dates = s.map((x) => String(x.fm.date || "")), vol = s.map((x) => Number(x.fm.total_volume || x.fm["Total Volume"] || 0)), dur = s.map((x) => Number(x.fm.duration_minutes || 0));
    this.spark(el, "Training volume", vol, dates);
    this.spark(el, "Workout duration", dur, dates);
    el.createEl("h3", { text: "Recent sessions" });
    table(el, ["Workout", "Date", "Sets", "Volume", "Duration"], s.slice(-12).reverse().map((x) => [x.fm.workout_title || x.file.basename, x.fm.date || "", x.fm.working_set_count || 0, Math.round(Number(x.fm.total_volume || x.fm["Total Volume"] || 0)), Number(x.fm.duration_minutes || 0) + " min"]));
  }
  renderRecovery(el, _path = null) {
    el.empty();
    el.createEl("p", { text: "Time since each muscle group was last logged. This is a history cue, not a physiological readiness score.", cls: "gym-muted" });
    const last = /* @__PURE__ */ new Map();
    this.index.allLogs().forEach((l) => {
      const e = this.index.exerciseById(l.exerciseId) || this.index.exerciseByName(l.exerciseName), g = e?.fm.muscle_group;
      if (!g) return;
      const t = new Date(l.performedAt).getTime();
      if (!last.has(g) || t > last.get(g)) last.set(g, t);
    });
    const grid = el.createDiv({ cls: "gym-recovery-grid" });
    [...new Set(this.index.exercisesList().map((e) => e.fm.muscle_group).filter(Boolean))].sort().forEach((g) => {
      const card = grid.createDiv({ cls: "gym-recovery-card" });
      card.createEl("strong", { text: String(g) });
      const t = last.get(g);
      card.createEl("div", { text: t ? (0, import_obsidian3.moment)(t).fromNow() : "No logged training", cls: "gym-muted" });
      if (t) {
        const track = card.createDiv({ cls: "gym-recovery-track" }), bar = track.createDiv({ cls: "gym-recovery-bar" });
        bar.style.width = Math.min(100, Math.round((Date.now() - t) / (48 * 36e5) * 100)) + "%";
      }
    });
  }
  renderRoutine(el, path) {
    const f = this.fileAt(path);
    if (!f) return;
    const fm = this.index.fm(f);
    el.empty();
    button(el, "Start this workout", async () => this.app.workspace.getLeaf(false).openFile(await this.gym.createSession(f)), true);
    table(el, ["Exercise", "Sets"], planOf(fm).map((p) => [this.index.exerciseById(p.exercise_id)?.name || p.exercise_id, p.sets]));
  }
  renderLog(el, path) {
    const f = this.fileAt(path);
    if (!f) return;
    const fm = this.index.fm(f);
    el.empty();
    el.createEl("p", { text: metricText(fm) + (fm.effort != null ? " \xB7 effort " + fm.effort + "/5" : "") });
    if (fm.note) el.createEl("p", { text: String(fm.note) });
  }
  async audit() {
    this.index.rebuild();
    const missing = [], dup = /* @__PURE__ */ new Map(), broken = [];
    this.index.exercisesList().forEach((e) => {
      if (!e.id) missing.push(e.file.path);
      const a = dup.get(e.id) || [];
      a.push(e.file.path);
      dup.set(e.id, a);
    });
    this.index.routinesList().forEach((r) => planOf(r.fm).forEach((p2) => {
      if (!this.index.exerciseById(p2.exercise_id)) broken.push(r.file.path + " \u2192 " + p2.exercise_id);
    }));
    const lines = ["# Obsidian Gym Audit", "", "Generated: " + (/* @__PURE__ */ new Date()).toLocaleString(), "", "- Exercises: " + this.index.exercisesList().length, "- Routines: " + this.index.routinesList().length, "- Sessions: " + this.index.sessionsList().length, "- Missing exercise IDs: " + missing.length, "- Duplicate exercise IDs: " + [...dup.values()].filter((x) => x.length > 1).length, "- Broken routine references: " + broken.length, "", "## Broken references", ...broken.length ? broken.map((x) => "- " + x) : ["- None"]];
    const p = "Obsidian Gym Audit.md", old = this.app.vault.getAbstractFileByPath(p);
    if (old instanceof import_obsidian3.TFile) await this.app.vault.process(old, () => lines.join("\n"));
    else await this.app.vault.create(p, lines.join("\n"));
    new import_obsidian3.Notice("Gym audit written to " + p);
  }
  async replaceLegacyBody(file, lang) {
    await this.app.vault.process(file, (raw) => {
      if (!raw.includes(FENCE + "dataviewjs") && !raw.includes("~~~dataviewjs")) return raw;
      const backtickPattern = new RegExp(FENCE + "dataviewjs[\\s\\S]*?" + FENCE, "g");
      const tildePattern = /~~~dataviewjs[\s\S]*?~~~/g;
      const cleaned = raw.replace(backtickPattern, "").replace(tildePattern, "").trimEnd();
      return cleaned + "\n\n" + FENCE + lang + "\n" + FENCE + "\n";
    });
  }
  async previewPathMigration() {
    const old = this.settings.previousPaths;
    if (!old) {
      new import_obsidian3.Notice("No previous paths are pending migration.");
      return;
    }
    const maps = [[old.exercisesRoot, this.settings.exercisesRoot], [old.workoutTemplatesRoot, this.settings.workoutTemplatesRoot], [old.workoutsRoot, this.settings.workoutsRoot]].filter((x) => x[0] && x[1] && norm(x[0]) !== norm(x[1]));
    let move = 0, conflict = 0;
    for (const [from, to] of maps) {
      for (const file of this.app.vault.getFiles().filter((f) => inside(f.path, from))) {
        let rel = file.path.slice(norm(from).length);
        if (rel.startsWith("/")) rel = rel.slice(1);
        const target = join(to, rel);
        this.app.vault.getAbstractFileByPath(target) ? conflict++ : move++;
      }
    }
    new import_obsidian3.Notice("Path migration: " + move + " movable, " + conflict + " conflicts.", 1e4);
  }
  async migratePaths() {
    const old = this.settings.previousPaths;
    if (!old) {
      new import_obsidian3.Notice("No previous paths are pending migration.");
      return;
    }
    const maps = [[old.exercisesRoot, this.settings.exercisesRoot], [old.workoutTemplatesRoot, this.settings.workoutTemplatesRoot], [old.workoutsRoot, this.settings.workoutsRoot]].filter((x) => x[0] && x[1] && norm(x[0]) !== norm(x[1])).sort((a, b) => String(b[0]).length - String(a[0]).length);
    let moved = 0, conflicts = 0;
    for (const [from, to] of maps) {
      const files = this.app.vault.getFiles().filter((f) => inside(f.path, from)).sort((a, b) => a.path.length - b.path.length);
      for (const file of files) {
        let rel = file.path.slice(norm(from).length);
        if (rel.startsWith("/")) rel = rel.slice(1);
        const target = join(to, rel);
        if (this.app.vault.getAbstractFileByPath(target)) {
          conflicts++;
          continue;
        }
        await this.gym.ensureFolder(parent(target));
        await this.app.fileManager.renameFile(file, target);
        moved++;
      }
    }
    for (const bp of ["Exercises List.base", "Workouts List.base", "Workouts History.base"]) {
      const file = this.app.vault.getAbstractFileByPath(bp);
      if (!(file instanceof import_obsidian3.TFile)) continue;
      await this.app.vault.process(file, (raw) => {
        maps.forEach(([from, to]) => {
          raw = raw.split(String(from)).join(String(to));
        });
        return raw;
      });
    }
    this.settings.previousPaths = null;
    await this.saveSettings();
    this.index.rebuild();
    new import_obsidian3.Notice("Path migration complete: " + moved + " moved, " + conflicts + " conflicts.", 1e4);
  }
  async migrateV3() {
    const stamp = (0, import_obsidian3.moment)().format("YYYYMMDD-HHmmss"), backup = join("Gym Migration Backups", stamp);
    await this.gym.ensureFolder(backup);
    const files = this.app.vault.getMarkdownFiles().filter((f) => inside(f.path, this.settings.exercisesRoot) || inside(f.path, this.settings.workoutTemplatesRoot) || inside(f.path, this.settings.workoutsRoot));
    let changed = 0;
    for (const file of files) {
      const f = this.index.fm(file);
      if (Number(f.schema_version || 0) >= 3) continue;
      const rel = file.path.replace(/^\/+/, "");
      const bp = join(backup, rel);
      await this.gym.ensureFolder(parent(bp));
      try {
        await this.app.vault.copy(file, bp);
      } catch {
      }
      if (inside(file.path, this.settings.exercisesRoot) && tags(f).includes("exercise") && !f.workout_id) {
        const patch = { schema_version: 3, tracking_mode: modeOf(f), default_rest_seconds: num(f.default_rest_seconds) ?? this.settings.defaultRestSeconds };
        const dr = parseLegacy(f.default_reps ?? f.reps), dw = parseLegacy(f.default_weight_kg ?? f.weight), dd = parseLegacy(f.default_duration_seconds ?? f.duration);
        if (dr != null) patch.default_reps = dr;
        if (dw != null) patch.default_weight_kg = dw;
        if (dd != null) patch.default_duration_seconds = dd;
        await this.gym.update(file, patch, ["date", "time", "weight", "reps", "effort", "timed", "duration"]);
        await this.replaceLegacyBody(file, "obsidian-gym-exercise");
        changed++;
      } else if (inside(file.path, this.settings.workoutTemplatesRoot) && tags(f).includes("workout")) {
        await this.gym.update(file, { schema_version: 3, exercise_plan: planOf(f) }, ["exercises", "workout_order"]);
        await this.replaceLegacyBody(file, "obsidian-gym-routine");
        changed++;
      } else if (inside(file.path, this.settings.workoutsRoot) && file.path.includes("/Log/")) {
        const event = f.event_type || (f.exercise === "Workout start" ? "workout_start" : f.exercise === "Workout end" ? "workout_end" : null), patch = { schema_version: 3, performed_at: f.performed_at || f.date || now() };
        if (event) patch.event_type = event;
        else {
          patch.tracking_mode = modeOf(f);
          patch.set_type = f.set_type || "working";
          if (f.weight_kg == null && num(f.weight) != null) patch.weight_kg = num(f.weight);
          if (f.duration_seconds == null && num(f.duration) != null) patch.duration_seconds = num(f.duration);
        }
        await this.gym.update(file, patch, ["weight", "duration", "date"]);
        await this.replaceLegacyBody(file, "obsidian-gym-log");
        changed++;
      } else if (inside(file.path, this.settings.workoutsRoot) && tags(f).includes("workout")) {
        await this.gym.update(file, { schema_version: 3, exercise_plan: planOf(f) }, ["exercises", "workout_order"]);
        await this.gym.recalc(file);
        await this.replaceLegacyBody(file, "obsidian-gym-session");
        changed++;
      }
    }
    this.settings.schemaVersion = 3;
    await this.saveSettings();
    this.index.rebuild();
    new import_obsidian3.Notice("Migrated " + changed + " gym files. Backup: " + backup, 1e4);
  }
};
