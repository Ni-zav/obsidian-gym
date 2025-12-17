---
workout_title: push-1
date: <% tp.date.now("YYYY-MM-DD") %>
time: <% tp.date.now("HH:mm") %>
exercises: [741600, 741600, 741600, 741600, 379969, 379969, 379969, 379969, 728817, 728817, 728817, 728817, 728817, 808829, 808829, 808829, 535529, 535529, 535529, 535529]
workout_order: [741600, 741600, 741600, 741600, 379969, 379969, 379969, 379969, 728817, 728817, 728817, 728817, 728817, 808829, 808829, 808829, 535529, 535529, 535529, 535529]
workout_type: Weight Training
workout_place: Home
Logs: []
tags:
 - workout
---

```dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderHeader(note);
```

## Rest Timer
---
```meta-bind-button
label: Start Timer
icon: ""
style: default
class: ""
cssStyle: ""
backgroundImage: ""
tooltip: ""
id: ""
hidden: false
actions:
  - type: command
    command: quickadd:choice:a9b81cef-90e8-4dce-a426-791f54e2a43d
```

```dataviewjs
const {timer} = customJS;
await timer.renderTimerControls(this);
```

## Log Exercise
---
```meta-bind-button
label: Log Exercise
icon: ""
style: primary
class: ""
cssStyle: ""
backgroundImage: ""
tooltip: ""
id: ""
hidden: false
actions:
  - type: command
    command: quickadd:choice:d5df32b0-6a04-481d-9a8d-b9bd1b2f0ea7
```

## Remaining Exercises
---
```dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderRemaining(note);
```

## Performed Exercises
---
```dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderPerformed(note);
workout.renderEffortChart(note);
```