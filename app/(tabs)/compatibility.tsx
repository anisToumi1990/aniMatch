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
import { Colors } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';

/** "business_partner" -> "Business partner" */
function formatRelationshipType(relationshipType: string): string {
  const words = relationshipType.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
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
  const router = useRouter();

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

  const renderCompatibilityItem = ({ item }: { item: CompatibilityResult }) => (
    <Pressable
      onPress={() => handleResultPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`View details for match with ${getOtherUserName(item)}`}
      style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.resultCardHeader}>
        <View style={styles.resultCardText}>
          <ThemedText style={styles.userName}>
            Match with {getOtherUserName(item)}
          </ThemedText>
          <ThemedText type="muted" style={styles.relationshipType}>
            {formatRelationshipType(item.relationship_type)}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
      <View style={styles.scoreContainer}>
        <ThemedText type="secondary" style={styles.scoreLabel}>Compatibility score</ThemedText>
        <ThemedText style={styles.scoreValue}>{Math.round(item.compatibility_score)}%</ThemedText>
      </View>
    </Pressable>
  );

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
    const leftAura = isCurrentUserA ? auraA : auraB; // connected user
    const rightAura = isCurrentUserA ? auraB : auraA; // current user

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
              <ThemedText style={styles.detailScoreValue}>{Math.round(result.compatibility_score)}%</ThemedText>
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
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.textSecondary} />
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : compatibilityResults.length === 0 ? (
              <View style={styles.centerContainer}>
                <ThemedText type="subtitle" style={styles.noResultsTitle}>
                  No compatibility results
                </ThemedText>
                <ThemedText type="secondary" style={styles.noResultsText}>
                  Invite someone to take the quiz or take the quiz yourself!
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
  listContainer: {
    padding: 20,
    paddingTop: 40,
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
    marginBottom: 14,
  },
  resultCardText: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 2,
  },
  relationshipType: {
    fontSize: 14,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardRaised,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  scoreLabel: {
    fontSize: 15,
  },
  scoreValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
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
    marginBottom: 4,
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
