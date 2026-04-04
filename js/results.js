// Setup all games modal
$(() => {
    let $rankingPeriodLabel = $('#ranking-period-label');
    let resultsTable = new DataTable('#results-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'eventId', visible: false },
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
                render: (data, type, game) => { return `<img class="ms-2 home team-logo" src="${data}">`; },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamLogo = $(cell).find('.team-logo');
                    $teamLogo.attr('data-bs-toggle', 'modal');
                    $teamLogo.attr('data-bs-target', '#team-modal');
                    $teamLogo.data('team-detail', 'home');                    
                }
            },
            { name: 'score', width: '7em', className: 'dt-center no-wrap', render: (data, type, game) => {
                let result = `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}`;
                if (game.status < 6)
                    result += '<sup class="unvalidated-info">†</sup>';
                result += `<div class="performance-deltas">${game.getPerformanceDeltaWithIcon(game.homeTeam,1)}&nbsp;&nbsp;${game.getPerformanceDeltaWithIcon(game.awayTeam,1)}</div>`;
                return result;
            } },
            { data: 'awayTeam.logo', width: '1em', 
                render: (data, type, game) => { return `<img class="ms-2 away team-logo" src="${data}">`; }, 
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
            },
            { data: 'weight', width: '1em', render: (data, type, game) => { return data ? `${(data * 100).toFixed(0)}%` : ''; } }
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
        layout: {
            topStart: null,
            topEnd: null,
            bottomStart: 'search'
        },        
        drawCallback: settings => {
            $('#results-table .unvalidated-info').tooltip({title: 'Score not yet validated'});            
            $('#results-table .forfeit-info').tooltip({title: 'Forfeit'});
            $('#results-table [data-toggle="tooltip"]').tooltip();            
        }
    });

    $('#results-modal').on('show.bs.modal', () => {
        $rankingPeriodLabel.text(`${rankingPeriodStartDt.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} up to ${rankingPeriodDeadlineDt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}`);
        // Filter to games within ranking period with scores
        let games = mrdaRankings.mrdaGames
            .filter(game => rankingPeriodStartDt <= game.date && game.date < rankingPeriodDeadlineDt
                && game.homeTeamId in game.scores && game.awayTeamId in game.scores);

        // Add virtual games
        let seedingRankings = mrdaRankings.getRankingHistory(rankingPeriodStartDt);
        if (seedingRankings) {
            for (const [teamId, ranking] of Object.entries(seedingRankings)) {
                if (games.some(game => !game.forfeit && (game.homeTeamId == teamId || game.awayTeamId == teamId))) {
                    games.push(new MrdaGame({
                        date: rankingPeriodStartDt,
                        home_team: teamId,
                        home_score: ranking.rankingPoints.toFixed(2)
                    }, mrdaRankings.mrdaTeams, mrdaRankings.mrdaEvents, true));
                }
            }
        }
        resultsTable.clear().rows.add(games).draw();
    });
    $('#results-modal').on('hidden.bs.modal', () => {
        $rankingPeriodLabel.text('');        
        resultsTable.clear().draw();
    });    
});