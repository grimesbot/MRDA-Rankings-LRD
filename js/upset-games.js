// Setup upset games modal
$(() => {
    let upsetsTable = new DataTable('#upsets-table', {
        columns: [
            { data: 'date', name: 'Date', render: (data, type, game) => { return type === 'display' ? data.toLocaleDateString() : data; } },
            { data: 'homeTeam.name', className: 'dt-right',
                render: (data, type, game) => { 
                    if (type === 'display')
                    {
                        let result = game.homeTeam.getNameWithRank(rankingPeriodDeadlineDt, region);
                        for (let i = 0; i < game.homeTeam.forfeits; i++) {
                            result += '<sup class="forfeit-penalty">↓</sup>';
                        }
                        result += game.homeTeam.getRankingPointsDisplay(rankingPeriodDeadlineDt);
                        return result;
                    }
                    return data;
                }
            },
            { name: 'homeLogo', width: '1em', render: (data, type, game) => { return game.homeTeam.getLogoDisplay(false, 'ms-2'); } },
            { name: 'score', width: '7em', className: 'dt-center no-wrap',
                render: (data, type, game) => { 
                    if (type === 'sort')
                        return Math.abs(game.scores[game.homeTeamId]-game.scores[game.awayTeamId]);
                    return `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}`;
                }
            },
            { name: 'awayLogo', width: '1em', render: (data, type, game) => { return game.awayTeam.getLogoDisplay(false, 'ms-2');} },
            { data: 'awayTeam.name', 
                render: (data, type, game) => {
                    if (type === 'display')
                    {
                        let result = game.awayTeam.getNameWithRank(rankingPeriodDeadlineDt, region);
                        for (let i = 0; i < game.awayTeam.forfeits; i++) {
                            result += '<sup class="forfeit-penalty">↓</sup>';
                        }
                        result += game.awayTeam.getRankingPointsDisplay(rankingPeriodDeadlineDt);
                        return result;
                    }
                    return data;
                }
            },
            { name: 'rankDiff', width: '1em', className: 'no-wrap', render: (data, type, game) => { return region == "GUR" ? Math.abs(game.homeTeam.rank - game.awayTeam.rank) : Math.abs(game.homeTeam.regionRank - game.awayTeam.regionRank); }},
            { name: 'rpDiff', width: '1em', className: 'no-wrap', render: (data, type, game) => { return Math.abs(game.homeTeam.rankingPoints-game.awayTeam.rankingPoints).toFixed(2); }}
        ],
        data: [],
        lengthChange: false,
        searching: false,
        createdRow: (row, data, dataIndex) => {
            $row = $(row);
            $row.attr('data-bs-toggle', 'modal');
            $row.attr('data-bs-target', '#predictor-modal');
        },
        drawCallback: settings => {
            $('#upsets-table .forfeit-penalty').tooltip({title: 'Two rank penalty applied for forfeit.'});
        }
    });

    $('#upsets-modal').on('show.bs.modal', () => {
        let upsetGames = mrdaRankings.mrdaGames
            .filter(game => rankingPeriodStartDt <= game.date && game.date < rankingPeriodDeadlineDt
                && game.homeTeamId in game.scores && game.awayTeamId in game.scores && !game.forfeit
                && game.homeTeam.rank && game.awayTeam.rank
                && (region == "GUR" || game.homeTeam.region == region && game.awayTeam.region == region)
                && ((game.scores[game.homeTeamId] > game.scores[game.awayTeamId] && game.homeTeam.rank > game.awayTeam.rank)
                    || (game.scores[game.awayTeamId] > game.scores[game.homeTeamId] && game.awayTeam.rank > game.homeTeam.rank)));

        upsetsTable.clear().rows.add(upsetGames).draw();
    });
    $('#upsets-modal').on('hidden.bs.modal', () => {
        upsetsTable.clear().draw();
    });
});