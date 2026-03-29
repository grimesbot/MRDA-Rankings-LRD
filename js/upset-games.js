// Setup upset games modal
$(function() {
    let upsetsTable = new DataTable('#upsets-table', {
        columns: [
            { data: 'date', name: 'Date', render: function (data, type, game) { return type === 'display' ? data.toLocaleDateString() : data; } },
            { data: 'homeTeam.name', title: 'Home Team', className: 'dt-right', render: function(data, type, game) { 
                let result = data;
                if (type === 'display')
                {
                    for (let i = 0; i < game.homeTeam.forfeits; i++) {
                        result += '<sup class="forfeit-penalty">↓</sup>';
                    }
                }
                return result;
            }},
            { data: 'homeTeam.rank', title: 'Home #', width: '1em', className: 'no-wrap dt-right', render: function(data, type, game) { return region == 'GUR' ? data : game.homeTeam.regionRank; } },
            { name: 'score', width: '7em', className: 'dt-center', title: 'Score', render: function(data, type, game) {return type === 'display' ? `${game.scores[game.homeTeamId]} - ${game.scores[game.awayTeamId]}` : Math.abs(game.scores[game.homeTeamId]-game.scores[game.awayTeamId]); } },
            { data: 'awayTeam.rank', title: 'Away #', width: '1em', className: 'no-wrap dt-left', render: function(data, type, game) { return region == 'GUR' ? data : game.awayTeam.regionRank; } },
            { data: 'awayTeam.name', title: 'Away Team', render: function(data, type, game) {
                let result = data;
                if (type === 'display')
                {
                    for (let i = 0; i < game.awayTeam.forfeits; i++) {
                        result += '<sup class="forfeit-penalty">↓</sup>';
                    }
                }
                return result;
            }},
            { title: '# Diff', width: '1em', className: 'no-wrap', render: function(data, type, game) { return region == "GUR" ? Math.abs(game.homeTeam.rank - game.awayTeam.rank) : Math.abs(game.homeTeam.regionRank - game.awayTeam.regionRank); }},
            { title: 'RP Diff', width: '1em', className: 'no-wrap', render: function(data, type, game) { return Math.abs(game.homeTeam.rankingPoints-game.awayTeam.rankingPoints).toFixed(2); }}
        ],
        data: [],
        lengthChange: false,
        searching: false,
        drawCallback: function (settings) {
            $('#upsets-table .forfeit-penalty').tooltip({title: 'Two rank penalty applied for forfeit.'});
        }
    });

    $('#upsets-modal').on('show.bs.modal', function () {
        let upsetGames = mrdaRankings.mrdaGames
            .filter(game => rankingPeriodStartDt <= game.date && game.date < rankingPeriodDeadlineDt
                && game.homeTeamId in game.scores && game.awayTeamId in game.scores && !game.forfeit
                && game.homeTeam.rank && game.awayTeam.rank
                && (region == "GUR" || (game.homeTeam.region == region && game.awayTeam.region == region))
                && ((game.scores[game.homeTeamId] > game.scores[game.awayTeamId] && game.homeTeam.rank > game.awayTeam.rank)
                    || (game.scores[game.awayTeamId] > game.scores[game.homeTeamId] && game.awayTeam.rank > game.homeTeam.rank)));

        upsetsTable.clear().rows.add(upsetGames).draw();
    });
    $('#upsets-modal').on('hidden.bs.modal', function () {
        upsetsTable.clear().draw();
    });
});