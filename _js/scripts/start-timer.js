module.exports = async function startTimer(params) {
    const { app, quickAddApi: { suggester, inputPrompt } } = params;

    // Predefined rest periods
    const restPeriods = [
        "30 seconds",
        "60 seconds",
        "90 seconds",
        "120 seconds",
        "Custom"
    ];

    // Get rest period
    const selectedPeriod = await suggester(restPeriods, restPeriods);
    if (!selectedPeriod) return;

    let seconds;
    if (selectedPeriod === "Custom") {
        const customSeconds = await inputPrompt("Enter rest period in seconds");
        if (!customSeconds || isNaN(customSeconds)) return;
        seconds = parseInt(customSeconds);
    } else {
        seconds = parseInt(selectedPeriod);
    }

    // Get the timer instance from CustomJS
    const { timer } = customJS;
    timer.start(seconds);

    // No variables to pass back
    params.variables = {};
}
