class exercise
{
	renderDescription(n)
	{
		const data = n.dv.current();
		let metadata = app.metadataCache.getFileCache(n.dv.current().file);

		let workout_id = metadata.frontmatter['workout_id'];

		let weight = metadata.frontmatter['weight'];
		let effort = metadata.frontmatter['effort'];
		let note = metadata.frontmatter['note'];

		if((weight != null || effort != null) && workout_id != null)
		{
			n.dv.header(2, "Exercise log:")
			if(weight != null)
			{
				n.dv.el('b', 'Weight: ');
				n.dv.span(weight.toString() + '\t');
				n.dv.el("br", "");
			}

			if(effort != null)
			{
				n.dv.el('b', 'Effort: ');
				n.dv.span(effort.toString());
				n.dv.el("br", "");
			}

			if(note != null)
			{
				n.dv.el('b', 'Note ✏️: ');
				n.dv.span(note.toString());
			}
			n.dv.el("br", "");
		}
		let instructions=`None`;
		if(instructions!='None')
		{
			n.dv.header(2, 'Instructions');
			n.dv.paragraph(instructions)
		}

		let video_url = metadata.frontmatter['video_url'];
		if(video_url != null)
			n.dv.el('p', '<iframe title="' + metadata.frontmatter['exercise'] + '" src="' + video_url + '" height="113" width="200" allowfullscreen="" allow="fullscreen" style="aspect-ratio: 1.76991 / 1; width: 100%; height: 100%;"></iframe>')
	}

	renderEffortWeightChart(n)
	{
		const data = n.dv.current()
		let metadata = app.metadataCache.getFileCache(n.dv.current().file);
		// exercise
		let exercise = this.fixExerciseName(metadata.frontmatter['exercise']);
		let exercises = n.dv.pages('#exercise');
		let performedExercises = []

		n.dv.header(2, "Past exercises")

		for(var e of exercises)
		{
			let metadata = app.metadataCache.getFileCache(e.file);
		    // Get the id from this exercise
		    let exerciseId = metadata.frontmatter['workout_id'];
			let e_exercise = this.fixExerciseName(e['exercise']);

			// if id != null -> performed
			if(exerciseId != null && exercise == e_exercise)
				performedExercises.push(e);
		}

		performedExercises.sort(function(a,b){
		  // Turn your strings into dates, and then subtract them
		  // to get a value that is either negative, positive, or zero.
		  return new Date(a['date']) - new Date(b['date']);
		});

		const dates = performedExercises.map(e=> moment(new Date(e['date'])).format('YY`MM`DD-HH:mm'));
		const weights = performedExercises.map(e=> e['weight'] || 0);
		const efforts = performedExercises.map(e=> e['effort'] || 0);
		const reps = performedExercises.map(e=> e['reps'] || 0);
		
		// Check if we have any valid weights
		const hasWeights = weights.length > 0 && !weights.every(value => value == null);

		// Calculate volumes (weight × reps)
		const volumes = weights.map((weight, i) => weight * reps[i]);
		const maxVolume = Math.max(...volumes);

		// Generate random color for consistent styling
		const color = { 
			base: 'rgb(153, 102, 255)',
			light: 'rgba(153, 102, 255, 0.6)'
		};

		const datasets = {
			labels: dates,
			datasets: [
				{
					label: `${exercise} (Volume)`,
					data: volumes,
					fill: false,
					borderColor: color.light,
					backgroundColor: color.light,
					borderWidth: 2,
					borderDash: [5, 5],
					tension: 0.3,
					pointRadius: 4,
					pointHitRadius: 10,
					pointHoverRadius: 6,
					yAxisID: 'y',
					display: hasWeights
				},
				{
					label: `${exercise} (Effort)`,
					data: efforts,
					fill: false,
					borderColor: color.base,
					backgroundColor: color.base,
					borderWidth: 2,
					tension: 0.3,
					pointRadius: 4,
					pointHitRadius: 10,
					pointHoverRadius: 6,
					yAxisID: 'y1'
				}
			]
		};

		// Create chart configuration
		const chartData = {
			type: 'line',
			data: datasets,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'nearest',
					axis: 'x',
					intersect: false
				},
				scales: {
					y: {
						type: 'linear',
						display: hasWeights,
						position: 'left',
						beginAtZero: true,
						suggestedMax: maxVolume * 1.2, // Add 20% space at top
						title: {
							display: true,
							text: 'Volume (kg×reps)'
						},
						grid: {
							drawOnChartArea: true
						}
					},
					y1: {
						type: 'linear',
						display: true,
						position: 'right',
						beginAtZero: true,
						min: 0,
						max: 5.5,
						title: {
							display: true,
							text: 'Effort (1-5)'
						},
						ticks: {
							stepSize: 1,
							callback: function(value) {
								if (value === 0) return '';
								return value <= 5 ? value : '';
							}
						},
						grid: {
							drawOnChartArea: false
						}
					}
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 15
						}
					},
					tooltip: {
						enabled: true,
						mode: 'index',
						intersect: false,
						callbacks: {
							label: function(context) {
								const label = context.dataset.label || '';
								const value = context.parsed.y;
								if (label.includes('Volume')) {
									return `${label}: ${value} (kg×reps)`;
								}
								return `${label}: ${value}`;
							}
						}
					}
				}
			}
		};

		// Create a div for the chart with fixed height
		const chartDiv = n.container.createEl('div');
		chartDiv.style.height = '300px';
		chartDiv.style.marginBottom = '20px';
		chartDiv.style.marginTop = '20px';

		n.window.renderChart(chartData, chartDiv);

		// Rest of the function (table rendering)
		function findPrevExercise(n, exercise)
		{
			let exercises = n.dv.pages('#exercise').sort(ex=> ex['date'], 'desc');
			for(let e of exercises)
			{
				if(new Date(e['date']) < new Date(exercise['date']))
					return e;
			}
		}

		let i=0;
		let prevTimeStamp;
		let lastExercises = [];
		for(const e of performedExercises.slice(-5))
		{
			metadata = app.metadataCache.getFileCache(e.file);
			let prev = findPrevExercise(n, e);
			prevTimeStamp = moment(new Date(prev['date']));

			var timeStamp = moment(new Date(e['date']));
			var diff_sec = timeStamp.diff(prevTimeStamp, "seconds");
			var diff_min = Math.floor(diff_sec / 60).toString();
			var diff_sec_remain = (diff_sec % 60).toString();
			var timeDiff = diff_min + 'm ' + diff_sec_remain + "s";

			let exercise = [];
			// File link (date as text)
			exercise.push('[[' + e.file.path + '|' + moment(new Date(e['date'])).format('YYYY-MM-DD') + ']]');
			// Duration
			exercise.push(timeDiff);
			// Weight
			if(hasWeights)
				exercise.push(e["weight"] + ' kg');
			// Effort
			exercise.push(e['effort']);
			// Note
			exercise.push(e['note']);
			lastExercises.push(exercise);

			prevTimeStamp = timeStamp;
			i++;
		}
		let columns = [];
		columns.push("Exercise");
		columns.push("⏱");
		if(hasWeights)
			columns.push("🏋🏼",);
		columns.push("😥");
		columns.push("🗒");

		n.dv.table(columns, lastExercises);
	}

	fixExerciseName(e)
	{
		return e.replace(' - ', ' ').toLowerCase();
	}

}