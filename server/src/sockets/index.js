import { MatchManager, roomFor, publicQuestion } from '../game/MatchManager.js';

const lobby = {
  waitingTeams: new Map(), // teamId -> { team, socketId }
};

export function registerSocketHandlers(io) {
  const matchManager = new MatchManager({ io });

  io.on('connection', (socket) => {
    socket.on('lobby:join', ({ team }) => {
      lobby.waitingTeams.set(team.id, { team, socketId: socket.id });
      socket.join('lobby');
      io.to('lobby').emit('lobby:update', rosterList());
    });

    socket.on('lobby:leave', ({ teamId }) => {
      lobby.waitingTeams.delete(teamId);
      io.to('lobby').emit('lobby:update', rosterList());
    });

    /**
     * Challenge flow: teamId challenges opponentTeamId. Supports asymmetrical sizes
     * (e.g. a 1-person team challenging a 4-person team) — MatchManager doesn't care
     * about roster size symmetry, only aggregate correct-answer counts per side.
     */
    socket.on('lobby:challenge', async ({ teamId, opponentTeamId }) => {
      const teamEntry = lobby.waitingTeams.get(teamId);
      const opponentEntry = lobby.waitingTeams.get(opponentTeamId);
      if (!teamEntry || !opponentEntry) {
        socket.emit('lobby:error', { message: 'One of the teams is no longer in the lobby.' });
        return;
      }

      const matchId = await matchManager.createMatch({
        teamA: teamEntry.team,
        teamB: opponentEntry.team,
      });

      lobby.waitingTeams.delete(teamId);
      lobby.waitingTeams.delete(opponentTeamId);
      io.to('lobby').emit('lobby:update', rosterList());

      for (const memberSocketId of [teamEntry.socketId, opponentEntry.socketId]) {
        io.sockets.sockets.get(memberSocketId)?.join(roomFor(matchId));
      }

      const firstQuestion = matchManager.getCurrentQuestion(matchId);
      io.to(roomFor(matchId)).emit('match:started', {
        matchId,
        teamA: teamEntry.team,
        teamB: opponentEntry.team,
        question: publicQuestion(firstQuestion),
      });
    });

    socket.on('match:submit_answer', ({ matchId, side, userId, choice }) => {
      try {
        const result = matchManager.submitAnswer(matchId, { side, userId, choice });
        socket.emit('match:answer_ack', result);
      } catch (err) {
        socket.emit('match:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      for (const [teamId, entry] of lobby.waitingTeams) {
        if (entry.socketId === socket.id) lobby.waitingTeams.delete(teamId);
      }
      io.to('lobby').emit('lobby:update', rosterList());
    });
  });
}

function rosterList() {
  return Array.from(lobby.waitingTeams.values()).map((entry) => entry.team);
}
