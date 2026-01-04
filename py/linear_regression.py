import statsmodels.api as sm
import math
import time
from datetime import datetime, date, timedelta, timezone
from dateutil.relativedelta import relativedelta

from mrda_data import mrda_teams, mrda_events, mrda_games, github_actions_run, write_json_to_file
from team_ranking import TeamRanking, RANKING_POINT_FLOOR

# Constants
DIFFERENTIAL_CAP = 200
POSTSEASON_EVENT_NAMES = ["Western Hemisphere Cup", "Qualifiers", "Mens Roller Derby Association Championships"]
START_DATE = date(2023,10,25) # Start calculations from first Wednesday after WHC 2023

# Global variables
q1_cutoff = date(2023,3,1) # Most recent Q1 ranking deadline from START_DATE (First Wednesday of March)
rankings_history = {}
last_games = []
last_calc_games = []
last_calc_compliance_games = []
last_calc_seeding = {}

rp_min = 0
# Methods
def linear_regression(games, seeding_team_rankings=None):
    global rp_min

    result = {}

    if len(games) == 0:
        result

    team_ids = []
    for game in games:
        if not game.home_team in team_ids:
            team_ids.append(game.home_team)
        if not game.away_team in team_ids:
            team_ids.append(game.away_team)

    Y = []
    X = []
    W = []

    for game in games:
        # Add score differential as observation 
        Y.append(game.home_score - game.away_score)
        
        # Build x column of regressors (teams) and whether they played in the game
        x_col = []
        for team_id in team_ids:
            if team_id == game.home_team:
                x_col.append(1)
            elif team_id == game.away_team:
                x_col.append(-1)
            else:
                x_col.append(0)
        X.append(x_col)

        # Calculate weight based on score differential if hasn't already been set
        if game.weight is None:
            score_differential = abs(game.home_score - game.away_score)
            game.weight = 1170*score_differential**(-4/3) if score_differential > DIFFERENTIAL_CAP else 1

        # Set game weight
        W.append(game.weight)

    # Add virtual games if we have seeding_team_rankings
    if seeding_team_rankings is not None:
        # Add virtual games for existing teams
        for team_id in team_ids:
            # Existing team if in seeding rankings
            if team_id in seeding_team_rankings:

                # Add team's seeding RP as virtual game score differential.
                # All existing teams play a virtual team whose RP is 0                       
                Y.append(seeding_team_rankings[team_id].ranking_points)

                # Build x column of regressors (teams), real team is home team (1), no away team (-1) since it was virtual team
                x_col = []
                for t in team_ids:
                    if t == team_id:
                        x_col.append(1)
                    else:
                        x_col.append(0)
                X.append(x_col)
                
                W.append(1/4)

    # Execute StatsModels Weighted Least Squares
    wls = sm.WLS(Y, X, W).fit()
    #print(wls.summary())
    wls_result = wls.params
    #print(wls_result)
    wls_stderrs = wls.bse
    #print(wls_stderrs)

    for i, team_id in enumerate(team_ids):
        ranking_points = wls_result[i]
        standard_error = wls_stderrs[i]
        result[team_id] = TeamRanking(mrda_teams[team_id], ranking_points, standard_error)

        if ranking_points < rp_min:
            rp_min = ranking_points

    #print(result)

    return result

def rank_teams(team_rankings, games, compliance_games):
    result = {}

    team_ids = []
    for game in games:
        if not game.home_team in team_ids:
            team_ids.append(game.home_team)
        if not game.away_team in team_ids:
            team_ids.append(game.away_team)

    # Calculate team metrics 
    for team_id in team_ids:
        if team_id not in team_rankings:
            team_ranking = TeamRanking(mrda_teams[team_id])
            team_rankings[team_id] = team_ranking
        else:
            team_ranking = team_rankings[team_id]
            team_ranking.reset_accumulators()

        for game in [game for game in games if game.home_team == team_id or game.away_team == team_id]:
            if not game.forfeit:
                team_score = game.home_score if game.home_team == team_id else game.away_score
                opponent_score = game.away_score if game.home_team == team_id else game.home_score
                if team_score > opponent_score:
                    team_ranking.wins += 1
                elif team_score < opponent_score:
                    team_ranking.losses += 1
            elif game.forfeit_team == team_id:
                team_ranking.forfeits += 1
    
        # Active status and postseason eligibility only use compliance games
        unique_opponents = []
        for game in [game for game in compliance_games if game.home_team == team_id or game.away_team == team_id]:
            if not game.forfeit or game.forfeit_team != team_id:
                team_ranking.game_count += 1
                opponent = game.away_team if game.home_team == team_id else game.home_team
                if not opponent in unique_opponents:
                    unique_opponents.append(opponent)
        team_ranking.active_status = team_ranking.game_count >= 3 and len(unique_opponents) >= 2
        team_ranking.postseason_eligible = team_ranking.active_status and (team_ranking.game_count >= 5 or team_ranking.mrda_team.distance_clause_applies)

    # Rank teams globally
    rank = 1
    for team_ranking in sorted([tr for tr in team_rankings.values() if tr.active_status], key=lambda tr: tr.ranking_points, reverse=True):
        team_ranking.rank = rank
        rank += 1

    # Apply forfeit penalties
    for team_ranking in sorted([tr for tr in team_rankings.values() if tr.rank is not None and tr.forfeits > 0 ], key=lambda tr: tr.rank, reverse=True):
        # Two spots for teach forfeit
        for forfeit in range(team_ranking.forfeits):
            for spot in range(2):
                swap_team_ids = [team_id for team_id, tr in team_rankings.items() if tr.rank == team_ranking.rank + 1]
                if len(swap_team_ids) > 0:
                    swap_team_id = swap_team_ids[0]
                    team_rankings[swap_team_id].rank -= 1
                    team_ranking.rank += 1

    # Rank teams regionally
    for region in set([t.region for t in mrda_teams.values()]):
        region_rank = 1
        for team_ranking in sorted([tr for tr in team_rankings.values() if region == tr.mrda_team.region and tr.rank is not None], key=lambda tr: tr.rank):
            team_ranking.region_rank = region_rank
            region_rank += 1

def get_seed_date(date):
    result = date - relativedelta(weeks=52) #12 months in weeks
    # If seed_date is a greater # weekday of month than date, set seed_date back an additional week
    # e.g. if date is 1st Wednesday of June, seed_date should be 1st Wednesday of June last year.
    # date = Jun 7, 2028, 52 weeks prior would seed_date = Jun 9, 2027 which is 2nd Wednesday of June.
    # set seed_date back an additional week seed_date = Jun 2, 2027 so games on weekend of Jun 4-6, 2027 count
    if (((result.day - 1) // 7) > ((date.day - 1) // 7)):
        result = result - relativedelta(weeks=1)
    return result

def get_ranking_history(date):
    seed_date = get_seed_date(date)
    ranking_history_dt = max([dt for dt in rankings_history.keys() if seed_date < dt <= date], default=None)
    return rankings_history[ranking_history_dt] if ranking_history_dt is not None else None

def get_rankings(date):
    global q1_cutoff
    global last_games
    global last_calc_games
    global last_calc_compliance_games
    global last_calc_seeding

    team_rankings = None

    seed_date = get_seed_date(date)

    # Get previously calculated rankings for seed_date
    seeding_team_rankings = get_ranking_history(seed_date)

    # If we don't have a ranking_history for the seed_date, calculate raw without seeding data and
    # use all games history we have (going back to Apr 2023). E.g. Q3-2024 rankings in Sept 2024
    # would include Apr '23-Aug'24 data which is 16 months, more than the typical 12 months.
    # But if we only use 12 months of data, Apr-Aug '23 games would fall off entirely & not contribute to
    # future seeding rankings depending on the time of the year the rankings are calculated.
    if seeding_team_rankings is None:
        games = [game for game in mrda_games if game.scores_submitted and game.datetime.date() < date ]
    else:
        games = [game for game in mrda_games if game.scores_submitted and seed_date <= game.datetime.date() < date ]

    # Filter compliance games to exclude postseason events prior to Q1 cutoff date
    compliance_games = games
    # No need to filter if we're doing the q1 calculation, but increment q1_cutoff to next year for future calculations
    if date.month == 3 and date.day <= 7:
        q1_cutoff = date
    else:
        for postseasonEventName in POSTSEASON_EVENT_NAMES:
            compliance_games = [game for game in compliance_games if game.event_id is None or mrda_events[game.event_id].name is None or postseasonEventName not in mrda_events[game.event_id].name or game.datetime.date() >= q1_cutoff]

    # Filter forfeits from calc_games
    calc_games = [game for game in games if not game.forfeit]
    
    # Calculate linear regression results if calc games or seeding rankings have changed since last calculation.    
    if calc_games != last_calc_games or seeding_team_rankings != last_calc_seeding:
        team_rankings = linear_regression(calc_games, seeding_team_rankings)
        last_calc_games = calc_games
        last_calc_seeding = seeding_team_rankings
        # Always rank teams if we got new ratings
        rank_teams(team_rankings, games, compliance_games)
        last_games = games
        last_calc_compliance_games = compliance_games
    # if games or compliance games have changed but we didn't get new ratings, re-rank teams with last ratings
    elif games != last_games or compliance_games != last_calc_compliance_games:
        team_rankings = get_ranking_history(date)
        rank_teams(team_rankings, games, compliance_games)
        last_games = games
        last_calc_compliance_games = compliance_games

    # Print sorted results for ranking deadline dates when debugging
    if not github_actions_run and date.month in [3,6,9,12] and date.day <= 7:
        print_result = team_rankings if team_rankings is not None else get_ranking_history(date)
        print("Rankings for " + date.strftime("%Y-%m-%d"))
        for item in sorted(print_result.items(), key=lambda item: (item[1].rank if item[1].rank is not None else len(print_result), -item[1].ranking_points if item[1].ranking_points is not None else 0)):
            tr = item[1]
            print(f"{tr.rank if tr.rank is not None else "NR"}\t{str(round(tr.ranking_points - rp_min + RANKING_POINT_FLOOR, 2)) if tr.ranking_points is not None else "No RP"}\t{tr.mrda_team.name}")
        print("")
        
    return team_rankings

# Find the next ranking deadline, which is the first Wednesday of the next March, June, September or December
nextRankingDeadline = datetime.today().date()
if not (nextRankingDeadline.month % 3 == 0 and nextRankingDeadline.day <= 7 and nextRankingDeadline.weekday() <= 2):
    # Set month to next March, June, Sept or Dec
    nextRankingDeadline = nextRankingDeadline + relativedelta(months=(3-(nextRankingDeadline.month % 3)))
# Set to first of month
nextRankingDeadline = nextRankingDeadline.replace(day=1)
# Set to Wednesday = 2
nextRankingDeadline = nextRankingDeadline + timedelta(days=(2 - nextRankingDeadline.weekday() + 7) % 7)

print("Beginning ranking calculation...")
start_time = time.perf_counter()
calc_count = 0

rankingDate = START_DATE
# Calculate rankings for each week on Wednesday from starting date until the next ranking deadline
while (rankingDate <= nextRankingDeadline):
    ranking_result = get_rankings(rankingDate)
    if ranking_result is not None:
        rankings_history[rankingDate] = ranking_result
        calc_count += 1
    rankingDate = rankingDate + timedelta(weeks=1)

print("Completed " + str(calc_count) + " ranking calculations in " + str(round(time.perf_counter() - start_time, 2)) + " seconds.")

# Format dates to Y-m-d and team rankings to formatted dict
rankings_history_dicts = {'{d.year}-{d.month}-{d.day}'.format(d=dt): {team_id: tr.to_dict(rp_min) for team_id, tr in team_rankings.items()} for dt, team_rankings in rankings_history.items()}
# Save rankings JSON to JavaScript file as rankings_history variable for local web UI
write_json_to_file(rankings_history_dicts, "mrda_rankings_history.js", "rankings_history", "rankings_generated_utc")
# Save rankings JSON file for external use
write_json_to_file(rankings_history_dicts, "mrda_rankings_history.json")
print("Rankings updated and saved to mrda_rankings_history.js and mrda_rankings_history.json")

# Save mrda_games to JavaScript file for local web UI
mrda_game_dicts = [mrda_game.to_dict() for mrda_game in sorted(mrda_games, key=lambda game: game.datetime)]
write_json_to_file(mrda_game_dicts, "mrda_games.js", "mrda_games")
# Save mrda_games JSON file for external use
write_json_to_file(mrda_game_dicts, "mrda_games.json")
print("MRDA games updated and saved to mrda_games.js and mrda_games.json")