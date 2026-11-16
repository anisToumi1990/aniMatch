import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor } from '@/constants/Colors';
import { formatRelationshipType, getMatchLevel } from '@/lib/compatibility';
import { ShareCardFrame } from './ShareCardFrame';

interface MatchShareCardProps {
  /** First names; the sharer comes first. */
  nameA: string;
  nameB: string;
  animalA: string;
  animalB: string;
  /** 0-100 */
  score: number;
  relationshipType: string;
}

/** "Our match" story card. */
export function MatchShareCard({ nameA, nameB, animalA, animalB, score, relationshipType }: MatchShareCardProps) {
  const colorA = getAuraColor(animalA);
  const colorB = getAuraColor(animalB);
  const roundedScore = Math.min(Math.max(Math.round(score), 0), 100);
  const level = getMatchLevel(roundedScore);

  return (
    <ShareCardFrame tintColor={colorA} secondaryTintColor={colorB} footerTitle="Are you compatible?">
      <Text style={styles.names} numberOfLines={1} adjustsFontSizeToFit>
        {nameA} & {nameB}
      </Text>
      <View style={styles.avatars}>
        {animalA ? <AuraAvatar animalName={animalA} size="large" /> : null}
        {animalB ? <AuraAvatar animalName={animalB} size="large" style={styles.avatarOverlap} /> : null}
      </View>
      {animalA && animalB ? (
        <Text style={styles.animals}>
          <Text style={{ color: colorA }}>{animalA}</Text>
          <Text style={styles.plus}> + </Text>
          <Text style={{ color: colorB }}>{animalB}</Text>
        </Text>
      ) : null}
      <Text style={[styles.score, { color: level.color }]}>{roundedScore}%</Text>
      <Text style={styles.level}>
        <Text style={{ color: level.color }}>{level.label}</Text>
        <Text style={styles.relationship}>{'  ·  '}{formatRelationshipType(relationshipType)}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${roundedScore}%`, backgroundColor: level.color }]} />
      </View>
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  names: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 22,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarOverlap: {
    marginLeft: -40,
  },
  animals: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 18,
  },
  plus: {
    color: Colors.textMuted,
  },
  score: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '500',
    letterSpacing: -1,
  },
  level: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 18,
  },
  relationship: {
    color: Colors.textSecondary,
  },
  track: {
    width: 200,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
