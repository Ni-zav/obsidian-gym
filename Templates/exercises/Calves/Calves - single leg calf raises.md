---
id: 193260
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
weight: 
reps: 
effort: 
exercise: Calves - single leg calf raises
muscle_group: Calves
equipment: Bodyweight
note: 
instructions: each alternate, so if you want to do 2 sets, write 4 sets.
tags:
  - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```
