const VIRTUAL_TEAM_ID = '0000a';

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
        this.forfeitTeamId = game.forfeit_team;
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
            return '';
        let result = performanceDelta.toFixed(round);
        return `${result > 0 ? '+' : ''}${result}`;
    }

    getPerformanceDeltaWithIcon(team, round = 2)
    {
        let performanceDelta = this.getPerformanceDelta(team);
        if (performanceDelta == null)
            return '';
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