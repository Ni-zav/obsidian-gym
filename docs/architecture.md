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


## Performance model

The shared core uses short-lived, lazily built indexes instead of repeatedly scanning the vault from every renderer or picker:

- exercise definitions: indexed by ID, name, and aliases
- workout routines: cached routine list
- workout sessions: indexed by workout ID and active state
- exercise history: indexed by exercise ID and name
- current workout logs: parsed once per short render window

General indexes use a 1.5-second safety TTL and are explicitly invalidated when gym code writes related files. Current-workout log entries use a shorter 750 ms cache. This keeps normal interaction immediate while allowing manual file edits to become visible without persistent event listeners.

Persistent metadata/vault event listeners were intentionally avoided in CustomJS because script reloads can create duplicate listeners and lifecycle leaks. If Obsidian Gym later becomes a full standalone plugin, replacing TTL caches with plugin-lifecycle-managed event indexes would be a reasonable next optimization.

Full vault scans remain in Audit/Migration/Bulk Repair commands because those are rare administrative operations where completeness is more important than interactive latency.
