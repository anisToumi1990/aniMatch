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
import { AnimalIcon } from '@/components/AnimalIcon';

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
      <ThemedText style={styles.userName}>
        Match with {getOtherUserName(item)}
      </ThemedText>
      <ThemedText style={styles.relationshipType}>
        {item.relationship_type.replace('_', ' ').toUpperCase()}
      </ThemedText>
      <View style={styles.scoreContainer}>
        <ThemedText style={styles.scoreLabel}>Compatibility Score</ThemedText>
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
      <ThemedText key={idx}>{sentence.trim()}</ThemedText>
    ));
  }


  function renderDetailView(result: CompatibilityResult) {
    const isCurrentUserA = user?.id === result.user_a_id;
    const leftAura = isCurrentUserA ? auraA : auraB; // connected user
    const rightAura = isCurrentUserA ? auraB : auraA; // current user

    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.detailHeader}>
          <Pressable
            onPress={() => setSelectedResult(null)}
            accessibilityRole="button"
            accessibilityLabel="Go back to compatibility results"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </Pressable>
          <ThemedText style={styles.detailTitle}>Relationship Details</ThemedText>
        </View>
        <ScrollView contentContainerStyle={styles.detailScrollContent}>
          <View style={[styles.detailContent, styles.auraCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              {isAuraLoading ? <ActivityIndicator size="large" /> : leftAura && <AnimalIcon animalName={leftAura.name} width={120} height={120} />}
              <ThemedText style={styles.auraArrow}>⇄</ThemedText>
              {isAuraLoading ? <ActivityIndicator size="large" /> : rightAura && <AnimalIcon animalName={rightAura.name} width={120} height={120} />}
            </View>
            <ThemedText style={styles.detailUserName}>
              Match with : {getOtherUserName(result)}
            </ThemedText>
            <ThemedText style={styles.detailRelationshipType}>
              {result.relationship_type.replace('_', ' ').toUpperCase()}
            </ThemedText>
            <View style={styles.detailScoreContainer}>
              <ThemedText style={styles.detailScoreValue}>{Math.round(result.compatibility_score)}%</ThemedText>
            </View>
            {isInsightLoading ? (
              <View style={{ marginTop: 24 }}>
                <ActivityIndicator size="small" />
              </View>
            ) : insightError ? (
              <ThemedText style={{ color: '#FF3B30', marginTop: 24 }}>{insightError}</ThemedText>
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
                  <ThemedText style={styles.sectionTitle}>Tips for Improvement</ThemedText>
                  {renderTextList(insight.tips)}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return selectedResult ? (
    renderDetailView(selectedResult)
  ) : (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Compatibility',
          headerShown: true,
        }}
      />
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : compatibilityResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <ThemedText type="subtitle" style={styles.noResultsText}>
            No compatibility results
          </ThemedText>
          <ThemedText style={styles.noResultsText}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  resultCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  relationshipType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'FFFFFF',
    padding: 12,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  scoreValue: {
    fontSize: 25,
    fontWeight: '700',
    color: '#38B6FF',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
  },
  noResultsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  detailScrollContent: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  detailContent: {
    flex: 1,
    padding: 24,
    alignItems: 'flex-start',
  },
  detailUserName: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailRelationshipType: {
    fontSize: 16,
    color: '#666',
    marginBottom:5,
  },
  detailScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailScoreLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  detailScoreValue: {
    fontSize: 45,
    fontWeight: '700',
    color: '#38B6FF',
    lineHeight: 50,
  },
  detailDate: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  auraArrow: {
    fontSize: 25,
    fontWeight: '900',
    color: '#222',
  },
  auraName: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  auraCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
}); 