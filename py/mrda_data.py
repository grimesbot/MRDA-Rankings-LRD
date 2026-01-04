import requests
import os
import json
from datetime import datetime, date, timedelta, timezone

from mrda_game import CHARTER_MAP, ApiEvent, MrdaGame
from mrda_event import MrdaEvent
from mrda_team import MrdaTeam

from game_history import games

# Constants
DATA_DIR = "data"

# Global variables
github_actions_run = 'GITHUB_ACTIONS' in os.environ and os.environ['GITHUB_ACTIONS'] == 'true'
github_actions_scheduled_run = github_actions_run and 'GITHUB_EVENT_NAME' in os.environ and os.environ['GITHUB_EVENT_NAME'] == 'schedule'

mrda_games = []
mrda_teams = {}
mrda_events = {}

# Methods
def get_api_game_data(startDate, status=None):
    url = "https://api.mrda.org/v1-public/sanctioning/algorithm"
    params = {
        "start-date": startDate.strftime("%m/%d/%Y"),
        "end-date": (datetime.today() + timedelta(weeks=52)).strftime("%m/%d/%Y") # Include upcoming games
    }

    if status is not None:
        params["status"] = status

    response = requests.get(url, params=params)
    response.raise_for_status()  # Raises an error for bad responses

    data = response.json()
    payload = data.get('payload', [])
    
    if not data["success"]:
        print("API did not return successfully.")
        exit()

    return payload

def write_json_to_file(data, file_name, var_name=None, utc_timestamp_var=None):
    file_path = os.path.join(DATA_DIR, file_name)
    # Delete if exists
    if os.path.exists(file_path):
        os.remove(file_path)
    # Write with optional JS variable name and optional UTC timestamp variable
    with open( file_path , "w" ) as f:
        if utc_timestamp_var is not None:
            f.write(utc_timestamp_var + " = \"" + datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ") + "\";\n")    
        if var_name is not None:
            f.write(var_name + " = ")
        json.dump( data , f) #, indent=4) pretty print

# Get 2024+ games from API
print("Begin MRDA Central API game data retrieval...")
game_data = get_api_game_data(date(2024, 1, 1))
print("Retrieved " + str(len(game_data)) + " games from >=2024 in Pending Processing or Complete status")

approved_game_data = get_api_game_data(date(2024, 1, 1), 3)
print("Retrieved " + str(len(approved_game_data)) + " games in Approved status")
game_data.extend(approved_game_data)

#waiting_for_documents_game_data = get_api_game_data(datetime.today() - timedelta(days=45), 4)
#print("Retrieved " + str(len(waiting_for_documents_game_data)) + " games from last 45 days in Waiting for Documents status")
waiting_for_documents_game_data = get_api_game_data(date(2024, 1, 1), 4)
print("Retrieved " + str(len(waiting_for_documents_game_data)) + " games in Waiting for Documents status")
game_data.extend(waiting_for_documents_game_data)

# Compare game_data to JSON file from last calculation for scheduled runs.
# Only recalculate rankings if game_data changes (manual runs always recalculate).
game_data_json_filename = "mrda_api_data.json"
game_data_json_file_path = os.path.join(DATA_DIR, game_data_json_filename)
if github_actions_scheduled_run:
    if os.path.exists(game_data_json_file_path):
        with open( game_data_json_file_path , "r" ) as f:
            file_content = f.read()
            if file_content == json.dumps(game_data):
                # game_data has not changed, exit without recalculating rankings
                print("Game data from MRDA Central API has not changed, exiting without recalculating rankings.")
                exit()

print("Initializing MRDA games list...")                
# Save game_data to JSON file for future comparison.
write_json_to_file(game_data, game_data_json_filename)
print(f"MRDA Central API game_data saved to {game_data_json_file_path} for future comparison.")

# Add 2023 events and games from game_history.py to mrda_events and mrda_games
for game_day in games:
    # Derive negative event_id so we don't collide with event_id from API
    event_id = games.index(game_day) - len(games)
    event_name = game_day[0][5] if len(game_day[0]) > 5 else None
    event_start_dt = datetime.strptime(game_day[0][0], "%Y-%m-%d")
    event = MrdaEvent(event_name, event_start_dt)

    for game in game_day:
        mrda_game = MrdaGame(None, game, event_id)

        if mrda_game.datetime > event.end_dt:
            event.end_dt = mrda_game.datetime

        mrda_games.append(mrda_game)

    mrda_events[event_id] = event

print("Added " + str(len(mrda_games)) + " games from 2023 in game_history.py")

# Validate and add data from API to mrda_events, mrda_teams and mrda_games
sorted_game_data = sorted(game_data, key=lambda x: datetime.strptime(x["event"]["game_datetime"], "%Y-%m-%d %H:%M:%S"))
for api_game in sorted_game_data:
    # Required fields
    if "event" not in api_game or api_game["event"] is None:
        print(f"event not found at index {sorted_game_data.index(api_game)}")
        continue

    api_event = ApiEvent(**api_game["event"])

    if api_event.game_datetime is None:
        print(f"game_datetime not found, sanctioning_events_id: {api_event.sanctioning_events_id}")
        continue
    
    if api_event.home_league_charter not in CHARTER_MAP.keys():
        print(f"home_league_charter not primary or secondary, sanctioning_events_id: {api_event.sanctioning_events_id}")
        continue

    if api_event.away_league_charter not in CHARTER_MAP.keys():
        print(f"away_league_charter not primary or secondary, sanctioning_events_id: {api_event.sanctioning_events_id}")
        continue

    mrda_game = MrdaGame(api_event)

    if mrda_game.forfeit and mrda_game.forfeit_team is None:
        print(f"forfeit without forfeir league, sanctioning_events_id: {api_event.sanctioning_events_id}")
        continue

    # Filter out games without scores older than 45 days
    if not mrda_game.scores_submitted and mrda_game.datetime < (datetime.today() - timedelta(days=45)):
        continue

    # Event
    if mrda_game.event_id is not None:
        if mrda_game.event_id not in mrda_events:
            mrda_events[mrda_game.event_id] = MrdaEvent(api_game.get("sanctioning", {}).get("event_name", None), mrda_game.datetime)
        elif mrda_game.datetime > mrda_events[mrda_game.event_id].end_dt:
            mrda_events[mrda_game.event_id].end_dt = mrda_game.datetime

    # Teams
    if mrda_game.home_team not in mrda_teams:
        mrda_teams[mrda_game.home_team] = MrdaTeam(mrda_game.home_team, api_event.home_league_name, api_event.home_league_charter, api_event.home_league_logo)
    if mrda_game.away_team not in mrda_teams:
        mrda_teams[mrda_game.away_team] = MrdaTeam(mrda_game.away_team, api_event.away_league_name, api_event.away_league_charter, api_event.away_league_logo)        

    mrda_games.append(mrda_game)

# Save mrda_events JSON to JavaScript file for local web UI
mrda_event_dicts = {event_id: mrda_event.to_dict() for event_id, mrda_event in mrda_events.items()}
write_json_to_file(mrda_event_dicts, "mrda_events.js", "mrda_events")
# Save mrda_events JSON file for external use
write_json_to_file(mrda_event_dicts, "mrda_events.json")
print("MRDA events saved to mrda_events.js and mrda_events.json")

# Save mrda_teams JSON to JavaScript file for local web UI
mrda_team_dicts = {team_id: mrda_team.to_dict() for team_id, mrda_team in mrda_teams.items()}
write_json_to_file(mrda_team_dicts, "mrda_teams.js", "mrda_teams")
# Save mrda_teams JSON file for external use
write_json_to_file(mrda_team_dicts, "mrda_teams.json")
print("MRDA teams saved to mrda_teams.js and mrda_teams.json")

# Feature to remove games for excluded teams
#excludedTeams = ["2714a", "17916a", "17915a","17910a","17911a"] #PAN, ORD, RDNA, NDT, RDT
#mrda_games = [game for game in mrda_games if not game.home_team in excludedTeams and not game.away_team in excludedTeams]

# Feature to get results for a specific event.
#mrda_games = [game for game in mrda_games if game.event_id is not None and mrda_events[game.event_id].name == "2025 Mens Roller Derby Association Championships"]

# Feature to exclude new games to look at changes from game decay only.
#mrda_games = [game for game in mrda_games if game.datetime <= datetime(2025,10,8)]