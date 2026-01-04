from datetime import datetime
from dataclasses import dataclass

from game_history import team_abbrev_id_map

# Constants
CHARTER_MAP = {"primary": "a", "secondary": "b"}

@dataclass
class ApiEvent:
    sanctioning_events_id: int
    sanctioning_id: int
    game_datetime: str
    home_league: int
    home_league_charter: str
    home_league_score: int
    away_league: int
    away_league_charter: str
    away_league_score: int
    scores_submitted: int
    status: str
    forfeit: int
    forfeit_league: int
    home_league_name: str
    home_league_logo: str
    away_league_name: str
    away_league_logo: str

class MrdaGame:
    def __init__(self, api_event: ApiEvent, game_history = None, event_id = None):
        if game_history is None:
            self.event_id = api_event.sanctioning_id
            self.datetime = datetime.strptime(api_event.game_datetime, "%Y-%m-%d %H:%M:%S")
            self.home_team = f"{str(api_event.home_league)}{CHARTER_MAP[api_event.home_league_charter]}"
            self.home_score = api_event.home_league_score
            self.away_team = f"{str(api_event.away_league)}{CHARTER_MAP[api_event.away_league_charter]}"
            self.away_score = api_event.away_league_score
            self.scores_submitted = api_event.scores_submitted == 1
            self.status = int(api_event.status) if api_event.status is not None else None
            self.forfeit = api_event.forfeit == 1
            if self.forfeit:
                if api_event.forfeit_league == api_event.home_league:
                    self.forfeit_team = self.home_team
                elif api_event.forfeit_league == api_event.away_league:
                    self.forfeit_team = self.away_team
                # Calculate forfeit_team based on score if we don't have it
                elif self.home_score > self.away_score:
                    self.forfeit_team = self.home_team
                elif self.away_score > self.home_score:
                    self.forfeit_team = self.away_team
                else:
                    print(f"Could not determine forfeit_team, sanctioning_events_id: {api_event.sanctioning_events_id}")
                    self.forfeit_team = None
            else:
                self.forfeit_team = None
        else:
            self.event_id = event_id
            self.datetime = datetime.strptime(game_history[0], "%Y-%m-%d")
            self.home_team = team_abbrev_id_map[game_history[1]]
            self.home_score = game_history[2]
            self.away_team = team_abbrev_id_map[game_history[3]]
            self.away_score = game_history[4]
            self.scores_submitted = True
            self.status = 7
            # Forfeits are hardcoded in game_history.py as 100-0 score
            if self.home_score == 100 and self.away_score == 0:
                self.forfeit = True
                self.forfeit_team = self.away_team
            elif self.away_score == 100 and self.home_score == 0:
                self.forfeit = True
                self.forfeit_team = self.home_team
            else:
                self.forfeit = False
        self.weight = None

    def to_dict(self):
        result = {
            "date": '{d.year}-{d.month}-{d.day} {d.hour}:{d.minute:02}'.format(d=self.datetime),
            "home_team": self.home_team,
            "away_team": self.away_team,
        }
        if self.event_id is not None:
            result["event_id"] = self.event_id
        if self.scores_submitted:
            result["home_score"] = self.home_score
            result["away_score"] = self.away_score            
        if self.status is not None:
            result["status"] = self.status
        if self.forfeit:
            result["forfeit"] = 1
            result["forfeit_team"] = self.forfeit_team
        if self.weight is not None:
            result["weight"] = round(self.weight,2)            
        return result