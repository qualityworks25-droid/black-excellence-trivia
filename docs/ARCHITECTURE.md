# System Architecture

## 1. Overview

```
┌──────────────────────┐        WebSocket (Socket.io)        ┌──────────────────────────┐
│   Expo / React Native │ ◄──────────────────────────────────► │   Node.js Game Server     │
│   iOS client           │        HTTPS (REST: auth, profile)  │   Express + Socket.io      │
└──────────────────────┘ ◄──────────────────────────────────► └──────────────────────────┘
                                                                       │
                                                                       │ SQL
                                                                       ▼
                                                              ┌──────────────────┐
                                                              │   PostgreSQL      │
                                                              │  users / teams /   │
                                                              │  matches / rounds /│
                                                              │  question_bank /   │
                                                              │  crowns / elo_log  │
                                                              └──────────────────┘

┌───────────────────────────── Question Generation Pipeline (offline, cron/worker) ─────────────┐
│                                                                                                   │
│  seed topics ──► LLM (OpenAI/Claude) ──► candidate MCQ ──► embedding model ──► vector similarity  │
│                                                                     search against vector DB       │
│                                                                     (Pinecone/Weaviate)            │
│                                                                        │                            │
│                                            similarity > 0.85 ─────────┼──── discard (duplicate)    │
│                                                                        │                            │
│                                            similarity ≤ 0.85 ─────────┴──── insert into Postgres   │
│                                                                              question_bank + vector │
│                                                                              store (for future dedup)│
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Frontend (Expo / React Native, iOS)

- **Navigation**: React Navigation (native-stack) — `Home → Lobby → Match → RoundSummary → CrownCeremony`.
- **Realtime**: a single `socket.io-client` connection managed by a `SocketProvider` context, exposing
  typed events (`lobby:update`, `match:question`, `match:answer_result`, `round:complete`, `match:complete`).
- **State**: React Query for REST data (profile, leaderboards, match history), local component state /
  context for live match state driven by socket events.
- **Visuals**: `expo-blur`'s `<BlurView intensity={40} tint="dark">` for glass cards, `react-native-reanimated`
  for transitions (card entrance, crown reveal, score pulses). Glass panels float over a gradient/animated
  background (`expo-linear-gradient` or a looping video/Lottie background).

## 3. Backend (Node.js + Socket.io)

- **Express** serves REST endpoints: auth, profile, leaderboard, match history, crown gallery.
- **Socket.io** handles everything realtime:
  - `lobby` namespace: presence, matchmaking, team formation, roster preview.
  - `match:<matchId>` room: question delivery, answer submission, live scoreboard, round/match completion.
- **MatchManager** (`server/src/game/MatchManager.js`) owns in-memory match state, keyed by matchId,
  backed by `RoundEngine` for the round rules and periodically checkpointed to Postgres so a server
  restart doesn't lose in-flight matches.
- **RoundEngine** (`server/src/game/RoundEngine.js`) is the pure game-logic module implementing:
  - up to 9 questions per round, round ends when a side reaches 5 correct **or** all 9 are answered;
  - best-of-3 rounds decides the match;
  - supports 1v1 up to 5v5, and asymmetrical rosters (e.g. 1v4) — scoring is per-side aggregate correct
    answers, not per-capita, so team size doesn't need to be symmetrical.
- **ELO ("Level of Intelligence")**: updated per match using a standard ELO update with a K-factor tuned
  for trivia (K=24 default), computed per team by treating the team's aggregate as one entity, and
  distributed proportionally to individual contribution (correct-answer share) to each player's personal
  ELO.

## 4. Database (PostgreSQL)

See `DATABASE_SCHEMA.sql`. Core tables: `users`, `teams`, `team_members`, `matches`, `match_participants`,
`rounds`, `round_answers`, `question_bank`, `crowns`, `elo_history`.

## 5. AI Question Generation Pipeline (RAG-style dedup)

Goal: an effectively infinite, non-repetitive question pool without manual entry.

1. **Seed topics** — a rotating list of specific prompts within the four categories (STEM Excellence,
   Business & Real Estate Moguls, Thriving Black Communities, Entertainment & Culture Pioneers), e.g.
   "19th-century Black inventors", "Modern R&B producers", "Baldwin Hills real estate history".
2. **Generation worker** (`server/src/ai/generateQuestions.js`) — a long-running or cron-triggered worker
   that sends a seed topic + the system prompt (`AI_SYSTEM_PROMPT.md`) to an LLM API, requesting a batch
   of strict 4-option MCQs with a correct answer and short explanation, as JSON.
3. **Embedding** (`server/src/ai/embeddings.js`) — each candidate question's text is embedded via an
   embedding model (e.g. `text-embedding-3-small`).
4. **Semantic dedup** (`server/src/ai/vectorStore.js`) — the embedding is compared via cosine similarity
   against existing vectors in the vector database (Pinecone/Weaviate). If the top match exceeds the
   configured threshold (default 0.85), the question is discarded as a near-duplicate. Otherwise it's
   accepted.
5. **Commit** — accepted questions are inserted into `question_bank` (Postgres, source of truth for
   gameplay) and the vector is upserted into the vector store (source of truth for future dedup checks).

This keeps question generation, validation, and storage cleanly separated: gameplay only ever reads from
Postgres; the vector store exists purely to prevent semantic repeats as the bank scales.

## 6. Player modes & matchmaking

- Lobby supports 1v1 through 5v5, plus asymmetrical rosters (e.g. 1v4), matched by aggregate team ELO
  rather than per-player ELO, so uneven team sizes stay competitive.
- Players can matchmake with anyone nationwide; region is metadata (state/country flag) for identity, not
  a matchmaking constraint.
- Team rosters and names are visible to both sides before the match starts (see `LobbyScreen.tsx`).

## 7. Reward: Digital Gold Crown

On match completion, the winning side's `crowns` row is inserted with the team/player name "engraved" (a
denormalized `engraved_name` field so the crown's inscription is immutable even if the team is renamed
later) and displayed on the winner's profile via a `GET /profiles/:id/crowns` endpoint.
