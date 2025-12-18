---
id: 808829
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: 
reps: 
effort: 
exercise: Triceps - dumbbells skull crusher
muscle_group: Triceps
equipment: Pair of Dumbbells
note: 
instructions: crush it man.
tags:
  - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```
