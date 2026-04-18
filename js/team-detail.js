const setTeamChartRankingHistory = (team, teamChart, minDate = rankingPeriodStartDt) => {
    let minRankingDt = [...team.rankingHistory.keys()].sort((a, b) => a - b)[0];
    if (minDate < minRankingDt) {
        minDate = new Date(minRankingDt);
        let oldestGame = teamChart.data.datasets[0].data.sort((a,b) => a.x - b.x)[0];
        if (oldestGame && oldestGame.x < minDate)
            minDate.setDate(minDate.getDate() - 7);
    }

    // Set up Ranking Point data with error bars, only displayed on an interval or for > 5% change
    let rankingHistory = [];
    let errorBarMinFrequency = (rankingPeriodDeadlineDt - minDate) / 16;
    let lastDtWithErrorBars = null;
    let teamRankingHistoryArray = Array.from(team.rankingHistory.entries()).filter(rh => minDate <= rh[0] && rh[0] <= rankingPeriodDeadlineDt);
    for (const [dt, ranking] of teamRankingHistoryArray) {
        let chartErrs = false;
        let index = teamRankingHistoryArray.findIndex(([key]) => key === dt);
        if (index == 0 || index == teamRankingHistoryArray.length - 1)
            chartErrs = true;
        else {
            let lastRanking = teamRankingHistoryArray[index - 1];
            let nextRanking = teamRankingHistoryArray[index + 1];
            if (lastRanking[1].standardError/ranking.standardError > 1.1
                || lastRanking[1].standardError/ranking.standardError < .9
                || nextRanking[1].standardError/ranking.standardError > 1.1
                || nextRanking[1].standardError/ranking.standardError < .9)
                chartErrs = true;
        }

        if (!chartErrs && (dt - lastDtWithErrorBars) > errorBarMinFrequency)
            chartErrs = true;

        if (chartErrs)
            lastDtWithErrorBars = dt;

        let errMin = ranking.rankingPoints - ranking.standardError;
        let errMax = ranking.rankingPoints + ranking.standardError;

        let rankingDt = new Date(dt);
        let predictorDt = null;
        if (rankingDt < rankingPeriodDeadlineDt && ranking.predictorRankingPoints) {
            rankingDt.setDate(rankingDt.getDate() - 1);
            predictorDt = new Date(dt);
            predictorDt.setDate(predictorDt.getDate() + 1);
        }
            
        rankingHistory.push({
            x: rankingDt,
            y: ranking.rankingPoints,
            yMin: chartErrs ? errMin : null,
            yMax: chartErrs ? errMax : null,
            title: dt.toLocaleDateString(undefined,{weekday: 'long', year:'numeric',month:'long',day:'numeric'}),
            label: `Ranking Points: ${ranking.rankingPoints}`,
            stdErr: `Standard Error: ± ${ranking.standardError} (${errMin.toFixed(2)} .. ${errMax.toFixed(2)})`

        });

        if (predictorDt) {
            rankingHistory.push({
                x: predictorDt,
                y: ranking.predictorRankingPoints,
                yMin: null,
                yMax: null,
                title: `${dt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})} after game decay`,
                label: `Ranking Points: ${ranking.predictorRankingPoints}`,
                stdErr: `Standard Error: ± ${ranking.predictorStandardError} (${(ranking.predictorRankingPoints - ranking.predictorStandardError).toFixed(2)} .. ${(ranking.predictorRankingPoints + ranking.predictorStandardError).toFixed(2)})`
            });
        }
    }
    
    teamChart.data.datasets[1].data = rankingHistory;
    teamChart.options.scales.x.min = minDate;
    teamChart.options.scales.x.max = rankingPeriodDeadlineDt;
}

const setTeameErrorChart = (team, teamErrorChart) => {

    teamErrorChart.data.datasets = [];

    let games = team.gameHistory
        .filter(game => rankingPeriodStartDt <= game.date && game.date < rankingPeriodDeadlineDt && !game.forfeit)
        .sort((a, b) => a.date - b.date);

    let seedingRp = team.getRankingPoints(rankingPeriodStartDt);
    if (seedingRp != null) {
        games.unshift(new MrdaGame({
            date: rankingPeriodStartDt,
            home_team: team.teamId,
            home_score: seedingRp,
        }, mrdaRankings.mrdaTeams, mrdaRankings.mrdaEvents, true));
    }

    games.forEach(game => {
        let opponent = game.getOpponentTeam(team.teamId);
        let expectedDiff = team.rankingPoints - opponent.rankingPoints;
        let actualDiff = game.getActualDifferential(team);
        let error = actualDiff - expectedDiff;

        teamErrorChart.data.datasets.push({
                label: "Error",
                data: [ { 
                    x:  game.awayTeamId == VIRTUAL_TEAM_ID ? 'Virtual Game' : `${game.date.toLocaleDateString(undefined, {year:'2-digit',month:'numeric',day:'numeric'})} ${game.date.toLocaleTimeString(undefined,{timeStyle:'short'})}`, 
                    y: error,
                    expectedDiff: expectedDiff,
                    game: game } ],
                borderColor: error > 0 ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)',
                backgroundColor: error > 0 ? 'rgb(54, 162, 235, .5)' : 'rgb(255, 99, 132, .5)',
                borderWidth: 2,
                borderRadius: 5,
                barPercentage: game.weight,
                });
    });
}

// Setup team details modal
$(() => {
    let $teamDetailModal = $('#team-modal');
    let $olderGamesBtn = $('#load-older-games');
    let team = null;
    let date = rankingPeriodDeadlineDt;
    let minGameDt = rankingPeriodStartDt;
    
    // Initialize the Team Ranking Point History chart. Data will be set on team row click.
    let teamChart = new Chart(document.getElementById('team-chart'), {
        data: {
            datasets: [{
                type: 'scatter',
                label: 'Game Scores vs. Prediction',
                data: [],
                pointRadius: 6,
            }, {
                type: 'lineWithErrorBars',
                label: 'Ranking Points ± Standard Error',
                data: [],
                showLine: true
            }],
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month'
                    },
                    min: rankingPeriodStartDt,
                    max: rankingPeriodDeadlineDt
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
                axis: 'xy'
            },
            plugins: {
                tooltip: {
                    bodySpacing: 3,
                    callbacks: {
                        title: context => {
                            if (context[0].datasetIndex == 0)
                                return [
                                    context[0].raw.game.getGameAndEventTitle(),
                                    context[0].raw.game.getGameSummary(team.teamId)
                                ];                            
                            return context[0].raw.title;                                
                        },
                        beforeBody: context => {
                            if (context[0].datasetIndex == 0) {
                                let game = context[0].raw.game;
                                let result = [`Score Differential: ${game.getActualDifferentialDisplay(team)}`];
                                let predictedDifferential = game.getPredictedDifferentialDisplay(team);
                                if (predictedDifferential != null)
                                    result.push(`Predicted Differential: ${predictedDifferential}`);
                                else
                                    result.push(`Opponent RP as of game: ${game.getPredictorRankingPoints(game.getOpponentTeam(team.teamId))}`);
                                return result;
                            }
                        },                        
                        label: context => {
                            if (context.datasetIndex == 0) {
                                let result = context.raw.game.getPerformanceDeltaDisplay(team);
                                if (result != null)
                                    return `Score vs. Prediction: ${result}`;
                                else 
                                    return `Estimated Ranking Points: ${context.raw.game.getPerformanceDeltaChart(team).toFixed(2)}`;
                            }                            
                            return context.raw.label;
                        },
                        afterBody: context => {
                            if (context[0].datasetIndex == 1)
                                return context[0].raw.stdErr;
                        },
                        footer: context => {
                            if (context[0].datasetIndex == 0 && context[0].raw.game.weight < 1)
                                return `Game Weight: ${(context[0].raw.game.weight * 100).toFixed(0)}%`;
                        }
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Initialize the Linear Regression Error chart. Data will be set on team row click.
    let teamErrorChart = new Chart(document.getElementById('team-error-chart'), {
        type: 'bar',
        options: { 
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            // Don't convert to arrow function syntax to preserve 'this' context
                            let label = this.getLabelForValue(value);
                            if (label == 'Virtual Game')
                                return label;
                            return label.split(' ')[0];
                         }
                    },
                },
                y: {
                    stacked: true,
                    ticks: {
                        callback: value => { 
                            return `${value > 0 ? '+' : ''}${value}`;
                         }
                    },
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Difference in Actual vs. Expected Score Differentials based on current Ranking Points',
                    padding: {
                        top:10,
                        bottom: 5
                    }                    
                },
                subtitle: {
                    display: true,
                    text: 'Ranking Points are calculated using linear regression to minimize error for all games and all teams.',
                    padding: {
                        bottom: 8
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    position: 'nearest',
                    bodySpacing: 3,
                    callbacks: {
                        title: context => {
                            if (context[0].raw.game.awayTeamId == VIRTUAL_TEAM_ID)
                                return [
                                    `${rankingPeriodStartDt.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}: ${context[0].label}`,
                                    `${team.getRankingPoints(rankingPeriodStartDt).toFixed(2)}-${mrda_config.virtual_team_rp} vs Virtual Team`,
                                ];
                            return [
                                context[0].raw.game.getGameAndEventTitle(),
                                context[0].raw.game.getGameSummary(team.teamId)
                            ];
                        },
                        beforeBody: context => {
                            let game = context[0].raw.game;
                            let opponent = game.getOpponentTeam(team.teamId);
                            let expectedDiff = context[0].raw.expectedDiff;
                            let actualDiff = game.getActualDifferentialDisplay(team);
                            return [
                                `Opponent's Current RP: ${opponent.rankingPoints}`,
                                `Expected Differential: ${expectedDiff > 0 ? '+' : ''}${expectedDiff.toFixed(2)}`,
                                `Score Differential: ${actualDiff}`,
                            ];
                        },
                        label: context => {
                            return ` Error: ${context.formattedValue > 0 ? '+' : ''}${context.formattedValue}`;
                        },
                        footer: context => {
                            return `Game Weight: ${(context[0].raw.game.weight * 100).toFixed(0)}%`;
                        }
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Initialize the team game history DataTable. Data will be set on team row click.
    let teamGameTable = new DataTable('#team-games-table', {
        columns: [
            { width: '1em', className: 'dt-center', name: 'date', data: 'date', render: (data, type, game) => { return type === 'display' ? `<div data-toggle="tooltip" title="${data.toLocaleTimeString(undefined,{timeStyle:'short'})}">${data.toLocaleDateString(undefined,{weekday:'short'})}</div>` : data }},
            { width: '1em', className: 'dt-center narrow', render: (data, type, game) => { return game.getWL(team.teamId) }},
            { width: '1em', className: 'dt-center narrow', render: (data, type, game) => { return game.getAtVs(team.teamId) }},
            { width: '1em', className: 'px-1 opponent', render: (data, type, game) => { return game.getOpponentTeam(team.teamId).getLogoDisplay(true); } },
            { className: 'ps-1 opponent text-overflow-ellipsis', render: (data, type, game) => { return game.getOpponentTeam(team.teamId).getNameWithRank(game.date, region, true); } },
            { width: '1em', className: 'dt-center no-wrap', render: (data, type, game) => { return game.getTeamsScore(team.teamId) }},
            { width: '1em', className: 'dt-center no-wrap', render: (data, type, game) => { return game.getActualDifferentialDisplayWithTooltip(team); } },
            { width: '1em', className: 'dt-center no-wrap', render: (data, type, game) => { return game.getPredictedDifferentialWithTooltip(team); } },
            { width: '1em', className: 'dt-center no-wrap', data: 'weight', render: (data, type, game) => { return game.getPerformanceDeltaWithIcon(team); } }
        ],
        data: [],
        paging: false,
        searching: false,
        info: false,
        layout: {
            topStart: null,
            topEnd: null,
            bottomStart: null,
            bottomEnd: null
        },
        rowGroup: {
            dataSrc: ['event'],
            startRender: (rows, group) => {
                let tr = document.createElement('tr');
                let th = document.createElement('th');

                let rpBefore = team.getPredictorRankingPoints(group.startDt);
                let rpAfter = team.getRankingPoints(group.endDt, true);

                th.colSpan = 5;
                th.textContent = group.getEventTitleWithDate();
                th.className = 'text-overflow-ellipsis';
                tr.appendChild(th);

                th = document.createElement('th');
                th.className = 'rp-change';
                if (rpBefore == null) {
                    th.colSpan = 4;
                    if (rpAfter != null)
                        th.innerHTML = `Resulting Ranking Points: ${rpAfter.toFixed(2)}`;
                    tr.appendChild(th);
                    return tr;
                }
                th.colSpan = 3;
                th.innerHTML = 'Ranking Points:';
                tr.appendChild(th);

                th = document.createElement('th');
                th.className = 'rp-delta';
                let rpDelta = rpAfter - rpBefore;

                th.setAttribute('data-toggle','tooltip');
                th.setAttribute('data-bs-html','true');
                th.title = 'Difference in Ranking Points from all games this weekend.<br>';
                th.title += `Before: ${rpBefore.toFixed(2)}<br>`
                th.title += `After: ${rpAfter.toFixed(2)}<br>`                

                if (rpAfter > rpBefore) {
                    let icon = '<i class="bi bi-triangle-fill text-success"></i>';
                    th.innerHTML = `${icon} <span class="rp-delta text-success">+${rpDelta.toFixed(2)}</span>`;
                } else if (rpBefore > rpAfter) {
                    let icon = '<i class="bi bi-triangle-fill down text-danger"></i>';
                    th.innerHTML = `${icon} <span class="rp-delta text-danger">${rpDelta.toFixed(2)}</span>`;
                } else
                    th.innerHTML = `<span class="rp-delta">${rpDelta.toFixed(2)}</span>`;
                tr.appendChild(th);
                return tr;
            },
        },
        order: {
            name: 'date',
            dir: 'desc'
        },
        ordering: {
            handler: false,
            indicators: false
        },
    }).on('draw', () => {
        $('#team-games-table [data-toggle="tooltip"]').tooltip();
    });

    const setTeam = clickedTeam => {
        if (clickedTeam == team && rankingPeriodDeadlineDt == date)
            return;

        team = clickedTeam;
        date = rankingPeriodDeadlineDt;
        minGameDt = rankingPeriodStartDt;
        
        $('#team-name').text(team.name);
        $('#team-rp').text(team.rankingPoints);
        $('#team-logo').attr('src', team.logo);
        $('#team-location').text(team.location);

        teamChart.data.datasets[0].data = team.gameHistory.map(game => {
            return { 
                x: game.date, 
                y: game.getPerformanceDeltaChart(team),
                game: game
            }});
        setTeamChartRankingHistory(team, teamChart);
        teamChart.update();

        setTeameErrorChart(team, teamErrorChart);
        teamErrorChart.update();

        // Game table data filtered to current ranking period.
        teamGameTable.clear().rows.add(team.gameHistory.filter(game => minGameDt <= game.date && game.date < rankingPeriodDeadlineDt)).draw();

        // Only show "load older games" button if there are games older than the current ranking period.
        if (team.gameHistory.some(game => game.date < minGameDt))
            $olderGamesBtn.show();
        else
            $olderGamesBtn.hide();
    };

    $olderGamesBtn.on('click', e => {
        let newMinDt = getSeedDate(minGameDt);
        teamGameTable.rows.add(team.gameHistory.filter(game => newMinDt <= game.date && game.date < minGameDt)).draw();
        setTeamChartRankingHistory(team, teamChart, newMinDt);
        teamChart.update();
        minGameDt = newMinDt;
        if (team.gameHistory.some(game => game.date < minGameDt))
            $olderGamesBtn.show();
        else
            $olderGamesBtn.hide();
    });

    $teamDetailModal.on('show.bs.modal', e => {
        let clicked = e.relatedTarget;
        if (clicked.hasAttribute('data-team-id')) {
            let $clicked = $(clicked);
            let teamId = $clicked.data('team-id');
            if (teamId) {
                setTeam(mrdaRankings.mrdaTeams[teamId]);
                return;
            } else
                return false;
        }
    });

    let clickedA = null;
    $('#team-games-table').on('click', 'a[data-bs-toggle="modal"]', e => { 
        clickedA = e.currentTarget; 
    });
    $teamDetailModal.on('hidden.bs.modal', e => {
        if (clickedA != null) {
            clickedA.click();
            clickedA = null;
        }
    });

    $('#region').on('change', () => {
        // Re-read team games table data with regional ranks
        $('#team-games-table').DataTable().rows().invalidate('data').draw();
    });
});