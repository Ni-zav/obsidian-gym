# Architecture

## Runtime

Obsidian Gym is one native plugin:

```text
Markdown + Bases
       ↑
 Obsidian Gym
 ├─ incremental indexes
 ├─ workout domain service
 ├─ mutation queue
 ├─ native commands
 ├─ native modals
 ├─ timer / stopwatch
 ├─ Markdown renderers
 ├─ analytics / recovery
 ├─ migrations
 └─ settings / audit
```

Canonical source is `plugin-src/main.ts`. The committed bundle is `.obsidian/plugins/obsidian-gym/main.js`.

## Indexing

At layout-ready the plugin scans the relevant Markdown files once and builds in-memory indexes for:

- exercises by path, ID, name, and aliases
- routines
- workout sessions by path and workout ID
- logs by path and workout ID
- logs by exercise ID and exercise name

After startup, Obsidian `metadataCache` and `vault` events update those indexes incrementally on change, delete, and rename.

Interactive operations therefore do not repeatedly scan the entire vault.

A full scan is intentionally retained for explicit administrative actions such as audit/rebuild/migration.

## Mutation model

Every workout has a serialized mutation queue.

Set creation, deletion, finishing, and other state-changing operations for the same workout execute in order. This prevents rapid double actions from racing for the same log filename or overwriting derived session fields.

Different workouts do not block one another.

## Metrics

Normal set creation updates session summaries incrementally:

- set count
- working-set count
- exercise counts
- weighted repetition volume
- timed seconds
- distance
- PR count

Edits/deletes use a complete recalculation for that workout. A full rebuild command is available for repair.

Warmup sets are stored but excluded from working-set volume/count summaries.

## Rendering

Notes contain inert native code blocks such as:

- `obsidian-gym-home`
- `obsidian-gym-create`
- `obsidian-gym-session`
- `obsidian-gym-exercise`
- `obsidian-gym-routine`
- `obsidian-gym-log`
- `obsidian-gym-analytics`
- `obsidian-gym-recovery`

The plugin registers Markdown code-block processors for these blocks.

Legacy `dataviewjs` gym pages can still render during migration, but schema-v3 migration rewrites recognized legacy gym blocks to native blocks.

## User interaction

The plugin owns stable command IDs and native Obsidian modals.

No QuickAdd, CustomJS, Dataview, Charts, Homepage, Templater, Meta Bind, or Buttons runtime is required.

The set logger is intentionally one screen. It derives defaults from the previous matching set and exercise definition, and exposes small adjustment controls rather than launching a chain of prompts.

## Timer

Rest timer and stopwatch state live in one plugin-scoped service.

The timer derives time from timestamps rather than trusting interval counts, so background throttling does not accumulate large timing drift.

## Safety and recoverability

- training history is Markdown
- schema migration creates timestamped backups
- path migration previews conflicts before moving data
- file moves use Obsidian's FileManager
- audit reports broken routine references
- derived workout metrics can be rebuilt from logs

The data layer is intentionally independent from the UI implementation.
