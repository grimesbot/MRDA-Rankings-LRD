import requests;
import statsmodels.api as sm
import os
import json

teams_response = requests.get("https://worldcup-dashboard.mrda.org/items/teams?fields=id,name,name_letters")
teams_response.raise_for_status()  # Raises an error for bad responses
teams_data = teams_response.json()
teams_json = teams_data.get('data', [])
teams = {team["id"]: {"name": team["name"], "name_letters": team["name_letters"]} for team in teams_json}

games_response = requests.get("https://worldcup-dashboard.mrda.org/items/games?fields=home_team,away_team,home_score,away_score,duration")
games_response.raise_for_status()  # Raises an error for bad responses
games_data = games_response.json()
games = games_data.get('data', [])

team_ids = []
for game in games:
    if not game["home_team"] in team_ids:
        team_ids.append(game["home_team"])
    if not game["away_team"] in team_ids:
        team_ids.append(game["away_team"])

Y = []
X = []
W = []

for game in games:
    score_diff = game["home_score"] - game["away_score"]

    # Double score differential for 2x15 minute games for comparability with full length games.
    if game["duration"] == "2x15":
        score_diff *= 2
    
    # Add score differential as observation
    Y.append(score_diff)
    
    # Build x column of regressors (teams) and whether they played in the game
    x_col = []
    for team_id in team_ids:
        if team_id == game["home_team"]:
            x_col.append(1)
        elif team_id == game["away_team"]:
            x_col.append(-1)
        else:
            x_col.append(0)
    X.append(x_col)

    # Set all game weights to 1
    W.append(1)

wls = sm.WLS(Y, X, W).fit()
wls_result = wls.params

team_rankings = {}
for i, team_id in enumerate(team_ids):
    team_rankings[team_id] = wls_result[i]

rank = 1 
rating_floor = min(wls_result) - 1 # Set floor to 1 point below lowest rating to avoid negative ratings
result = {}
print(f"Rank\tRating\tTeam")
for item in sorted(team_rankings.items(), key=lambda item: item[1], reverse=True):
    team_result = {"rank": rank, "rating" : round(item[1] - rating_floor,2)}
    print(f"{team_result["rank"]}\t{str(team_result["rating"])}\t{teams[item[0]]["name"]}")
    result[item[0]] = team_result
    rank += 1

file_path = os.path.join("data", "world_cup_rankings.json")
# Delete if exists
if os.path.exists(file_path):
    os.remove(file_path)
with open( file_path , "w" ) as f:
    json.dump( result , f)