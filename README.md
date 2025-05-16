# Enhanced Obsidian Gym Log

An advanced workout tracking system for [Obsidian](https://obsidian.md/), based on and inspired by [martinjo's obsidian-gym-log](https://github.com/martinjo/obsidian-gym-log) with significant enhancements and improvements.

## Features

- 📊 Rich data visualization with effort and volume charts
- ⏱️ Built-in rest timer
- 💪 Exercise library management
- 📈 Progress tracking
- 🎯 Set and rep counting
- 📝 Workout templating
- 🔄 Custom exercise support
- ⚡ Quick exercise logging
- 📅 Calendar heatmap for workout tracking


## Usage Guide

### Starting a Workout

1. Open "Workout list"
2. Click "Start Workout"
3. Select a workout template
4. Begin logging exercises

### Logging Exercises

1. In an active workout:
   - Click "Log Exercise"
   - Select from remaining exercises
   - Enter weight, reps, and effort
   - Add optional notes

### Creating Custom Workouts

1. Use "Create Workout Routine"
2. Select exercises from library
3. Specify sets for each exercise
4. Save template

### Adding New Exercises

1. Use "Add Exercise to Library"
2. Enter exercise details:
   - Name
   - Muscle group
   - Equipment
   - Instructions
   - Optional video URL

## Plugins

1. [Dataview](https://github.com/blacksmithgu/obsidian-dataview) - Data querying and visualization
2. [Meta Bind](https://github.com/mProjectsCode/obsidian-meta-bind-plugin) - Enhanced UI controls
3. [Templater](https://github.com/SilentVoid13/Templater) - Advanced templating
4. [QuickAdd](https://github.com/chhoumann/quickadd) - Quick actions and macros
5. [CustomJS](https://github.com/saml-dev/obsidian-custom-js) - Custom JavaScript support
6. [Obsidian Charts](https://github.com/phibr0/obsidian-charts) - Data visualization
7. [Heatmap Calendar](https://github.com/Richardsl/heatmap-calendar-obsidian) - Workout calendar view

## To-do
- [x] fix renderRemaining() function
- [x] change workout-type to something else (type of workout? push? upper body? cardio? recovery?)
- [x] add timed workout functionality (warm up, plank, jog, etc.)
- [x] Add some exercises templates
- [x] Add few more workout templates
- [x] Add some basic/general muscle groups
- [ ] Add Workout Program Feature (but I don't know what is program yet) (might not be needed for simple and streamlined system)
- [ ] if possible, add full body visualization of each exercises done and soreness/muscle area (simulate rest periods and recovery)
- [ ] hide properties is default on notes inside workouts folder
- [x] change order of input fields to be more user-friendly
- [x] fix chart logic in workout routine
- [x] fix chart on exercise, x-axis should be time and date, not just date.
- [ ] add demo video
- [ ] add relation between equipment and place for better exercises selection
- [ ] add muscle-group or exercises dashboard

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Original [obsidian-gym-log](https://github.com/martinjo/obsidian-gym-log) by martinjo
- Obsidian Community for various plugins