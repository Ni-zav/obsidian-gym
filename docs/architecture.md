# Architecture

## Runtime

`_js/shared/gym-core.js` is the central service. It owns:

- path resolution
- UUID generation
- exercise discovery
- workout-template discovery
- workout session creation
- set/event creation
- workout metrics
- previous-set history
- PR comparison
- remaining-set calculation
- skip / replace / next-order mutations
- active-session discovery

Other shared modules are deliberately smaller:

- `workout.js` — workout/session UI
- `exercise.js` — exercise definition/history UI
- `timer.js` — countdown + stopwatch
- `stats.js` — generic progress and recovery-gap displays
- `utils.js` — pure small helpers
- `path-config.js` — runtime path fallback
- `pr-tracker.js` — compatibility wrapper around core PR logic

## Commands

QuickAdd still provides stable command IDs used by Meta Bind and the Home renderer.

Primary user scripts:

- `start-today-workout.js`
- `start-free-workout.js`
- `log-exercise.js`
- `create-workout-routine.js`
- `add-exercise-to-library.js`
- `recalculate-metrics.js`

These scripts no longer directly access Templater internals and no longer carry copies of folder configuration.

## Persistence

Exercise definitions and routine templates are immutable-ish library records.

Workout sessions are generated records. Each session owns a `Log/` folder containing event files. The session frontmatter stores derived summary fields for fast Bases and dashboard access.

Derived fields can be rebuilt from logs with the Recalculate Metrics command/script.

## Compatibility

Schema-v2 code accepts legacy fields where possible:

- `weight` → `weight_kg`
- `duration` → `duration_seconds`
- numeric legacy exercise IDs remain valid
- name matching is retained as a fallback for older logs
- aliases can preserve history lookup after exercise renames

New history relationships should rely on `exercise_id`, not the exercise name.

## Design rule

Do not add new path parsing or direct whole-vault workout logic to command scripts. Put shared behavior in `gym-core.js` and keep command scripts as interaction orchestration.
