---
id: 345396
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
timed: false
weight: <% await tp.system.prompt("Weight", "", true) %>
reps: <% await tp.system.prompt("Reps", "5", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: Abs - bb
muscle_group: Abs
equipment: Barbell
note: <% await tp.system.prompt("Note", "", true) %>
video_url: "b"
instructions: 'b'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```