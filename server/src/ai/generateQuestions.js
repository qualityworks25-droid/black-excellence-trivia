import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import OpenAI from 'openai';
import { pool } from '../db/pool.js';
import { embedQuestion } from './embeddings.js';
import { checkDuplicate, upsertQuestionVector } from './vectorStore.js';
import { allCategories, pickRandomSeedTopic } from './seedTopics.js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GENERATION_MODEL = process.env.GENERATION_MODEL ?? 'gpt-4o-mini';
const BATCH_SIZE = 8;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT_TEMPLATE = extractPromptTemplate(
  readFileSync(path.join(__dirname, '../../../docs/AI_SYSTEM_PROMPT.md'), 'utf-8'),
);

function extractPromptTemplate(markdown) {
  const match = markdown.match(/```\n(You are the question-writing engine[\s\S]*?)\n```/);
  if (!match) throw new Error('Could not find system prompt template in AI_SYSTEM_PROMPT.md');
  return match[1];
}

function buildPrompt(category, seedTopic) {
  return SYSTEM_PROMPT_TEMPLATE.replace('{{CATEGORY}}', category)
    .replace('{{SEED_TOPIC}}', seedTopic)
    .replace('{{BATCH_SIZE}}', String(BATCH_SIZE));
}

/** Structural validation, independent of and prior to semantic dedup. */
function isStructurallyValid(candidate) {
  if (!candidate.prompt || !candidate.explanation) return false;
  if (!['A', 'B', 'C', 'D'].includes(candidate.correct_choice)) return false;

  const choices = candidate.choices ?? {};
  const keys = ['A', 'B', 'C', 'D'];
  if (!keys.every((k) => typeof choices[k] === 'string' && choices[k].trim().length > 0)) {
    return false;
  }
  const texts = keys.map((k) => choices[k].trim().toLowerCase());
  return new Set(texts).size === keys.length; // all four choices distinct
}

async function generateBatch(category, seedTopic) {
  const completion = await client.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [{ role: 'system', content: buildPrompt(category, seedTopic) }],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0].message.content;
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.questions ?? [];
}

async function insertQuestion(candidate, category, seedTopic, embedding, vectorId) {
  await pool.query(
    `INSERT INTO question_bank
       (category, seed_topic, prompt, choice_a, choice_b, choice_c, choice_d,
        correct_choice, explanation, difficulty, vector_id, generated_by_model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      category,
      seedTopic,
      candidate.prompt,
      candidate.choices.A,
      candidate.choices.B,
      candidate.choices.C,
      candidate.choices.D,
      candidate.correct_choice,
      candidate.explanation,
      candidate.difficulty ?? 2,
      vectorId,
      GENERATION_MODEL,
    ],
  );
}

/** Runs one generation-validate-dedup-insert pass across all four categories. */
export async function runGenerationPass() {
  const summary = { accepted: 0, rejectedStructural: 0, rejectedDuplicate: 0 };

  for (const category of allCategories()) {
    const seedTopic = pickRandomSeedTopic(category);
    let candidates;
    try {
      candidates = await generateBatch(category, seedTopic);
    } catch (err) {
      console.error(`[generateQuestions] generation failed for ${category}:`, err.message);
      continue;
    }

    for (const candidate of candidates) {
      if (!isStructurallyValid(candidate)) {
        summary.rejectedStructural += 1;
        continue;
      }

      const embedding = await embedQuestion(candidate);
      const { isDuplicate, topScore } = await checkDuplicate(embedding);
      if (isDuplicate) {
        summary.rejectedDuplicate += 1;
        console.log(`[generateQuestions] discarded duplicate (score=${topScore.toFixed(3)})`);
        continue;
      }

      const vectorId = await upsertQuestionVector(embedding, { category, seedTopic });
      await insertQuestion(candidate, category, seedTopic, embedding, vectorId);
      summary.accepted += 1;
    }
  }

  return summary;
}

// Allow running directly: `npm run generate:questions`
if (import.meta.url === `file://${process.argv[1]}`) {
  runGenerationPass()
    .then((summary) => {
      console.log('[generateQuestions] pass complete:', summary);
      return pool.end();
    })
    .catch((err) => {
      console.error('[generateQuestions] fatal error', err);
      process.exitCode = 1;
    });
}
