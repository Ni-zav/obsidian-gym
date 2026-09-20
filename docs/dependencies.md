# Dependencies

## Required runtime

| Plugin | Purpose |
|---|---|
| QuickAdd | command entry points and prompts |
| Dataview | Markdown-driven render blocks |
| CustomJS | shared gym classes |
| Meta Bind | command buttons embedded in notes |
| Charts | Chart.js integration without CDN injection |
| Obsidian Gym Settings | local path configuration/migration |

Homepage is optional convenience only.

## Removed runtime dependencies

- Templater — session/log creation is now direct and deterministic
- Buttons — Meta Bind is the single button system
- Media Extended — not required by the gym runtime
- Tag Wrangler — not required by the gym runtime
- Heatmap Calendar — no active gym view requires it

## Upstream update policy

The repository may contain older vendored community-plugin bundles. Update them from inside Obsidian.

Do not manually bump only the manifest version. The manifest, compiled JavaScript, and stylesheet must belong to the same release.

The modernization code avoids depending on new QuickAdd-specific features, so it remains compatible across the current QuickAdd 2.x line while allowing users to update normally.
