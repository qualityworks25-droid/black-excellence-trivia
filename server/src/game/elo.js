const K_FACTOR = 24;

/** Standard ELO expected-score formula. */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Updates a single side's rating treating each team as one entity (average of its
 * members' ratings), then distributes the team's rating delta to individual members
 * proportional to their share of the team's correct answers, so a player who carried
 * the team gains/loses more than one who barely contributed.
 */
export function computeEloUpdates({ teamARatings, teamBRatings, teamAWon, contributions }) {
  const avg = (ratings) => ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const ratingA = avg(teamARatings);
  const ratingB = avg(teamBRatings);

  const actualA = teamAWon ? 1 : 0;
  const deltaTeamA = Math.round(K_FACTOR * (actualA - expectedScore(ratingA, ratingB)));
  const deltaTeamB = -deltaTeamA;

  return {
    teamADelta: distribute(deltaTeamA, contributions.teamA),
    teamBDelta: distribute(deltaTeamB, contributions.teamB),
  };
}

/** Split a team's total ELO delta across members proportional to correct-answer share. */
function distribute(teamDelta, memberCorrectCounts) {
  const total = memberCorrectCounts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const even = teamDelta / memberCorrectCounts.length;
    return memberCorrectCounts.map(() => Math.round(even));
  }
  return memberCorrectCounts.map((count) => Math.round((count / total) * teamDelta));
}
