# Create

## Exercise

```meta-bind-button
label: Add Exercise
style: primary
actions:
  - type: command
    command: quickadd:choice:aeaf28e2-ba08-4988-948d-79b10bde8deb
```

New exercises use schema v2: stable UUID, definition-only metadata, optional default load/reps/duration, and per-exercise rest time.

## Routine

```meta-bind-button
label: Create Workout Routine
style: primary
actions:
  - type: command
    command: quickadd:choice:1ce4bca4-4630-4c48-944d-19adf1c3f623
```

A routine only stores its planned exercise IDs and set order. Starting it from [[Home]] creates the actual workout session.
