---
workout_title: Push up
exercises: [464245, 464245, 464245, 464245, 464245]
workout_order: [464245, 464245, 464245, 464245, 464245]
type: custom
tags:
 - workout
---

```dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderHeader(note);
```

## Rest Timer
```button
name Quick Timer
type command
action QuickAdd: Start Timer
color blue
```
^button-timer

```dataviewjs
const {timer} = customJS;
await timer.renderTimerControls(this);
```

## Log Exercise
```button
name Log Exercise
type command
action QuickAdd: Log Exercise
color green
```
^button-log

## Remaining Exercises
```dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderRemaining(note);
```

## Performed Exercises
```dataviewjs
const {workout} = customJS;
const note = {dv: dv, container: this.container, window: window};
workout.renderPerformed(note);
workout.renderEffortChart(note);
```