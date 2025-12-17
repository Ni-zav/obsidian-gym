class exercise
{
	renderDescription(n)
	{
		const data = n.dv.current();
		let metadata = app.metadataCache.getFileCache(n.dv.current().file);

		if (!metadata || !metadata.frontmatter) {
			return;
		}

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
		
		if (!metadata || !metadata.frontmatter) {
			return;
		}
		
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
		  return new Date(a['date']) - new Date(b['date']);
		});

		const dates = performedExercises.map(e=> moment(new Date(e['date'])).format('YY`MM`DD-HH:mm'));
		const weights = performedExercises.map(e=> e['weight'] || 1); // default to 1 for timed
		const efforts = performedExercises.map(e=> e['effort'] || 0);
		const isTimed = metadata.frontmatter['timed'] === true || metadata.frontmatter['timed'] === 'true';
		let repsOrDur = performedExercises.map(e => {
			if (isTimed) return Number(e['duration']) || 0;
			return Number(e['reps']) || 0;
		});
		// Volume: for timed, duration * weight; for normal, reps * weight
		const volumes = performedExercises.map((e, i) => weights[i] * repsOrDur[i]);
		const maxVolume = Math.max(...volumes);

		const color = { 
			base: 'rgb(153, 102, 255)',
			light: 'rgba(153, 102, 255, 0.6)'
		};

		const datasets = {
			labels: dates,
			datasets: [
				{
					label: isTimed ? `${exercise} (Duration×Weight)` : `${exercise} (Volume)`,
					data: volumes,
					fill: false,
					borderColor: color.light,
					backgroundColor: color.light,
					borderWidth: 2,
					borderDash: isTimed ? [] : [5, 5],
					tension: 0.3,
					pointRadius: isTimed ? 0 : 4,
					pointHitRadius: 10,
					pointHoverRadius: 6,
					yAxisID: 'y',
					display: true
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
						display: true,
						position: 'left',
						beginAtZero: true,
						suggestedMax: maxVolume * 1.2,
						title: {
							display: true,
							text: isTimed ? 'Duration×Weight (sec×kg)' : 'Volume (kg×reps)'
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
								if (label.includes('Volume') || label.includes('Duration×Weight')) {
									return `${label}: ${value} ${isTimed ? '(sec×kg)' : '(kg×reps)'}`;
								}
								return `${label}: ${value}`;
							}
						}
					}
				}
			}
		};

		const chartDiv = n.container.createEl('div');
		chartDiv.style.height = '300px';
		chartDiv.style.marginBottom = '20px';
		chartDiv.style.marginTop = '20px';

		n.window.renderChart(chartData, chartDiv);

		// Table rendering
		let lastExercises = [];
		for(const e of performedExercises.slice(-5))
		{
			let row = [];
			row.push('[[' + e.file.path + '|' + moment(new Date(e['date'])).format('YYYY-MM-DD') + ']]');
			if (isTimed) {
				row.push(e['duration'] ? e['duration'] + ' sec' : '~');
				row.push(e['weight'] ? e['weight'] + ' kg' : '~');
				row.push(e['effort'] || '~');
				row.push(e['note'] || '');
			} else {
				row.push(e['reps'] || '~');
				row.push(e['weight'] ? e['weight'] + ' kg' : '~');
				row.push(e['effort'] || '~');
				row.push(e['note'] || '');
			}
			lastExercises.push(row);
		}
		let columns = ["Exercise", isTimed ? "⏱ (sec)" : "Reps", "🏋🏼", "😥", "🗒"];
		n.dv.table(columns, lastExercises);
	}

	fixExerciseName(e)
	{
		if (!e) return '';
		return e.replace(' - ', ' ').toLowerCase();
	}

}