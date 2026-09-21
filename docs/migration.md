# Migration and compatibility

## Schema-v3 migration

Run:

**Obsidian Gym: Migrate gym data to schema v3**

Before modifying a legacy gym note, the plugin copies it into:

`Gym Migration Backups/YYYYMMDD-HHmmss/`

The original relative path is retained inside the backup folder.

The migration converts supported legacy metadata and replaces recognized legacy gym DataviewJS render blocks with native `obsidian-gym-*` blocks.

## What is migrated

### Exercise definitions

- preserve the existing exercise ID
- set `schema_version: 3`
- infer `tracking_mode`
- promote useful legacy weight/reps/duration prompt defaults into `default_*` fields when possible
- add `default_rest_seconds` if absent
- remove performed-set/template-only fields such as date/time/effort

### Routines

- preserve referenced exercise IDs
- convert repeated legacy `exercises` entries into ordered `exercise_plan` items with set counts
- remove obsolete `workout_order`

### Set logs

- set `schema_version: 3`
- normalize `performed_at`
- convert `weight` to `weight_kg`
- convert `duration` to `duration_seconds`
- add `tracking_mode` and `set_type`
- convert legacy workout-start/end markers into explicit event records

### Sessions

- convert the plan to `exercise_plan`
- remove obsolete plan fields
- rebuild derived metrics from logs

## IDs

Legacy numeric exercise IDs are intentionally preserved.

Changing IDs would require rewriting every routine/log relationship atomically and provides little value. UUIDs are used for newly created records while old stable IDs remain valid.

## Folder migration

Changing a root setting records the previous roots.

Run:

1. **Obsidian Gym: Preview gym path migration**
2. inspect movable/conflict counts
3. **Obsidian Gym: Migrate gym paths**

The mover:

- uses Obsidian FileManager rename operations
- creates target directories
- skips collisions instead of overwriting
- updates known Base root strings
- processes longer/nested roots before parent roots

A conflict is intentionally left untouched for manual resolution.

## Audit

Run **Obsidian Gym: Audit gym data**.

It writes `Obsidian Gym Audit.md` with counts and broken routine references.

## Metric repair

Run **Obsidian Gym: Recalculate all workout metrics** after manual frontmatter edits or if a session summary looks wrong.

Session summary fields are derived and can be rebuilt from logs.

## Rollback

For schema migration, restore the needed files from the timestamped backup directory.

For a path migration, files are moved rather than copied; use Obsidian/Git history or move them back through the same settings workflow if necessary.
