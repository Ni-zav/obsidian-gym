# Migration and compatibility

## Folder moves

The local Obsidian Gym Settings plugin manages:

- exercises root
- workout templates root
- workout sessions root

Before a large move, run **Preview gym path migration** from the command palette. It reports movable files, conflicts, and missing source paths.

The migration code moves files through Obsidian's FileManager and rewrites known Base roots with placeholder substitution so overlapping paths do not rewrite their own newly inserted output.

## Legacy exercise IDs

Existing numeric IDs are intentionally not bulk-converted to UUIDs. Routine templates already refer to them, so rewriting only part of the relationship graph would be worse than keeping stable legacy IDs.

All newly created IDs are UUIDs.

## Legacy exercise templates

Older exercise definitions may still contain Templater expressions in fields such as `weight`, `reps`, or `date`.

The new logger does not execute those templates. It reads useful static metadata and uses explicit `default_*` fields when present.

You can gradually recreate or manually clean legacy definitions; no big-bang migration is required.

## Plugin updates

Use Obsidian's Community Plugins updater. A plugin release consists of matching compiled assets; changing a vendored `manifest.json` alone is not an update.

Templater, Buttons, Media Extended, Tag Wrangler, and Heatmap Calendar are no longer enabled by this vault's gym runtime.
