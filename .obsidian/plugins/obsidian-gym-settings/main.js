const { Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile } = require("obsidian");

const DEFAULT_PATHS = {
    templatesRoot: "Templates",
    exercisesRoot: "Templates/exercises",
    workoutTemplatesRoot: "Templates/Workouts",
    workoutsRoot: "Workouts"
};

function normalizeVaultPath(pathValue) {
    if (!pathValue || typeof pathValue !== "string") return "";
    return pathValue.replace(/\\/g, "/").trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinVaultPath(...parts) {
    return parts
        .filter(Boolean)
        .map((part, index) => {
            const value = String(part);
            if (index === 0) return value.replace(/\/+$/, "");
            return value.replace(/^\/+/, "").replace(/\/+$/, "");
        })
        .join("/");
}

function replaceAllLiteral(content, source, target) {
    if (!source || source === target) return content;
    return content.split(source).join(target);
}

class ObsidianGymSettingsPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.applyPathsGlobal();

        this.addSettingTab(new ObsidianGymSettingsTab(this.app, this));

        this.addCommand({
            id: "obsidian-gym-reapply-path-settings",
            name: "Re-apply Obsidian Gym path settings",
            callback: async () => {
                this.applyPathsGlobal();
                new Notice("Obsidian Gym paths applied to runtime");
            }
        });

        this.addCommand({
            id: "obsidian-gym-migrate-from-previous",
            name: "Migrate Obsidian Gym data from previous paths",
            callback: async () => {
                const previous = this.settings.previousPaths || DEFAULT_PATHS;
                const current = this.settings.paths;
                const changed = JSON.stringify(previous) !== JSON.stringify(current);
                if (!changed) {
                    new Notice("No path changes to migrate");
                    return;
                }

                await this.migratePaths(previous, current);
            }
        });
    }

    onunload() {
        if (typeof globalThis !== "undefined" && globalThis.obsidianGymPaths) {
            globalThis.obsidianGymPaths = { ...globalThis.obsidianGymPaths };
        }
    }

    async loadSettings() {
        const raw = await this.loadData();
        const savedPaths = raw?.paths || raw || {};
        const previousPaths = raw?.previousPaths || DEFAULT_PATHS;

        this.settings = {
            paths: this.normalizePaths({ ...DEFAULT_PATHS, ...savedPaths }),
            previousPaths: this.normalizePaths({ ...DEFAULT_PATHS, ...previousPaths })
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    normalizePaths(paths) {
        return {
            templatesRoot: normalizeVaultPath(paths.templatesRoot) || DEFAULT_PATHS.templatesRoot,
            exercisesRoot: normalizeVaultPath(paths.exercisesRoot) || DEFAULT_PATHS.exercisesRoot,
            workoutTemplatesRoot: normalizeVaultPath(paths.workoutTemplatesRoot) || DEFAULT_PATHS.workoutTemplatesRoot,
            workoutsRoot: normalizeVaultPath(paths.workoutsRoot) || DEFAULT_PATHS.workoutsRoot
        };
    }

    applyPathsGlobal(paths = this.settings.paths) {
        if (typeof globalThis === "undefined") return;
        globalThis.obsidianGymPaths = this.normalizePaths(paths);
    }

    async savePathChanges(nextPaths, migrateData = false) {
        const current = this.normalizePaths(this.settings.paths);
        const target = this.normalizePaths(nextPaths);

        const changed = JSON.stringify(current) !== JSON.stringify(target);
        if (!changed) {
            this.applyPathsGlobal(target);
            new Notice("No path changes detected");
            return;
        }

        if (migrateData) {
            await this.migratePaths(current, target);
            return;
        }

        await this.updateBaseViews(current, target);
        this.settings.previousPaths = current;
        this.settings.paths = target;
        await this.saveSettings();
        this.applyPathsGlobal(target);
        new Notice("Obsidian Gym paths saved");
    }

    async migratePaths(oldPathsRaw, newPathsRaw) {
        const oldPaths = this.normalizePaths(oldPathsRaw);
        const newPaths = this.normalizePaths(newPathsRaw);

        const changed = JSON.stringify(oldPaths) !== JSON.stringify(newPaths);
        if (!changed) {
            new Notice("No path changes to migrate");
            return;
        }

        const summary = {
            moved: 0,
            conflicts: 0,
            missing: 0,
            errors: 0
        };

        const roots = [
            { from: oldPaths.exercisesRoot, to: newPaths.exercisesRoot, label: "exercises" },
            { from: oldPaths.workoutTemplatesRoot, to: newPaths.workoutTemplatesRoot, label: "workout templates" },
            { from: oldPaths.workoutsRoot, to: newPaths.workoutsRoot, label: "workouts" }
        ];

        for (const root of roots) {
            const result = await this.migrateFolder(root.from, root.to, root.label);
            summary.moved += result.moved;
            summary.conflicts += result.conflicts;
            summary.missing += result.missing;
            summary.errors += result.errors;
        }

        const templateAssets = ["Start.md", "End.md", "Custom.md", "programs"];
        for (const asset of templateAssets) {
            const from = joinVaultPath(oldPaths.templatesRoot, asset);
            const to = joinVaultPath(newPaths.templatesRoot, asset);
            const result = await this.migratePathAsset(from, to);
            summary.moved += result.moved;
            summary.conflicts += result.conflicts;
            summary.missing += result.missing;
            summary.errors += result.errors;
        }

        await this.updateBaseViews(oldPaths, newPaths);

        this.settings.previousPaths = oldPaths;
        this.settings.paths = newPaths;
        await this.saveSettings();
        this.applyPathsGlobal(newPaths);

        const message = `Gym migration complete: moved ${summary.moved}, conflicts ${summary.conflicts}, missing ${summary.missing}, errors ${summary.errors}`;
        new Notice(message, 10000);
    }

    async migratePathAsset(fromPath, toPath) {
        const source = this.app.vault.getAbstractFileByPath(fromPath);
        if (!source) {
            return { moved: 0, conflicts: 0, missing: 1, errors: 0 };
        }

        if (source instanceof TFolder) {
            return this.migrateFolder(fromPath, toPath, "template asset folder");
        }

        if (source instanceof TFile) {
            return this.migrateSingleFile(source, toPath);
        }

        return { moved: 0, conflicts: 0, missing: 0, errors: 1 };
    }

    async migrateFolder(fromRoot, toRoot) {
        const sourceRoot = normalizeVaultPath(fromRoot);
        const targetRoot = normalizeVaultPath(toRoot);

        if (!sourceRoot || !targetRoot || sourceRoot === targetRoot) {
            return { moved: 0, conflicts: 0, missing: 0, errors: 0 };
        }

        const exists = await this.app.vault.adapter.exists(sourceRoot);
        if (!exists) {
            return { moved: 0, conflicts: 0, missing: 1, errors: 0 };
        }

        await this.ensureFolder(targetRoot);

        const files = this.app.vault.getFiles()
            .filter(file => file.path === sourceRoot || file.path.startsWith(`${sourceRoot}/`))
            .sort((a, b) => a.path.length - b.path.length);

        const result = { moved: 0, conflicts: 0, missing: 0, errors: 0 };

        for (const file of files) {
            const rel = file.path === sourceRoot ? file.name : file.path.slice(sourceRoot.length + 1);
            const destinationPath = joinVaultPath(targetRoot, rel);

            if (this.app.vault.getAbstractFileByPath(destinationPath)) {
                result.conflicts += 1;
                continue;
            }

            try {
                await this.ensureFolder(this.getParentPath(destinationPath));
                await this.app.fileManager.renameFile(file, destinationPath);
                result.moved += 1;
            } catch (error) {
                console.error("Failed to migrate file", file.path, error);
                result.errors += 1;
            }
        }

        return result;
    }

    async migrateSingleFile(sourceFile, destinationPath) {
        const destination = normalizeVaultPath(destinationPath);
        if (!destination || sourceFile.path === destination) {
            return { moved: 0, conflicts: 0, missing: 0, errors: 0 };
        }

        if (this.app.vault.getAbstractFileByPath(destination)) {
            return { moved: 0, conflicts: 1, missing: 0, errors: 0 };
        }

        try {
            await this.ensureFolder(this.getParentPath(destination));
            await this.app.fileManager.renameFile(sourceFile, destination);
            return { moved: 1, conflicts: 0, missing: 0, errors: 0 };
        } catch (error) {
            console.error("Failed to migrate file", sourceFile.path, error);
            return { moved: 0, conflicts: 0, missing: 0, errors: 1 };
        }
    }

    async ensureFolder(folderPath) {
        const normalized = normalizeVaultPath(folderPath);
        if (!normalized) return;

        const parts = normalized.split("/");
        let current = "";

        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            const exists = await this.app.vault.adapter.exists(current);
            if (!exists) {
                await this.app.vault.createFolder(current);
            }
        }
    }

    getParentPath(pathValue) {
        const normalized = normalizeVaultPath(pathValue);
        const idx = normalized.lastIndexOf("/");
        if (idx === -1) return "";
        return normalized.slice(0, idx);
    }

    async updateBaseViews(oldPathsRaw, newPathsRaw) {
        const oldPaths = this.normalizePaths(oldPathsRaw);
        const newPaths = this.normalizePaths(newPathsRaw);

        const filesToUpdate = [
            "Exercises List.base",
            "Workouts List.base",
            "Workouts History.base"
        ];

        for (const filePath of filesToUpdate) {
            const exists = await this.app.vault.adapter.exists(filePath);
            if (!exists) continue;

            let content = await this.app.vault.adapter.read(filePath);
            const original = content;

            content = replaceAllLiteral(content, `${oldPaths.exercisesRoot}/_library`, `${newPaths.exercisesRoot}/_library`);
            content = replaceAllLiteral(content, oldPaths.exercisesRoot, newPaths.exercisesRoot);
            content = replaceAllLiteral(content, oldPaths.workoutTemplatesRoot, newPaths.workoutTemplatesRoot);
            content = replaceAllLiteral(content, oldPaths.workoutsRoot, newPaths.workoutsRoot);

            if (content !== original) {
                await this.app.vault.adapter.write(filePath, content);
            }
        }
    }
}

class ObsidianGymSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        const draft = { ...this.plugin.settings.paths };

        containerEl.createEl("h2", { text: "Obsidian Gym Paths" });
        containerEl.createEl("p", {
            text: "Use vault-relative paths. Example: Templates/exercises or fitness/workouts/templates."
        });

        new Setting(containerEl)
            .setName("Templates root")
            .setDesc("Base folder for shared templates (Start.md, End.md, Custom.md, programs)")
            .addText(text => text
                .setPlaceholder("Templates")
                .setValue(draft.templatesRoot)
                .onChange(value => draft.templatesRoot = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Exercises root")
            .setDesc("Folder where exercise templates are saved and loaded")
            .addText(text => text
                .setPlaceholder("Templates/exercises")
                .setValue(draft.exercisesRoot)
                .onChange(value => draft.exercisesRoot = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Workout templates root")
            .setDesc("Folder where workout routine templates are saved and selected")
            .addText(text => text
                .setPlaceholder("Templates/Workouts")
                .setValue(draft.workoutTemplatesRoot)
                .onChange(value => draft.workoutTemplatesRoot = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Workouts root")
            .setDesc("Folder where generated daily workouts are created")
            .addText(text => text
                .setPlaceholder("Workouts")
                .setValue(draft.workoutsRoot)
                .onChange(value => draft.workoutsRoot = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Save path settings")
            .setDesc("Applies new paths for future runs without moving existing files")
            .addButton(button => button
                .setButtonText("Save")
                .setCta()
                .onClick(async () => {
                    await this.plugin.savePathChanges(draft, false);
                }));

        new Setting(containerEl)
            .setName("Save and migrate existing data")
            .setDesc("Moves exercises, workout templates, workouts, and core template files to the new paths")
            .addButton(button => button
                .setButtonText("Save + Migrate")
                .setWarning()
                .onClick(async () => {
                    const confirmed = window.confirm("This moves existing gym files to the new configured paths. Continue?");
                    if (!confirmed) return;
                    await this.plugin.savePathChanges(draft, true);
                }));
    }
}

module.exports = ObsidianGymSettingsPlugin;
