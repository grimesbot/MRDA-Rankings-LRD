const mrdaLinearRegressionSystem = new MrdaLinearRegressionSystem(rankings_history, mrda_teams, mrda_events, mrda_games);

const urlParams = new URLSearchParams(window.location.search);

let rankingPeriodDeadlineDt = null;
let rankingPeriodStartDt = null;
let previousQuarterDt = null;
let region = null;

function setRankingDates($dateSelect) {
    rankingPeriodDeadlineDt = new Date(`${$dateSelect.val()} 00:00`);
    rankingPeriodStartDt = getSeedDate(rankingPeriodDeadlineDt);

    let prevQtrDateStr = $dateSelect.find('option:selected').nextAll().filter((i,e) => $(e).text().trim().startsWith('Q')).first().val();
    previousQuarterDt = prevQtrDateStr ? new Date(`${prevQtrDateStr} 00:00`) : null;
}

function setRegion($regionSelect) {
    region = $regionSelect.val();
}

function setupRankingDates($dateSelect) {
    let allRankingDts = [...mrdaLinearRegressionSystem.mrdaRankingsHistory.keys()].sort((a, b) => a - b);

    let searchDt = mrdaLinearRegressionSystem.getNextRankingPeriodDate(allRankingDts[0]);
    let newestRankingDt = allRankingDts.at(-1);

    let dateOptions = [];

    while (searchDt <= newestRankingDt) {
        dateOptions.push({
            date: new Date(searchDt),
            value: `${searchDt.getFullYear()}-${searchDt.getMonth() + 1}-${searchDt.getDate()}`,
            text: `Q${(searchDt.getMonth() + 1) / 3} ${searchDt.getFullYear()}`,
            selected: false
        });
        searchDt.setMonth(searchDt.getMonth() + 3); // Add 3 months (a quarter)
        searchDt.setDate(1); // Set to first of month
        searchDt.setDate(1 + ((3 - searchDt.getDay() + 7) % 7)); // Set to Wednesday = 3
    }

    let queryDt = null;
    if (urlParams.has('date')) {
        queryDt = new Date(urlParams.get('date'));
        if (isNaN(queryDt))
            queryDt = null;
        else {
            queryDt.setHours(0, 0, 0, 0);
            queryDt.setDate(queryDt.getDate() + ((3 - queryDt.getDay() + 7) % 7)); // Set most recent Wednesday = 3
        }
    }

    let current = new Date();
    if (current < newestRankingDt) {
        current.setHours(0, 0, 0, 0);
        current.setDate(current.getDate() + ((3 - current.getDay() - 7) % 7)); // Set most recent Wednesday = 3
        if (mrdaLinearRegressionSystem.mrdaGames.some(game => game.date >= current && game.homeTeamId in game.scores && game.awayTeamId in game.scores))
            current.setDate(current.getDate() + 7); // Set to next Wednesday if there are newer scores
        let currentDateOptions = dateOptions.filter(o => o.date.getTime() == current.getTime());
        if (currentDateOptions.length == 0) {
                dateOptions.push({
                date: current,
                value: `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()}`,
                text: `Today`,
                selected: !queryDt || queryDt.getTime() == current.getTime()
            });
        } else if (!queryDt || queryDt.getTime() == current.getTime()) {
            currentDateOptions[0].selected = true;
        }
    }

    if (queryDt && queryDt.getTime() != current.getTime()) {
        let queryDtDateOptions = dateOptions.filter(o => o.date.getTime() == queryDt.getTime());
        if (queryDtDateOptions.length == 0) {
                dateOptions.push({
                date: queryDt,
                value: `${queryDt.getFullYear()}-${queryDt.getMonth() + 1}-${queryDt.getDate()}`,
                text: queryDt.toLocaleDateString(undefined, {year:'2-digit',month:'numeric',day:'numeric'}),
                selected: true
            });
        } else {
            queryDtDateOptions[0].selected = true;
        }
    }
    
    dateOptions.sort((a,b) => b.date - a.date).forEach(o => {
        $dateSelect.append(new Option(o.text, o.value, o.selected, o.selected));
    });

    setRankingDates($dateSelect);
    $dateSelect.on('change', function() { setRankingDates($dateSelect) } );
}

function setupRegion($regionSelect) {
    if (urlParams.has('region') && $regionSelect.find(`option[value="${urlParams.get('region')}"]`).length > 0)
        $regionSelect.val(urlParams.get('region'));
    else if (false) { // Don't auto-select region, regional rankings unpopular with membership
        // Automatically set European region with very rudimentary timezone math
        var offset = new Date().getTimezoneOffset();
        if ((-6*60) < offset && offset < (3*60))
            $('#region').val('EUR');
        else
            $('#region').val('AM');
    }
    setRegion($regionSelect);
    $regionSelect.on('change', function() { setRegion($regionSelect) } );
}

function setupRankingChart(teams) {
    let datasets = [];

    teams.slice(0, 5).forEach(team => {
        team.chart = true;
        datasets.push({
            teamId: team.teamId,
            region: team.region,
            label: team.name,
            data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
            showLine: true
        });
    });

    let rankingChart = new Chart(document.getElementById('rankings-chart'), {
        type: 'line',
        data: {
            datasets: datasets
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
                axis: 'x'
            },
            plugins: {
                tooltip: {
                    itemSort: function(a, b) {
                        return b.raw.y - a.raw.y;
                    },
                    callbacks: {
                        title: function(context) {
                            return context[0].raw.x.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
                        },
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.y.toFixed(2)}`;
                        }
                    }
                },
                colors: {
                    forceOverride: true
                }
            },
            responsive: true,
            maintainAspectRatio: false
        },
    });

    $('#rankings-table-container').on('change', 'input.chart', function (e) {
        let tr = e.target.closest('tr');
        let dt = $('#rankings-table').DataTable();
        let row = dt.row(tr);
        let team = row.data();
        team.chart = $(this).prop('checked');
        if (team.chart) {
            rankingChart.data.datasets.push({
                teamId: team.teamId,
                label: team.name,
                data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
                showLine: true
            });
        } else 
            rankingChart.data.datasets = rankingChart.data.datasets.filter(dataset => dataset.teamId != team.teamId);
        rankingChart.update();
    });
}

function setupRankingsTable(teams) {

    let annotations = document.createElement('div');
    annotations.className = 'annotations';
    annotations.innerHTML = '*Not enough games to be Postseason Eligible.';
    annotations.innerHTML += '<br><sup>↓</sup>Two rank penalty applied for each forfeit.';    

    let exportOptions = { 
        columns: [0,3,4,5,6], 
        format: { 
            header: function (data, columnIdx) { return ['Rank','Team','Ranking Points','Relative Standard Error','Game Count'][columnIdx]; } 
        },        
    };

    new DataTable('#rankings-table', {
        columns: [
            { name: 'rank', data: 'rank', width: '1em', className: 'dt-center pe-1', 
                render: function (data, type, team) { 
                    if (type === 'sort')
                        return team.rankSort;
                    else if (region != 'GUR')
                        return team.regionRank;
                    else
                        return data;
                }
            },
            { data: 'delta', width: '1em', className: 'no-wrap delta dt-center px-1',
                render: function (data, type, team) {
                    let delta = region == 'GUR' ? team.delta : team.regionDelta;
                    if (type === 'display') {
                        if (!team.rank)
                            return '';
                        else if (delta > 0) 
                            return `<i class="bi bi-triangle-fill text-success"></i> <span class="text-success">${delta}</span>`;
                        else if (delta < 0)
                            return `<i class="bi bi-triangle-fill down text-danger"></i> <span class="down text-danger">${-delta}</span>`;
                        else if (delta == null)
                            return '<i class="bi bi-star-fill text-body-secondary"></i>'
                        else
                            return '<i class="bi bi-circle-fill text-body-tertiary"></i>';
                    } else
                        return delta;
                }
             },
            { data: 'logo', width: '1em', orderable: false, className: 'px-1', render: function (data, type, team) { return data ? `<img class="team-logo" src="${data}">` : ''; } },            
            { data: 'name', orderable: false, className: 'px-1 text-overflow-ellipsis', 
                render: function (data, type, team) {
                    let result = type == 'display' ? `<span class="team-name">${data}</span>` : data;
                    if (['display','export'].includes(type) && team.activeStatus) {
                        for (let i = 0; i < team.forfeits; i++) {
                            if (type === 'display')
                                result += '<sup class="forfeit-penalty">↓</sup>';
                            else if (type === 'export')
                                result += ' ↓';
                        }
                        return result;
                    }
                    return result;
                },
                createdCell: function (td, cellData, team, row, col) {
                    if (team.location) 
                        $(td).append(`<div class="team-location">${team.location}</div>`);
                }
            },
            { data: 'rankingPoints', width: '1em', className: 'px-1' },
            { data: 'standardError', width: '1em', className: 'px-1 dt-left', render: function (data, type, team) { return type === 'display' ? `±${data}` : data; }},
            { data: 'activeStatusGameCount', width: '1em', className: 'px-1', render: function (data, type, team) { return type === 'display' && !team.postseasonEligible ? `${data}<span class="postseason-ineligible">*</span>` : data; } },
            { data: 'wins', width: '1em', orderable: false, className: 'px-1 dt-center'},
            { data: 'losses', width: '1.6em', orderable: false, className: 'px-1 dt-left'},
            { data: 'chart', width: '1em', className: 'ps-1 dt-center no-pointer', orderable: false, render: function (data, type, team) { return `<input type="checkbox" class="chart"${data ? ' checked' : ''}></input>`; }}
        ],
        data: teams,
        layout: {
            topStart: null,
            topEnd: null,
            bottomStart: annotations,
            bottomEnd: { 
                buttons: [
                    {
                        extend: 'copy',
                        text: '<i class="bi bi-copy"></i>',
                        exportOptions: exportOptions,
                        messageBottom: '*Not enough games to be Postseason Eligible.\n↓ Two rank penalty applied for each forfeit.',
                        title: null,
                    }, 
                    {
                        extend: 'csv',
                        text: '<i class="bi bi-filetype-csv"></i>',
                        exportOptions: exportOptions
                    } 
                ] 
            }
        },
        paging: false,
        searching: false,
        info: false,
        order: {
            name: 'rank',
            dir: 'asc'
        },
        fixedHeader: {
            header: true,
            headerOffset: $('nav.sticky-top').outerHeight()
        },
        createdRow: function (row, data, dataIndex) {
            if (data.postseasonPosition != null) {
                $(row).addClass('postseason-position ' + data.postseasonPosition);
            }
        },
        drawCallback: function (settings) {
            $('#rankings-table .forfeit-penalty').tooltip({title: 'Two rank penalty applied for each forfeit.'});
            $('#rankings-table .postseason-ineligible').tooltip({title: 'Not enough games to be Postseason Eligible.'});
        }
    });
}

function setupRankings() {
    mrdaLinearRegressionSystem.rankTeams(rankingPeriodDeadlineDt, rankingPeriodStartDt, previousQuarterDt);

    let teams = mrdaLinearRegressionSystem.getOrderedTeams(region);

    setupRankingChart(teams);

    setupRankingsTable(teams);
}

function handleRankingPeriodChange() {
    // Move the chart to new dates
    let rankingChart = Chart.getChart('rankings-chart');
    rankingChart.options.scales.x.min = rankingPeriodStartDt;
    rankingChart.options.scales.x.max = rankingPeriodDeadlineDt;
    rankingChart.update();

    // Re-rank teams for new dates and update table
    mrdaLinearRegressionSystem.rankTeams(rankingPeriodDeadlineDt, rankingPeriodStartDt, previousQuarterDt);
    $('#rankings-table').DataTable().clear().rows.add(mrdaLinearRegressionSystem.getOrderedTeams(region)).draw();

    // Re-read team games table data with regional ranks
    $('#team-games-table').DataTable().rows().invalidate('data').draw();
}

function handleRegionChange() {
    // Get ordered teams for region
    let teams = mrdaLinearRegressionSystem.getOrderedTeams(region);
    
    // Clear the chart and re-add top 5 teams, set all other team.chart = false
    let rankingChart = Chart.getChart('rankings-chart');
    rankingChart.data.datasets = [];
    teams.forEach((team, index) => {
        team.chart = index < 5;
        if (team.chart) {
            rankingChart.data.datasets.push({
                teamId: team.teamId,
                label: team.name,
                data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
                showLine: true
            });
        }
    });    
    rankingChart.update();

    // Update table with region's teams
    $('#rankings-table').DataTable().clear().rows.add(teams).draw();
}

function setTeamChartRankingHistory(team, teamChart, minDate = rankingPeriodStartDt) {
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

function setTeameErrorChart(team, teamErrorChart) {

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
        }, mrdaLinearRegressionSystem.mrdaTeams, mrdaLinearRegressionSystem.mrdaEvents, true));
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

function setupTeamDetails() {
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
                        title: function(context) {
                            if (context[0].datasetIndex == 0)
                                return [
                                    context[0].raw.game.getGameAndEventTitle(),
                                    context[0].raw.game.getGameSummary(team.teamId)
                                ];                            
                            return context[0].raw.title;                                
                        },
                        beforeBody: function(context) {
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
                        label: function(context) {
                            if (context.datasetIndex == 0) {
                                let result = context.raw.game.getPerformanceDeltaDisplay(team);
                                if (result != null)
                                    return `Score vs. Prediction: ${result}`;
                                else 
                                    return `Estimated Ranking Points: ${context.raw.game.getPerformanceDeltaChart(team).toFixed(2)}`;
                            }                            
                            return context.raw.label;
                        },
                        afterBody: function(context) {
                            if (context[0].datasetIndex == 1)
                                return context[0].raw.stdErr;
                        },
                        footer: function(context) {
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
                        callback: function(value) { 
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
                        title: function(context) {
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
                        beforeBody: function(context) {
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
                        label: function(context) {
                            return ` Error: ${context.formattedValue > 0 ? '+' : ''}${context.formattedValue}`;
                        },
                        footer: function(context) {
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
            { width: '1em', className: 'dt-center', name: 'date', data: 'date', render: function (data, type, game) { return type === 'display' ? `<div data-toggle="tooltip" title="${data.toLocaleTimeString(undefined,{timeStyle:'short'})}">${data.toLocaleDateString(undefined,{weekday:'short'})}</div>` : data }},
            { width: '1em', className: 'dt-center narrow', render: function (data, type, game) { return game.getWL(team.teamId) }},
            { width: '1em', className: 'dt-center narrow', render: function (data, type, game) { return game.getAtVs(team.teamId) }},
            { width: '1em', className: 'px-1', render: function(data, type, game) {return `<img class="opponent-logo" src="${game.getOpponentTeam(team.teamId).logo}">`; } },
            { className: 'ps-1 text-overflow-ellipsis', render: function (data, type, game) { return game.getOpponentTeam(team.teamId).getNameWithRank(game.date, region); } },
            { width: '1em', className: 'dt-center no-wrap', render: function (data, type, game) { return game.getTeamsScore(team.teamId) }},
            { width: '1em', className: 'dt-center no-wrap', render: function (data, type, game) { return game.getActualDifferentialDisplayWithTooltip(team); } },
            { width: '1em', className: 'dt-center no-wrap', render: function (data, type, game) { return game.getPredictedDifferentialWithTooltip(team); } },
            { width: '1em', className: 'dt-center no-wrap', data: 'weight', render: function(data, type, game) { return game.getPerformanceDeltaWithIcon(team); } }
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
            startRender: function (rows, group) {
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
    }).on('draw', function() {
        $('#team-games-table [data-toggle="tooltip"]').tooltip();
    });

    $('#rankings-table-container').on('click', '#rankings-table td:not(.no-pointer)', function (e) {
        let tr = e.target.closest('tr');
        let row = $('#rankings-table').DataTable().row(tr);
        let clickedTeam = row.data();

        if (clickedTeam == team && rankingPeriodDeadlineDt == date) {
            $teamDetailModal.modal('show');
            return; 
        }

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
        
        $teamDetailModal.modal('show');
    });

    $olderGamesBtn.on('click', function (e) {
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
}

async function setupUpcomingGames() {
    let gamesWithoutScores = mrdaLinearRegressionSystem.mrdaGames.filter(game => !(game.homeTeamId in game.scores) || !(game.awayTeamId in game.scores));

    let upcomingGamesTable = new DataTable('#upcoming-games-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'date', visible: false },
            { data: 'homeTeam.name', width: '30em', className: 'dt-right', render: function(data, type, game) {return `<span class="team-name">${data}</span><div class="team-rp">${game.homeTeam.getPredictorRankingPoints(game.date) ?? '&nbsp;'}</div>`; } },
            { data: 'homeTeam.logo', width: '1em', render: function(data, type, game) {return `<img class="team-logo" class="ms-2" src="${data}">`; } },
            { data: 'getPredictedDifferentialDisplay()', width: '1em', className: 'dt-center' },
            { data: 'awayTeam.logo', width: '1em', render: function(data, type, game) {return `<img class="team-logo" class="ms-2" src="${data}">`; } },                
            { data: 'awayTeam.name', width: '30em', render: function(data, type, game) {return `<span class="team-name">${data}</span><div class="team-rp">${game.awayTeam.getPredictorRankingPoints(game.date) ?? '&nbsp;'}</div>`; }  },
        ],
        data: gamesWithoutScores,
        rowGroup: {
            dataSrc: ['event.getEventTitle()','getGameDay()'],
            emptyDataGroup: null
        },
        lengthChange: false,
        order: [[0, 'asc'], [1, 'asc']],
        ordering: {
            handler: false
        },
    });

    $('#upcoming-games-container').on('click', '#upcoming-games-table tr:not(.dtrg-group)', function (e) {
        let tr = e.target.closest('tr');
        let row = upcomingGamesTable.row(tr);
        let clickedGame = row.data();
        if (!clickedGame.homeTeam.getPredictorRankingPoints(clickedGame.date) || !clickedGame.awayTeam.getPredictorRankingPoints(clickedGame.date))
            return;
        $('#predictor-home').val(clickedGame.homeTeamId);
        $('#predictor-away').val(clickedGame.awayTeamId);
        let $predictorDate = $('#predictor-date');
        $predictorDate[0].valueAsDate = clickedGame.date;
        $predictorDate.trigger("change"); 
        $('#upcoming-games-modal').modal('hide');
        $('#predictor-modal').modal('show');
    });
}

async function populatePredictorChart(date, homeTeam, awayTeam, predictorChart, $loadingOverlay) {
    $loadingOverlay.find('.spinner-border').show();
    $loadingOverlay.find('.unavailable').hide();
    $loadingOverlay.show();

    date = new Date(date);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + ((3 - date.getDay() + 7) % 7)); // Set to next Wednesday
    let seedDate = getSeedDate(date);

    date.setDate(date.getDate() - 7); // Don't include games from current week so predicted game is in isolation

    let data = {th: homeTeam.teamId, ta: awayTeam.teamId};

    data.games = mrdaLinearRegressionSystem.mrdaGames
    .filter(game => seedDate <= game.date && game.date < date
        && !game.forfeit && game.homeTeamId in game.scores && game.awayTeamId in game.scores)
        .map(game => ({th: game.homeTeamId, ta: game.awayTeamId, sh: game.scores[game.homeTeamId], sa:game.scores[game.awayTeamId]}));

    data.seeding = Object.fromEntries(
        Object.entries(mrdaLinearRegressionSystem.getRankingHistory(seedDate))
            .map(([teamId, teamRanking]) => [teamId, teamRanking.rankingPoints - mrda_config.virtual_team_rp])
    );
    
    try {
        let response = await fetch('https://grimesbot.pythonanywhere.com/predict-game-lrd', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        
        let results = await response.json();

        predictorChart.options.scales.x.min = results[0]['d'];
        predictorChart.options.scales.x.max = results[results.length - 1]['d'];

        predictorChart.data.datasets = [];

        predictorChart.data.datasets.push({
            label: homeTeam.name,
            data: results.map(result => ({ x: result['d'], y: result['dh']})),
        });
        predictorChart.data.datasets.push({
            label: awayTeam.name,
            data: results.map(result => ({ x: result['d'], y: result['da']})),
        });
        $loadingOverlay.hide();
        predictorChart.update();
    } catch (err) {
        $loadingOverlay.find('.spinner-border').hide();
        $loadingOverlay.find('.unavailable').show();    
        console.error('Request failed:', err);
  }
}


function predictGame(predictorChart, $loadingOverlay) {
    predictorChart.data.datasets = [];
    predictorChart.update();

    let date = $('#predictor-date')[0].valueAsDate;

    let homeTeam = mrdaLinearRegressionSystem.mrdaTeams[$('#predictor-home').val()];
    let awayTeam = mrdaLinearRegressionSystem.mrdaTeams[$('#predictor-away').val()];

    let homeRp = null;
    let awayRp = null;

    if (homeTeam) {
        $('#predictor-home-logo').attr('src',homeTeam.logo);
        homeRp = homeTeam.getPredictorRankingPoints(date);
        if (homeRp)
            $('#predictor-home-rp').text(homeTeam.getPredictorPointsWithError(date));
        else
            $('#predictor-home-rp').html('&nbsp;');
    }

    if (awayTeam) {
        $('#predictor-away-logo').attr('src',awayTeam.logo);
        awayRp = awayTeam.getPredictorRankingPoints(date);
        if (awayRp)
            $('#predictor-away-rp').text(awayTeam.getPredictorPointsWithError(date));
        else
            $('#predictor-away-rp').html('&nbsp;');
    }

    if (homeRp && awayRp && homeTeam != awayTeam) {
        let diff = homeRp - awayRp;
        $('#predictor-diff').text(`${diff > 0 ? "+" : ""}${diff.toFixed(2)}`);
        populatePredictorChart(date, homeTeam, awayTeam, predictorChart, $loadingOverlay);
    } else
        $('#predictor-diff').html('&nbsp;');
}

function setupPredictor() {
    let $loadingOverlay = $('#predictor-chart-container .loading-overlay');
    $loadingOverlay.hide();
    $loadingOverlay.find('.unavailable').hide();

    let $date = $('#predictor-date');
    let $teamSelects = $('#predictor-home,#predictor-away');

    $date[0].valueAsDate = new Date();

    Object.values(mrdaLinearRegressionSystem.mrdaTeams).sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
        $teamSelects.append($('<option />').val(team.teamId).text(team.name));
    });

    let predictorChart = new Chart(document.getElementById('predictor-chart'), {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    min: -300,
                    max: 300,
                    title: {
                        display: true,
                        text: 'Potential Score Differential (Home - Away)',
                    },
                    ticks: {
                        callback: function(value, index, ticks) {
                            return value > 0 ? `+${value}` : value;
                        }
                    }
                },
                y: {
                    suggestedMin: -1,
                    suggestedMax: 1,
                    title: {
                        display: true,
                        text: 'Estimated Change in Ranking Points',
                    },
                    ticks: {
                        callback: function(value, index, ticks) {
                            return value > 0 ? `+${value}` : value;
                        }
                    },
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
                axis: 'x'
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Potential Score Differential: ${context[0].raw.x > 0 ? "+" : ""}${context[0].label}`;
                        },
                        label: function(context) {
                            return `${context.dataset.label}: ` + (context.raw.y > 0 ? `+${context.raw.y}` : context.raw.y);
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Estimated Change in Ranking Points vs. Potential Score Differentials*',
                },
                colors: {
                    forceOverride: true
                }
            },
            responsive: true,
            maintainAspectRatio: false
        },
    });

    $teamSelects.change(function() { predictGame(predictorChart, $loadingOverlay); });
    $date.change(function() { predictGame(predictorChart, $loadingOverlay); });
}

function setupAllGames() {
    let allGamesTable = new DataTable('#all-games-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'eventId', visible: false },                
            { data: 'date', visible: false },
            { className: 'dt-right', render: function(data, type, game) { 
                let result = game.homeTeam.getNameWithRank(game.date, region);
                if (game.forfeit && game.forfeitTeamId == game.homeTeamId)
                    result += '<sup class="forfeit-info">↓</sup>';
                let rankingPoints = game.awayTeamId == VIRTUAL_TEAM_ID ? game.homeTeam.getRankingPoints(game.date) : game.homeTeam.getPredictorRankingPoints(game.date);
                result += `<div class="team-rp">${rankingPoints ?? '&nbsp;'}</div>`;
                return result;
            } },
            { data: 'homeTeam.logo', width: '1em', render: function(data, type, game) { return `<img class="ms-2 team-logo" src="${data}">`; } },
            { name: 'score', width: '7em', className: 'dt-center no-wrap', render: function(data, type, game) {
                let result = `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}`;
                if (game.status < 6)
                    result += '<sup class="unvalidated-info">†</sup>';
                result += `<div class="performance-deltas">${game.getPerformanceDeltaWithIcon(game.homeTeam,1) ?? '&nbsp;'}&nbsp;&nbsp;${game.getPerformanceDeltaWithIcon(game.awayTeam,1) ?? '&nbsp;'}</div>`;
                return result;
            } },
            { data: 'awayTeam.logo', width: '1em', render: function(data, type, game) { return `<img class="ms-2 team-logo" src="${data}">`; } },                
            { render: function(data, type, game) { 
                let result = game.awayTeam.getNameWithRank(game.date, region);
                if (game.forfeit && game.forfeitTeamId == game.awayTeamId)
                    result += '<sup class="forfeit-info">↓</sup>';
                result += `<div class="team-rp">${game.awayTeam.getPredictorRankingPoints(game.date) ?? '&nbsp;'}</div>`;
                return result;
            } },
            { data: 'weight', width: '1em', render: function(data, type, game) { return data ? `${(data * 100).toFixed(0)}%` : ''; } }
        ],
        data: [],
        rowGroup: {
            dataSrc: ['event.getEventTitle()','getGameDay()'],
            emptyDataGroup: null
        },
        lengthChange: false,
        order: [[0, 'desc'], [1, 'desc'], [2, 'desc']],
        ordering: {
            handler: false
        },
        drawCallback: function (settings) {
            $('#all-games-table .unvalidated-info').tooltip({title: 'Score not yet validated'});            
            $('#all-games-table .forfeit-info').tooltip({title: 'Forfeit'});
            $('#all-games-table [data-toggle="tooltip"]').tooltip();            
        }
    });    

    $('#all-games-modal').on('show.bs.modal', function () {
        // Filter to games within ranking period with scores
        let games = mrdaLinearRegressionSystem.mrdaGames
            .filter(game => rankingPeriodStartDt <= game.date && game.date < rankingPeriodDeadlineDt
                && game.homeTeamId in game.scores && game.awayTeamId in game.scores);

        // Add virtual games
        let seedingRankings = mrdaLinearRegressionSystem.getRankingHistory(rankingPeriodStartDt);
        if (seedingRankings) {
            for (const [teamId, ranking] of Object.entries(seedingRankings)) {
                if (games.some(game => !game.forfeit && (game.homeTeamId == teamId || game.awayTeamId == teamId))) {
                    games.push(new MrdaGame({
                        date: rankingPeriodStartDt,
                        home_team: teamId,
                        home_score: ranking.rankingPoints.toFixed(2)
                    }, mrdaLinearRegressionSystem.mrdaTeams, mrdaLinearRegressionSystem.mrdaEvents, true));
                }
            }
        }
        allGamesTable.clear().rows.add(games).draw();
    });
    $('#all-games-modal').on('hidden.bs.modal', function () {
        allGamesTable.clear().draw();
    });
}

function setupUpsetGames() {
    let upsetsTable = new DataTable('#upsets-table', {
        columns: [
            { data: 'date', name: 'Date', render: function (data, type, game) { return type === 'display' ? data.toLocaleDateString() : data; } },
            { data: 'homeTeam.name', title: 'Home Team', className: 'dt-right', render: function(data, type, game) { 
                let result = data;
                if (type === 'display')
                {
                    for (let i = 0; i < game.homeTeam.forfeits; i++) {
                        result += '<sup class="forfeit-penalty">↓</sup>';
                    }
                }
                return result;
            }},
            { data: 'homeTeam.rank', title: 'Home #', width: '1em', className: 'no-wrap dt-right', render: function(data, type, game) { return region == 'GUR' ? data : game.homeTeam.regionRank; } },
            { name: 'score', width: '7em', className: 'dt-center', title: 'Score', render: function(data, type, game) {return type === 'display' ? `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}` : Math.abs(game.scores[game.homeTeamId]-game.scores[game.awayTeamId]); } },
            { data: 'awayTeam.rank', title: 'Away #', width: '1em', className: 'no-wrap dt-left', render: function(data, type, game) { return region == 'GUR' ? data : game.awayTeam.regionRank; } },
            { data: 'awayTeam.name', title: 'Away Team', render: function(data, type, game) {
                let result = data;
                if (type === 'display')
                {
                    for (let i = 0; i < game.awayTeam.forfeits; i++) {
                        result += '<sup class="forfeit-penalty">↓</sup>';
                    }
                }
                return result;
            }},
            { title: '# Diff', width: '1em', className: 'no-wrap', render: function(data, type, game) { return region == "GUR" ? Math.abs(game.homeTeam.rank - game.awayTeam.rank) : Math.abs(game.homeTeam.regionRank - game.awayTeam.regionRank); }},
            { title: 'RP Diff', width: '1em', className: 'no-wrap', render: function(data, type, game) { return Math.abs(game.homeTeam.rankingPoints-game.awayTeam.rankingPoints).toFixed(2); }}
        ],
        data: [],
        lengthChange: false,
        searching: false,
        drawCallback: function (settings) {
            $('#upsets-table .forfeit-penalty').tooltip({title: 'Two rank penalty applied for forfeit.'});
        }
    });

    $('#upsets-modal').on('show.bs.modal', function () {
        let upsetGames = mrdaLinearRegressionSystem.mrdaGames
            .filter(game => rankingPeriodStartDt <= game.date && game.date < rankingPeriodDeadlineDt
                && game.homeTeamId in game.scores && game.awayTeamId in game.scores && !game.forfeit
                && game.homeTeam.rank && game.awayTeam.rank
                && (region == "GUR" || (game.homeTeam.region == region && game.awayTeam.region == region))
                && ((game.scores[game.homeTeamId] > game.scores[game.awayTeamId] && game.homeTeam.rank > game.awayTeam.rank)
                    || (game.scores[game.awayTeamId] > game.scores[game.homeTeamId] && game.awayTeam.rank > game.homeTeam.rank)));

        upsetsTable.clear().rows.add(upsetGames).draw();
    });
    $('#upsets-modal').on('hidden.bs.modal', function () {
        upsetsTable.clear().draw();
    });
}

function setupErrorSummary() {
    let errorTable = new DataTable('#error-table', {
        columns: [
            { data: 'title', width: '20em'},
            { title: 'Start Date', data: 'minDt', render: DataTable.render.date()},
            { title: 'End Date', data: 'maxDt', render: DataTable.render.date()},            
            { title: 'Game Count', data: 'gameCount'},
            { title: 'Average Error', data: 'averageError' },            
        ],
        data: [],
        dom: 't',
        paging: false,
        searching: false,
        info: false,
        ordering: false
    });

    $('#error-modal').on('show.bs.modal', function () {
        if (!errorTable.data().any()) {

            let tableData = [];

            let quarterOpts = $('#date option').filter((i,e) => $(e).text().trim().startsWith('Q'));

            for (let i = 0; i < (quarterOpts.length - 1); i++) {
                let $quarterOpt = $(quarterOpts[i]);

                tableData.push({
                    title: $quarterOpt.text(),
                    minDt: new Date(`${$(quarterOpts[i+1]).val()} 00:00:00`),
                    maxDt: new Date(`${$quarterOpt.val()} 00:00:00`)
                });
            }

            tableData.push({
                title: '2024 Season (Without Seed Data)',
                minDt: new Date (2023, 10 - 1, 25),
                maxDt: new Date (2024, 10 - 1, 23)
            });

            tableData.push({
                title: '2025 Season',
                minDt: new Date (2024, 10 - 1, 23),
                maxDt: new Date (2025, 10 - 1, 22)
            });

            tableData.push({
                title: '2026 Season',
                minDt: new Date (2025, 10 - 1, 22),
                maxDt: new Date (2026, 10 - 1, 28)
            });

            tableData.push({
                title: '2025+ (All games with Seed Data)',
                minDt: new Date (2024, 10 - 1, 23),
                maxDt: null
            });

            tableData.push({
                title: 'All Games',
                minDt: null,
                maxDt: null
            });

            let predictedGames = mrdaLinearRegressionSystem.mrdaGames.filter(game => game.getPerformanceDelta(game.homeTeam) != null);
            for (const data of tableData) {
                let games = predictedGames.filter(game => (data.minDt == null || data.minDt <= game.date) && (data.maxDt == null || game.date < data.maxDt));
                data.gameCount = games.length;
                if (games.length > 0) {
                    let errSum = 0;
                    for (const game of games) {
                        let error = Math.abs(game.getPerformanceDelta(game.homeTeam));
                        errSum += error;
                    }
                    data.averageError = (errSum / games.length).toFixed(2);
                } else {
                    data.averageError = null;
                }
            }

            errorTable.rows.add(tableData).draw();
        }
    });
}

$(function() {

    //document.documentElement.setAttribute('data-bs-theme', (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    let $dateSelect = $('#date');
    setupRankingDates($dateSelect);

    let $regionSelect = $('#region');
    setupRegion($regionSelect);

    setupRankings();
    $dateSelect.on('change', handleRankingPeriodChange);
    $regionSelect.on('change', handleRegionChange);
        
    $('#rankings-generated-dt').text(new Date(mrda_config.rankings_generated_utc).toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'long'}));

    $('[data-toggle="tooltip"]').tooltip();

    //These are all initially hidden until user input. Setup last.
    setupTeamDetails();

    setupPredictor();

    setupUpcomingGames();

    setupAllGames();

    setupUpsetGames();      

    setupErrorSummary();
})