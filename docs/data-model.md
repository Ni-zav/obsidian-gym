# Data model

## Exercise definition

New definitions use schema v2:

```yaml
schema_version: 2
id: "uuid"
exercise: "Lower Body - squat"
muscle_group: "Lower Body"
equipment: "Barbell"
timed: false
default_reps: 8
default_weight_kg: 60
default_rest_seconds: 90
instructions: "..."
aliases: []
tags:
  - exercise
```

Definitions describe the exercise. They no longer store performed-set date, effort, note, weight, or reps as if those were permanent properties.

## Routine template

```yaml
schema_version: 2
workout_title: "Upper A"
exercises: ["exercise-id", "exercise-id", "another-id"]
workout_order: ["exercise-id", "exercise-id", "another-id"]
workout_type: "Weight Training"
workout_place: "Home"
tags:
  - workout
```

Repeated IDs represent planned sets. `workout_order` is now meaningful: it determines remaining-exercise ordering and can be changed for a session without changing the routine.

## Workout session

```yaml
schema_version: 2
id: "session-uuid"
workout_title: "Upper A"
date: "2026-09-20"
started_at: "2026-09-20T18:30:00"
ended_at: null
status: active
exercises: [...]
workout_order: [...]
skipped_exercises: []
Logs: [...]
ExerciseCounts: {}
ExercisesSummary: ""
Total Volume: 0
timed_load: 0
duration_minutes: 0
duration: Ongoing
tags:
  - workout
```

`Total Volume` is conventional weighted rep volume: weight × reps.

Timed activities are intentionally excluded from that metric. Their optional weight × seconds aggregate is stored separately as `timed_load` so unlike units are not mixed.

## Set log

```yaml
schema_version: 2
id: "log-uuid"
workout_id: "session-uuid"
exercise_id: "exercise-uuid"
exercise: "Lower Body - squat"
performed_at: "2026-09-20T18:34:00"
timed: false
weight_kg: 80
reps: 8
effort: 4
note: ""
tags:
  - exercise
  - log
```

Timed logs use `duration_seconds` instead of reps.

## Start/end events

Workout start and end are log events with `exercise: "Workout start"` and `exercise: "Workout end"`. They make duration rebuilding deterministic.

## Renaming exercises

Keep the same `id`. Optionally add the previous name to `aliases`. New logs remain linked through `exercise_id`.
