from mrda_team import MrdaTeam

RANKING_POINT_FLOOR = 1

class TeamRanking:
    def __init__(self, mrda_team: MrdaTeam, ranking_points = None, standard_error = None):
        self.mrda_team = mrda_team
        self.ranking_points = ranking_points
        self.standard_error = standard_error
        self.wins = 0
        self.losses = 0
        self.forfeits = 0
        self.game_count = 0
        self.active_status = False
        self.postseason_eligible = False
        self.rank = None
        self.region_rank = None

    def reset_accumulators(self):
        self.wins = 0
        self.losses = 0
        self.forfeits = 0
        self.game_count = 0
        self.active_status = False
        self.postseason_eligible = False
        self.rank = None
        self.region_rank = None        

    def to_dict(self, rp_min):
        result = {}
        if self.ranking_points is not None:
            result["rp"] = round(self.ranking_points - rp_min + RANKING_POINT_FLOOR, 2)
        if self.standard_error is not None:
            result["se"] = round(self.standard_error, 2)
        if self.wins > 0:
            result["w"] = self.wins
        if self.losses > 0:
            result["l"] = self.losses            
        if self.forfeits > 0:
            result["f"] = self.forfeits            
        if self.game_count > 0:
            result["gc"] = self.game_count
        if self.active_status:
            result["as"] = 1
        if self.postseason_eligible:
            result["pe"] = 1
        if self.rank is not None:
            result["r"] = self.rank
        if self.region_rank is not None:
            result["rr"] = self.region_rank            
        return result        