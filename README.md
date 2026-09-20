# Obsidian Gym

A local-first workout tracker built on ordinary Obsidian Markdown. Exercise definitions, routines, workout sessions, and set logs remain readable files; JavaScript adds fast logging, timers, progression history, and dashboards.

## What it does

- Routine-based and free workouts
- Resume unfinished workouts from Home
- Fast set logging with previous-set context
- Same / +2.5 / -2.5 kg and +1 / -1 rep shortcuts
- Repeat last set, undo, skip, replace, and choose the next exercise
- Per-exercise automatic rest timers plus stopwatch mode
- Explicit workout completion and duration tracking
- Strict PR detection for weight, reps, and volume
- Exercise history, estimated 1RM, weekly set count, and progression direction
- Workout history and analytics using Obsidian Bases + Charts
- Approximate muscle-group recovery-gap view
- Configurable vault folders with safe migration preview

## Requirements

Obsidian Gym now targets **Obsidian 1.13+**.

Enabled runtime plugins:

1. [QuickAdd](https://github.com/chhoumann/quickadd) — command entry points
2. [Dataview](https://github.com/blacksmithgu/obsidian-dataview) — Markdown-driven renderers and queries
3. [CustomJS](https://github.com/saml-dev/obsidian-custom-js) — shared gym services and UI
4. [Charts](https://github.com/phibr0/obsidian-charts) — offline chart rendering
5. Homepage — optional startup convenience
6. **Obsidian Gym Settings** — local plugin in this repository

Templater, Meta Bind, Buttons, Media Extended, Tag Wrangler, and Heatmap Calendar are no longer runtime dependencies for the gym flow.

The repository keeps the plugin bundles already committed to the vault. After opening the vault, use Obsidian's normal Community Plugins updater for upstream plugin updates. Do not update only a plugin manifest without its matching compiled plugin bundle.

## Start

Open [[Home]].

- **Start workout** chooses a saved routine.
- **Free workout** starts without a planned exercise list.
- If a session is still active, Home changes the primary action to **Resume**.

Starting a workout immediately creates a workout-start event. Finishing it creates the end event and freezes the final duration.

## Log a set

Use **Log / Manage Exercise** inside a workout.

The action menu supports:

- log a planned exercise
- log any extra exercise
- repeat the last set
- undo the last set
- set the next planned exercise
- skip an exercise for this session
- replace a remaining exercise for this session
- finish the workout

For existing exercises, the logger uses the latest set as the fastest default. Newly created exercises can define default reps/duration, weight, and rest time.

## Files and data

Default locations:

- `Templates/exercises` — exercise definitions + category JSON
- `Templates/Workouts` — saved routines
- `Workouts` — generated sessions and `Log/` set events

Configure them in **Settings → Community plugins → Obsidian Gym Settings**.

Path migration has a command-palette preview:

- **Obsidian Gym Settings: Preview gym path migration**
- **Obsidian Gym Settings: Migrate gym data from previous paths**

See [docs/data-model.md](docs/data-model.md) and [docs/migration.md](docs/migration.md).

## Schema v2

Newly created definitions and logs use stable UUIDs and separate definition defaults from performed-set data.

Old exercise definitions with numeric IDs remain readable and usable. They are not rewritten in place because routine templates may already reference those IDs.

## Dashboards

- [[Exercises List.base]]
- [[Workouts List.base]]
- [[Workouts History.base]]
- [[Data Visualization]]
- [[Recovery]]

The recovery page is deliberately only a **time-since-last-trained** display. It is not a physiological recovery or soreness measurement.

## Architecture

The current runtime is intentionally transitional:

```text
Markdown + Bases
      ↑
gym-core (data + session service)
      ↑
CustomJS renderers
      ↑
QuickAdd commands / DataviewJS buttons
```

Templater is no longer in the runtime path. Folder logic, IDs, metrics, workout state, and history lookup live in one shared service instead of being copied into each QuickAdd script.

See [docs/architecture.md](docs/architecture.md).

## Updating

Current modernization targets tested by design:

- Obsidian 1.13+
- Meta Bind 1.5.x-compatible markup
- QuickAdd 2.x-compatible user scripts
- Dataview 0.5.x
- CustomJS 1.0.x
- Charts 3.9.x

Upstream plugins should be updated through Obsidian so `main.js`, `styles.css`, and `manifest.json` stay from the same release.

## Project principle

The vault should stay useful even if its UI code is temporarily unavailable: training data remains Markdown, JSON, and Bases rather than an opaque database.

> Complexity is the enemy of execution.
