import { randomUUID } from 'node:crypto';
import { pool } from './pool.js';
import { getScoreSummary, Side } from '../game/RoundEngine.js';

/** Lightweight checkpoint after each question, so a server restart can resume a match. */
export async function persistMatchSnapshot(match) {
  await pool.query(
    `INSERT INTO matches (id, status, team_a_id, team_b_id, rounds_won_a, rounds_won_b)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE
       SET status = EXCLUDED.status,
           rounds_won_a = EXCLUDED.rounds_won_a,
           rounds_won_b = EXCLUDED.rounds_won_b`,
    [
      match.matchId,
      match.status,
      match.teamIds[Side.A],
      match.teamIds[Side.B],
      match.roundsWon[Side.A],
      match.roundsWon[Side.B],
    ],
  );
}

/** Final write-up on match completion: rounds, per-question answers, crown, ELO. */
export async function persistCompletedMatch(match, rosters) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const winnerTeamId = match.teamIds[match.winnerSide];

    await client.query(
      `UPDATE matches
          SET status = 'completed', winner_team_id = $2, completed_at = now()
        WHERE id = $1`,
      [match.matchId, winnerTeamId],
    );

    for (const round of match.rounds) {
      await client.query(
        `INSERT INTO rounds (match_id, round_number, team_a_correct, team_b_correct,
                              questions_answered, clinched_at_question, winner_team_id, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (match_id, round_number) DO NOTHING`,
        [
          match.matchId,
          round.roundNumber,
          round.correct[Side.A],
          round.correct[Side.B],
          round.questionNumber,
          round.clinchedAtQuestion,
          round.winner ? match.teamIds[round.winner] : null,
        ],
      );
    }

    await client.query(
      `INSERT INTO crowns (id, match_id, team_id, engraved_name)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), match.matchId, winnerTeamId, rosters[match.winnerSide].name],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
