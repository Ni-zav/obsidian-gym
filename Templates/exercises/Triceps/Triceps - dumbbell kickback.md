---
id: 412067
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: <% await tp.system.prompt("Weight", "", true) %>
reps: <% await tp.system.prompt("Reps", "8", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Triceps - dumbbell kickback
muscle_group: Triceps
equipment: Dumbbell
note: <% await tp.system.prompt("Note", "", true) %>
instructions: 'alternate arm'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```