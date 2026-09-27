import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import Flag from 'react-native-country-flag';
import { GlassCard } from './GlassCard';
import { colors } from '../theme/colors';
import type { Player } from '../types/game';

interface PlayerCardProps {
  player: Player;
  accentColor?: string;
}

function winRate(player: Player): number {
  if (player.matchesPlayed === 0) return 0;
  return Math.round((player.matchesWon / player.matchesPlayed) * 100);
}

/** A single opponent/roster card: avatar, flag, name, ELO ("Level of Intelligence"), win rate. */
export function PlayerCard({ player, accentColor = colors.gold }: PlayerCardProps) {
  return (
    <GlassCard style={styles.card} intensity={30}>
      <View style={styles.row}>
        {player.avatarUrl ? (
          <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{player.displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {player.displayName}
            </Text>
            <Flag isoCode={player.countryCode} size={16} style={styles.flag} />
            {player.stateCode ? <Text style={styles.stateBadge}>{player.stateCode}</Text> : null}
          </View>

          <View style={styles.statsRow}>
            <Text style={[styles.eloBadge, { color: accentColor }]}>
              LOI {player.eloRating}
            </Text>
            <Text style={styles.statText}>
              {winRate(player)}% WR · {player.matchesPlayed} played
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  flag: { borderRadius: 3 },
  stateBadge: {
    color: colors.textSecondary,
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  eloBadge: { fontWeight: '700', fontSize: 12 },
  statText: { color: colors.textSecondary, fontSize: 12 },
});
