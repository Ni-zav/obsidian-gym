---
id: 654821
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
timed: true
duration: <% await tp.system.prompt("Duration (seconds)", "30", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Glutes - b
muscle_group: Glutes
equipment: Bodyweight
note: <% await tp.system.prompt("Note", "", true) %>
instructions: 'nm'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```