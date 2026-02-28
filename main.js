const mrdaLinearRegressionSystem = new MrdaLinearRegressionSystem(rankings_history, mrda_teams, mrda_events, mrda_games);

const urlParams = new URLSearchParams(window.location.search);

let rankingPeriodDeadlineDt = null;
let rankingPeriodStartDt = null;
let previousQuarterDt = null;
let region = null;

function setRankingDates($dateSelect) {
    rankingPeriodDeadlineDt = new Date(`${$dateSelect.val()} 00:00`);
    rankingPeriodStartDt = mrdaLinearRegressionSystem.getSeedDate(rankingPeriodDeadlineDt);

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
                render: function (data, type, full) { 
                    if (type === 'sort')
                        return full.rankSort;
                    else if (region != 'GUR')
                        return full.regionRank;
                    else
                        return data;
                }
            },
            { data: 'delta', width: '1em', className: 'no-wrap delta dt-center px-1',
                render: function (data, type, full) {
                    let delta = region == 'GUR' ? full.delta : full.regionDelta;
                    if (type === 'display') {
                        if (!full.rank)
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
            { data: 'logo', width: '1em', orderable: false, className: 'px-1', render: function (data, type, full) { return data ? `<img class="team-logo" src="${data}">` : ''; } },            
            { data: 'name', orderable: false, className: 'px-1 text-overflow-ellipsis', 
                render: function (data, type, full) {
                    if (['display','export'].includes(type) && full.activeStatus) {
                        let result = data;
                        for (let i = 0; i < full.forfeits; i++) {
                            if (type === 'display')
                                result += '<sup class="forfeit-penalty">↓</sup>';
                            else if (type === 'export')
                                result += ' ↓';
                        }
                        return result;
                    }
                    return data;
                },
                createdCell: function (td, cellData, rowData, row, col) {
                    if (rowData.location) 
                        $(td).append(`<div class="team-location">${rowData.location}</div>`);
                }
            },
            { data: 'rankingPoints', width: '1em', className: 'px-1' },
            { data: 'standardError', width: '1em', className: 'px-1 dt-left', render: function (data, type, full) { return type === 'display' ? `±${data}` : data; }},
            { data: 'activeStatusGameCount', width: '1em', className: 'px-1', render: function (data, type, full) { return type === 'display' && !full.postseasonEligible ? `${data}<span class="postseason-ineligible">*</span>` : data; } },
            { data: 'wins', width: '1em', orderable: false, className: 'px-1 dt-center'},
            { data: 'losses', width: '1.6em', orderable: false, className: 'px-1 dt-left'},
            { data: 'chart', width: '1em', className: 'ps-1 dt-center no-pointer', orderable: false, render: function (data, type, full) { return `<input type="checkbox" class="chart"${data ? ' checked' : ''}></input>`; }}
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
                        label: 'Games',
                        data: [],
                        pointRadius: 5,
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
                            callbacks: {
                                title: function(context) {
                                    return context[0].raw.title;                                
                                },
                                label: function(context) {
                                    return context.raw.label;
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
            { width: '1em', className: 'dt-center', name: 'date', data: 'date', render: function (data, type, row) { return type === 'display' ? `<div data-toggle="tooltip" title="${data.toLocaleTimeString(undefined,{timeStyle:'short'})}">${data.toLocaleDateString(undefined,{weekday:'short'})}</div>` : data }},
            { width: '1em', className: 'dt-center narrow', render: function (data, type, row) { return row.getWL(team.teamId) }},
            { width: '1em', className: 'dt-center narrow', render: function (data, type, row) { return row.getAtVs(team.teamId) }},
            //{ width: '5em', className: 'dt-right', render: function (data, type, row) { return row.getWlAtVs(team.teamId) }},
            { width: '1em', className: 'px-1', render: function(data, type, game) {return `<img class="opponent-logo" src="${game.getOpponentTeam(team.teamId).logo}">`; } },
            { className: 'ps-1 text-overflow-ellipsis', render: function (data, type, game) { 
                let opponent = game.getOpponentTeam(team.teamId);
                let teamRanking = opponent.getRanking(game.date);
                if (teamRanking && teamRanking.rank)
                    return `<span class="team-rank" data-toggle="tooltip" title="Global rank as of ${teamRanking.date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}">${teamRanking.rank}</span> ${opponent.name}`
                return opponent.name; 
            }},
            { width: '1em', className: 'dt-center no-wrap', render: function (data, type, row) { return row.getTeamsScore(team.teamId) }},
            { width: '1em', className: 'dt-center', render: function (data, type, row) { return team.teamId in row.actualDifferentials ? (row.actualDifferentials[team.teamId] > 0 ? `+${row.actualDifferentials[team.teamId]}` : row.actualDifferentials[team.teamId]) : '' } },            
            { width: '1em', className: 'dt-center', render: function (data, type, row) { return team.teamId in row.expectedDifferentials ? (row.expectedDifferentials[team.teamId] > 0 ? `+${row.expectedDifferentials[team.teamId].toFixed(2)}` : row.expectedDifferentials[team.teamId].toFixed(2)) : '' } },
            { width: '1em', className: 'dt-center', data: 'weight', render: function(data, type, game) {return data ? `${(data * 100).toFixed(0)}%` : ''; } }
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

                th.colSpan = 6;
                th.textContent = group.getEventTitleWithDate();
                th.className = 'text-overflow-ellipsis';
                tr.appendChild(th);

                th = document.createElement('th');
                th.colSpan = 3;
                th.className = 'rp-change';

                let rpBefore = team.getRankingPoints(group.startDt);
                let rpAfter = team.getRankingPoints(group.endDt, true);

                if (rpBefore && rpAfter) {
                    let icon = 'bi-arrow-right';
                    if (rpAfter > rpBefore)
                        icon = 'bi-arrow-up-right';
                    else if (rpBefore > rpAfter)
                        icon = 'bi-arrow-down-right';
                    th.innerHTML = `${rpBefore.toFixed(2)} <i class='bi ${icon}'></i> ${rpAfter.toFixed(2)}`;                    
                } else if (rpAfter) {
                    th.innerHTML = rpAfter.toFixed(2);
                }

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
        drawCallback: function (settings) {
            $('#team-games-table [data-toggle="tooltip"]').tooltip();
        }
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

        let minChartDt = [...team.rankingHistory.keys()].sort((a, b) => a - b)[0];
        let chartGames = team.gameHistory.filter(game => game.gamePoints[team.teamId]);        
        let oldestGame = chartGames.sort((a,b) => a.date - b.date)[0];
        if (oldestGame && oldestGame.date < minChartDt)
            minChartDt = new Date(minChartDt).setDate(minChartDt.getDate() - 7);

        // Set up Ranking Point data with error bars, only displayed on an interval or for > 5% change
        let rankingHistory = [];
        let errorBarMinFrequency = (date - minChartDt) / 16;
        let lastDtWithErrorBars = null;
        let teamRankingHistoryArray = Array.from(team.rankingHistory.entries()).filter(rh => rh[0] <= date);
        for (const [dt, ranking] of teamRankingHistoryArray) {
            let chartErrs = false;
            let index = teamRankingHistoryArray.findIndex(([key]) => key === dt);
            if (index == 0 || index == teamRankingHistoryArray.length - 1 || dt == date)
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
                
            rankingHistory.push({
                x: dt,
                y: ranking.rankingPoints,
                yMin: chartErrs ? errMin : null,
                yMax: chartErrs ? errMax : null,
                title: dt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),
                label: `RP: ${ranking.rankingPoints} ± ${ranking.standardError} (${errMin.toFixed(2)} .. ${errMax.toFixed(2)})`
            });
        }
        
        // Game chart data
        teamChart.data.datasets[0].data = chartGames.map(game => {
            return { 
                x: game.date, 
                y: game.gamePoints[team.teamId],
                title: game.getGameAndEventTitle(),
                label: `${game.getGameSummary(team.teamId)}: ${game.gamePoints[team.teamId].toFixed(2)}`
            }});
        teamChart.data.datasets[1].data = rankingHistory;
        teamChart.options.scales.x.min = minChartDt;
        teamChart.options.scales.x.max = rankingPeriodDeadlineDt;
        teamChart.update();

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
        let newMinDt = mrdaLinearRegressionSystem.getSeedDate(minGameDt);
        teamGameTable.rows.add(team.gameHistory.filter(game => newMinDt <= game.date && game.date < minGameDt)).draw();
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
            { data: 'homeTeam.name', width: '30em', className: 'dt-right', render: function(data, type, game) {return `${data}<div class="team-rp">${game.homeTeam.getRankingPoints(game.date) ?? '&nbsp;'}</div>`; } },
            { data: 'homeTeam.logo', width: '1em', render: function(data, type, full) {return `<img class="team-logo" class="ms-2" src="${data}">`; } },
            { width: '1em', className: 'dt-center',  render: function(data, type, game) { return game.homeTeamId in game.expectedDifferentials ? game.expectedDifferentials[game.homeTeamId].toFixed(2) : ''; } },
            { data: 'awayTeam.logo', width: '1em', render: function(data, type, full) {return `<img class="team-logo" class="ms-2" src="${data}">`; } },                
            { data: 'awayTeam.name', width: '30em', render: function(data, type, game) {return `${data}<div class="team-rp">${game.awayTeam.getRankingPoints(game.date) ?? '&nbsp;'}</div>`; }  },
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
        if (!clickedGame.awayTeam.getRankingPoints(clickedGame.date) || !clickedGame.homeTeam.getRankingPoints(clickedGame.date))
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
    let seedDate = mrdaLinearRegressionSystem.getSeedDate(date);

    let data = {th: homeTeam.teamId, ta: awayTeam.teamId};

    data.games = mrdaLinearRegressionSystem.mrdaGames
    .filter(game => seedDate <= game.date && game.date < date
        && !game.forfeit && game.homeTeamId in game.scores && game.awayTeamId in game.scores)
        .map(game => ({th: game.homeTeamId, ta: game.awayTeamId, sh: game.scores[game.homeTeamId], sa:game.scores[game.awayTeamId]}));

    data.seeding = Object.fromEntries(
        Object.entries(mrdaLinearRegressionSystem.getRankingHistory(seedDate))
            .map(([teamId, teamRanking]) => [teamId, teamRanking.rankingPoints])
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
    let ranking = mrdaLinearRegressionSystem.getRankingHistory(date);

    let homeTeam = mrdaLinearRegressionSystem.mrdaTeams[$('#predictor-home').val()];
    let awayTeam = mrdaLinearRegressionSystem.mrdaTeams[$('#predictor-away').val()];

    let homeRp = null;
    let awayRp = null;

    if (homeTeam) {
        $('#predictor-home-logo').attr('src',homeTeam.logo);
        let homeRanking = ranking[homeTeam.teamId];
        if (homeRanking && homeRanking.rankingPoints) {
            homeRp = homeRanking.rankingPoints;
            $('#predictor-home-rp').text(`${homeRp} ±${homeRanking.standardError}`);
        } else
            $('#predictor-home-rp').html('&nbsp;');
    }

    if (awayTeam) {
        $('#predictor-away-logo').attr('src',awayTeam.logo);
        let awayRanking = ranking[awayTeam.teamId];
        if (awayRanking && awayRanking.rankingPoints) {
            awayRp = awayRanking.rankingPoints;
            $('#predictor-away-rp').text(`${awayRp} ±${awayRanking.standardError}`);
        } else
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
                    home_score: ranking.rankingPoints.toFixed(2),
                    away_score: 0,
                    weight: .25,
                }, mrdaLinearRegressionSystem.mrdaTeams, mrdaLinearRegressionSystem.mrdaEvents, true));
            }
        }
    }

    if (DataTable.isDataTable('#all-games-table')) {
        $('#all-games-table').DataTable().clear().rows.add(games).draw();
        return;
    }

    new DataTable('#all-games-table', {
            columns: [
                { data: 'event.startDt', visible: false },
                { data: 'eventId', visible: false },                
                { data: 'date', visible: false },
                { data: 'homeTeam.name', title: 'Home Team', className: 'dt-right', render: function(data, type, game) { return game.forfeit && game.forfeitTeamId == game.homeTeamId ? `${data}<sup class="forfeit-info">↓</sup>` : data; } },
                { data: 'homeTeam.logo', width: '1em', render: function(data, type, game) { return `<img class="ms-2 team-logo" src="${data}">`; } },
                { name: 'score', width: '7em', className: 'dt-center', title: 'Score', render: function(data, type, game) {return `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}${game.status < 6 ? '<sup class="unvalidated-info">†</sup>' : ''}`} },
                { data: 'awayTeam.logo', width: '1em', render: function(data, type, game) { return `<img class="ms-2 team-logo" src="${data}">`; } },                
                { data: 'awayTeam.name', title: 'Away Team', render: function(data, type, game) { return game.forfeit && game.forfeitTeamId == game.awayTeamId ? `${data}<sup class="forfeit-info">↓</sup>` : data; } },
                { data: 'weight', title: 'Weight', width: '1em', render: function(data, type, game) { return data ? `${(data * 100).toFixed(0)}%` : ''; } }
            ],
            data: games,
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
                $('.unvalidated-info').tooltip({title: 'Score not yet validated'});            
                $('.forfeit-info').tooltip({title: 'Forfeit'});
            }
        });
}

function setupErrorSummary() {
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

    let predictedGames = mrdaLinearRegressionSystem.mrdaGames.filter(game => game.absLogError);
    for (const data of tableData) {
        let games = predictedGames.filter(game => (data.minDt == null || data.minDt <= game.date) && (data.maxDt == null || game.date < data.maxDt));
        data.gameCount = games.length;
        if (games.length > 0) {
            let errSum = 0;
            let absLogErrSum = 0;
            for (const game of games) {
                let error = Math.abs(game.scores[game.homeTeamId] - game.scores[game.awayTeamId] - game.expectedDifferentials[game.homeTeamId]);
                errSum += error;
                absLogErrSum += game.absLogError;
            }
            data.averageError = (errSum / games.length).toFixed(2);
            data.meal = Math.exp(absLogErrSum/data.gameCount) - 1;
        } else {
            data.averageError = null;
            data.meal = null;
        }
    }

    new DataTable('#error-table', {
        columns: [
            { data: 'title'},
            { title: 'Start Date', data: 'minDt', render: DataTable.render.date()},
            { title: 'End Date', data: 'maxDt', render: DataTable.render.date()},            
            { title: 'Game Count', data: 'gameCount'},
            { title: 'Average Error', data: 'averageError' },            
            { title: 'Mean Absolute Log Error', data: 'meal', render: function(data, type) {return data ? `${(data * 100).toFixed(2)}%` : ''; }}
        ],
        data: tableData,
        dom: 't',
        paging: false,
        searching: false,
        info: false,
        ordering: false
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
        
    $('#rankings-generated-dt').text(new Date(rankings_generated_utc).toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'long'}));

    $('[data-toggle="tooltip"]').tooltip();

    //These are all initially hidden until user input. Setup last.
    setupTeamDetails();

    setupPredictor();

    setupUpcomingGames();

    setupAllGames();
    // update all games table when ranking period changes to filter games to new ranking period and recalculate virtual games
    $dateSelect.on('change', setupAllGames); 

    setupErrorSummary();
})