---
id: 584404
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
timed: true
duration: <% await tp.system.prompt("Duration (seconds)", "45", true) %>
weight: <% await tp.system.prompt("Weight", "", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Core - plank
muscle_group: Core
equipment: Bodyweight
note: <% await tp.system.prompt("Note", "", true) %>
video_url: "later"
instructions: 'plank, hold it.'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```