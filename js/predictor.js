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
    let $homeTeamSelect = $teamSelects.filter('#predictor-home');
    let $awayTeamSelect = $teamSelects.filter('#predictor-away');

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
            { name: 'homeName', className: 'dt-right home', 
                render: (data, type, game) => { 
                    let result = game.homeTeam.getNameWithRank(game.date, region, true);
                    if (game.forfeit && game.forfeitTeamId == game.homeTeamId)
                        result += '<sup class="forfeit-info">↓</sup>';
                    result += game.homeTeam.getPredictorRankingPointsDisplay(game.date);
                    return result;
                }
            },
            { name: 'homeLogo', className: 'home', width: '1em', render: (data, type, game) => { return game.homeTeam.getLogoDisplay(true, 'ms-2'); } },
            { name: 'score', width: '7em', className: 'no-wrap dt-center', 
                render: (data, type, game) => {
                    return `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}${game.getPerformanceDeltasDisplay()}`;
                } 
            },
            { name: 'awayLogo', className: 'away', width: '1em', render: (data, type, game) => { return game.awayTeam.getLogoDisplay(true, 'ms-2');} },
            { name: 'awayName', className: 'away', 
                render: (data, type, game) => {
                    let result = game.awayTeam.getNameWithRank(game.date, region, true);
                    if (game.forfeit && game.forfeitTeamId == game.awayTeamId)
                        result += '<sup class="forfeit-info">↓</sup>';
                    result += game.awayTeam.getPredictorRankingPointsDisplay(game.date);
                    return result; 
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

    $teamSelects.change(() => { 
        predictGame(predictorChart, $loadingOverlay);
        populateMatchupHistory(matchupHistoryTable);
    });

    $date.change(() => { predictGame(predictorChart, $loadingOverlay); });

    $('#predictor-modal').on('show.bs.modal', e => {
        let clicked = e.relatedTarget;
        let tr = clicked.closest('tr');
        if (!tr) return;
        let dt = $(clicked.closest('table')).DataTable();
        let row = dt.row(tr);
        let data = row.data();

        if (data instanceof MrdaGame) {
            let teamsChanged = false;
            if ($homeTeamSelect.val() != data.homeTeamId) {
                $homeTeamSelect.val(data.homeTeamId);
                teamsChanged = true;
            }
            if ($awayTeamSelect.val() != data.awayTeamId) {
                $awayTeamSelect.val(data.awayTeamId);
                teamsChanged = true; 
            }

            let dateChanged = false;
            let dateStr = `${data.date.getFullYear()}-${String(data.date.getMonth() + 1).padStart(2, '0')}-${String(data.date.getDate()).padStart(2, '0')}`;
            if ($date.val() != dateStr) {
                $date.val(dateStr);
                dateChanged = true;
            }

            if (teamsChanged) {
                predictGame(predictorChart, $loadingOverlay);
                populateMatchupHistory(matchupHistoryTable);
            } else if (dateChanged) {
                predictGame(predictorChart, $loadingOverlay);
            }
        }
    });

    $('#region').on('change', () => {
        // Re-read team matchup history table table data with regional ranks
        matchupHistoryTable.rows().invalidate('data').draw();
    });    
});