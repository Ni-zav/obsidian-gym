---
id: 664283
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm") %>
weight: <% await tp.system.prompt("Weight", "", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Core - plank
muscle_group: Core
equipment: Bodyweight
note: <% await tp.system.prompt("Note", "", true) %>
reps: <% await tp.system.prompt("Reps", "60", true) %>
sets: 6
video_url: nope
instructions: plank
tags:
  - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```