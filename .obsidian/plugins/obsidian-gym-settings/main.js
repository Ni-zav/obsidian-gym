const { Plugin, PluginSettingTab, Notice, TFolder, TFile } = require("obsidian");

const DEFAULT_PATHS = {
    exercisesRoot: "Templates/exercises",
    workoutTemplatesRoot: "Templates/Workouts",
    workoutsRoot: "Workouts"
};

function normalizeVaultPath(value) {
    if (!value || typeof value !== "string") return "";
    let normalized = value.split(String.fromCharCode(92)).join("/").trim();
    while (normalized.startsWith("/")) normalized = normalized.slice(1);
    while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized;
}

function joinVaultPath(...parts) {
    return parts.filter(Boolean).map((part, index) => {
        let value = String(part);
        if (index === 0) {
            while (value.endsWith("/")) value = value.slice(0, -1);
        } else {
            while (value.startsWith("/")) value = value.slice(1);
            while (value.endsWith("/")) value = value.slice(0, -1);
        }
        return value;
    }).join("/");
}

function parentPath(value) {
    const normalized = normalizeVaultPath(value);
    const index = normalized.lastIndexOf("/");
    return index < 0 ? "" : normalized.slice(0, index);
}

class ObsidianGymSettingsPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.applyPathsGlobal();
        this.addSettingTab(new ObsidianGymSettingsTab(this.app, this));

        this.addCommand({
            id: "obsidian-gym-reapply-path-settings",
            name: "Re-apply gym path settings",
            callback: async () => {
                await this.ensurePathDirectories(this.settings.paths);
                this.applyPathsGlobal();
                new Notice("Gym paths applied");
            }
        });

        this.addCommand({
            id: "obsidian-gym-preview-path-migration",
            name: "Preview gym path migration",
            callback: async () => {
                const plan = await this.planMigration(this.settings.previousPaths, this.settings.paths);
                new Notice("Gym migration preview: " + plan.movable + " files movable, " + plan.conflicts + " conflicts, " + plan.missing + " sources missing", 10000);
            }
        });

        this.addCommand({
            id: "obsidian-gym-migrate-from-previous",
            name: "Migrate gym data from previous paths",
            callback: async () => this.migratePaths(this.settings.previousPaths, this.settings.paths)
        });
    }

    normalizePaths(paths = {}) {
        const exercisesRoot = normalizeVaultPath(paths.exercisesRoot) || DEFAULT_PATHS.exercisesRoot;
        return {
            exercisesRoot,
            workoutTemplatesRoot: normalizeVaultPath(paths.workoutTemplatesRoot) || DEFAULT_PATHS.workoutTemplatesRoot,
            workoutsRoot: normalizeVaultPath(paths.workoutsRoot) || DEFAULT_PATHS.workoutsRoot
        };
    }

    derived(pathsRaw) {
        const paths = this.normalizePaths(pathsRaw);
        return {
            ...paths,
            exerciseCategoriesPath: joinVaultPath(paths.exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: joinVaultPath(paths.exercisesRoot, "_library/workout_categories.json"),
        };
    }

    async loadSettings() {
        const raw = await this.loadData() || {};
        const legacyPaths = raw.paths || raw;
        this.settings = {
            paths: this.normalizePaths({ ...DEFAULT_PATHS, ...legacyPaths }),
            previousPaths: this.normalizePaths({ ...DEFAULT_PATHS, ...(raw.previousPaths || legacyPaths) })
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    applyPathsGlobal(paths = this.settings.paths) {
        globalThis.obsidianGymPaths = this.derived(paths);
    }

    async ensureFolder(path) {
        const normalized = normalizeVaultPath(path);
        if (!normalized) return;
        let current = "";
        for (const part of normalized.split("/")) {
            current = current ? current + "/" + part : part;
            if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
        }
    }

    async ensurePathDirectories(pathsRaw) {
        const paths = this.derived(pathsRaw);
        for (const path of [
            paths.exercisesRoot,
            paths.workoutTemplatesRoot,
            paths.workoutsRoot,
            joinVaultPath(paths.exercisesRoot, "_library")
        ]) await this.ensureFolder(path);
    }

    isWithin(path, root) {
        const value = normalizeVaultPath(path);
        const base = normalizeVaultPath(root);
        return Boolean(value && base && (value === base || value.startsWith(base + "/")));
    }

    async savePathChanges(nextRaw, migrate = false) {
        const current = this.normalizePaths(this.settings.paths);
        const next = this.normalizePaths(nextRaw);
        if (JSON.stringify(current) === JSON.stringify(next)) {
            await this.ensurePathDirectories(next);
            this.applyPathsGlobal(next);
            new Notice("No path changes");
            return;
        }

        if (migrate) {
            await this.migratePaths(current, next);
            return;
        }

        await this.ensurePathDirectories(next);
        await this.updateBaseViews(current, next);
        this.settings.previousPaths = current;
        this.settings.paths = next;
        await this.saveSettings();
        this.applyPathsGlobal(next);
        new Notice("Gym paths saved");
    }

    async planMigration(oldRaw, nextRaw) {
        const oldPaths = this.derived(oldRaw);
        const nextPaths = this.derived(nextRaw);
        const mappings = this.getMigrationMappings(oldPaths, nextPaths);
        const result = { movable: 0, conflicts: 0, missing: 0 };

        for (const mapping of mappings) {
            if (mapping.from === mapping.to) continue;
            const source = this.app.vault.getAbstractFileByPath(mapping.from);
            if (!source) {
                result.missing += 1;
                continue;
            }
            if (source instanceof TFolder) {
                for (const file of this.app.vault.getFiles().filter(file => this.isWithin(file.path, mapping.from))) {
                    let rel = file.path.slice(mapping.from.length);
                    if (rel.startsWith("/")) rel = rel.slice(1);
                    const target = joinVaultPath(mapping.to, rel);
                    if (this.app.vault.getAbstractFileByPath(target)) result.conflicts += 1;
                    else result.movable += 1;
                }
            } else if (source instanceof TFile) {
                if (this.app.vault.getAbstractFileByPath(mapping.to)) result.conflicts += 1;
                else result.movable += 1;
            }
        }
        return result;
    }

    getMigrationMappings(oldPaths, nextPaths) {
        return [
            { from: oldPaths.exercisesRoot, to: nextPaths.exercisesRoot },
            { from: oldPaths.workoutTemplatesRoot, to: nextPaths.workoutTemplatesRoot },
            { from: oldPaths.workoutsRoot, to: nextPaths.workoutsRoot }
        ].filter((entry, index, list) =>
            entry.from && entry.to && list.findIndex(other => other.from === entry.from && other.to === entry.to) === index
        ).sort((a, b) => b.from.length - a.from.length);
    }

    async migratePaths(oldRaw, nextRaw) {
        const oldPaths = this.derived(oldRaw);
        const nextPaths = this.derived(nextRaw);
        if (JSON.stringify(this.normalizePaths(oldPaths)) === JSON.stringify(this.normalizePaths(nextPaths))) {
            new Notice("No path changes to migrate");
            return;
        }

        const summary = { moved: 0, conflicts: 0, errors: 0 };
        const mappings = this.getMigrationMappings(oldPaths, nextPaths);
        for (const mapping of mappings) {
            if (mapping.from === mapping.to) continue;
            const source = this.app.vault.getAbstractFileByPath(mapping.from);
            if (!source) continue;
            if (source instanceof TFolder) {
                const files = this.app.vault.getFiles()
                    .filter(file => this.isWithin(file.path, mapping.from))
                    .sort((a, b) => a.path.length - b.path.length);
                for (const file of files) {
                    let rel = file.path.slice(mapping.from.length);
                    if (rel.startsWith("/")) rel = rel.slice(1);
                    const target = joinVaultPath(mapping.to, rel);
                    if (this.app.vault.getAbstractFileByPath(target)) {
                        summary.conflicts += 1;
                        continue;
                    }
                    try {
                        await this.ensureFolder(parentPath(target));
                        await this.app.fileManager.renameFile(file, target);
                        summary.moved += 1;
                    } catch (error) {
                        console.error("Gym migration failed for", file.path, error);
                        summary.errors += 1;
                    }
                }
            } else if (source instanceof TFile) {
                if (this.app.vault.getAbstractFileByPath(mapping.to)) {
                    summary.conflicts += 1;
                } else {
                    try {
                        await this.ensureFolder(parentPath(mapping.to));
                        await this.app.fileManager.renameFile(source, mapping.to);
                        summary.moved += 1;
                    } catch (error) {
                        summary.errors += 1;
                    }
                }
            }
        }

        await this.ensurePathDirectories(nextPaths);
        await this.updateBaseViews(oldPaths, nextPaths);
        this.settings.previousPaths = this.normalizePaths(oldPaths);
        this.settings.paths = this.normalizePaths(nextPaths);
        await this.saveSettings();
        this.applyPathsGlobal(nextPaths);
        new Notice("Gym migration complete: moved " + summary.moved + ", conflicts " + summary.conflicts + ", errors " + summary.errors, 10000);
    }

    async updateBaseViews(oldRaw, nextRaw) {
        const oldPaths = this.derived(oldRaw);
        const nextPaths = this.derived(nextRaw);
        const replacements = [
            [oldPaths.exercisesRoot, nextPaths.exercisesRoot],
            [oldPaths.workoutTemplatesRoot, nextPaths.workoutTemplatesRoot],
            [oldPaths.workoutsRoot, nextPaths.workoutsRoot]
        ].filter(([from, to]) => from && to && from !== to);

        for (const path of ["Exercises List.base", "Workouts List.base", "Workouts History.base"]) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) continue;
            let content = await this.app.vault.read(file);
            const tokens = replacements.map((_, index) => "__GYM_PATH_" + index + "__");
            replacements.forEach(([from], index) => { content = content.split(from).join(tokens[index]); });
            replacements.forEach(([, to], index) => { content = content.split(tokens[index]).join(to); });
            await this.app.vault.modify(file, content);
        }
    }
}

class ObsidianGymSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.draft = { ...plugin.settings.paths };
    }

    pathDefinition(name, desc, key, placeholder) {
        return {
            name,
            desc,
            render: setting => setting.addText(text => text
                .setPlaceholder(placeholder)
                .setValue(this.draft[key] || "")
                .onChange(value => { this.draft[key] = normalizeVaultPath(value); }))
        };
    }

    getSettingDefinitions() {
        return [
            this.pathDefinition("Exercises root", "Exercise definitions and category library.", "exercisesRoot", DEFAULT_PATHS.exercisesRoot),
            this.pathDefinition("Workout templates root", "Saved workout routines.", "workoutTemplatesRoot", DEFAULT_PATHS.workoutTemplatesRoot),
            this.pathDefinition("Workouts root", "Generated workout sessions and logs.", "workoutsRoot", DEFAULT_PATHS.workoutsRoot),
            {
                name: "Save paths",
                desc: "Apply path changes to new operations and update Base views.",
                render: setting => setting.addButton(button => button
                    .setButtonText("Save")
                    .setCta()
                    .onClick(async () => {
                        await this.plugin.savePathChanges(this.draft, false);
                        this.draft = { ...this.plugin.settings.paths };
                    }))
            },
            {
                name: "Save + migrate",
                desc: "Move existing gym files to the new paths. Run the preview command first if you want a conflict count.",
                render: setting => setting.addButton(button => button
                    .setButtonText("Migrate")
                    .setWarning()
                    .onClick(async () => {
                        await this.plugin.savePathChanges(this.draft, true);
                        this.draft = { ...this.plugin.settings.paths };
                    }))
            }
        ];
    }
}

module.exports = ObsidianGymSettingsPlugin;
