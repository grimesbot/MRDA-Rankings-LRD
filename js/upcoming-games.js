// Setup upcoming games modal
$(() => {
    let gamesWithoutScores = mrdaRankings.mrdaGames.filter(game => !(game.homeTeamId in game.scores) || !(game.awayTeamId in game.scores));

    new DataTable('#upcoming-games-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'date', visible: false },
            { data: 'homeTeam.name', width: '30em', className: 'dt-right', render: (data, type, game) => {return `<span class="team-name">${data}</span><div class="team-rp">${game.homeTeam.getPredictorRankingPoints(game.date) ?? '&nbsp;'}</div>`; } },
            { data: 'homeTeam.logo', width: '1em', render: (data, type, game) => {return `<img class="team-logo" class="ms-2" src="${data}">`; } },
            { data: 'getPredictedDifferentialDisplay()', width: '1em', className: 'dt-center' },
            { data: 'awayTeam.logo', width: '1em', render: (data, type, game) => {return `<img class="team-logo" class="ms-2" src="${data}">`; } },                
            { data: 'awayTeam.name', width: '30em', render: (data, type, game) => {return `<span class="team-name">${data}</span><div class="team-rp">${game.awayTeam.getPredictorRankingPoints(game.date) ?? '&nbsp;'}</div>`; }  },
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
        createdRow: (row, data, dataIndex) => {
            $row = $(row);
            $row.attr('data-bs-toggle', 'modal');
            $row.attr('data-bs-target', '#predictor-modal');
        },
    });
});