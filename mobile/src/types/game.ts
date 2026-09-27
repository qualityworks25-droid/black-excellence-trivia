export interface Player {
  id: string;
  displayName: string;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "US"
  stateCode?: string; // e.g. "GA", "MD" — for US state badges
  avatarUrl?: string;
  eloRating: number; // "Level of Intelligence"
  matchesPlayed: number;
  matchesWon: number;
}

export interface Team {
  id: string;
  name: string;
  members: Player[];
  teamElo: number;
}

export type QuestionCategory =
  | 'stem_excellence'
  | 'business_real_estate'
  | 'thriving_communities'
  | 'entertainment_culture';

export interface Question {
  id: string;
  category: QuestionCategory;
  prompt: string;
  choices: { A: string; B: string; C: string; D: string };
  difficulty: 1 | 2 | 3 | 4 | 5;
  // correctChoice intentionally omitted from the client-facing type — the server never
  // sends it until the question is answered.
}

export interface RoundSummary {
  roundNumber: number;
  correct: { A: number; B: number };
  questionNumber: number;
  clinchedBy: 'A' | 'B' | null;
  isComplete: boolean;
  winner: 'A' | 'B' | null;
}

export interface ScoreSummary {
  roundsWon: { A: number; B: number };
  currentRound: number;
  rounds: RoundSummary[];
  status: 'in_progress' | 'completed';
  winnerSide: 'A' | 'B' | null;
}
