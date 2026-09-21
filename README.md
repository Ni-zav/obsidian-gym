# Obsidian Gym

A local-first workout tracker implemented as a single native Obsidian plugin.

Training data stays in ordinary Markdown frontmatter and Obsidian Bases. The plugin supplies the interaction layer: workout creation, fast set logging, timers, progression history, PR detection, analytics, recovery-gap views, migrations, and integrity tools.

## Requirements

- Obsidian 1.13+
- the bundled `obsidian-gym` plugin

No other community plugin is required for the gym runtime.

## Features

- Routine-based and free workouts
- Resume unfinished sessions from Home
- One-screen set logging with previous-set context
- Strength, bodyweight, duration, and distance+time tracking
- Working, warmup, drop, and failure set types
- Weight/repetition shortcuts
- Automatic rest timer and stopwatch
- Repeat, edit, delete, and undo sets
- Next / skip / replace planned exercises
- Explicit workout completion
- Weight, reps-at-weight, set-volume, estimated-1RM, duration, distance, and pace PRs
- Native exercise history and progression summaries
- Native volume and duration analytics
- Recovery-gap history view
- Schema-v3 migration with backups
- Configurable folders with path-migration preview and conflict detection
- Data audit and full metric rebuild commands

## Start

Open [[Home]].

The Home renderer is provided by a native Markdown code block:

```text
```obsidian-gym-home
```
```

From there you can start a routine, start a free workout, resume an active session, create an exercise, or create a routine.

## Commands

Open Obsidian's command palette and search for **Obsidian Gym**.

Important commands include:

- Open home
- Start workout
- Start free workout
- Log set
- Create exercise
- Create routine
- Finish active workout
- Undo last set
- Recalculate all workout metrics
- Audit gym data
- Migrate gym data to schema v3
- Preview gym path migration
- Migrate gym paths

Commands are registered by the plugin itself; there are no external command UUIDs.

## Files

Default locations:

- `Templates/exercises` — exercise definitions and category JSON
- `Templates/Workouts` — saved routines
- `Workouts` — workout sessions and their `Log/` entries

Change these in **Settings → Community plugins → Obsidian Gym**.

## Schema v3

Schema v3 separates definitions, plans, sessions, events, and performed sets.

Existing numeric exercise IDs remain valid. New exercise/log/session IDs are UUIDs. This preserves old routine relationships while avoiding a destructive ID rewrite.

See [docs/data-model.md](docs/data-model.md).

## Persistence

The plugin does not use an opaque database.

```text
Exercise Markdown ─┐
Routine Markdown  ─┼─> Obsidian Gym plugin ─> Session + set Markdown
Bases             ─┘
```

If the plugin is disabled, the underlying training records are still readable files.

## Dashboards

- [[Exercises List.base]]
- [[Workouts List.base]]
- [[Workouts History.base]]
- [[Data Visualization]]
- [[Recovery]]

The Recovery page is intentionally only a **time-since-last-trained** history cue. It is not a physiological recovery, soreness, or medical measurement.

## Development

Canonical source:

- `plugin-src/main.ts`

Bundled runtime:

- `.obsidian/plugins/obsidian-gym/main.js`

Build:

```bash
npm install
npm run check
npm run build
```

See [docs/development.md](docs/development.md).

## Migration

Use **Obsidian Gym: Migrate gym data to schema v3** for old workout data. The command creates a backup before rewriting legacy metadata/render blocks.

Folder changes have a separate preview + migrate flow.

See [docs/migration.md](docs/migration.md).

## Project principle

> Complexity is the enemy of execution.

The runtime should stay small, native, responsive, and recoverable from its Markdown data.
