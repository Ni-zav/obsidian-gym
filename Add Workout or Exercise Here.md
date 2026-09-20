# Create

```dataviewjs
const actions = [
  ["Add Exercise", "quickadd:choice:aeaf28e2-ba08-4988-948d-79b10bde8deb"],
  ["Create Workout Routine", "quickadd:choice:1ce4bca4-4630-4c48-944d-19adf1c3f623"]
];
const row = this.container.createDiv({ cls: "gym-home-actions" });
for (const [label, command] of actions) {
  const button = row.createEl("button", { text: label, cls: "mod-cta" });
  button.addEventListener("click", () => app.commands.executeCommandById(command));
}
```

New exercises use schema v2: stable UUID, definition-only metadata, optional default load/reps/duration, and per-exercise rest time.

A routine only stores planned exercise IDs and set order. Starting it from [[Home]] creates the workout session.
