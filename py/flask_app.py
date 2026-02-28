from flask import Flask, jsonify, request
from flask_cors import CORS
import statsmodels.api as sm
import math

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://localhost",
    "http://127.0.0.1",
    "null",
    "https://grimesbot.github.io"
]}})

DIFFERENTIAL_CAP = 200

def linear_regression_diff(games, seeding):
    result = {}

    team_ids = []
    for game in games:
        home_team = game.get("th")
        away_team = game.get("ta")
        if not home_team in team_ids:
            team_ids.append(home_team)
        if not away_team in team_ids:
            team_ids.append(away_team)

    Y = []
    X = []
    W = []

    for game in games:
        home_team = game.get("th")
        away_team = game.get("ta")
        home_score = game.get("sh")
        away_score = game.get("sa")

        # Add score differential as observation
        Y.append(home_score - away_score)

        # Build x column of regressors (teams) and whether they played in the game
        x_col = []
        for team_id in team_ids:
            if team_id == home_team:
                x_col.append(1)
            elif team_id == away_team:
                x_col.append(-1)
            else:
                x_col.append(0)
        X.append(x_col)

        # Set game weight
        score_differential = abs(home_score - away_score)
        W.append(DIFFERENTIAL_CAP*score_differential**(-1) if score_differential > DIFFERENTIAL_CAP else 1)

    # Add virtual games if we have seeding
    if seeding is not None:
        # Add virtual games for existing teams
        for team_id in team_ids:
            # Existing team if in seeding rankings
            if team_id in seeding:

                # Add team's seeding RP as virtual game score differential.
                # All existing teams play a virtual team whose RP is 0
                Y.append(seeding[team_id])

                # Build x column of regressors (teams), real team is home team (1), no away team (-1) since it was virtual team
                x_col = []
                for t in team_ids:
                    if t == team_id:
                        x_col.append(1)
                    else:
                        x_col.append(0)
                X.append(x_col)

                W.append(1/4)

    wls = sm.WLS(Y, X, W).fit()
    wls_result = wls.params

    for i, team_id in enumerate(team_ids):
        result[team_id] = wls_result[i]

    return result

@app.route("/predict-game-lrd", methods=["POST"])
def predict_game_lrd():
    data = request.json
    home_team = data.get("th")
    away_team = data.get("ta")
    games = data.get("games")
    seeding = data.get("seeding")

    lr_result = linear_regression_diff(games, seeding)

    home_rp = lr_result[home_team]
    away_rp = lr_result[away_team]

    result = []
    for i in range(-300, 301, 25):
        diff = round(home_rp - away_rp) + i
        mock_game = {"th": home_team, "sh": diff, "ta": away_team, "sa": 0}
        games.append(mock_game)
        lr_result = linear_regression_diff(games, seeding)
        new_home_rp = lr_result[home_team]
        new_away_rp = lr_result[away_team]
        result.append({
            "d": diff,
            "dh": round(new_home_rp - home_rp, 2),
            "da": round(new_away_rp - away_rp, 2)
            })
        games.remove(mock_game)

    return jsonify(result), 200
