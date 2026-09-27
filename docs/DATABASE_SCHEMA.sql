-- Black Excellence Trivia — PostgreSQL schema
-- Core entities: users, teams, matches/rounds, question bank, crowns, ELO history.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Users & identity
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username            TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  country_code        CHAR(2) NOT NULL,           -- ISO 3166-1 alpha-2, drives flag rendering
  state_code          TEXT,                        -- e.g. "GA", "MD" — for US state flags/badges
  avatar_url          TEXT,
  elo_rating          INTEGER NOT NULL DEFAULT 1200,   -- "Level of Intelligence"
  matches_played      INTEGER NOT NULL DEFAULT 0,
  matches_won         INTEGER NOT NULL DEFAULT 0,
  total_correct        INTEGER NOT NULL DEFAULT 0,
  total_answered       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_elo ON users (elo_rating DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Teams (a team may be a single player for 1v1, or up to 5 for 5v5)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE teams (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  is_ad_hoc           BOOLEAN NOT NULL DEFAULT true,   -- true = formed for one match, false = persistent team
  created_by          UUID REFERENCES users(id),
  team_elo            INTEGER NOT NULL DEFAULT 1200,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Question bank (populated by the AI generation pipeline; see docs/ARCHITECTURE.md)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE question_category AS ENUM (
  'stem_excellence',
  'business_real_estate',
  'thriving_communities',
  'entertainment_culture'
);

CREATE TABLE question_bank (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category            question_category NOT NULL,
  seed_topic          TEXT NOT NULL,               -- the rotating seed topic that produced this question
  prompt              TEXT NOT NULL,
  choice_a            TEXT NOT NULL,
  choice_b            TEXT NOT NULL,
  choice_c            TEXT NOT NULL,
  choice_d            TEXT NOT NULL,
  correct_choice      CHAR(1) NOT NULL CHECK (correct_choice IN ('A', 'B', 'C', 'D')),
  explanation         TEXT NOT NULL,
  difficulty          SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  vector_id           TEXT NOT NULL,               -- id of this question's vector in the vector store
  generated_by_model  TEXT NOT NULL,               -- e.g. "claude-sonnet-5"
  times_used          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_bank_category ON question_bank (category, times_used);

-- ─────────────────────────────────────────────────────────────────────────────
-- Matches, rounds, and per-question answers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE match_status AS ENUM ('lobby', 'in_progress', 'completed', 'abandoned');

CREATE TABLE matches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status              match_status NOT NULL DEFAULT 'lobby',
  team_a_id           UUID NOT NULL REFERENCES teams(id),
  team_b_id           UUID NOT NULL REFERENCES teams(id),
  rounds_won_a        SMALLINT NOT NULL DEFAULT 0,
  rounds_won_b        SMALLINT NOT NULL DEFAULT 0,
  winner_team_id      UUID REFERENCES teams(id),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE match_participants (
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id),
  team_id             UUID NOT NULL REFERENCES teams(id),
  elo_before          INTEGER NOT NULL,
  elo_after           INTEGER,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE rounds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number        SMALLINT NOT NULL CHECK (round_number BETWEEN 1 AND 3),
  team_a_correct      SMALLINT NOT NULL DEFAULT 0,
  team_b_correct      SMALLINT NOT NULL DEFAULT 0,
  questions_answered  SMALLINT NOT NULL DEFAULT 0,      -- out of 9
  clinched_at_question SMALLINT,                          -- which question number reached 5-correct (if any)
  winner_team_id      UUID REFERENCES teams(id),
  completed_at        TIMESTAMPTZ,
  UNIQUE (match_id, round_number)
);

CREATE TABLE round_answers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id            UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  question_id         UUID NOT NULL REFERENCES question_bank(id),
  question_number     SMALLINT NOT NULL CHECK (question_number BETWEEN 1 AND 9),
  team_id             UUID NOT NULL REFERENCES teams(id),
  user_id             UUID NOT NULL REFERENCES users(id),   -- who buzzed in the answer for the team
  choice              CHAR(1) NOT NULL CHECK (choice IN ('A', 'B', 'C', 'D')),
  is_correct          BOOLEAN NOT NULL,
  answered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  latency_ms          INTEGER
);

CREATE INDEX idx_round_answers_round ON round_answers (round_id, question_number);

-- ─────────────────────────────────────────────────────────────────────────────
-- Rewards: digital gold crowns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE crowns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id),
  team_id             UUID NOT NULL REFERENCES teams(id),
  engraved_name       TEXT NOT NULL,   -- team/player name at time of win, immutable even if renamed later
  awarded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_crowns (
  user_id             UUID NOT NULL REFERENCES users(id),
  crown_id            UUID NOT NULL REFERENCES crowns(id),
  PRIMARY KEY (user_id, crown_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ELO ("Level of Intelligence") history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE elo_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  match_id            UUID NOT NULL REFERENCES matches(id),
  elo_before          INTEGER NOT NULL,
  elo_after           INTEGER NOT NULL,
  delta               INTEGER NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_elo_history_user ON elo_history (user_id, recorded_at DESC);
