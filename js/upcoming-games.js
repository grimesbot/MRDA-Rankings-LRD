// Setup upcoming games modal
$(function() {
    let gamesWithoutScores = mrdaRankings.mrdaGames.filter(game => !(game.homeTeamId in game.scores) || !(game.awayTeamId in game.scores));

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
});