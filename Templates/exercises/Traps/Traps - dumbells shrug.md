---
id: 672037
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: <% await tp.system.prompt("Weight", "", true) %>
reps: <% await tp.system.prompt("Reps", "12", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Traps - dumbells shrug
muscle_group: Traps
equipment: Pair of Dumbbells
note: <% await tp.system.prompt("Note", "", true) %>
instructions: 'shrug it off'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```