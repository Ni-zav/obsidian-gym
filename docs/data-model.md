# Data model

Schema v3 separates exercise definitions, routine plans, workout sessions, events, and performed sets.

## Exercise definition

```yaml
schema_version: 3
id: "exercise-uuid"
exercise: "Lower Body - Squat"
muscle_group: "Lower Body"
equipment: "Barbell"
tracking_mode: strength
default_reps: 8
default_weight_kg: 60
default_rest_seconds: 90
instructions: "..."
aliases: []
tags:
  - exercise
```

Supported `tracking_mode` values:

- `strength`
- `bodyweight`
- `duration`
- `distance_time`

Mode-specific optional defaults are:

- `default_weight_kg`
- `default_reps`
- `default_duration_seconds`
- `default_distance_km`

Definitions never store performed-set effort/note/date values.

## Routine

```yaml
schema_version: 3
workout_title: "Upper A"
exercise_plan:
  - exercise_id: "exercise-a"
    sets: 3
  - exercise_id: "exercise-b"
    sets: 4
workout_type: "Weight Training"
workout_place: "Gym"
tags:
  - workout
```

`exercise_plan` is ordered and stores planned working-set counts.

## Workout session

```yaml
schema_version: 3
id: "session-uuid"
workout_title: "Upper A"
date: "2026-09-21"
started_at: "2026-09-21T18:30:00"
ended_at: null
status: active
exercise_plan:
  - exercise_id: "exercise-a"
    sets: 3
skipped_exercises: []
workout_type: "Weight Training"
workout_place: "Gym"
set_count: 0
working_set_count: 0
exercise_counts: {}
total_volume: 0
timed_seconds: 0
distance_km: 0
pr_count: 0
duration_minutes: 0
tags:
  - workout
```

Session summary fields are derived/cache fields. Logs remain the reconstructible record.

## Set log

```yaml
schema_version: 3
id: "log-uuid"
workout_id: "session-uuid"
set_index: 1
exercise_id: "exercise-uuid"
exercise: "Lower Body - Squat"
performed_at: "2026-09-21T18:34:00"
tracking_mode: strength
set_type: working
weight_kg: 80
reps: 8
effort: 4
note: ""
prs:
  - estimated_1rm
tags:
  - exercise
  - log
  - set
```

Supported `set_type` values:

- `working`
- `warmup`
- `drop`
- `failure`

Warmup sets are retained in history but excluded from working-set summary metrics.

Duration logs use `duration_seconds`.

Distance/time logs use `distance_km` + `duration_seconds`.

## Events

Workout lifecycle events live in the same `Log/` directory:

```yaml
schema_version: 3
id: "event-uuid"
workout_id: "session-uuid"
event_type: workout_start
performed_at: "2026-09-21T18:30:00"
tags:
  - log
  - event
  - start
```

End events use `event_type: workout_end`.

These events make duration repair deterministic.

## PR semantics

PR comparison ignores warmup sets.

Possible PR keys:

- `weight`
- `reps_at_weight`
- `set_volume`
- `estimated_1rm`
- `duration`
- `distance`
- `pace`

A tie is not a PR.

## Legacy compatibility

Existing exercise IDs, including numeric IDs, remain valid.

During schema-v3 migration:

- legacy `weight` becomes `weight_kg`
- legacy `duration` becomes `duration_seconds`
- old repeated `exercises` arrays become `exercise_plan`
- old start/end exercise names become explicit lifecycle events
- old Templater definition fields are converted to useful static defaults where possible

History lookup prefers `exercise_id`, then falls back to names/aliases for older logs.

## Renames

Keep the exercise `id` unchanged.

If useful, add the previous exercise name to `aliases`; this lets old name-only logs continue to participate in history.
