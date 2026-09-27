# Black Excellence Trivia

A premium, real-time, team-based trivia game (Expo / React Native, targeting iOS) celebrating
Black American excellence, history, and culture — STEM pioneers, business & real estate moguls,
thriving Black communities, and entertainment/culture innovators.

This repo is a **boilerplate / architecture scaffold**: it wires up the full system end-to-end
(lobby UI, real-time match engine, AI question-generation pipeline) with working reference code
for every major subsystem. It is a starting point to build from, not a finished, shipped app —
no signing credentials, store listings, or production secrets are included or implied.

## Repo layout

```
black-excellence-trivia/
├── docs/
│   ├── ARCHITECTURE.md        full system architecture
│   ├── DATABASE_SCHEMA.sql    Postgres schema (users, teams, matches, question bank, crowns)
│   ├── AI_SYSTEM_PROMPT.md    system prompt used by the question-generation workers
│   ├── EAS_SETUP.md           building & submitting the iOS app to the App Store via EAS
│   └── preview.html           static HTML preview of the lobby/match/crown screens
├── server/                    Node.js backend: Express + Socket.io + Postgres + vector dedup
│   └── src/
│       ├── game/              round/match state machine ("first to 5 of 9", best of 3)
│       ├── sockets/            Socket.io event handlers (lobby, matchmaking, live answers)
│       ├── ai/                 AI question generation workers + embedding dedup
│       └── db/                 Postgres connection pool
└── mobile/                    Expo React Native app (iOS-first)
    └── src/
        ├── screens/            LobbyScreen (glassmorphism matchmaking UI)
        ├── components/         GlassCard, PlayerCard (BlurView-based glass UI)
        ├── theme/               color tokens
        └── types/               shared game types
```

## Quick start

### Server
```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, OPENAI_API_KEY, PINECONE_API_KEY, etc.
npm install
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

### Building the iOS app for TestFlight / the App Store
See [`docs/EAS_SETUP.md`](docs/EAS_SETUP.md) — this has to run from your own Mac since it involves
logging into your personal Expo and Apple accounts.

## Design notes

- **Never commit secrets.** `.env` files, API keys, and signing credentials are gitignored.
  The `.env.example` files list required variables without values.
- The AI question-generation worker (`server/src/ai/generateQuestions.js`) is written against a
  generic LLM + embeddings + vector-store interface so you can swap providers (OpenAI/Claude for
  generation, Pinecone/Weaviate for the vector store) without touching game logic.
- The round/match engine (`server/src/game/RoundEngine.js`) is pure state-machine logic with no
  I/O, so it's unit-testable independent of Socket.io or the database.
- The mobile lobby screen uses `expo-blur`'s `<BlurView>` for the glassmorphism effect. No native
  "glass effect" package is required — `expo-blur` alone is sufficient and well-supported on iOS.
