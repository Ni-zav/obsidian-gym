---
id: 649346
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: <% await tp.system.prompt("Weight", "", true) %>
reps: <% await tp.system.prompt("Reps", "20", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Neck - neck bridge
muscle_group: Neck
equipment: Bodyweight
note: <% await tp.system.prompt("Note", "", true) %>
instructions: 'do isometric. avoid using your top part of your head.'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```