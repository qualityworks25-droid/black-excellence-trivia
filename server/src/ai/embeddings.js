import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';

/** Embeds question text (prompt + correct choice) into a vector for semantic dedup. */
export async function embedQuestion(question) {
  const text = `${question.prompt}\nCorrect answer: ${question.choices[question.correct_choice]}`;
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}
