// Setup all games modal
$(() => {
    let $rankingPeriodLabel = $('#ranking-period-label');
    let resultsTable = new DataTable('#results-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'eventId', visible: false },
            { data: 'date', visible: false },
            { name: 'homeName', className: 'dt-right home', 
                render: (data, type, game) => { 
                    let result = game.homeTeam.getNameWithRank(game.date, region, true);
                    if (game.forfeit && game.forfeitTeamId == game.homeTeamId)
                        result += '<sup class="forfeit-info">↓</sup>';
                    result += game.awayTeamId == VIRTUAL_TEAM_ID ? game.homeTeam.getRankingPointsDisplay(game.date) : game.homeTeam.getPredictorRankingPointsDisplay(game.date);
                    return result;
                }
            },
            { name: 'homeLogo', className: 'home', width: '1em', render: (data, type, game) => { return game.homeTeam.getLogoDisplay(true, 'ms-2'); } },
            { name: 'score', width: '7em', className: 'dt-center no-wrap', 
                render: (data, type, game) => {
                    let result = `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}`;
                    if (game.status < 6)
                        result += '<sup class="unvalidated-info">†</sup>';
                    result += game.getPerformanceDeltasDisplay();
                    return result;
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