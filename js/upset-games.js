// Setup upset games modal
$(() => {
    let upsetsTable = new DataTable('#upsets-table', {
        columns: [
            { data: 'date', name: 'Date', render: (data, type, game) => { return type === 'display' ? data.toLocaleDateString() : data; } },
            { data: 'homeTeam.name', title: 'Home Team', className: 'dt-right', render: (data, type, game) => { 
                if (type === 'display')
                {
                    let result = game.homeTeam.getNameWithRank(rankingPeriodDeadlineDt, region);
                    for (let i = 0; i < game.homeTeam.forfeits; i++) {
                        result += '<sup class="forfeit-penalty">↓</sup>';
                    }
                    result += `<div class="team-rp">${game.homeTeam.getRankingPoints(rankingPeriodDeadlineDt) ?? '&nbsp;'}</div>`;
                    return result;
                }
                return data;
            }},
            { data: 'homeTeam.logo', width: '1em', render: (data, type, game) => { return `<img class="ms-2 team-logo" src="${data}">`; } },
            { name: 'score', width: '7em', className: 'dt-center', title: 'Score', render: (data, type, game) => {return type === 'display' ? `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}` : Math.abs(game.scores[game.homeTeamId]-game.scores[game.awayTeamId]); } },
            { data: 'awayTeam.logo', width: '1em', render: (data, type, game) => { return `<img class="ms-2 team-logo" src="${data}">`; } },
            { data: 'awayTeam.name', title: 'Away Team', render: (data, type, game) => {
                if (type === 'display')
                {
                    let result = game.awayTeam.getNameWithRank(rankingPeriodDeadlineDt, region);
                    for (let i = 0; i < game.awayTeam.forfeits; i++) {
                        result += '<sup class="forfeit-penalty">↓</sup>';
                    }
                    result += `<div class="team-rp">${game.awayTeam.getRankingPoints(rankingPeriodDeadlineDt) ?? '&nbsp;'}</div>`;
                    return result;
                }
                return data;
            }},
            { title: 'Rank Δ', width: '1em', className: 'no-wrap', render: (data, type, game) => { return region == "GUR" ? Math.abs(game.homeTeam.rank - game.awayTeam.rank) : Math.abs(game.homeTeam.regionRank - game.awayTeam.regionRank); }},
            { title: 'RP Δ', width: '1em', className: 'no-wrap', render: (data, type, game) => { return Math.abs(game.homeTeam.rankingPoints-game.awayTeam.rankingPoints).toFixed(2); }}
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