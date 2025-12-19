module.exports = async function startTodaysWorkout(params) {
    try {
        // Validate required parameters
        if (!params || !params.obsidian || !params.quickAddApi || !app.plugins.plugins["templater-obsidian"]) {
            throw new Error("Missing required dependencies");
        }

        console.log("Script: Starting today's workout.");

        const obsidian = params.obsidian;
        const templater = app.plugins.plugins["templater-obsidian"].templater;
        const cache = app.metadataCache;
        const files = app.vault.getMarkdownFiles();
        let workouts = [];

        // Only collect workout templates from Templates/Workouts
        for(const file of files) {
            if (!file.path.startsWith('Templates/Workouts/')) continue;
            
            const file_cache = cache.getFileCache(file);
            if (!file_cache) continue;
            
            const tags = obsidian.getAllTags(file_cache);
            if (!tags) continue;
            
            let metadata = cache.getFileCache(file);
            if (!metadata || !metadata.frontmatter) continue;

            if (tags.includes("#workout")) {
                workouts.push(file);
            }
        }

        if (workouts.length === 0) {
            throw new Error("No workout templates found in Templates/Workouts/");
        }

        function sortworkout(a, b) {
            return a.basename.localeCompare(b.basename, undefined, {numeric: true, sensitivity: 'base'});
        }

        const hemmagym = workouts.filter(w => w.basename.includes('Hemmagym')).sort(sortworkout);
        const gym = workouts.filter(w => !w.basename.includes('Hemmagym')).sort(sortworkout);
        workouts = [].concat(gym, hemmagym);

        // Display files to select
        const notesDisplay = await params.quickAddApi.suggester(
            (file) => file.basename,
            workouts
        );

        if (!notesDisplay) {
            console.log("User cancelled workout selection");
            new Notice("Workout selection cancelled");
            params.variables = { notePath: "" };
            return;
        }

        // Expand template
        console.log("Creating note from template: " + notesDisplay.path);
        let templateFile = app.vault.getAbstractFileByPath(notesDisplay.path);
        if (!templateFile) {
            throw new Error("Template file not found: " + notesDisplay.path);
        }

        let now = moment(new Date());
        // Strip all extensions and ensure we only add one .md
        let nameWoExt = templateFile.name.split('.')[0];
        let targetPath = 'Workouts/' + now.format("YYYY-MM-DD") + ' - ' + nameWoExt;
        
        // Create folders if they don't exist
        if (!await app.vault.exists(targetPath)) {
            await app.vault.createFolder(targetPath);
            await app.vault.createFolder(targetPath + '/Log');
        }

        let targetFolder = app.vault.getAbstractFileByPath(targetPath);
        if (!targetFolder) {
            throw new Error("Failed to create or access target folder: " + targetPath);
        }

        // Create new file from template
        let fileName = nameWoExt;  // nameWoExt is already clean, just add one .md
        let newNote;

        if (!await app.vault.exists(targetPath + '/' + fileName)) {
            newNote = await templater.create_new_note_from_template(templateFile, targetFolder, fileName, false);
            if (!newNote) {
                throw new Error("Failed to create new note from template");
            }

            // Add id to FrontMatter
            let content = await app.vault.read(newNote);
            const regex = /---\n+/m;
            const subst = '---\nid: ' + generateGuid() + '\n';
            content = content.replace(regex, subst);
            await app.vault.modify(newNote, content);
        } else {
            params.variables = { notePath: "" };
            return;
        }

        // Pass selected note's path to notes variable
        params.variables = { notePath: newNote.path };
        console.log("Successfully created workout: " + newNote.path);

        // Open the new note
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(newNote);

    } catch (error) {
        console.error("Error creating workout:", error);
        // Re-throw the error to be handled by the calling function
        throw error;
    }
}

function generateGuid() {
    let result = '';
    for(let j = 0; j < 6; j++) {
        result += Math.floor(Math.random() * 16).toString(16).toLowerCase();
    }
    return result;
}
