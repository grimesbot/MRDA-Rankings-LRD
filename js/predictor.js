const populatePredictorChart = async (date, homeTeam, awayTeam, predictorChart, $loadingOverlay) => {
    $loadingOverlay.find('.spinner-border').show();
    $loadingOverlay.find('.unavailable').hide();
    $loadingOverlay.show();

    date = new Date(date);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + ((3 - date.getDay() + 7) % 7)); // Set to next Wednesday
    let seedDate = getSeedDate(date);

    date.setDate(date.getDate() - 7); // Don't include games from current week so predicted game is in isolation

    let data = {th: homeTeam.teamId, ta: awayTeam.teamId};

    data.games = mrdaRankings.mrdaGames
    .filter(game => seedDate <= game.date && game.date < date
        && !game.forfeit && game.homeTeamId in game.scores && game.awayTeamId in game.scores)
        .map(game => ({th: game.homeTeamId, ta: game.awayTeamId, sh: game.scores[game.homeTeamId], sa:game.scores[game.awayTeamId]}));

    data.seeding = Object.fromEntries(
        Object.entries(mrdaRankings.getRankingHistory(seedDate))
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

const populateMatchupHistory = matchupHistoryTable => {
    $('#matchup-history-home-wins').html('&nbsp;');
    $('#matchup-history-away-wins').html('&nbsp;');
    $('#matchup-history-game-count').html('&nbsp;');

    matchupHistoryTable.clear().draw();

    let homeTeamId = $('#predictor-home').val();
    let awayTeamId = $('#predictor-away').val()

    if (homeTeamId && awayTeamId && homeTeamId != awayTeamId) {
        let games = mrdaRankings.mrdaGames.filter(game => game.date < rankingPeriodDeadlineDt
            && (game.homeTeamId == homeTeamId || game.awayTeamId == homeTeamId) 
            && (game.homeTeamId == awayTeamId || game.awayTeamId == awayTeamId)
            && game.homeTeamId in game.scores && game.awayTeamId in game.scores);

        let homeWins = games.filter(game => game.scores[homeTeamId] > game.scores[game.getOpponentTeamId(homeTeamId)]).length;
        let awayWins = games.filter(game => game.scores[awayTeamId] > game.scores[game.getOpponentTeamId(awayTeamId)]).length;

        $('#matchup-history-home-wins').text(homeWins);
        $('#matchup-history-away-wins').text(awayWins);
        $('#matchup-history-game-count').text(games.length);
        matchupHistoryTable.clear().rows.add(games).draw();
    }
}

const predictGame = (predictorChart, $loadingOverlay) => {
    $('#predictor-home-rp').html('&nbsp;');
    $('#predictor-away-rp').html('&nbsp;');
    $('#predictor-ratio').html('&nbsp;');

    predictorChart.data.datasets = [];
    predictorChart.update();

    let date = $('#predictor-date')[0].valueAsDate;

    let homeTeam = mrdaRankings.mrdaTeams[$('#predictor-home').val()];
    let awayTeam = mrdaRankings.mrdaTeams[$('#predictor-away').val()];

    let homeRp = null;
    let awayRp = null;

    if (homeTeam) {
        $('#predictor-home-logo, #matchup-history-home-logo').attr('src',homeTeam.logo);
        $('.predictor-home-team').data('team-id', homeTeam.teamId);
        homeRp = homeTeam.getPredictorRankingPoints(date);
        if (homeRp)
            $('#predictor-home-rp').text(homeTeam.getPredictorPointsWithError(date));
    }

    if (awayTeam) {
        $('#predictor-away-logo, #matchup-history-away-logo').attr('src',awayTeam.logo);
        $('.predictor-away-team').data('team-id', awayTeam.teamId);
        awayRp = awayTeam.getPredictorRankingPoints(date);
        if (awayRp)
            $('#predictor-away-rp').text(awayTeam.getPredictorPointsWithError(date));
    }

    if (homeRp && awayRp && homeTeam != awayTeam) {
        let diff = homeRp - awayRp;
        $('#predictor-diff').text(`${diff > 0 ? "+" : ""}${diff.toFixed(2)}`);
        populatePredictorChart(date, homeTeam, awayTeam, predictorChart, $loadingOverlay);
    }
}

// Setup predictor modal
$(() => {
    let $loadingOverlay = $('#predictor-chart-container .loading-overlay');
    $loadingOverlay.hide();
    $loadingOverlay.find('.unavailable').hide();

    let $date = $('#predictor-date');
    let $teamSelects = $('#predictor-home,#predictor-away');

    $date[0].valueAsDate = new Date();

    Object.values(mrdaRankings.mrdaTeams).sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
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
                        callback: (value, index, ticks) => {
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
                        callback: (value, index, ticks) => {
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
                        title: context => {
                            return `Potential Score Differential: ${context[0].raw.x > 0 ? "+" : ""}${context[0].label}`;
                        },
                        label: context => {
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

    let outsideRankingPeriodLegend = document.createElement('div');
    outsideRankingPeriodLegend.className = 'outside-ranking-period';
    outsideRankingPeriodLegend.innerHTML = 'Games older than current Ranking Period';

    let matchupHistoryTable = new DataTable('#matchup-history-table', {
        columns: [
            { data: 'date', visible: false },
            { data: 'homeTeam.name', className: 'dt-right home', 
                render: (data, type, game) => { 
                    let result = game.homeTeam.getNameWithRank(game.date, region);
                    if (game.forfeit && game.forfeitTeamId == game.homeTeamId)
                        result += '<sup class="forfeit-info">↓</sup>';
                    let rankingPoints = game.awayTeamId == VIRTUAL_TEAM_ID ? game.homeTeam.getRankingPoints(game.date) : game.homeTeam.getPredictorRankingPoints(game.date);
                    result += `<div class="team-rp">${rankingPoints ?? '&nbsp;'}</div>`;
                    return result;
                },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamName = $(cell).find('.team-name');
                    $teamName.attr('data-bs-toggle', 'modal');
                    $teamName.attr('data-bs-target', '#team-modal');
                    $teamName.data('team-detail', 'home');                    
                }
            },
            { data: 'homeTeam.logo', width: '1em', 
                render: (data, type, game) => { return `<img class="ms-2 team-logo home" src="${data}">`; },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamLogo = $(cell).find('.team-logo');
                    $teamLogo.attr('data-bs-toggle', 'modal');
                    $teamLogo.attr('data-bs-target', '#team-modal');
                    $teamLogo.data('team-detail', 'home');                    
                } 
            },
            { name: 'score', width: '7em', className: 'no-wrap dt-center', render: (data, type, game) => {
                return `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}<div class="performance-deltas">${game.getPerformanceDeltaWithIcon(game.homeTeam,1)}&nbsp;&nbsp;${game.getPerformanceDeltaWithIcon(game.awayTeam,1)}</div>`;
            } },
            { data: 'awayTeam.logo', width: '1em', 
                render: (data, type, game) => { return `<img class="ms-2 team-logo away" src="${data}">`; },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamLogo = $(cell).find('.team-logo');
                    $teamLogo.attr('data-bs-toggle', 'modal');
                    $teamLogo.attr('data-bs-target', '#team-modal');
                    $teamLogo.data('team-detail', 'away');                    
                }
            },
            { data: 'awayTeam.name', className: 'away', 
                render: (data, type, game) => {
                    let result = game.awayTeam.getNameWithRank(game.date, region);
                    if (game.forfeit && game.forfeitTeamId == game.awayTeamId)
                        result += '<sup class="forfeit-info">↓</sup>';
                    result += `<div class="team-rp">${game.awayTeam.getPredictorRankingPoints(game.date) ?? '&nbsp;'}</div>`;
                    return result; 
                },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamName = $(cell).find('.team-name');
                    $teamName.attr('data-bs-toggle', 'modal');
                    $teamName.attr('data-bs-target', '#team-modal');
                    $teamName.data('team-detail', 'away');                    
                } 
            }
        ],
        data: [],
        rowGroup: {
            dataSrc: ['getGameAndEventTitle()']
        },
        lengthChange: false,
        order: [[0, 'desc']],
        ordering: {
            handler: false
        },
        layout: {
            topStart: null,
            topEnd: null,
            bottomStart: outsideRankingPeriodLegend
        },
        language: {
            emptyTable: 'No previous games between these teams.',
            info: 'Showing _START_ to _END_ of _TOTAL_ games',
            infoEmpty: 'Showing 0 to 0 of 0 games.'
        },
        createdRow: (row, game, dataIndex) => {
            if (game.date < rankingPeriodStartDt)
                $(row).addClass('outside-ranking-period');
        },        
        drawCallback: settings => {
            $('#matchup-history-table .forfeit-info').tooltip({title: 'Forfeit'});
            $('#matchup-history-table [data-toggle="tooltip"]').tooltip();
        }
    });

    $('#predictor-modal').on('show.bs.modal', e => {
        let clicked = e.relatedTarget;
        let tr = clicked.closest('tr');
        if (!tr) return;
        let dt = $(clicked.closest('table')).DataTable();
        let row = dt.row(tr);
        let data = row.data();

        if (data instanceof MrdaGame) {
            $teamSelects.filter('#predictor-home').val(data.homeTeamId);
            $teamSelects.filter('#predictor-away').val(data.awayTeamId);
            $date[0].valueAsDate = data.date;
            predictGame(predictorChart, $loadingOverlay); 
            populateMatchupHistory(matchupHistoryTable);
        }
    });    

    $teamSelects.change(() => { 
        predictGame(predictorChart, $loadingOverlay);
        populateMatchupHistory(matchupHistoryTable);        
    });

    $date.change(() => { predictGame(predictorChart, $loadingOverlay); });

    $('#region').on('change', () => {
        // Re-read team matchup history table table data with regional ranks
        matchupHistoryTable.rows().invalidate('data').draw();
    });    
});