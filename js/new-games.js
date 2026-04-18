// Setup new games modal
$(() => {
    let $newGamesPeriodLabel = $('#new-games-period-label');
    let exportOptions = { 
        columns: [2,3,5,7,8], 
        format: { 
            header: (data, columnIdx) => { return ['Date','Home Team','Score','Away Team','Event'][columnIdx]; } 
        },
        orthogonal: 'export'   
    };

    let newGamesTable = new DataTable('#new-games-table', {
        columns: [
            { data: 'event.startDt', visible: false },
            { data: 'eventId', visible: false },
            { data: 'date', title: 'Date', width: '1em', render: (data, type, game) => { return ['display','export'].includes(type) ? data.toLocaleDateString() : data; } },
            { data: 'homeTeam.name', className: 'dt-right home',
                render: (data, type, game) => {
                    if (type === 'sort')
                        return data;
                    let result = type === 'display' ? game.homeTeam.getNameWithRank(game.date, region, true) : data;
                    if (game.forfeit && game.forfeitTeamId == game.homeTeamId)
                        result += type === 'display' ? '<sup class="forfeit-info">↓</sup>' : ' ↓';
                    if (type === 'display')
                        result += game.homeTeam.getPredictorRankingPointsDisplay(game.date);
                    return result;
                }
            },
            { name: 'homeLogo', className: 'home', width: '1em', render: (data, type, game) => { return game.homeTeam.getLogoDisplay(true, 'ms-2'); } },
            { name: 'score', width: '7em', className: 'dt-center no-wrap',
                render: (data, type, game) => {
                    if (type === 'sort')
                        return Math.abs(game.scores[game.homeTeamId] - game.scores[game.awayTeamId]);
                    let result = `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}`;
                    if (type === 'display')
                        result += game.getPerformanceDeltasDisplay();
                    return result;
                }
            },
            { name: 'awayLogo', className: 'away', width: '1em', render: (data, type, game) => { return game.awayTeam.getLogoDisplay(true, 'ms-2');} },
            { data: 'awayTeam.name', className: 'away', 
                render: (data, type, game) => {
                    if (type === 'sort')
                        return data;
                    let result = type === 'display' ? game.awayTeam.getNameWithRank(game.date, region, true) : data;
                    if (game.forfeit && game.forfeitTeamId == game.awayTeamId)
                        result += type === 'display' ? '<sup class="forfeit-info">↓</sup>' : ' ↓';
                    if (type === 'display')
                        result += game.awayTeam.getPredictorRankingPointsDisplay(game.date);                    
                    return result;
                }
            },
            { name: 'event', render: (data, type, game) => { return game.event.name ?? ''; } },
        ],
        data: [],
        order: [[0, 'asc'], [1, 'asc'], [2, 'asc']],
        ordering: {
            handler: false
        },
        lengthChange: false,
        searching: false,
        layout: {
            topStart: null,
            topEnd: null,
            bottomStart: { 
                buttons: [
                    {
                        extend: 'copy',
                        text: '<i class="bi bi-copy"></i>',
                        exportOptions: exportOptions,
                        messageBottom: '↓ Forfeit',
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
        drawCallback: settings => {
            $('#new-games-table .forfeit-info').tooltip({title: 'Forfeit'});
            $('#new-games-table [data-toggle="tooltip"]').tooltip();
        }
    });

    $('#new-games-modal').on('show.bs.modal', () => {
        $newGamesPeriodLabel.text(`${previousQuarterDt.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} up to ${rankingPeriodDeadlineDt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}`);
        let newGames = mrdaRankings.mrdaGames
            .filter(game => previousQuarterDt <= game.date && game.date < rankingPeriodDeadlineDt
                && game.homeTeamId in game.scores && game.awayTeamId in game.scores
                && (region == "GUR" || game.homeTeam.region == region || game.awayTeam.region == region));

        newGamesTable.clear().rows.add(newGames).draw();
    });

    $('#new-games-modal').on('hidden.bs.modal', () => {
        $newGamesPeriodLabel.text('');
        newGamesTable.clear().draw();
    });
});