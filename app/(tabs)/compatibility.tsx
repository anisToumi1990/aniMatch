import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CompatibilityResult {
  id: string;
  user_a_id: string;
  user_b_id: string;
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

export default function CompatibilityScreen() {
  const { user } = useAuth();
  const [compatibilityResults, setCompatibilityResults] = useState<CompatibilityResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const renderCompatibilityItem = ({ item }: { item: CompatibilityResult }) => (
    <ThemedView style={styles.resultCard}>
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
    </ThemedView>
  );

  return (
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
          <ThemedText style={styles.noResultsText}>
            No compatibility results yet. Invite someone to take the quiz!
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
    padding: 20,
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
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  scoreValue: {
    fontSize: 20,
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
}); 