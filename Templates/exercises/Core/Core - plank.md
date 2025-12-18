---
id: 584404
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
timed: true
duration: <% await tp.system.prompt("Duration (seconds)", "45", true) %>
weight: 
effort: 
exercise: Core - plank
muscle_group: Core
equipment: Bodyweight
note: 
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
