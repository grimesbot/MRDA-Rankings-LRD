const REGIONS = ['EUR', 'AA', 'AM'];

const ADHOC_POSTSEASON_CUTOFF = new Date(2026,7-1,31); // Special "Regular Season" end date for 2026 postseason by vote
const ADHOC_POSTSEASON_START = new Date(2026,6-1,3); // Q2-2026 ranking deadline we're extending

const VIRTUAL_TEAM_ID = '0000a';

function getSeedDate(date, addWeek = false) {
    if (new Date().getFullYear() == ADHOC_POSTSEASON_CUTOFF.getFullYear() && ADHOC_POSTSEASON_START < date && date < ADHOC_POSTSEASON_CUTOFF)
        return getSeedDate(ADHOC_POSTSEASON_START)

    let seedDate = new Date(date);
    if (addWeek)
        seedDate.setDate(seedDate.getDate() + 7);
    seedDate.setDate(date.getDate() - 7 * 52);
    // If seedDate is a greater # weekday of month than date, set seedDate back an additional week
    // e.g. if date is 1st Wednesday of June, seedDate should be 1st Wednesday of June last year.
    // date = Jun 7, 2028, 52 weeks prior would seedDate = Jun 9, 2027 which is 2nd Wednesday of June.
    // set seedDate back an additional week seedDate = Jun 2, 2027 so games on weekend of Jun 4-6, 2027 count
    if (Math.floor((seedDate.getDate() - 1) / 7) > Math.floor((date.getDate() - 1) / 7))
        seedDate.setDate(seedDate.getDate() - 7);
    return seedDate;
}

class MrdaGame {
    constructor(game, mrdaTeams, mrdaEvents, virtualGame = false) {
        this.date = game.date instanceof Date ? game.date : new Date(game.date);
        this.homeTeamId = game.home_team;
        this.scores = {};
        if('home_score' in game)
            this.scores[this.homeTeamId] = game.home_score;

        if (virtualGame) {
            this.awayTeamId = VIRTUAL_TEAM_ID;
            this.scores[VIRTUAL_TEAM_ID] =  mrda_config.virtual_team_rp;
            this.eventId = null;
            this.event = new MrdaEvent(null, {start_dt: this.date, name: 'Virtual Games'});
            this.weight = .25;
            this.awayTeam = new MrdaTeam(VIRTUAL_TEAM_ID, { name: 'Virtual Team'});
            this.awayTeam.rankingPoints = mrda_config.virtual_team_rp;            
        } else {
            this.awayTeamId = game.away_team;
            if('away_score' in game)
                this.scores[this.awayTeamId] = game.away_score;
            this.eventId = game.event_id;
            this.event = mrdaEvents[this.eventId];
            this.weight = game.weight;
            this.awayTeam = mrdaTeams[this.awayTeamId];
        }

        this.forfeit = game.forfeit;
        this.forfeitTeamId = game.forfeit_team_id;
        this.status = game.status;
        this.actualDifferentials = {};
        this.predictorRankingPoints = {};
        this.predictedDifferentials = {};
        this.performanceDeltas = {};

        this.homeTeam = mrdaTeams[this.homeTeamId];

        // Add scored games (not upcoming games) to teams' Game History
        if (this.homeTeamId in this.scores && this.awayTeamId in this.scores && !virtualGame) {
            this.homeTeam.gameHistory.push(this);
            this.awayTeam.gameHistory.push(this);
        }
    }

    getOpponentTeamId(teamId) {
        return teamId == this.homeTeamId ? this.awayTeamId : this.homeTeamId;
    }    

    getOpponentTeam(teamId) {
        return teamId == this.homeTeamId ? this.awayTeam : this.homeTeam;
    }

    getWL(teamId) {
        return this.scores[teamId] > this.scores[this.getOpponentTeamId(teamId)] ? 'W' : 'L';
    }

    getAtVs(teamId) {
        return this.homeTeamId == teamId ? 'vs' : '@'
    }

    getActualDifferential(team) {
        if (team.teamId in this.actualDifferentials)
            return this.actualDifferentials[team.teamId];

        if (!(this.homeTeamId in this.scores) || !(this.awayTeamId in this.scores) || this.forfeit)
            this.actualDifferentials[team.teamId] = null;
        else
            this.actualDifferentials[team.teamId] = this.scores[team.teamId] - this.scores[this.getOpponentTeamId(team.teamId)];
        return this.actualDifferentials[team.teamId];
    }

    getActualDifferentialDisplay(team) {
        let actualDifferential = this.getActualDifferential(team);
        if (actualDifferential == null)
            return null;
        return `${actualDifferential > 0 ? '+' : ''}${actualDifferential.toFixed(this.awayTeamId == VIRTUAL_TEAM_ID ? 2 : 0)}`;
    }

    getActualDifferentialDisplayWithTooltip(team) {
        let actualDifferential = this.getActualDifferential(team);
        if (actualDifferential == null)
            return null;
        let result = `${actualDifferential > 0 ? '+' : ''}${actualDifferential}`;
        if (Math.abs(actualDifferential) > mrda_config.differential_cap) {
            let weight = (this.weight * 100).toFixed(0);
            let tooltip = `Games with score differentials beyond ${mrda_config.differential_cap} have diminishing weights in the linear regression algorithm`;
            return `<span data-toggle="tooltip" data-bs-html="true" title="Weight: ${weight}%<br>${tooltip}">${result}*</span>`;
        }
        return result;
    }

    getPredictorRankingPoints(team) {
        if (team.teamId in this.predictorRankingPoints)
            return this.predictorRankingPoints[team.teamId];

        this.predictorRankingPoints[team.teamId] = team.getPredictorRankingPoints(this.date);
        return this.predictorRankingPoints[team.teamId];
    }

    getPredictedDifferential(team) {
        if (team.teamId in this.predictedDifferentials)
            return this.predictedDifferentials[team.teamId];

        let opponent = this.getOpponentTeam(team.teamId);
        let teamRp = this.getPredictorRankingPoints(team);
        let opponentRp = this.getPredictorRankingPoints(opponent);
        if (teamRp == null || opponentRp == null)
            this.predictedDifferentials[team.teamId] = null;
        else 
            this.predictedDifferentials[team.teamId] = teamRp - opponentRp;

        return this.predictedDifferentials[team.teamId];
    }

    getPredictedDifferentialDisplay(team) {
        if (team === undefined)
            team = this.homeTeam;
        let predictedDifferential = this.getPredictedDifferential(team);
        if (predictedDifferential == null)
            return null;
        return `${predictedDifferential > 0 ? '+' : ''}${predictedDifferential.toFixed(2)}`;
    }

    getPredictedDifferentialWithTooltip(team) {
        let result = this.getPredictedDifferentialDisplay(team);
        if (result == null)
            return null;

        let ranking = team.getRanking(this.date);
        let opponent = this.getOpponentTeam(team.teamId);
        let teamRp = this.getPredictorRankingPoints(team);
        let opponentRp = this.getPredictorRankingPoints(opponent);

        let tooltip = `Predicted differential based on Ranking Points as of ${ranking.date.toLocaleDateString(undefined, {year:'2-digit',month:'numeric',day:'numeric'})}:<br>`;
        tooltip += `This Team: ${teamRp.toFixed(2)}<br>`;
        tooltip += `Opponent: ${opponentRp.toFixed(2)}<br>`;

        return `<span data-toggle="tooltip" data-bs-html="true" title="${tooltip}">${result}</span>`;
    }

    getPerformanceDelta(team) {
        if (team.teamId in this.performanceDeltas)
            return this.performanceDeltas[team.teamId];

        let predictedDifferential = this.getPredictedDifferential(team);
        let actualDifferential = this.getActualDifferential(team);

        if (predictedDifferential == null || actualDifferential == null)
            this.performanceDeltas[team.teamId] = null;
        else
            this.performanceDeltas[team.teamId] = actualDifferential - predictedDifferential;

        return this.performanceDeltas[team.teamId];
    }

    getPerformanceDeltaDisplay(team, round = 2)
    {
        let performanceDelta = this.getPerformanceDelta(team);
        if (performanceDelta == null)
            return null;
        let result = performanceDelta.toFixed(round);
        return `${result > 0 ? '+' : ''}${result}`;
    }

    getPerformanceDeltaWithIcon(team, round = 2)
    {
        let performanceDelta = this.getPerformanceDelta(team);
        if (performanceDelta == null)
            return null;
        let result = performanceDelta.toFixed(round);
        if (result > 0) {
            let icon = '<i class="bi bi-triangle-fill text-success"></i>';
            return `${icon} <span class="performance-delta text-success">+${result}</span>`;
        } else if (performanceDelta < 0) {
            let icon = '<i class="bi bi-triangle-fill down text-danger"></i>';
            return `${icon} <span class="performance-delta text-danger">${result}</span>`;
        }
        return `<span class="performance-delta">${result}</span>`;
    }

    getPerformanceDeltaChart(team)
    {
        let performanceDelta = this.getPerformanceDelta(team);
        if (performanceDelta == null)
        {
            let actualDifferential = this.getActualDifferential(team);
            if (actualDifferential == null)
                return null;

            let opponentRp = this.getPredictorRankingPoints(this.getOpponentTeam(team.teamId));
            if (opponentRp == null)
                return null;

            // Calculate for new team as seeding game for visualization
            return opponentRp + actualDifferential;
        }
        return this.getPredictorRankingPoints(team) + performanceDelta;
    }

    getTeamsScore(teamId) {
        return `${this.scores[teamId]}-${this.scores[this.getOpponentTeamId(teamId)]}`;
    }

    getGameSummary(teamId) {
        return `${this.getTeamsScore(teamId)} ${this.getWL(teamId)} ${this.getAtVs(teamId)} ${this.getOpponentTeam(teamId).name}`;
    }

    getGameDay() {
        if (this.event.startDt != this.event.endDt)
            return this.date.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    }

    getGameAndEventTitle() {
        if (this.event.name){
            return `${this.date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}: ${this.event.getShortName()}`;
        } else
            return this.date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric',weekday:'long'});
    }
}

class MrdaEvent {
    constructor(eventId, event) {
        this.eventId = eventId;
        this.startDt = event.start_dt instanceof Date ? event.start_dt : new Date(event.start_dt);
        this.endDt = event.end_dt ? new Date(event.end_dt) : this.startDt;
        this.name = event.name;
    }

    getDateString() {
        // Single day events
        if (this.startDt == this.endDt){
            // If the single day event has a title, return the date but don't include the weekday for brevity
            if (this.name)
                return this.startDt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
            else
                return this.startDt.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
        } else {
        // Multi-day events use short month for brevity
            let dtFmtOpts = {year:'numeric',month:'short',day:'numeric'};
            let dateStr = this.startDt.toLocaleDateString(undefined,dtFmtOpts);            
            if (this.startDt.getFullYear() != this.endDt.getFullYear())
                return `${dateStr} - ${this.endDt.toLocaleDateString(undefined,dtFmtOpts)}`;
            else if (this.startDt.getMonth() != this.endDt.getMonth()) {
                dtFmtOpts = {month:'short',day:'numeric'};
                let monthAndDay = this.startDt.toLocaleDateString(undefined,dtFmtOpts);
                return dateStr.replace(monthAndDay, `${monthAndDay} - ${this.endDt.toLocaleDateString(undefined,dtFmtOpts)}`);
            } else {
                dtFmtOpts = {day:'numeric'};
                let day = this.startDt.toLocaleDateString(undefined,dtFmtOpts);
                return dateStr.replace(new RegExp(`\\b${day}\\b`, 'g'), `${day}-${this.endDt.toLocaleDateString(undefined,dtFmtOpts)}`);
            }
        }
    }

    getEventTitle() {
        // Single day events
        if (this.startDt == this.endDt) {
            if (this.name)
                return `${this.getDateString()}: ${this.name}`;
            else
                return this.getDateString();
        } else {
        // Multi-day events
            if (this.name)
                return this.name;
            else 
                return this.getDateString();
        }
    }

    getShortName() {
        return this.name ? this.name.replace('Mens Roller Derby Association', 'MRDA')
                                .replace('Men\'s Roller Derby Association', 'MRDA')
                                .replace(this.startDt.getFullYear(),'').trim() : null;
    }

    getEventTitleWithDate() {
        if (this.name){
            let niceName = this.getShortName();
            return `${this.getDateString()}: ${niceName}`;
        } else
            return this.getDateString();
    }
}

class MrdaTeamRanking {
    constructor(date, teamId, teamRanking={}) {
        this.date = date;
        this.teamId = teamId;
        this.rankingPoints = teamRanking.rp ?? null;
        this.standardError = teamRanking.se ?? null;
        this.predictorRankingPoints = teamRanking.prp ?? null;
        this.predictorStandardError = teamRanking.pse ?? null;        
        this.gameCount = teamRanking.gc ?? 0;
        this.activeStatus = teamRanking.as == 1;
        this.postseasonEligible = teamRanking.pe == 1;
        this.rank = teamRanking.r ?? null;
        this.regionRank = teamRanking.rr ?? null;
        this.wins = teamRanking.w ?? 0;
        this.losses = teamRanking.l ?? 0;
        this.forfeits = teamRanking.f ?? 0;
    }
}

class MrdaTeam {
    constructor(teamId, team, mrdaRankingsHistory) {
        this.teamId = teamId;
        this.name = team.name;
        this.region = team.region;
        this.location = team.location;
        this.logo = team.logo ?? 'img/blank.png';
        if (this.logo.startsWith('/central/'))
            this.logo = 'https://assets.mrda.org' + team.logo;
        this.games = []
        this.gameHistory = []
        this.activeStatus = false;
        this.postseasonEligible = false;
        this.activeStatusGameCount = 0;
        this.wins = 0;
        this.losses = 0;
        this.forfeits = 0;
        this.rankingPoints = 0;
        this.standardError = 0;
        this.rank = null;
        this.regionRank = null;        
        this.rankSort = null;
        this.delta = null;
        this.regionDelta = null;        
        this.postseasonPosition = null;
        this.chart = false;

        this.rankingHistory = new Map();

        if (mrdaRankingsHistory) {
            let lastRankings = {};
            for (const [date, rankings] of mrdaRankingsHistory) {
                if (this.teamId in rankings) {
                    this.rankingHistory.set(date,rankings[this.teamId])                  
                } else if (teamId in lastRankings) {
                    // Add empty teamRanking if they're not in current ranking but were in the last ranking.
                    this.rankingHistory.set(date,new MrdaTeamRanking(date, this.teamId))
                }
                lastRankings = rankings;
            }
        }
    }

    getRanking(date, addWeek = false, seedDate = null) {
        if (!(date instanceof Date) || addWeek)
            date = new Date(date);

        if (addWeek)
            date.setDate(date.getDate() + 7);

        seedDate = seedDate ?? getSeedDate(date);

        let latestRankingDt = [...this.rankingHistory.keys()].filter(dt => seedDate < dt && dt <= date)
            .sort((a, b) => b - a)[0];

        if (latestRankingDt)
            return this.rankingHistory.get(latestRankingDt);
        else
            return null;
    }

    getNameWithRank(date, region) {
        let result = `<span class="team-name">${this.name}</span>`;
        let teamRanking = this.getRanking(date);
        if (teamRanking != null && teamRanking.rank) {
            let rankType;
            let rank;
            if (region == 'GUR') {
                rankType = 'Global';
                rank = teamRanking.rank;
            } else {
                rankType = 'Regional';
                rank = teamRanking.regionRank;
            }
            result = `<span class="team-rank" data-toggle="tooltip" title="${rankType} rank as of ${teamRanking.date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}">${rank}</span> ${result}`;
        }
        return result;
    }

    getRankingPoints(date, addWeek=false) {
        let ranking = this.getRanking(date, addWeek);
        if (ranking)
            return ranking.rankingPoints;
        else
            return null;
    }

    getPredictorRankingPoints(date) {
        let seedDate = getSeedDate(date, true);
        let ranking = this.getRanking(date, false, seedDate);
        if (ranking) {
            if (ranking.predictorRankingPoints)
                return ranking.predictorRankingPoints;

            // Check the next ranking for Ranking Points to see if they've fallen off & return no value for predictor.
            let nextRanking = this.getRanking(date, true, seedDate);
            if (nextRanking && nextRanking.date > date && !nextRanking.rankingPoints)
                    return null;

            // If we don't have predictor ranking points, no new games this week so they're the same.
            return ranking.rankingPoints;
        }
        return null;
    }

    getPredictorPointsWithError(date) {
        let seedDate = getSeedDate(date, true);
        let ranking = this.getRanking(date, false, seedDate);
        if (ranking) {
            if (ranking.predictorRankingPoints)
                return `${ranking.predictorRankingPoints} ±${ranking.predictorStandardError}`;

            // Check the next ranking for Ranking Points to see if they've fallen off & return no value for predictor.
            let nextRanking = this.getRanking(date, true, seedDate);
            if (nextRanking && nextRanking.date > date && !nextRanking.rankingPoints)
                    return null;
            
            // If we don't have predictor ranking points, no new games this week so they're the same.
            return `${ranking.rankingPoints} ±${ranking.predictorStandardError}`;
        }
        return null;
    }
}

class MrdaLinearRegressionSystem {
    constructor(mrda_rankings_history_json, mrda_teams_json, mrda_events_json, mrda_games_json) {
        this.mrdaRankingsHistory = new Map();
        this.mrdaTeams = {};
        this.mrdaEvents = {};
        this.mrdaGames = [];

        // Build mrdaRankingsHistoryDts map 
        for (const dt of Object.keys(mrda_rankings_history_json).map(day => new Date(day + ' 00:00:00')).sort((a, b) => a - b)) {
            let jsonRanking = mrda_rankings_history_json[`${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`];
            let teamRankings = {};
            for (const teamId of Object.keys(jsonRanking))
                teamRankings[teamId] = new MrdaTeamRanking(dt, teamId, jsonRanking[teamId]);
            this.mrdaRankingsHistory.set(dt, teamRankings);
        };
        
        // Map all teams, events and games from raw JSON generated by python
        Object.keys(mrda_teams_json).forEach(teamId => this.mrdaTeams[teamId] = new MrdaTeam(teamId, mrda_teams_json[teamId], this.mrdaRankingsHistory));
        Object.keys(mrda_events_json).forEach(eventId => this.mrdaEvents[eventId] = new MrdaEvent(eventId, mrda_events_json[eventId]));
        this.mrdaGames = mrda_games_json.map(game => new MrdaGame(game, this.mrdaTeams, this.mrdaEvents));
    }

    // Gets next Ranking Period Deadline Date, which is the first Wednesday of March, June, September or December.
    getNextRankingPeriodDate(date) {
        let searchDt = new Date(date);
        searchDt.setHours(0, 0, 0, 0);

        if ((searchDt.getMonth() + 1) % 3 == 0 && searchDt.getDate() <= 7 && searchDt.getDay() <= 3) {
            if (searchDt.getDay() == 3)
                return searchDt;
            else {
                searchDt.setDate(searchDt.getDate() + ((3 - searchDt.getDay() + 7) % 7));
                return searchDt;
            }
        } else {
            searchDt.setMonth(searchDt.getMonth() + (3 - ((searchDt.getMonth() + 1) % 3)));
            searchDt.setDate(1); // Set to first of month
            searchDt.setDate(1 + ((3 - searchDt.getDay() + 7) % 7)); // Set to Wednesday = 3
            return searchDt;
        }
    }

    getRankingHistory(date, seedDt = null) {
        if (!date)
            return null;
        seedDt = seedDt ?? getSeedDate(date);
        let latestRankingDts = [...this.mrdaRankingsHistory.keys()].filter(dt => seedDt < dt && dt <= date).sort((a,b) => b - a);
        if (latestRankingDts.length > 0)
            return this.mrdaRankingsHistory.get(latestRankingDts[0]);
        return null;
    }

    rankTeams(date, seedDt, lastQtrDt) {
        let maxRank = 0;
        // Get most recent Ranking History and apply to all teams
        let ranking = this.getRankingHistory(date, seedDt);
        let lastQtrRanking = this.getRankingHistory(lastQtrDt);
        for (const [teamId, team] of Object.entries(this.mrdaTeams)) {
            if (teamId in ranking) {
                let teamRanking = ranking[team.teamId];
                team.rankingPoints = teamRanking.rankingPoints ? teamRanking.rankingPoints.toFixed(2) : null;
                team.standardError = teamRanking.standardError ? teamRanking.standardError.toFixed(2) : null;
                team.activeStatusGameCount = teamRanking.gameCount;                
                team.activeStatus = teamRanking.activeStatus;
                team.postseasonEligible = teamRanking.postseasonEligible;
                team.rank = teamRanking.rank;
                team.regionRank = teamRanking.regionRank;
                team.delta = teamRanking.rank && lastQtrRanking && teamId in lastQtrRanking && lastQtrRanking[teamId].rank ? lastQtrRanking[teamId].rank - teamRanking.rank : null;
                team.regionDelta = teamRanking.regionRank && lastQtrRanking && teamId in lastQtrRanking && lastQtrRanking[teamId].regionRank ? lastQtrRanking[teamId].regionRank - teamRanking.regionRank : null;
                team.wins = teamRanking.wins;
                team.losses = teamRanking.losses;
                team.forfeits = teamRanking.forfeits;
            } else {
                team.rankingPoints = null;
                team.standardError = null;
                team.activeStatusGameCount = 0;                
                team.activeStatus = false;
                team.postseasonEligible = false;
                team.rank = null;
                team.regionRank = null;
                team.delta = null;
                team.regionDelta = null;
                team.wins = 0;
                team.losses = 0;
                team.forfeits = 0;
            }
            team.rankSort = team.rank;
            if (team.rankSort > maxRank)
                maxRank = team.rank;
            team.postseasonPosition = null;
        }

        // Set rankSort for unranked teams.
        Object.values(this.mrdaTeams).filter(team => !team.rankSort)
            .sort((a, b) => b.rankingPoints - a.rankingPoints )
            .forEach(team => {
                maxRank += 1;
                team.rankSort = maxRank;
            });

        if (date.getFullYear() == ADHOC_POSTSEASON_CUTOFF.getFullYear()) {            
            REGIONS.forEach(r => {
                Object.values(this.mrdaTeams).filter(team => team.postseasonEligible && r == team.region)
                                                .sort((a, b) => a.rank - b.rank)
                                                .slice(0,12)
                                                .forEach(team => {
                                                    team.postseasonPosition = r;
                                                });
            });

            $('#postseason-legend .postseason-position.postseason-adhoc').removeClass('d-none');
            $('#postseason-legend .postseason-position:not(.postseason-adhoc)').addClass('d-none');

            return;
        }

        $('#postseason-legend .postseason-position.postseason-adhoc').addClass('d-none');
        $('#postseason-legend .postseason-position:not(.postseason-adhoc)').removeClass('d-none');
        
        // Assign potential postseason invite positions
        // Champs go to top 7 globally
        let sortedPostseasonTeams = Object.values(this.mrdaTeams).filter(team => team.postseasonEligible)
                                                .sort((a, b) => a.rank - b.rank );
        for (let i = 0; i < 7; i++) {
            let team = sortedPostseasonTeams[i];
            team.postseasonPosition = 'GUR';
        }

        // Regional Qualifiers
        REGIONS.forEach(r => {
            let qualInfo = $(`#postseason-legend .postseason-position.${r} .qualifiers`);
            let inviteInfo = $(`#postseason-legend .postseason-position.${r} .invites`);

            // Austrasia gets 1 spot, other regions get 2
            let spots = r == 'AA' ? 1 : 2;

            let regionPostseasonTeams = Object.values(this.mrdaTeams).filter(team => team.postseasonEligible && r == team.region && team.postseasonPosition == null)
                                            .sort((a, b) => a.rank - b.rank );

            // Handle fewer postseason eligible teams in this region than spots
            if (regionPostseasonTeams <= spots){
                qualInfo.hide();
                inviteInfo.show();

                //assign the regions spots to next best eligible team in region, or next best eligible team globally.
                for (let i = 0; i < spots; i++) {
                    let team = regionPostseasonTeams[i];
                    if (team) {
                        team.postseasonPosition = r;
                    } else {
                        let globalPostseasonTeams = Object.values(this.mrdaTeams).filter(team => team.postseasonEligible && team.postseasonPosition == null)
                                                                            .sort((a, b) => a.rank - b.rank );
                        team = globalPostseasonTeams[0];
                        if (team)
                            team.postseasonPosition = r;
                    }
                }
            } else {
                qualInfo.show();
                inviteInfo.hide();
                // Assign qualifier spots up to 8
                for (let i = 0; i < Math.min(8,regionPostseasonTeams.length); i++) {
                    let team = regionPostseasonTeams[i];
                    team.postseasonPosition = r;
                }
            }
        });
    }

    getOrderedTeams(region) {
        return Object.values(this.mrdaTeams)
            .filter(team => (team.wins + team.losses) > 0 && (team.region == region || region == 'GUR'))
            .sort((a, b) => a.rankSort - b.rankSort);
    }
}
