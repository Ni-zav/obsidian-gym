# Dependencies

## Runtime

Obsidian Gym requires only:

- Obsidian 1.13+
- the bundled `obsidian-gym` plugin

The vault's `.obsidian/community-plugins.json` enables only `obsidian-gym`.

## No longer required

The gym runtime does not depend on:

- QuickAdd
- CustomJS
- Dataview
- Charts
- Homepage
- Templater
- Meta Bind
- Buttons
- Heatmap Calendar
- Media Extended
- Tag Wrangler
- the former Obsidian Gym Settings helper plugin

Those integrations were replaced by native plugin commands, modals, Markdown processors, indexes, settings, analytics, and migrations.

## Development dependencies

Development dependencies are intentionally small and pinned:

- `obsidian` — official public plugin API types
- `typescript`
- `esbuild`

Use:

```bash
npm install
npm run check
npm run build
```

The source of truth is `plugin-src/main.ts`. The generated runtime is committed at `.obsidian/plugins/obsidian-gym/main.js` so the vault works immediately after cloning.

## Version policy

`manifest.json` controls the minimum supported Obsidian application version.

Development-package versions are not the same thing as `minAppVersion`; they provide build/type information. When updating them, rebuild the plugin instead of editing only the generated bundle or only the manifest.

## External network dependencies

The runtime does not load JavaScript, CSS, fonts, charts, or exercise data from a CDN.

All interaction and visualization code is local to the vault/plugin.
