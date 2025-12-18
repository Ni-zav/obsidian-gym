---
id: 276860
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: 
reps: 
effort: 
exercise: Triceps - dips
muscle_group: Triceps
equipment: Bodyweight
note: 
instructions: dip it deep.
tags:
  - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```
