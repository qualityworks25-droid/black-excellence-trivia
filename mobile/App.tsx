import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LobbyScreen } from './src/screens/LobbyScreen';
import type { Team } from './src/types/game';

// Placeholder "signed-in" team until auth/profile screens are wired up — swap for
// whatever the auth flow resolves to.
const DEMO_TEAM: Team = {
  id: 'demo-team-1',
  name: 'The Innovators',
  teamElo: 1450,
  members: [
    {
      id: 'demo-user-1',
      displayName: 'Amara J.',
      countryCode: 'US',
      stateCode: 'GA',
      eloRating: 1480,
      matchesPlayed: 32,
      matchesWon: 21,
    },
  ],
};

export default function App() {
  const [, setMatchId] = useState<string | null>(null);

  // MatchScreen (question flow, live scoreboard, crown ceremony) is the next screen to
  // build — see docs/ARCHITECTURE.md for the event contract it consumes. Once it
  // exists, render it here when matchId is set instead of staying on the lobby.
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <LobbyScreen myTeam={DEMO_TEAM} onMatchStarted={(payload) => setMatchId(payload.matchId)} />
    </SafeAreaProvider>
  );
}
