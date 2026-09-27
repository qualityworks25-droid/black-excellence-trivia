import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './sockets/index.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// REST endpoints for non-realtime data would live here: auth, profile, leaderboard,
// match history, crown gallery. Omitted from this boilerplate — see docs/ARCHITECTURE.md.

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
});

registerSocketHandlers(io);

const port = process.env.PORT ?? 4000;
server.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});
