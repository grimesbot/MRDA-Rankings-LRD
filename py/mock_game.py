from datetime import datetime, timedelta
from tkinter import Tk

from game_history import team_abbrev_id_map
from mrda_game import MrdaGame
from linear_regression import get_ranking_history, get_rankings, mrda_games, mrda_teams

# Constanct for hypothetical game analysis, must match formats in game_history
HOME_ABBREV = "DHR"
AWAY_ABBREV = "KMRD"
GAME_DATE = '2025-12-6'

game_count = 0
error_sum = 0
for game in [game for game in mrda_games if game.scores_submitted and not game.forfeit]:
    ranking = get_ranking_history(game.datetime.date())
    if ranking is not None and game.home_team in ranking and game.away_team in ranking:
        predicted_diff = ranking[game.home_team].ranking_points - ranking[game.away_team].ranking_points
        actual_diff = game.home_score - game.away_score
        error_sum += abs(predicted_diff - actual_diff)
        game_count += 1

table_str = f"Average Error: {error_sum/game_count}\n\n"

home_id = team_abbrev_id_map[HOME_ABBREV] 
away_id = team_abbrev_id_map[AWAY_ABBREV]

ranking_dt = datetime.strptime(GAME_DATE, "%Y-%m-%d")
days_to_wed = (2 - ranking_dt.weekday()) % 7
days_to_wed = 7 if days_to_wed == 0 else days_to_wed
ranking_dt = ranking_dt + timedelta(days=days_to_wed)

current_ranking = get_ranking_history(ranking_dt.date())
home_rp = current_ranking[home_id].ranking_points
away_rp = current_ranking[away_id].ranking_points

table_str += f"Hypothetical game between {mrda_teams[home_id].name} vs. {mrda_teams[away_id].name} on {GAME_DATE}. Expected score differential: {str(round(home_rp-away_rp,2))}\n\n"
table_str += f"Diff\t{mrda_teams[home_id].name} RP Δ\t{mrda_teams[away_id].name} RP Δ\tWeight\n"

for score_differential in range(25, 801, 25):
    mock_game_history = (GAME_DATE, HOME_ABBREV, score_differential, AWAY_ABBREV, 0)
    mock_game = MrdaGame(None, mock_game_history)
    mrda_games.append(mock_game)
    new_ranking = get_rankings(ranking_dt.date())
    new_home_rp = new_ranking[home_id].ranking_points
    new_away_rp = new_ranking[away_id].ranking_points
    table_str += f"{score_differential}\t{str(round(new_home_rp - home_rp,2))}\t{str(round(new_away_rp - away_rp,2))}\t{mock_game.weight}\n"
    mrda_games.remove(mock_game)

# Copy to clipboard using tkinter
r = Tk()
r.withdraw()
r.clipboard_clear()
r.clipboard_append(table_str)
r.update()
r.destroy()