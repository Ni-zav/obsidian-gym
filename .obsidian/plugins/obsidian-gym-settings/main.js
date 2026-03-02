const { Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile } = require("obsidian");

const DEFAULT_PATHS = {
    exercisesRoot: "Templates/exercises",
    exerciseCategoriesPath: "Templates/exercises/_library/categories.json",
    workoutCategoriesPath: "Templates/exercises/_library/workout_categories.json",
    workoutTemplatesRoot: "Templates/Workouts",
    workoutsRoot: "Workouts",
    programTemplatePath: "Templates/programs/_templates/program-template.md",
    programsOutputRoot: "Templates/programs/active-programs",
    startTemplatePath: "Templates/exercises/Start.md",
    endTemplatePath: "Templates/exercises/End.md",
    customTemplatePath: "Templates/exercises/Custom.md"
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

function parentPath(pathValue) {
    const normalized = normalizeVaultPath(pathValue);
    const idx = normalized.lastIndexOf("/");
    if (idx === -1) return "";
    return normalized.slice(0, idx);
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
                await this.ensurePathDirectories(this.settings.paths);
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
        const exercisesRoot = normalizeVaultPath(paths.exercisesRoot) || DEFAULT_PATHS.exercisesRoot;

        const legacyTemplatesRoot = normalizeVaultPath(paths.templatesRoot);
        const legacyTemplateNotesRoot = normalizeVaultPath(paths.templateNotesRoot) || legacyTemplatesRoot;
        const legacyProgramsRoot = normalizeVaultPath(paths.programsRoot) || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "programs") : "");

        return {
            exercisesRoot,
            exerciseCategoriesPath: normalizeVaultPath(paths.exerciseCategoriesPath) || joinVaultPath(exercisesRoot, "_library/categories.json"),
            workoutCategoriesPath: normalizeVaultPath(paths.workoutCategoriesPath) || joinVaultPath(exercisesRoot, "_library/workout_categories.json"),
            workoutTemplatesRoot: normalizeVaultPath(paths.workoutTemplatesRoot) || DEFAULT_PATHS.workoutTemplatesRoot,
            workoutsRoot: normalizeVaultPath(paths.workoutsRoot) || DEFAULT_PATHS.workoutsRoot,
            programTemplatePath: normalizeVaultPath(paths.programTemplatePath) || (legacyProgramsRoot ? joinVaultPath(legacyProgramsRoot, "_templates/program-template.md") : DEFAULT_PATHS.programTemplatePath),
            programsOutputRoot: normalizeVaultPath(paths.programsOutputRoot) || (legacyProgramsRoot ? joinVaultPath(legacyProgramsRoot, "active-programs") : DEFAULT_PATHS.programsOutputRoot),
            startTemplatePath: normalizeVaultPath(paths.startTemplatePath) || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "Start.md") : joinVaultPath(exercisesRoot, "Start.md")),
            endTemplatePath: normalizeVaultPath(paths.endTemplatePath) || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "End.md") : joinVaultPath(exercisesRoot, "End.md")),
            customTemplatePath: normalizeVaultPath(paths.customTemplatePath) || (legacyTemplateNotesRoot ? joinVaultPath(legacyTemplateNotesRoot, "Custom.md") : joinVaultPath(exercisesRoot, "Custom.md"))
        };
    }

    applyPathsGlobal(paths = this.settings.paths) {
        if (typeof globalThis === "undefined") return;
        globalThis.obsidianGymPaths = this.normalizePaths(paths);
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

    async ensurePathDirectories(pathsRaw) {
        const paths = this.normalizePaths(pathsRaw);

        const folderFields = [
            paths.exercisesRoot,
            paths.workoutTemplatesRoot,
            paths.workoutsRoot,
            paths.programsOutputRoot
        ];

        const fileParentFields = [
            paths.exerciseCategoriesPath,
            paths.workoutCategoriesPath,
            paths.programTemplatePath,
            paths.startTemplatePath,
            paths.endTemplatePath,
            paths.customTemplatePath
        ].map(parentPath);

        for (const folder of [...folderFields, ...fileParentFields]) {
            await this.ensureFolder(folder);
        }
    }

    async savePathChanges(nextPaths, migrateData = false) {
        const current = this.normalizePaths(this.settings.paths);
        const target = this.normalizePaths(nextPaths);

        const changed = JSON.stringify(current) !== JSON.stringify(target);
        if (!changed) {
            await this.ensurePathDirectories(target);
            this.applyPathsGlobal(target);
            new Notice("No path changes detected");
            return;
        }

        if (migrateData) {
            await this.migratePaths(current, target);
            return;
        }

        await this.ensurePathDirectories(target);
        await this.updateBaseViews(current, target);
        this.settings.previousPaths = current;
        this.settings.paths = target;
        await this.saveSettings();
        this.applyPathsGlobal(target);
        new Notice("Obsidian Gym paths saved");
    }

    isWithin(pathValue, root) {
        const pathNormalized = normalizeVaultPath(pathValue);
        const rootNormalized = normalizeVaultPath(root);
        if (!pathNormalized || !rootNormalized) return false;
        return pathNormalized === rootNormalized || pathNormalized.startsWith(`${rootNormalized}/`);
    }

    async migratePathAsset(fromPath, toPath) {
        const sourcePath = normalizeVaultPath(fromPath);
        const destinationPath = normalizeVaultPath(toPath);

        if (!sourcePath || !destinationPath || sourcePath === destinationPath) {
            return { moved: 0, conflicts: 0, missing: 0, errors: 0 };
        }

        const source = this.app.vault.getAbstractFileByPath(sourcePath);
        if (!source) {
            return { moved: 0, conflicts: 0, missing: 0, errors: 0 };
        }

        if (source instanceof TFolder) {
            return this.migrateFolder(sourcePath, destinationPath);
        }

        if (source instanceof TFile) {
            return this.migrateSingleFile(source, destinationPath);
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
            return { moved: 0, conflicts: 0, missing: 0, errors: 0 };
        }

        await this.ensureFolder(targetRoot);

        const files = this.app.vault.getFiles()
            .filter(file => this.isWithin(file.path, sourceRoot))
            .sort((a, b) => a.path.length - b.path.length);

        const result = { moved: 0, conflicts: 0, missing: 0, errors: 0 };

        for (const file of files) {
            const rel = file.path.slice(sourceRoot.length).replace(/^\//, "");
            const destinationPath = joinVaultPath(targetRoot, rel);

            if (this.app.vault.getAbstractFileByPath(destinationPath)) {
                result.conflicts += 1;
                continue;
            }

            try {
                await this.ensureFolder(parentPath(destinationPath));
                await this.app.fileManager.renameFile(file, destinationPath);
                result.moved += 1;
            } catch (error) {
                console.error("Failed to migrate file", file.path, error);
                result.errors += 1;
            }
        }

        return result;
    }

    async migrateSingleFile(sourceFile, destinationPathRaw) {
        const destinationPath = normalizeVaultPath(destinationPathRaw);
        if (!destinationPath || sourceFile.path === destinationPath) {
            return { moved: 0, conflicts: 0, missing: 0, errors: 0 };
        }

        if (this.app.vault.getAbstractFileByPath(destinationPath)) {
            return { moved: 0, conflicts: 1, missing: 0, errors: 0 };
        }

        try {
            await this.ensureFolder(parentPath(destinationPath));
            await this.app.fileManager.renameFile(sourceFile, destinationPath);
            return { moved: 1, conflicts: 0, missing: 0, errors: 0 };
        } catch (error) {
            console.error("Failed to migrate file", sourceFile.path, error);
            return { moved: 0, conflicts: 0, missing: 0, errors: 1 };
        }
    }

    async migratePaths(oldPathsRaw, newPathsRaw) {
        const oldPaths = this.normalizePaths(oldPathsRaw);
        const newPaths = this.normalizePaths(newPathsRaw);

        const changed = JSON.stringify(oldPaths) !== JSON.stringify(newPaths);
        if (!changed) {
            new Notice("No path changes to migrate");
            return;
        }

        const summary = { moved: 0, conflicts: 0, missing: 0, errors: 0 };

        const folderEntries = [
            { from: oldPaths.exercisesRoot, to: newPaths.exercisesRoot },
            { from: oldPaths.workoutTemplatesRoot, to: newPaths.workoutTemplatesRoot },
            { from: oldPaths.workoutsRoot, to: newPaths.workoutsRoot },
            { from: parentPath(oldPaths.programTemplatePath), to: parentPath(newPaths.programTemplatePath) },
            { from: oldPaths.programsOutputRoot, to: newPaths.programsOutputRoot }
        ];

        for (const entry of folderEntries) {
            const result = await this.migrateFolder(entry.from, entry.to);
            summary.moved += result.moved;
            summary.conflicts += result.conflicts;
            summary.missing += result.missing;
            summary.errors += result.errors;
        }

        const fileEntries = [
            { from: oldPaths.exerciseCategoriesPath, to: newPaths.exerciseCategoriesPath },
            { from: oldPaths.workoutCategoriesPath, to: newPaths.workoutCategoriesPath },
            { from: oldPaths.programTemplatePath, to: newPaths.programTemplatePath },
            { from: oldPaths.startTemplatePath, to: newPaths.startTemplatePath },
            { from: oldPaths.endTemplatePath, to: newPaths.endTemplatePath },
            { from: oldPaths.customTemplatePath, to: newPaths.customTemplatePath }
        ];

        for (const entry of fileEntries) {
            const result = await this.migratePathAsset(entry.from, entry.to);
            summary.moved += result.moved;
            summary.conflicts += result.conflicts;
            summary.missing += result.missing;
            summary.errors += result.errors;
        }

        await this.ensurePathDirectories(newPaths);
        await this.updateBaseViews(oldPaths, newPaths);

        this.settings.previousPaths = oldPaths;
        this.settings.paths = newPaths;
        await this.saveSettings();
        this.applyPathsGlobal(newPaths);

        new Notice(
            `Gym migration complete: moved ${summary.moved}, conflicts ${summary.conflicts}, errors ${summary.errors}`,
            10000
        );
    }

    async updateBaseViews(oldPathsRaw, newPathsRaw) {
        const oldPaths = this.normalizePaths(oldPathsRaw);
        const newPaths = this.normalizePaths(newPathsRaw);

        const filesToUpdate = [
            "Exercises List.base",
            "Workouts List.base",
            "Workouts History.base",
            "Program List.base",
            "Program History.base"
        ];

        for (const filePath of filesToUpdate) {
            const exists = await this.app.vault.adapter.exists(filePath);
            if (!exists) continue;

            let content = await this.app.vault.adapter.read(filePath);
            const original = content;

            content = replaceAllLiteral(content, oldPaths.exercisesRoot, newPaths.exercisesRoot);
            content = replaceAllLiteral(content, oldPaths.workoutTemplatesRoot, newPaths.workoutTemplatesRoot);
            content = replaceAllLiteral(content, oldPaths.workoutsRoot, newPaths.workoutsRoot);
            content = replaceAllLiteral(content, oldPaths.programsOutputRoot, newPaths.programsOutputRoot);

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
            text: "All fields are independent. Use vault-relative paths and mix any structure you want."
        });

        new Setting(containerEl)
            .setName("Exercises root")
            .setDesc("Folder where exercise templates are saved and loaded")
            .addText(text => text
                .setPlaceholder("Templates/exercises")
                .setValue(draft.exercisesRoot)
                .onChange(value => draft.exercisesRoot = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Exercise categories file")
            .setDesc("Path to categories.json")
            .addText(text => text
                .setPlaceholder("Templates/exercises/_library/categories.json")
                .setValue(draft.exerciseCategoriesPath)
                .onChange(value => draft.exerciseCategoriesPath = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Workout categories file")
            .setDesc("Path to workout_categories.json")
            .addText(text => text
                .setPlaceholder("Templates/exercises/_library/workout_categories.json")
                .setValue(draft.workoutCategoriesPath)
                .onChange(value => draft.workoutCategoriesPath = normalizeVaultPath(value)));

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
            .setName("Program template file")
            .setDesc("Path to program-template.md")
            .addText(text => text
                .setPlaceholder("Templates/programs/_templates/program-template.md")
                .setValue(draft.programTemplatePath)
                .onChange(value => draft.programTemplatePath = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Programs output root")
            .setDesc("Folder where created program notes are saved")
            .addText(text => text
                .setPlaceholder("Templates/programs/active-programs")
                .setValue(draft.programsOutputRoot)
                .onChange(value => draft.programsOutputRoot = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Start template file")
            .setDesc("Path to Start.md (default is inside exercises root)")
            .addText(text => text
                .setPlaceholder("Templates/exercises/Start.md")
                .setValue(draft.startTemplatePath)
                .onChange(value => draft.startTemplatePath = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("End template file")
            .setDesc("Path to End.md (default is inside exercises root)")
            .addText(text => text
                .setPlaceholder("Templates/exercises/End.md")
                .setValue(draft.endTemplatePath)
                .onChange(value => draft.endTemplatePath = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Custom template file")
            .setDesc("Path to Custom.md (default is inside exercises root)")
            .addText(text => text
                .setPlaceholder("Templates/exercises/Custom.md")
                .setValue(draft.customTemplatePath)
                .onChange(value => draft.customTemplatePath = normalizeVaultPath(value)));

        new Setting(containerEl)
            .setName("Save path settings")
            .setDesc("Applies new paths and auto-creates missing folders for writable targets")
            .addButton(button => button
                .setButtonText("Save")
                .setCta()
                .onClick(async () => {
                    await this.plugin.savePathChanges(draft, false);
                }));

        new Setting(containerEl)
            .setName("Save and migrate existing data")
            .setDesc("Moves files/folders to new configured paths when possible")
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
