// Setup upcoming games modal
$(() => {
    let gamesWithoutScores = mrdaRankings.mrdaGames.filter(game => !(game.homeTeamId in game.scores) || !(game.awayTeamId in game.scores));

    new DataTable('#upcoming-games-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'date', className: 'no-wrap game-time', width: '1em', render: (data, type, game) => { return type === 'display' ? data.toLocaleTimeString(undefined,{timeStyle:'short'}) : data; } },
            { name: 'homeName', width: '30em', className: 'dt-right', render: (data, type, game) => { return `${game.homeTeam.getNameDisplay()}${game.homeTeam.getPredictorRankingPointsDisplay(game.date)}`; } },
            { name: 'homeLogo', width: '1em', render: (data, type, game) => { return game.homeTeam.getLogoDisplay(false, 'ms-2'); } },
            { data: 'getPredictedDifferentialDisplay()', width: '1em', className: 'dt-center' },
            { name: 'awayLogo', width: '1em', render: (data, type, game) => { return game.awayTeam.getLogoDisplay(false, 'ms-2'); } },                
            { name: 'awayName', width: '30em', render: (data, type, game) => { return `${game.awayTeam.getNameDisplay()}${game.awayTeam.getPredictorRankingPointsDisplay(game.date)}`; } },
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