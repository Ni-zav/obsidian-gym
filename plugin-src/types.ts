export type TrackingMode = "strength" | "bodyweight" | "duration" | "distance_time";
export type SetType = "working" | "warmup" | "drop" | "failure";

export interface GymSettings {
  exercisesRoot: string;
  workoutTemplatesRoot: string;
  workoutsRoot: string;
  homeNote: string;
  openHomeOnStartup: boolean;
  defaultRestSeconds: number;
  weightStepKg: number;
  previousPaths?: { exercisesRoot: string; workoutTemplatesRoot: string; workoutsRoot: string };
  schemaVersion?: number;
}

export interface ExerciseRecord {
  file: any;
  fm: Record<string, any>;
  id: string;
  name: string;
  aliases: string[];
  trackingMode: TrackingMode;
}

export interface RoutinePlanItem {
  exercise_id: string;
  sets: number;
}

export interface SessionRecord {
  file: any;
  fm: Record<string, any>;
  id: string;
}

export interface LogRecord {
  file: any;
  fm: Record<string, any>;
  id: string;
  workoutId: string;
  exerciseId?: string;
  exerciseName?: string;
  eventType?: "workout_start" | "workout_end";
  trackingMode?: TrackingMode;
  performedAt: string;
}

export interface SetPayload {
  exercise_id: string;
  exercise: string;
  tracking_mode: TrackingMode;
  set_type: SetType;
  weight_kg?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  effort?: number | null;
  note?: string;
}

export interface PRResult {
  key: string;
  label: string;
  value?: number;
}
