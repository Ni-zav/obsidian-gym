---
id: 397007
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: 
reps: 
effort: 
exercise: Front Deltoids - dumbbells front raise
muscle_group: Front Deltoids
equipment: Pair of Dumbbells
note: 
instructions: front
tags:
  - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```
