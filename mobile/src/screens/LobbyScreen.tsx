import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { PlayerCard } from '../components/PlayerCard';
import { colors } from '../theme/colors';
import type { Team } from '../types/game';
import { getSocket } from '../socket';

interface LobbyScreenProps {
  myTeam: Team;
  onMatchStarted: (payload: { matchId: string; teamA: Team; teamB: Team }) => void;
}

/**
 * Matchmaking lobby: browse waiting teams (1v1 up to 5v5, including asymmetrical
 * rosters like 1v4), preview full rosters with ELO/flags, and challenge an opponent.
 */
export function LobbyScreen({ myTeam, onMatchStarted }: LobbyScreenProps) {
  const [waitingTeams, setWaitingTeams] = useState<Team[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('lobby:join', { team: myTeam });

    socket.on('lobby:update', (teams: Team[]) => {
      setWaitingTeams(teams.filter((t) => t.id !== myTeam.id));
    });

    socket.on('match:started', onMatchStarted);

    return () => {
      socket.emit('lobby:leave', { teamId: myTeam.id });
      socket.off('lobby:update');
      socket.off('match:started', onMatchStarted);
    };
  }, [myTeam.id]);

  function challenge(opponent: Team) {
    getSocket().emit('lobby:challenge', { teamId: myTeam.id, opponentTeamId: opponent.id });
  }

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <View style={styles.header}>
          <Text style={styles.title}>Matchmaking Lobby</Text>
          <Text style={styles.subtitle}>
            {waitingTeams.length} team{waitingTeams.length === 1 ? '' : 's'} ready to play
          </Text>
        </View>

        <GlassCard style={styles.myTeamCard} intensity={50}>
          <Text style={styles.sectionLabel}>YOUR TEAM · {myTeam.name}</Text>
          {myTeam.members.map((player) => (
            <PlayerCard key={player.id} player={player} accentColor={colors.teamA} />
          ))}
        </GlassCard>

        <FlatList
          data={waitingTeams}
          keyExtractor={(team) => team.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: team }) => (
            <OpponentTeamRow
              team={team}
              expanded={expandedTeamId === team.id}
              onToggle={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
              onChallenge={() => challenge(team)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Waiting for opponents to enter the lobby…</Text>
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function teamElo(team: Team): number {
  if (team.members.length === 0) return team.teamElo;
  return Math.round(team.members.reduce((sum, p) => sum + p.eloRating, 0) / team.members.length);
}

function OpponentTeamRow({
  team,
  expanded,
  onToggle,
  onChallenge,
}: {
  team: Team;
  expanded: boolean;
  onToggle: () => void;
  onChallenge: () => void;
}) {
  return (
    <GlassCard style={styles.opponentCard} intensity={35}>
      <Pressable onPress={onToggle} style={styles.opponentHeader}>
        <View>
          <Text style={styles.opponentName}>{team.name}</Text>
          <Text style={styles.opponentMeta}>
            {team.members.length} player{team.members.length === 1 ? '' : 's'} · Team LOI{' '}
            {teamElo(team)}
          </Text>
        </View>
        <Pressable style={styles.challengeButton} onPress={onChallenge}>
          <Text style={styles.challengeButtonText}>Challenge</Text>
        </Pressable>
      </Pressable>

      {expanded ? (
        <View style={styles.rosterList}>
          {team.members.map((player) => (
            <PlayerCard key={player.id} player={player} accentColor={colors.teamB} />
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  myTeamCard: { marginHorizontal: 20, marginBottom: 12 },
  sectionLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  opponentCard: { marginBottom: 12 },
  opponentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opponentName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  opponentMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  challengeButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  challengeButtonText: { color: '#1A1200', fontWeight: '700', fontSize: 13 },
  rosterList: { marginTop: 12 },
  emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
