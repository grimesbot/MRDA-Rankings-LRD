// Setup error sumamry modal
$(() => {
    let errorTable = new DataTable('#error-table', {
        columns: [
            { data: 'title', width: '20em'},
            { title: 'Start Date', data: 'minDt', render: DataTable.render.date()},
            { title: 'End Date', data: 'maxDt', render: DataTable.render.date()},
            { title: 'Game Count', data: 'gameCount'},
            { title: 'Average Error', data: 'averageError' },
        ],
        data: [],
        dom: 't',
        paging: false,
        searching: false,
        info: false,
        ordering: false
    });

    $('#error-modal').on('show.bs.modal', () => {
        if (!errorTable.data().any()) {

            let tableData = [];

            let quarterOpts = $('#date option').filter((i,e) => $(e).text().trim().startsWith('Q'));

            for (let i = 0; i < (quarterOpts.length - 1); i++) {
                let $quarterOpt = $(quarterOpts[i]);

                tableData.push({
                    title: $quarterOpt.text(),
                    minDt: new Date(`${$(quarterOpts[i+1]).val()} 00:00:00`),
                    maxDt: new Date(`${$quarterOpt.val()} 00:00:00`)
                });
            }

            tableData.push({
                title: '2024 Season (Without Seed Data)',
                minDt: new Date (2023, 10 - 1, 25),
                maxDt: new Date (2024, 10 - 1, 23)
            });

            tableData.push({
                title: '2025 Season',
                minDt: new Date (2024, 10 - 1, 23),
                maxDt: new Date (2025, 10 - 1, 22)
            });

            tableData.push({
                title: '2026 Season',
                minDt: new Date (2025, 10 - 1, 22),
                maxDt: new Date (2026, 10 - 1, 28)
            });

            tableData.push({
                title: '2025+ (All games with Seed Data)',
                minDt: new Date (2024, 10 - 1, 23),
                maxDt: null
            });

            tableData.push({
                title: 'All Games',
                minDt: null,
                maxDt: null
            });

            let predictedGames = mrdaRankings.mrdaGames.filter(game => game.getPerformanceDelta(game.homeTeam) != null);
            for (const data of tableData) {
                let games = predictedGames.filter(game => (data.minDt == null || data.minDt <= game.date) && (data.maxDt == null || game.date < data.maxDt));
                data.gameCount = games.length;
                if (games.length > 0) {
                    let errSum = 0;
                    for (const game of games) {
                        let error = Math.abs(game.getPerformanceDelta(game.homeTeam));
                        errSum += error;
                    }
                    data.averageError = (errSum / games.length).toFixed(2);
                } else {
                    data.averageError = null;
                }
            }

            errorTable.rows.add(tableData).draw();
        }
    });
});