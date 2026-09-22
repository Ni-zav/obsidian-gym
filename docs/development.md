# Development

## Layout

```text
plugin-src/
├─ main.ts
├─ gym-service.ts
├─ index-service.ts
├─ ui.ts
├─ timer-service.ts
└─ utils.ts
        │
        │ npm run build
        ▼
.obsidian/plugins/obsidian-gym/
├─ main.js
├─ manifest.json
└─ styles.css
```

The files under `plugin-src/` are canonical source.

Do not hand-edit behavior only in the generated `main.js`; rebuild it after source changes.

## Setup

```bash
npm install
```

## Type check

```bash
npm run check
```

## Build

```bash
npm run build
```

## Watch build

```bash
npm run build:watch
```

The build bundles the source as CommonJS and keeps Obsidian/Electron/CodeMirror packages external.

## Runtime design rules

1. Keep user data in Markdown/frontmatter.
2. Use exercise/session/log IDs for relationships; use names only as compatibility fallback.
3. Put interactive state in the plugin, not in executable note scripts.
4. Use lifecycle-managed Obsidian events for index maintenance.
5. Serialize mutations within a workout.
6. Avoid whole-vault scans in interactive paths.
7. Keep warmups distinct from working-set metrics.
8. Make destructive migrations recoverable.
9. Prefer native Obsidian CSS variables/components.
10. Do not introduce a new community-plugin dependency for a small UI convenience.

## Performance

A startup rebuild scans Markdown once.

After that, index updates are event-driven. Full scans are reserved for explicit administrative repair/audit operations.

Normal set additions update session metrics incrementally. Edit/delete repair only the affected workout.

## Testing checklist

Before merging runtime changes:

- `npm run check`
- `npm run build`
- parse the built `main.js`
- validate plugin manifest and JSON configuration
- confirm source build output is the committed runtime
- scan for retired runtime references
- review the complete branch diff

For significant interaction changes, also manually exercise in Obsidian:

- start routine
- start free workout
- log each tracking mode
- edit / repeat / delete / undo
- next / skip / replace
- finish session
- reopen Home/Analytics/Recovery
- run migration preview/audit
