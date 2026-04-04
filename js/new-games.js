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
            { data: 'homeTeam.name', className: 'dt-right home', title: 'Home Team', 
                render: (data, type, game) => { 
                    let result = type === 'display' ? game.homeTeam.getNameWithRank(game.date, region) : data;
                    if (['display','export'].includes(type) && game.forfeit && game.forfeitTeamId == game.homeTeamId)
                        result += type === 'display' ? '<sup class="forfeit-info">↓</sup>' : ' ↓';
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
            { name: 'score', width: '7em', className: 'dt-center', title: 'Score', render: (data, type, game) => {return type === 'sort' ? Math.abs(game.scores[game.homeTeamId] - game.scores[game.awayTeamId]) : `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}`; } },
            { data: 'awayTeam.logo', width: '1em', 
                render: (data, type, game) => { return `<img class="ms-2 team-logo away" src="${data}">`; },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamLogo = $(cell).find('.team-logo');
                    $teamLogo.attr('data-bs-toggle', 'modal');
                    $teamLogo.attr('data-bs-target', '#team-modal');
                    $teamLogo.data('team-detail', 'away');                    
                }                
            },
            { data: 'awayTeam.name', className: 'away',  title: 'Away Team', 
                render: (data, type, game) => {
                    let result = type === 'display' ? game.awayTeam.getNameWithRank(game.date, region) : data;
                    if (['display','export'].includes(type) && game.forfeit && game.forfeitTeamId == game.awayTeamId)
                        result += type === 'display' ? '<sup class="forfeit-info">↓</sup>' : ' ↓';
                    return result;
                },
                createdCell: ( cell, cellData, rowData, rowIndex, colIndex ) => {
                    let $teamName = $(cell).find('.team-name');
                    $teamName.attr('data-bs-toggle', 'modal');
                    $teamName.attr('data-bs-target', '#team-modal');
                    $teamName.data('team-detail', 'away');
                }
            },
            { title: 'Event', render: (data, type, game) => { return game.event.name ?? ''; } },
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