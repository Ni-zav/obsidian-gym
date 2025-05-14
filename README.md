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

## System Overview

### Core Components

1. **Workout Management**
   - Create custom workout routines
   - Track sets, reps, weights, and effort
   - Monitor workout completion
   - Real-time progress visualization

2. **Exercise Library**
   - Organized by muscle groups
   - Exercise details with instructions
   - Support for video demonstrations
   - Equipment tracking

3. **Progress Tracking**
   - Weight progression charts
   - Effort tracking
   - Volume calculations
   - Historical performance view

4. **Timer System**
   - Rest timer with presets
   - Workout duration tracking
   - Visual and audio cues

### File Structure

```
📁 _js/              # Core JavaScript functionality
├── 📁 scripts/      # Command scripts
└── 📁 shared/       # Shared utilities and classes

📁 Templates/        # Template files
├── 📁 exercises/    # Exercise templates
└── 📁 Workouts/    # Workout templates

📁 Workouts/        # Active workout files
└── 📁 [DATE]/      # Date-organized workouts
    └── 📁 Log/     # Individual exercise logs
```

## Required Plugins

1. [Dataview](https://github.com/blacksmithgu/obsidian-dataview) - Data querying and visualization
2. [Meta Bind](https://github.com/mProjectsCode/obsidian-meta-bind-plugin) - Enhanced UI controls
3. [Templater](https://github.com/SilentVoid13/Templater) - Advanced templating
4. [QuickAdd](https://github.com/chhoumann/quickadd) - Quick actions and macros
5. [CustomJS](https://github.com/saml-dev/obsidian-custom-js) - Custom JavaScript support
6. [Obsidian Charts](https://github.com/phibr0/obsidian-charts) - Data visualization
7. [Heatmap Calendar](https://github.com/Richardsl/heatmap-calendar-obsidian) - Workout calendar view

## Setup Instructions

1. **Install Required Plugins**
   - Install all plugins listed above through Obsidian's Community Plugins

2. **Configure CustomJS**
   - Enable CustomJS plugin
   - Point to the '_js/shared' folder in settings

3. **Configure QuickAdd**
   Add the following macros:
   - Start Workout
   - Log Exercise
   - Create Workout Routine
   - Add Exercise to Library

4. **Configure Templater**
   - Set template folder to 'Templates'
   - Enable folder templates

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

## Features In Detail

### Exercise Tracking
- Weight progression
- Effort tracking (1-5 scale)
- Set/rep counting
- Rest timing
- Notes and form cues

### Data Visualization
- Effort charts
- Volume tracking
- Weight progression
- Calendar heatmap

### Templates
- Workout templates
- Exercise templates
- Custom exercise support
- Flexible organization

## Mobile Support

The vault is fully compatible with Obsidian Mobile, featuring:
- Touch-friendly controls
- Responsive layouts
- Quick-access buttons
- Mobile-optimized views

## Customization

The system is highly customizable through:
- JavaScript customization
- Template modification
- Custom exercise types
- Workout organization
- Data visualization options

## To-do
- [ ] fix renderRemaining() function
- [ ] change workout-type to something else (type of workout? push? upper body? cardio? recovery?)
- [ ] add timed workout functionality (warm up, plank, jog, etc.)
- [ ] Add some exercises templates
- [ ] Add few more workout templates
- [ ] Add some basic/general muscle groups
- [ ] Add Workout Program Feature (but I don't know what is program yet) (might not be needed for simple and streamlined system)


## License

This project is open source and available under the MIT License.

## Acknowledgments

- Original [obsidian-gym-log](https://github.com/martinjo/obsidian-gym-log) by martinjo
- Obsidian Community for various plugins
- Contributors and testers

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.
