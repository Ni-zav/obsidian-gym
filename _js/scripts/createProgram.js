module.exports = async function createProgram(params) {
    const { app, quickAddApi: { inputPrompt, suggester } } = params;
    
    try {
        const templater = app.plugins.plugins["templater-obsidian"].templater;

        // Ensure template exists
        const templatePath = "Templates/programs/_templates/program-template.md";
        const templateFile = app.vault.getAbstractFileByPath(templatePath);
        if (!templateFile) {
            throw new Error("Program template not found! Please check that the template exists at: " + templatePath);
        }

        // Get the program name first
        const programName = await inputPrompt("Enter program name");
        if (!programName) {
            throw new Error("Program name is required");
        }

        // Create target folder if it doesn't exist
        const targetPath = "Templates/programs/active-programs";
        if (!await app.vault.adapter.exists(targetPath)) {
            await app.vault.createFolder(targetPath);
        }
        
        const targetFolder = app.vault.getAbstractFileByPath(targetPath);
        if (!targetFolder) {
            throw new Error("Failed to access or create the active programs folder");
        }        // Create new program from template
        const timestamp = moment().format("YYYY-MM-DD");
        const fileName = `${timestamp}-${programName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.md`;
        
        const newProgram = await templater.create_new_note_from_template(templateFile, targetFolder, fileName, false);
        if (!newProgram) {
            throw new Error("Failed to create new program from template");
        }

        // Wait a moment for the file to be fully created
        await new Promise(resolve => setTimeout(resolve, 100));

        // Pass the new program's path back
        params.variables = { programPath: newProgram.path };
        
        // Open the new program
        await app.workspace.getLeaf().openFile(newProgram);

    } catch (error) {
        console.error("Error creating program:", error);
        new Notice("Failed to create program: " + error.message);
    }
}
