---
id: 579826
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: 
reps: 
effort: 
exercise: Lower Body - squat
muscle_group: Lower Body
equipment: Barbell
note: 
instructions: just squat.
tags:
  - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```
