/**
 * Pure game-logic state machine for a match: no I/O, no sockets, no DB.
 * MatchManager wraps this with persistence and realtime delivery.
 *
 * Rules:
 *  - A match is best-of-3 rounds.
 *  - A round has up to 9 questions. A side wins the round on reaching 5 correct answers,
 *    but ALL 9 questions are still played out (to maximize each side's overall score) —
 *    the round is only marked "complete" after question 9, even though the winner may be
 *    mathematically decided earlier.
 *  - Team sizes need not match (e.g. 1 vs 4): scoring is the team's aggregate correct count,
 *    not per-capita, so asymmetrical rosters remain meaningful.
 */

export const QUESTIONS_PER_ROUND = 9;
export const CORRECT_TO_CLINCH = 5;
export const ROUNDS_TO_WIN_MATCH = 2; // best of 3

export const Side = Object.freeze({ A: 'A', B: 'B' });

function otherSide(side) {
  return side === Side.A ? Side.B : Side.A;
}

export function createRound(roundNumber) {
  return {
    roundNumber,
    questionNumber: 0,
    correct: { [Side.A]: 0, [Side.B]: 0 },
    answered: { [Side.A]: 0, [Side.B]: 0 },
    clinchedBy: null, // Side.A | Side.B | null — set the instant a side hits 5, play continues
    clinchedAtQuestion: null,
    isComplete: false,
    winner: null, // set once isComplete is true; may be null on a tie at 9 questions
  };
}

export function createMatch(matchId, teamAId, teamBId) {
  return {
    matchId,
    teamIds: { [Side.A]: teamAId, [Side.B]: teamBId },
    roundsWon: { [Side.A]: 0, [Side.B]: 0 },
    rounds: [createRound(1)],
    status: 'in_progress', // 'in_progress' | 'completed'
    winnerSide: null,
  };
}

function currentRound(match) {
  return match.rounds[match.rounds.length - 1];
}

/**
 * Record one side's answer to the current question of the current round.
 * `side` answers independently per team — in a team match, any correct answer from any
 * teammate counts once for the team on that question (first correct answer per side per
 * question is what's scored; late/duplicate answers from teammates are ignored by the caller,
 * see MatchManager's per-question answer gating).
 */
export function recordAnswer(match, side, isCorrect) {
  if (match.status === 'completed') {
    throw new Error('Match already completed');
  }
  const round = currentRound(match);
  if (round.isComplete) {
    throw new Error('Round already completed');
  }

  round.answered[side] += 1;
  if (isCorrect) {
    round.correct[side] += 1;
    if (round.correct[side] === CORRECT_TO_CLINCH && round.clinchedBy === null) {
      round.clinchedBy = side;
      round.clinchedAtQuestion = round.questionNumber + 1;
    }
  }

  return match;
}

/**
 * Advance to the next question in the round, or close out the round/match if this was
 * the 9th question. Call after both sides have answered the current question.
 */
export function advanceQuestion(match) {
  const round = currentRound(match);
  round.questionNumber += 1;

  if (round.questionNumber >= QUESTIONS_PER_ROUND) {
    closeRound(match, round);
  }

  return match;
}

function closeRound(match, round) {
  round.isComplete = true;

  if (round.correct[Side.A] === round.correct[Side.B]) {
    round.winner = null; // tied round: no round point awarded to either side
  } else {
    round.winner = round.correct[Side.A] > round.correct[Side.B] ? Side.A : Side.B;
    match.roundsWon[round.winner] += 1;
  }

  if (match.roundsWon[Side.A] >= ROUNDS_TO_WIN_MATCH || match.roundsWon[Side.B] >= ROUNDS_TO_WIN_MATCH) {
    match.status = 'completed';
    match.winnerSide = match.roundsWon[Side.A] > match.roundsWon[Side.B] ? Side.A : Side.B;
  } else if (match.rounds.length < 3) {
    match.rounds.push(createRound(match.rounds.length + 1));
  } else {
    // All 3 rounds played and still tied on rounds won (e.g. 1-1-tie) — resolve by
    // aggregate correct answers across all rounds as a tiebreaker.
    match.status = 'completed';
    const totalA = match.rounds.reduce((sum, r) => sum + r.correct[Side.A], 0);
    const totalB = match.rounds.reduce((sum, r) => sum + r.correct[Side.B], 0);
    match.winnerSide = totalA >= totalB ? Side.A : Side.B;
  }
}

export function isRoundClinched(match) {
  return currentRound(match).clinchedBy !== null;
}

export function getScoreSummary(match) {
  return {
    roundsWon: { ...match.roundsWon },
    currentRound: match.rounds.length,
    rounds: match.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      correct: { ...r.correct },
      questionNumber: r.questionNumber,
      clinchedBy: r.clinchedBy,
      isComplete: r.isComplete,
      winner: r.winner,
    })),
    status: match.status,
    winnerSide: match.winnerSide,
  };
}
