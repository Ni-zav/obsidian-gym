---
id: 151534
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm:ss") %>
timed: true
duration: <% await tp.system.prompt("Duration (seconds)", "3600", true) %>
weight: 
effort: 
exercise: Full Body - jogging
muscle_group: Full Body
equipment: Bodyweight
note: 
video_url: "later on."
instructions: 'jogging.'
tags:
 - exercise
---

```dataviewjs
const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderDescription(note);
exercise.renderEffortWeightChart(note);
```
