import { moment } from "obsidian";
import type { RoutinePlanItem, TrackingMode } from "./types";

export function normalizePath(value: unknown): string {
  if (typeof value !== "string") return "";
  let normalized = value.replace(/\\/g, "/").trim();
  normalized = normalized.replace(/^\/+|\/+$/g, "");
  return normalized;
}

export function joinPath(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).map((part, index) => {
    let value = String(part);
    if (index === 0) value = value.replace(/\/+$/g, "");
    else value = value.replace(/^\/+|\/+$/g, "");
    return value;
  }).join("/");
}

export function parentPath(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}

export function isInside(path: string, root: string): boolean {
  const p = normalizePath(path);
  const r = normalizePath(root);
  return Boolean(p && r && (p === r || p.startsWith(r + "/")));
}

export function tagsOf(fm: Record<string, any>): string[] {
  const value = fm?.tags ?? [];
  const values = Array.isArray(value) ? value : [value];
  return values.filter(Boolean).map((item) => String(item).replace(/^#/, ""));
}

export function numberOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowTimestamp(): string {
  return moment().format("YYYY-MM-DDTHH:mm:ss");
}

export function today(): string {
  return moment().format("YYYY-MM-DD");
}

export function trackingModeOf(fm: Record<string, any>): TrackingMode {
  const mode = fm?.tracking_mode;
  if (["strength", "bodyweight", "duration", "distance_time"].includes(mode)) return mode;
  if (fm?.distance_km != null || fm?.default_distance_km != null) return "distance_time";
  if (fm?.timed === true || fm?.timed === "true" || fm?.duration != null || fm?.default_duration_seconds != null) return "duration";
  const equipment = String(fm?.equipment || "").toLowerCase();
  if (equipment.includes("bodyweight")) return "bodyweight";
  return "strength";
}

export function parseLegacyPromptDefault(value: unknown): number | null {
  const direct = numberOrNull(value);
  if (direct != null) return direct;
  if (typeof value !== "string") return null;
  const quoted = [...value.matchAll(/["'](-?\d+(?:\.\d+)?)["']/g)];
  if (!quoted.length) return null;
  return numberOrNull(quoted[quoted.length - 1][1]);
}

export function normalizePlan(fm: Record<string, any>): RoutinePlanItem[] {
  const modern = fm?.exercise_plan;
  if (Array.isArray(modern)) {
    return modern.map((item) => ({
      exercise_id: String(item?.exercise_id ?? item?.id ?? ""),
      sets: Math.max(1, Math.floor(Number(item?.sets) || 1)),
    })).filter((item) => item.exercise_id);
  }
  const legacy = Array.isArray(fm?.exercises) ? fm.exercises.map(String) : [];
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const id of legacy) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return order.map((id) => ({ exercise_id: id, sets: counts.get(id) || 1 }));
}

export function oneRepMax(weight: unknown, reps: unknown): number {
  const w = numberOrNull(weight) || 0;
  const r = numberOrNull(reps) || 0;
  if (w <= 0 || r <= 0 || r >= 37) return 0;
  return w * (36 / (37 - r));
}

export function setVolume(weight: unknown, reps: unknown): number {
  return Math.max(0, numberOrNull(weight) || 0) * Math.max(0, numberOrNull(reps) || 0);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function escapeYamlString(value: unknown): string {
  return JSON.stringify(String(value ?? ""));
}
