// Setup all games modal
$(function() {
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
        allGamesTable.clear().rows.add(games).draw();
    });
    $('#all-games-modal').on('hidden.bs.modal', function () {
        allGamesTable.clear().draw();
    });    
});