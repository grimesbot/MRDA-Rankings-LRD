const mrdaRankings = new MrdaRankings(rankings_history, mrda_teams, mrda_events, mrda_games);

const urlParams = new URLSearchParams(window.location.search);

let rankingPeriodDeadlineDt = null;
let rankingPeriodStartDt = null;
let previousQuarterDt = null;
let region = 'GUR';

const setRankingDates = $dateSelect => {
    rankingPeriodDeadlineDt = new Date(`${$dateSelect.val()} 00:00`);
    rankingPeriodStartDt = getSeedDate(rankingPeriodDeadlineDt);

    let prevQtrDateStr = $dateSelect.find('option:selected').nextAll().filter((i,e) => $(e).text().trim().startsWith('Q')).first().val();
    previousQuarterDt = prevQtrDateStr ? new Date(`${prevQtrDateStr} 00:00`) : null;
}

const setupRankingDates = $dateSelect => {
    let allRankingDts = [...mrdaRankings.mrdaRankingsHistory.keys()].sort((a, b) => a - b);

    let searchDt = mrdaRankings.getNextRankingPeriodDate(allRankingDts[0]);
    let newestRankingDt = allRankingDts.at(-1);

    let dateOptions = [];

    while (searchDt <= newestRankingDt) {
        dateOptions.push({
            date: new Date(searchDt),
            value: `${searchDt.getFullYear()}-${searchDt.getMonth() + 1}-${searchDt.getDate()}`,
            text: `Q${(searchDt.getMonth() + 1) / 3} ${searchDt.getFullYear()}`,
            selected: false
        });
        searchDt.setMonth(searchDt.getMonth() + 3); // Add 3 months (a quarter)
        searchDt.setDate(1); // Set to first of month
        searchDt.setDate(1 + ((3 - searchDt.getDay() + 7) % 7)); // Set to Wednesday = 3
    }

    // Add option for ad hoc postseason dates. Can be removed after 2026 season.
    if (new Date().getFullYear() == ADHOC_POSTSEASON_START.getFullYear() && ADHOC_POSTSEASON_START <= newestRankingDt) {
        let wednesdayBeforeAdhoc = new Date(ADHOC_POSTSEASON_CUTOFF);
        wednesdayBeforeAdhoc.setHours(0, 0, 0, 0);
        wednesdayBeforeAdhoc.setDate(wednesdayBeforeAdhoc.getDate() + ((3 - wednesdayBeforeAdhoc.getDay() + 7) % 7));
        dateOptions.push({
                date: wednesdayBeforeAdhoc,
                value: `${wednesdayBeforeAdhoc.getFullYear()}-${wednesdayBeforeAdhoc.getMonth() + 1}-${wednesdayBeforeAdhoc.getDate()}`,
                text: ADHOC_POSTSEASON_CUTOFF.toLocaleDateString(undefined, {year:'2-digit',month:'numeric',day:'numeric'}),
                selected: false
            });
    }

    let queryDt = null;
    if (urlParams.has('date')) {
        queryDt = new Date(urlParams.get('date'));
        if (isNaN(queryDt))
            queryDt = null;
        else if (allRankingDts[0] <= queryDt && queryDt <= newestRankingDt) {
            queryDt.setHours(0, 0, 0, 0);
            queryDt.setDate(queryDt.getDate() + ((3 - queryDt.getDay() + 7) % 7)); // Set most recent Wednesday = 3
        }
    }

    let current = new Date();
    if (current < newestRankingDt) {
        current.setHours(0, 0, 0, 0);
        current.setDate(current.getDate() + ((3 - current.getDay() - 7) % 7)); // Set most recent Wednesday = 3
        if (mrdaRankings.mrdaGames.some(game => game.date >= current && game.homeTeamId in game.scores && game.awayTeamId in game.scores))
            current.setDate(current.getDate() + 7); // Set to next Wednesday if there are newer scores
        let currentDateOptions = dateOptions.filter(o => o.date.getTime() == current.getTime());
        if (currentDateOptions.length == 0) {
                dateOptions.push({
                date: current,
                value: `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()}`,
                text: `Today`,
                selected: !queryDt || queryDt.getTime() == current.getTime()
            });
        } else if (!queryDt || queryDt.getTime() == current.getTime()) {
            currentDateOptions[0].selected = true;
        }
    }

    if (queryDt && queryDt.getTime() != current.getTime()) {
        let queryDtDateOptions = dateOptions.filter(o => o.date.getTime() == queryDt.getTime());
        if (queryDtDateOptions.length == 0) {
                dateOptions.push({
                date: queryDt,
                value: `${queryDt.getFullYear()}-${queryDt.getMonth() + 1}-${queryDt.getDate()}`,
                text: queryDt.toLocaleDateString(undefined, {year:'2-digit',month:'numeric',day:'numeric'}),
                selected: true
            });
        } else {
            queryDtDateOptions[0].selected = true;
        }
    }
    
    dateOptions.sort((a,b) => b.date - a.date).forEach(o => {
        $dateSelect.append(new Option(o.text, o.value, o.selected, o.selected));
    });

    setRankingDates($dateSelect);
    $dateSelect.on('change', () => { setRankingDates($dateSelect) } );
}

const setupRegion = $regionSelect => {
    if (urlParams.has('region') && $regionSelect.find(`option[value="${urlParams.get('region')}"]`).length > 0)
        region = urlParams.get('region');
    else { 
        let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone)
        {
            if (timezone.startsWith('America/'))
                region = 'AM';
            else if (timezone.startsWith('Europe/'))
                region = 'EUR';
        }
    }
    if ($regionSelect.val() != region)
        $regionSelect.val(region);
    $regionSelect.on('change', () => { region = $regionSelect.val(); } );
}

const setupRankingChart = teams => {
    let datasets = [];

    teams.slice(0, 5).forEach(team => {
        team.chart = true;
        datasets.push({
            teamId: team.teamId,
            region: team.region,
            label: team.name,
            data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
            showLine: true
        });
    });

    let rankingChart = new Chart(document.getElementById('rankings-chart'), {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month'
                    },
                    min: rankingPeriodStartDt,
                    max: rankingPeriodDeadlineDt
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
                axis: 'x'
            },
            plugins: {
                tooltip: {
                    itemSort: (a, b) => {
                        return b.raw.y - a.raw.y;
                    },
                    callbacks: {
                        title: context => {
                            return context[0].raw.x.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
                        },
                        label: context => {
                            return `${context.dataset.label}: ${context.raw.y.toFixed(2)}`;
                        }
                    }
                },
                colors: {
                    forceOverride: true
                }
            },
            responsive: true,
            maintainAspectRatio: false
        },
    });

    $('#rankings-table').on('change', 'input.chart', e => {
        let tr = e.target.closest('tr');
        let dt = $('#rankings-table').DataTable();
        let row = dt.row(tr);
        let team = row.data();
        team.chart = e.target.checked;
        if (team.chart) {
            rankingChart.data.datasets.push({
                teamId: team.teamId,
                label: team.name,
                data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
                showLine: true
            });
        } else 
            rankingChart.data.datasets = rankingChart.data.datasets.filter(dataset => dataset.teamId != team.teamId);
        rankingChart.update();
    });
    
    $('#rankings-table').on('click', 'th i.bi-graph-up', e => {
        let dt = $('#rankings-table').DataTable();
        let teams = dt.rows().data().toArray().sort((a, b) => a.rankSort - b.rankSort);
        let charted = teams.filter(team => team.chart);
        let topFive = teams.slice(0, 5);

        teams.forEach(team => team.chart = false);

        if (charted.length !== topFive.length || !charted.every(team => topFive.includes(team))) {            
            rankingChart.data.datasets = rankingChart.data.datasets.filter(ds => topFive.some(team => ds.teamId == team.teamId));
            
            topFive.forEach(team => {
                team.chart = true;
                if (!rankingChart.data.datasets.some(ds => ds.teamId == team.teamId))
                    rankingChart.data.datasets.push({
                        teamId: team.teamId,
                        label: team.name,
                        data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
                        showLine: true
                    });
            });
        } else
            rankingChart.data.datasets = [];
        
        rankingChart.update();
        dt.rows().invalidate('data').draw();
    });
}

const setupRankingsTable = teams => {

    let annotations = document.createElement('div');
    annotations.className = 'annotations';
    annotations.innerHTML = '*Not enough games to be Postseason Eligible.';
    annotations.innerHTML += '<br><sup>↓</sup>Two rank penalty applied for each forfeit.';    

    let exportOptions = { 
        columns: [0,3,4,5,6], 
        format: { 
            header: (data, columnIdx) => { return ['Rank','Team','Ranking Points','Relative Standard Error','Game Count'][columnIdx]; } 
        },
        orthogonal: 'export'
    };

    new DataTable('#rankings-table', {
        columns: [
            { name: 'rank', data: 'rank', width: '1em', className: 'dt-center pe-1', 
                render: (data, type, team) => { 
                    if (type === 'export' && data == null)
                        return 'NR';
                    if (type === 'sort')
                        return team.rankSort;
                    else if (region != 'GUR')
                        return team.regionRank;
                    else
                        return data;
                }
            },
            { name: 'delta', width: '1em', className: 'no-wrap delta dt-center px-1',
                render: (data, type, team) => {
                    let delta = region == 'GUR' ? team.delta : team.regionDelta;
                    if (type === 'display') {
                        if (!team.rank)
                            return '';
                        else if (delta > 0) 
                            return `<i class="bi bi-triangle-fill text-success"></i> <span class="text-success">${delta}</span>`;
                        else if (delta < 0)
                            return `<i class="bi bi-triangle-fill down text-danger"></i> <span class="down text-danger">${-delta}</span>`;
                        else if (delta == null)
                            return '<i class="bi bi-star-fill text-body-secondary"></i>'
                        else
                            return '<i class="bi bi-circle-fill text-body-tertiary"></i>';
                    } else
                        return delta;
                }
             },
            { data: 'getLogoDisplay', width: '1em', orderable: false, className: 'team-logo px-1' },
            { data: 'name', orderable: false, className: 'px-1 text-overflow-ellipsis', 
                render: (data, type, team) => {
                    let result = type == 'display' ? team.getNameDisplay(true) : data;
                    if (['display','export'].includes(type) && team.activeStatus) {
                        for (let i = 0; i < team.forfeits; i++) {
                            if (type === 'display')
                                result += '<sup class="forfeit-penalty">↓</sup>';
                            else if (type === 'export')
                                result += ' ↓';
                        }
                    }
                    if (type === 'display' && team.location)
                        result += `<div class="team-location">${team.location}</div>`;
                    return result;
                }
            },
            { data: 'rankingPoints', width: '1em', className: 'px-1' },
            { data: 'standardError', width: '1em', className: 'px-1 dt-left', render: (data, type, team) => { return type === 'display' && data != null ? `±${data}` : data; }},
            { data: 'activeStatusGameCount', width: '1em', className: 'px-1', render: (data, type, team) => { return type === 'display' && !team.postseasonEligible ? `${data}<span class="postseason-ineligible">*</span>` : data; } },
            { data: 'wins', width: '1em', orderable: false, className: 'px-1 dt-center'},
            { data: 'losses', width: '1.6em', orderable: false, className: 'px-1 dt-left'},
            { data: 'chart', width: '1em', className: 'ps-1 dt-center no-pointer', orderable: false, render: (data, type, team) => { return `<input type="checkbox" class="chart"${data ? ' checked' : ''}></input>`; }}
        ],
        data: teams,
        layout: {
            topStart: null,
            topEnd: null,
            bottomStart: annotations,
            bottomEnd: { 
                buttons: [
                    {
                        extend: 'copy',
                        text: '<i class="bi bi-copy"></i>',
                        exportOptions: exportOptions,
                        messageBottom: '*Not enough games to be Postseason Eligible.\n↓ Two rank penalty applied for each forfeit.',
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
        paging: false,
        searching: false,
        info: false,
        order: {
            name: 'rank',
            dir: 'asc'
        },
        fixedHeader: {
            header: true,
            headerOffset: $('nav.sticky-top').outerHeight()
        },
        createdRow: (row, data, dataIndex) => {
            if (data.postseasonPosition != null) {
                $(row).addClass('postseason-position ' + data.postseasonPosition);
            }
        },
        drawCallback: settings => {
            $('#rankings-table .forfeit-penalty').tooltip({title: 'Two rank penalty applied for each forfeit.'});
            $('#rankings-table .postseason-ineligible').tooltip({title: 'Not enough games to be Postseason Eligible.'});
        }
    });

    $('#rankings-table').on('click', 'td:not(.no-pointer)', e => {
        if (e.target.nodeName !== 'A') 
            e.target.closest('tr').querySelector('a[data-bs-toggle="modal"]').click();
    });
}

const handleRankingPeriodChange = () => {
    // Move the chart to new dates
    let rankingChart = Chart.getChart('rankings-chart');
    rankingChart.options.scales.x.min = rankingPeriodStartDt;
    rankingChart.options.scales.x.max = rankingPeriodDeadlineDt;
    rankingChart.update();

    // Re-rank teams for new dates and update table
    mrdaRankings.rankTeams(rankingPeriodDeadlineDt, rankingPeriodStartDt, previousQuarterDt);
    $('#rankings-table').DataTable().clear().rows.add(mrdaRankings.getOrderedTeams(region)).draw();
}

const handleRegionChange = () => {
    // Get ordered teams for region
    let teams = mrdaRankings.getOrderedTeams(region);
    
    // Clear the chart and re-add top 5 teams, set all other team.chart = false
    let rankingChart = Chart.getChart('rankings-chart');
    rankingChart.data.datasets = [];
    teams.forEach((team, index) => {
        team.chart = index < 5;
        if (team.chart) {
            rankingChart.data.datasets.push({
                teamId: team.teamId,
                label: team.name,
                data: Array.from(team.rankingHistory, ([date, ranking]) => ({ x: date, y: ranking.rankingPoints})),
                showLine: true
            });
        }
    });    
    rankingChart.update();

    // Update table with region's teams
    $('#rankings-table').DataTable().clear().rows.add(teams).draw();
}

$(() => {
    //document.documentElement.setAttribute('data-bs-theme', (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    let $dateSelect = $('#date');
    setupRankingDates($dateSelect);

    let $regionSelect = $('#region');
    setupRegion($regionSelect);

    // Rank teams
    mrdaRankings.rankTeams(rankingPeriodDeadlineDt, rankingPeriodStartDt, previousQuarterDt);
    let teams = mrdaRankings.getOrderedTeams(region);

    // Setup Rankings
    setupRankingChart(teams);
    setupRankingsTable(teams);

    $dateSelect.on('change', handleRankingPeriodChange);
    $regionSelect.on('change', handleRegionChange);
        
    $('#rankings-generated-dt').text(new Date(mrda_config.rankings_generated_utc).toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'long'}));

    $(() => { // Setup tooltips after all other elements are rendered.
        $('[data-toggle="tooltip"]').tooltip();
    });
});