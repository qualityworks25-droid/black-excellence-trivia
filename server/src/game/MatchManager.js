import { randomUUID } from 'node:crypto';
import {
  createMatch,
  recordAnswer,
  advanceQuestion,
  isRoundClinched,
  getScoreSummary,
  Side,
} from './RoundEngine.js';
import { getQuestionsForMatch } from '../db/questionBank.js';
import { persistMatchSnapshot, persistCompletedMatch } from '../db/matches.js';

/**
 * Owns all in-memory live matches, keyed by matchId. Wraps the pure RoundEngine state
 * machine with question delivery, per-question answer gating (first correct answer per
 * side per question counts, teammates' later answers to the same question are ignored),
 * and periodic Postgres checkpointing so a server restart doesn't lose in-flight matches.
 */
export class MatchManager {
  constructor({ io }) {
    this.io = io;
    this.matches = new Map(); // matchId -> { match, questions, answeredSidesThisQuestion, rosters }
  }

  async createMatch({ teamA, teamB }) {
    const matchId = randomUUID();
    const match = createMatch(matchId, teamA.id, teamB.id);
    const questions = await getQuestionsForMatch({ perRound: 9, rounds: 3 });

    this.matches.set(matchId, {
      match,
      questions, // { 1: [q1..q9], 2: [...], 3: [...] }
      rosters: { [Side.A]: teamA, [Side.B]: teamB },
      answeredSidesThisQuestion: new Set(),
    });

    return matchId;
  }

  getCurrentQuestion(matchId) {
    const state = this.matches.get(matchId);
    if (!state) return null;
    const round = state.match.rounds[state.match.rounds.length - 1];
    const questionIndex = round.questionNumber; // 0-based, next question to ask
    return state.questions[round.roundNumber]?.[questionIndex] ?? null;
  }

  /**
   * `userId` submits `choice` on behalf of `side`. Only the first correct-or-incorrect
   * answer recorded per side per question is scored — subsequent teammates' answers to
   * the same question are acknowledged but don't change the score, matching "any
   * teammate can answer for the team."
   */
  submitAnswer(matchId, { side, userId, choice }) {
    const state = this.matches.get(matchId);
    if (!state) throw new Error('Unknown match');

    const sideKey = `${side}`;
    if (state.answeredSidesThisQuestion.has(sideKey)) {
      return { accepted: false, reason: 'side_already_answered' };
    }

    const question = this.getCurrentQuestion(matchId);
    if (!question) throw new Error('No active question');

    const isCorrect = choice === question.correctChoice;
    recordAnswer(state.match, side, isCorrect);
    state.answeredSidesThisQuestion.add(sideKey);

    this.io.to(roomFor(matchId)).emit('match:answer_result', {
      side,
      userId,
      isCorrect,
      scoreSummary: getScoreSummary(state.match),
    });

    let roundJustClosed = false;
    if (state.answeredSidesThisQuestion.size === 2) {
      const wasComplete = state.match.rounds[state.match.rounds.length - 1].isComplete;
      advanceQuestion(state.match);
      state.answeredSidesThisQuestion.clear();
      roundJustClosed = !wasComplete && this._latestClosedRound(state.match);

      persistMatchSnapshot(state.match).catch((err) =>
        console.error('[MatchManager] snapshot persist failed', err),
      );

      if (roundJustClosed) {
        this.io.to(roomFor(matchId)).emit('round:complete', getScoreSummary(state.match));
      }

      if (state.match.status === 'completed') {
        this.io.to(roomFor(matchId)).emit('match:complete', getScoreSummary(state.match));
        persistCompletedMatch(state.match, state.rosters).catch((err) =>
          console.error('[MatchManager] final persist failed', err),
        );
        this.matches.delete(matchId);
        return { accepted: true, matchComplete: true };
      }

      const nextQuestion = this.getCurrentQuestion(matchId);
      if (nextQuestion) {
        this.io.to(roomFor(matchId)).emit('match:question', {
          scoreSummary: getScoreSummary(state.match),
          question: publicQuestion(nextQuestion),
        });
      }
    }

    return { accepted: true, matchComplete: false, roundClinched: isRoundClinched(state.match) };
  }

  _latestClosedRound(match) {
    const round = match.rounds[match.rounds.length - 1];
    return round.isComplete || match.rounds[match.rounds.length - 2]?.isComplete;
  }
}

export function roomFor(matchId) {
  return `match:${matchId}`;
}

/** Strip the correct answer before sending a question to clients. */
export function publicQuestion(question) {
  const { correctChoice, ...rest } = question;
  return rest;
}
