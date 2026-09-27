import { pool } from './pool.js';

const CATEGORIES = [
  'stem_excellence',
  'business_real_estate',
  'thriving_communities',
  'entertainment_culture',
];

/**
 * Pull a fresh, randomized 9-question set per round (27 total for a 3-round match),
 * biased to rotate evenly across the four categories, favoring less-used questions so
 * the bank's long tail gets surfaced instead of the same popular questions repeating.
 */
export async function getQuestionsForMatch({ perRound = 9, rounds = 3 } = {}) {
  const result = {};
  for (let round = 1; round <= rounds; round += 1) {
    result[round] = await pickRoundQuestions(perRound);
  }
  return result;
}

async function pickRoundQuestions(count) {
  const perCategory = Math.ceil(count / CATEGORIES.length);
  const rows = [];

  for (const category of CATEGORIES) {
    const { rows: categoryRows } = await pool.query(
      `SELECT id, category, prompt, choice_a, choice_b, choice_c, choice_d,
              correct_choice, explanation, difficulty
         FROM question_bank
        WHERE category = $1
        ORDER BY times_used ASC, random()
        LIMIT $2`,
      [category, perCategory],
    );
    rows.push(...categoryRows);
  }

  const selected = shuffle(rows).slice(0, count);

  if (selected.length > 0) {
    await pool.query(
      `UPDATE question_bank SET times_used = times_used + 1 WHERE id = ANY($1::uuid[])`,
      [selected.map((r) => r.id)],
    );
  }

  return selected.map(rowToQuestion);
}

function rowToQuestion(row) {
  return {
    id: row.id,
    category: row.category,
    prompt: row.prompt,
    choices: { A: row.choice_a, B: row.choice_b, C: row.choice_c, D: row.choice_d },
    correctChoice: row.correct_choice,
    explanation: row.explanation,
    difficulty: row.difficulty,
  };
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
