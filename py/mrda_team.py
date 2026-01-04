from team_info import team_info

DEFAULT_REGION = "AM"

class MrdaTeam:
    def __init__(self, team_id: str, league_name: str, charter: str, logo: str):
        # Use nice names from team_info
        self.name = team_info[team_id].get("name", None) if team_id in team_info else None
        # Derive name from league_name and charter if not in team_info
        if self.name is None:
            self.name = f"{league_name} ({CHARTER_MAP[charter].upper()})"

        # Get most recent logo from api_event, otherwise use backup defined in team_info                
        if logo is not None:
            self.logo = logo
        else:
            self.logo = team_info[team_id].get("logo", None) if team_id in team_info else None
        
        # Propertied defined only in team_info.py:
        self.region = team_info[team_id].get("region", DEFAULT_REGION) if team_id in team_info else DEFAULT_REGION
        self.location = team_info[team_id].get("location", None) if team_id in team_info else None
        self.distance_clause_applies = team_info[team_id].get("distance_clause_applies", False) if team_id in team_info else False

    def to_dict(self):
        result = {
            "name": self.name,
            "region": self.region
        }
        if self.logo is not None:
            result["logo"] = self.logo
        if self.location is not None:
            result["location"] = self.location
        return result