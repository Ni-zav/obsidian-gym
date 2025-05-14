Lastly, use that created routine(s) here for today's workout!
```meta-bind-button
label: Start Today's Workout
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
    command: quickadd:choice:c547bcae-f9e1-462e-be41-5c729807d8ac

```
Secondly, create your routine here:
```meta-bind-button
label: Create Workout Routine
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
    command: quickadd:choice:1ce4bca4-4630-4c48-944d-19adf1c3f623

```
If you haven't add any exercise, start here:
```meta-bind-button
label: Add New Exercise
style: primary
class: ""
cssStyle: ""
backgroundImage: ""
tooltip: ""
id: ""
hidden: false
actions:
  - type: command
    command: quickadd:choice:aeaf28e2-ba08-4988-948d-79b10bde8deb

```
---
# Workout List

```dataviewjs

let pages = dv.pages('"Workouts" and #workout').sort(p=> p.date, "desc");
let workouts = []

dv.header(3,"After creating today's workout, it will shows here in a few seconds.")
dv.header(3, "Total number of workouts: " + pages.length.toString());

const span = document.createElement('span');

dv.table(["Last workouts", "Date", "Type", "Place"], pages.slice(0,5)
	.map(e=> [e.file.link, span.innerText = `[[${moment(e['date']).format('YYYY-MM-DD')}]]`, e['workout_type'] || "Not specified", e['workout_place'] || "Not specified"]))

```
---
# Heatmap
```dataviewjs
dv.span("** 😊 Workouts  😥**") /* optional ⏹️💤⚡⚠🧩↑↓⏳📔💾📁📝🔄📝🔀⌨️🕸️📅🔍✨ */
const calendarData = {
    year: 2025,  // (optional) defaults to current year
    colors: {    // (optional) defaults to green
        blue:        ["#8cb9ff", "#69a3ff", "#428bff", "#1872ff", "#0058e2"], // first entry is considered default if supplied
        green:       ["#c6e48b", "#7bc96f", "#49af5d", "#2e8840", "#196127"],
        red:         ["#ff9e82", "#ff7b55", "#ff4d1a", "#e73400", "#bd2a00"],
        orange:      ["#ffa244", "#fd7f00", "#dd6f00", "#bf6000", "#9b4e00"],
        pink:        ["#ff96cb", "#ff70b8", "#ff3a9d", "#ee0077", "#c30062"],
        orangeToRed: ["#ffdf04", "#ffbe04", "#ff9a03", "#ff6d02", "#ff2c01"]
    },
    showCurrentDayBorder: true, // (optional) defaults to true
    defaultEntryIntensity: 4,   // (optional) defaults to 4
    intensityScaleStart: 10,    // (optional) defaults to lowest value passed to entries.intensity
    intensityScaleEnd: 100,     // (optional) defaults to highest value passed to entries.intensity
    entries: [],                // (required) populated in the DataviewJS loop below
}

//DataviewJS loop
for (let page of dv.pages('#workout')) 
{
	let metadata = app.metadataCache.getFileCache(page.file);
	let color = null;
	
	if(metadata.frontmatter['type'] != null)
	{
		let colors = Object.keys(calendarData.colors); 
		color = colors[metadata.frontmatter['sub_type']-1];
	}
	else
		color = metadata.frontmatter.tags.includes('2-1') ? "orange" : 'green'

   
    if(metadata.frontmatter['id'] == null)
	    continue;
	//dv.span("<br>" + page.file.name) // uncomment for troubleshooting
    calendarData.entries.push({
        date: metadata.frontmatter['date'],     // (required) Format YYYY-MM-DD
        intensity: 1, // (required) the data you want to track, will map color intensities automatically
        color: color
                  // (optional) Reference from *calendarData.colors*. If no color is supplied; colors[0] is used
    })
}

renderHeatmapCalendar(this.container, calendarData)
```
---

