---
id: 5c8864
workout_title: abc
date: 2025-12-18
time: 01:58
exercises:
  - 286289
  - 286289
  - 286289
  - 858572
  - 858572
  - 858572
  - 527062
  - 527062
  - 527062
workout_order:
  - 286289
  - 286289
  - 286289
  - 858572
  - 858572
  - 858572
  - 527062
  - 527062
  - 527062
workout_type: Weight Training
workout_place: Home
tags:
  - workout
Logs:
  - Workouts/2025-12-18 - abc/Log/1.md
  - Workouts/2025-12-18 - abc/Log/2.md
  - Workouts/2025-12-18 - abc/Log/3.md
  - Workouts/2025-12-18 - abc/Log/4.md
ExerciseCounts:
  Abs - leg raises: 2
ExercisesSummary: Abs - leg raises x2
Total Volume: 110
duration: 7 Minutes
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