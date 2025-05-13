---
id: custom
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
time: <% tp.date.now("HH:mm") %>
weight: <% await tp.system.prompt("Weight", "", true) %>
effort: <% await tp.system.suggester(["1 (easy)", "2", "3", "4", "5 (failure)"], ["1", "2", "3", "4", "5"]) %>
exercise: <% await tp.system.prompt("Exercise", "", true) %>
muscle_group: <% await tp.system.suggester(["Shoulders", "Legs", "Biceps", "Chest", "Abs", "Back", "Triceps"], ["Shoulders", "Legs", "Biceps", "Chest", "Abs", "Back", "Triceps"]) %>
equipment: <% await tp.system.suggester(["Barbell", "Dumbbell", "Kettlebell", "Machine", "Bodyweight", "Resistance Bands", "Cable Machine", "Smith Machine"], ["Barbell", "Dumbbell", "Kettlebell", "Machine", "Bodyweight", "Resistance Bands", "Cable Machine", "Smith Machine"]) %>
note: <% await tp.system.prompt("Note", "", true) %>
reps: <% await tp.system.prompt("Reps", "6", true) %>
sets: <% await tp.system.prompt("Sets", "6", true) %>
personalBests:
  weightPR: 0
  repsPR: 0
  volumePR: 0
  datePR: null
tags:
 - exercise
 - custom
---

```dataviewjs

const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: this.window};

exercise.renderDescription(note);

```



```dataviewjs

const {exercise} = customJS;
const note = {dv: dv, container: this.container, window: window};

exercise.renderEffortWeightChart(note);

```