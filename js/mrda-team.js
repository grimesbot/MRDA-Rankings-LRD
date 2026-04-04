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