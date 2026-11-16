import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuraAvatar } from '@/components/AuraAvatar';
import { ScreenBackground } from '@/components/ScreenBackground';
import { Colors, MatchLevelColors, getAuraColor, withAlpha } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { AuraButton } from '@/components/AuraButton';
import { InviteModal } from '@/components/InviteModal';
import { InviteLinkRoute } from '@/components/InviteForm';

/** "business_partner" -> "Business partner" */
function formatRelationshipType(relationshipType: string): string {
  const words = relationshipType.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const RELATIONSHIP_ICONS: Record<string, IoniconName> = {
  lover: 'heart',
  family: 'home',
  friend: 'people',
  business_partner: 'briefcase',
};

function getRelationshipIcon(relationshipType: string): IoniconName {
  return RELATIONSHIP_ICONS[relationshipType] ?? 'people';
}

interface MatchLevel {
  label: string;
  color: string;
}

/** 75-100: strong, 50-74: good, under 50: needs effort. */
function getMatchLevel(score: number): MatchLevel {
  if (score >= 75) return { label: 'Strong match', color: MatchLevelColors.strong };
  if (score >= 50) return { label: 'Good match', color: MatchLevelColors.good };
  return { label: 'Needs effort', color: MatchLevelColors.needsEffort };
}

interface CompatibilityResult {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_aura_id: number;
  user_b_aura_id: number;
  compatibility_score: number;
  relationship_type: 'lover' | 'business_partner' | 'family';
  created_at: string;
  user_a: {
    full_name: string;
  };
  user_b: {
    full_name: string;
  };
}

interface CompatibilityInsightTemplate {
  id: string;
  relationship_type: 'lover' | 'business_partner' | 'family';
  score_range_min: number;
  score_range_max: number;
  strengths: string;
  challenges: string;
  tips: string;
}

interface AnimalAura {
  id: number;
  name: string;
  icon_url: string;
}

export default function CompatibilityScreen() {
  const { user } = useAuth();
  const [compatibilityResults, setCompatibilityResults] = useState<CompatibilityResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<CompatibilityResult | null>(null);
  const [insight, setInsight] = useState<CompatibilityInsightTemplate | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [auraA, setAuraA] = useState<AnimalAura | null>(null);
  const [auraB, setAuraB] = useState<AnimalAura | null>(null);
  const [isAuraLoading, setIsAuraLoading] = useState(false);
  const [auraNamesById, setAuraNamesById] = useState<Record<number, string>>({});
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const router = useRouter();

  // "See your match in Compatibility" just closes the popup: we're already here.
  function handleInviteLinkPress(route: InviteLinkRoute) {
    if (route === '/(tabs)/compatibility') return;
    router.navigate(route);
  }

  // Aura names for the avatars on each card (read-only, loaded once).
  useEffect(() => {
    let isCancelled = false;

    async function loadAuraNames() {
      try {
        const { data, error } = await supabase.from('animal_auras').select('id, name');
        if (error) throw error;
        if (isCancelled) return;
        const names: Record<number, string> = {};
        (data ?? []).forEach((aura: { id: number; name: string }) => {
          names[aura.id] = aura.name;
        });
        setAuraNamesById(names);
      } catch (loadError) {
        console.error('Error loading aura names:', loadError);
      }
    }

    loadAuraNames();
    return () => {
      isCancelled = true;
    };
  }, []);

  const fetchCompatibilityResults = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('compatibility_results')
        .select(`
          *,
          user_a:user_a_id(full_name),
          user_b:user_b_id(full_name)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
      if (error) throw error;
      setCompatibilityResults(data || []);
    } catch (err) {
      setError('Failed to load compatibility results');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchCompatibilityResults();

    const subscription = supabase
      .from('compatibility_results')
      .on('*', payload => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (row.user_a_id === user.id || row.user_b_id === user.id) {
          fetchCompatibilityResults();
        }
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, [user?.id, fetchCompatibilityResults]);

  const getOtherUserName = (result: CompatibilityResult) => {
    if (!user?.id) return 'Unknown User';
    
    if (result.user_a_id === user.id) {
      return result.user_b?.full_name || 'Unknown User';
    }
    return result.user_a?.full_name || 'Unknown User';
  };

  async function fetchInsight(result: CompatibilityResult) {
    setIsInsightLoading(true);
    setInsightError(null);
    setInsight(null);
    const { data, error } = await supabase
      .from('compatibility_insight_templates')
      .select('*')
      .eq('relationship_type', result.relationship_type)
      .lte('score_range_min', result.compatibility_score)
      .gte('score_range_max', result.compatibility_score)
      .maybeSingle();
    if (error) setInsightError('Failed to load insights');
    setInsight(data || null);
    setIsInsightLoading(false);
  }

  async function fetchAuras(result: CompatibilityResult) {
    setIsAuraLoading(true);
    setAuraA(null);
    setAuraB(null);
    try {
      const [{ data: dataA }, { data: dataB }] = await Promise.all([
        supabase.from('animal_auras').select('id, name, icon_url').eq('id', result.user_a_aura_id).maybeSingle(),
        supabase.from('animal_auras').select('id, name, icon_url').eq('id', result.user_b_aura_id).maybeSingle(),
      ]);
      setAuraA(dataA || null);
      setAuraB(dataB || null);
    } catch (e) {
      setAuraA(null);
      setAuraB(null);
    } finally {
      setIsAuraLoading(false);
    }
  }

  const handleResultPress = (item: CompatibilityResult) => {
    setSelectedResult(item);
    fetchInsight(item);
    fetchAuras(item);
  };

  const renderCompatibilityItem = ({ item }: { item: CompatibilityResult }) => {
    const isCurrentUserA = user?.id === item.user_a_id;
    const myAuraName = auraNamesById[isCurrentUserA ? item.user_a_aura_id : item.user_b_aura_id] ?? '';
    const otherAuraName = auraNamesById[isCurrentUserA ? item.user_b_aura_id : item.user_a_aura_id] ?? '';
    const otherAuraColor = getAuraColor(otherAuraName);
    const score = Math.round(item.compatibility_score);
    const level = getMatchLevel(score);
    const otherName = getOtherUserName(item);

    return (
      <Pressable
        onPress={() => handleResultPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`View details for match with ${otherName}`}
        style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.resultCardHeader}>
          <View style={styles.avatarPair}>
            <AuraAvatar animalName={myAuraName} size="small" />
            <AuraAvatar animalName={otherAuraName} size="small" style={styles.avatarOverlap} />
          </View>
          <View style={styles.resultCardText}>
            <ThemedText style={[styles.userName, { color: otherAuraColor }]} numberOfLines={1}>
              {otherName}
            </ThemedText>
            <View style={styles.metaRow}>
              {otherAuraName ? (
                <ThemedText type="muted" style={styles.animalName}>{otherAuraName}</ThemedText>
              ) : null}
              <View
                style={[
                  styles.relationshipTag,
                  { borderColor: withAlpha(otherAuraColor, 0.45), backgroundColor: withAlpha(otherAuraColor, 0.12) },
                ]}
              >
                <Ionicons name={getRelationshipIcon(item.relationship_type)} size={11} color={otherAuraColor} />
                <ThemedText style={[styles.relationshipTagText, { color: otherAuraColor }]}>
                  {formatRelationshipType(item.relationship_type)}
                </ThemedText>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </View>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreRow}>
            <ThemedText style={[styles.scoreValue, { color: level.color }]}>{score}%</ThemedText>
            <ThemedText style={[styles.scoreLevel, { color: level.color }]}>{level.label}</ThemedText>
          </View>
          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreFill,
                { width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: level.color },
              ]}
            />
          </View>
        </View>
      </Pressable>
    );
  };

  function renderTextList(text: string[] | string) {
    const sentences = Array.isArray(text)
      ? text
      : typeof text === 'string'
      ? text.split(',')
      : [];

    return sentences.map((sentence, idx) => (
      <ThemedText key={idx} type="secondary" style={styles.listItem}>{sentence.trim()}</ThemedText>
    ));
  }


  function renderDetailView(result: CompatibilityResult) {
    const isCurrentUserA = user?.id === result.user_a_id;
    // auraA belongs to user_a, auraB to user_b.
    const leftAura = isCurrentUserA ? auraB : auraA; // connected user
    const rightAura = isCurrentUserA ? auraA : auraB; // current user

    return (
      <SafeAreaView style={styles.container}  edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.detailScrollContent}>
          <View style={[styles.detailContent, styles.auraCard]}>
            <View style={styles.aurasRow}>
              <View style={styles.auraColumn}>
                {isAuraLoading ? (
                  <ActivityIndicator size="large" color={Colors.textSecondary} style={styles.auraLoader} />
                ) : leftAura ? (
                  <AuraAvatar animalName={leftAura.name} size="medium" />
                ) : null}
                <ThemedText style={styles.auraPersonName} numberOfLines={1}>{getOtherUserName(result)}</ThemedText>
                {leftAura ? <ThemedText type="muted" style={styles.auraName}>{leftAura.name}</ThemedText> : null}
              </View>
              <View style={styles.auraLink}>
                <Ionicons name="swap-horizontal" size={20} color={Colors.textMuted} />
              </View>
              <View style={styles.auraColumn}>
                {isAuraLoading ? (
                  <ActivityIndicator size="large" color={Colors.textSecondary} style={styles.auraLoader} />
                ) : rightAura ? (
                  <AuraAvatar animalName={rightAura.name} size="medium" />
                ) : null}
                <ThemedText style={styles.auraPersonName} numberOfLines={1}>You</ThemedText>
                {rightAura ? <ThemedText type="muted" style={styles.auraName}>{rightAura.name}</ThemedText> : null}
              </View>
            </View>
            <View style={styles.detailSummary}>
              <ThemedText style={[styles.detailScoreValue, { color: getMatchLevel(Math.round(result.compatibility_score)).color }]}>
                {Math.round(result.compatibility_score)}%
              </ThemedText>
              <ThemedText style={[styles.detailScoreLevel, { color: getMatchLevel(Math.round(result.compatibility_score)).color }]}>
                {getMatchLevel(Math.round(result.compatibility_score)).label}
              </ThemedText>
              <ThemedText type="secondary" style={styles.detailUserName}>
                Match with {getOtherUserName(result)}
              </ThemedText>
              <ThemedText type="muted" style={styles.detailRelationshipType}>
                {formatRelationshipType(result.relationship_type)}
              </ThemedText>
            </View>
            {isInsightLoading ? (
              <View style={{ marginTop: 24, alignSelf: 'center' }}>
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              </View>
            ) : insightError ? (
              <ThemedText style={styles.errorText}>{insightError}</ThemedText>
            ) : insight ? (
              <>
                <View style={styles.sectionContainer}>
                  <ThemedText style={styles.sectionTitle}>Strengths</ThemedText>
                  {renderTextList(insight.strengths)}
                </View>
                <View style={styles.sectionContainer}>
                  <ThemedText style={styles.sectionTitle}>Challenges</ThemedText>
                  {renderTextList(insight.challenges)}
                </View>
                <View style={styles.sectionContainer}>
                  <ThemedText style={styles.sectionTitle}>Tips for improvement</ThemedText>
                  {renderTextList(insight.tips)}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: selectedResult ? 'Relationship details' : 'Compatibility',
            headerLeft: () => selectedResult ? (
              <Pressable
                onPress={() => setSelectedResult(null)}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
              </Pressable>
            ) : null,
          }}
        />
        {selectedResult ? (
          renderDetailView(selectedResult)
        ) : (
          <View style={styles.container}>
            <View style={styles.inviteBar}>
              <AuraButton
                label="Invite someone"
                icon="person-add"
                onPress={() => setIsInviteOpen(true)}
                style={styles.inviteButton}
              />
            </View>
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.textSecondary} />
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : compatibilityResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ThemedText type="subtitle" style={styles.noResultsTitle}>
                  No matches yet
                </ThemedText>
                <ThemedText type="secondary" style={styles.noResultsText}>
                  Invite someone to see how your auras match. Once they accept and you&apos;ve both taken the quiz, your match shows up here.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={compatibilityResults}
                renderItem={renderCompatibilityItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
              />
            )}
          </View>
        )}
        <InviteModal
          visible={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          onLinkPress={handleInviteLinkPress}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  inviteBar: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  // Primary pill with a soft light glow (shadow* props also render on web).
  inviteButton: {
    alignSelf: 'stretch',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  listContainer: {
    padding: 20,
    paddingTop: 24,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  resultCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPair: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarOverlap: {
    marginLeft: -18,
  },
  resultCardText: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  animalName: {
    fontSize: 14,
  },
  relationshipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  relationshipTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  scoreContainer: {
    backgroundColor: Colors.cardRaised,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  scoreLevel: {
    fontSize: 14,
    fontWeight: '500',
  },
  scoreTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 2,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
    marginTop: 24,
  },
  noResultsTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsText: {
    textAlign: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailScrollContent: {
    flexGrow: 1,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  detailContent: {
    flex: 1,
    padding: 24,
    alignItems: 'flex-start',
  },
  aurasRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  auraColumn: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 160,
  },
  auraLoader: {
    height: 96,
  },
  auraLink: {
    height: 96,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  auraPersonName: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  auraName: {
    fontSize: 13,
    textAlign: 'center',
  },
  detailSummary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingBottom: 24,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailUserName: {
    fontSize: 16,
    marginBottom: 2,
  },
  detailRelationshipType: {
    fontSize: 14,
  },
  detailScoreValue: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '500',
  },
  detailScoreLevel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 8,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 23,
  },
  auraCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginVertical: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
});
