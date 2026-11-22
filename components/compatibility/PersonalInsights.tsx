import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { PersonalInsights as PersonalInsightsData } from '@/lib/personalInsights';
import { fetchPersonalInsights } from '@/lib/supabase/personalInsights';

interface PersonalInsightsProps {
  /** compatibility_results.id of the open match. */
  resultId: number | string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; insights: PersonalInsightsData }
  /** One of the two people has no quiz result yet. */
  | { status: 'empty' }
  | { status: 'error' };

/**
 * Match detail insights (docs/pair-insights-proposal.md): "The two of you" (their card
 * and a "You" card), pair Strengths and Challenges, then 3 Tips about them. All texts
 * are picked and filled by the database; the app never sees trait scores.
 */
export function PersonalInsights({ resultId }: PersonalInsightsProps) {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${resultId}|${reloadCount}`;
  const [result, setResult] = useState<{ key: string; state: LoadState } | null>(null);
  // Loading until the answer for the current match (and retry) arrives.
  const state: LoadState = result?.key === requestKey ? result.state : { status: 'loading' };

  useEffect(() => {
    let isCancelled = false;
    fetchPersonalInsights(resultId)
      .then(insights => {
        if (!isCancelled) setResult({ key: requestKey, state: insights ? { status: 'ready', insights } : { status: 'empty' } });
      })
      .catch(error => {
        console.error('Error loading personal insights:', error);
        if (!isCancelled) setResult({ key: requestKey, state: { status: 'error' } });
      });
    return () => {
      isCancelled = true;
    };
  }, [resultId, requestKey]);

  const retry = useCallback(() => setReloadCount(count => count + 1), []);

  if (state.status === 'loading') {
    return (
      <View style={styles.placeholder} accessibilityLabel="Loading insights">
        <ActivityIndicator size="small" color={Colors.textSecondary} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.placeholder} accessibilityLiveRegion="polite">
        <ThemedText style={styles.errorText}>Couldn&apos;t load your insights. Check your connection.</ThemedText>
        <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
          <Ionicons name="refresh" size={14} color={Colors.text} />
          <ThemedText style={styles.retryText}>Try again</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (state.status === 'empty') {
    return (
      <View style={styles.placeholder}>
        <ThemedText type="secondary" style={styles.emptyText}>
          Your insights will appear once you&apos;ve both taken the quiz.
        </ThemedText>
      </View>
    );
  }

  const { them, you, strengths, challenges, tips } = state.insights;
  return (
    <View style={styles.container}>
      <Section title="The two of you">
        <PersonCard title={them.name} text={them.who} />
        <PersonCard title="You" text={you.who} />
      </Section>
      <Section title="Strengths">
        {strengths.map(text => (
          <Bullet key={text} marker="•" text={text} />
        ))}
      </Section>
      <Section title="Challenges">
        {challenges.map(text => (
          <Bullet key={text} marker="•" text={text} />
        ))}
      </Section>
      <Section title="Tips">
        {tips.map((text, index) => (
          <Bullet key={text} marker={`${index + 1}.`} text={text} />
        ))}
      </Section>
      <View style={styles.footnote}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
        <ThemedText type="muted" style={styles.footnoteText}>Based on both of your quiz results</ThemedText>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle} accessibilityRole="header">{title}</ThemedText>
      {children}
    </View>
  );
}

function PersonCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.personCard}>
      <ThemedText style={styles.personName} numberOfLines={1}>{title}</ThemedText>
      <ThemedText type="secondary" style={styles.paragraph}>{text}</ThemedText>
    </View>
  );
}

function Bullet({ marker, text }: { marker: string; text: string }) {
  return (
    <View style={styles.bullet}>
      <ThemedText type="secondary" style={styles.bulletMarker}>{marker}</ThemedText>
      <ThemedText type="secondary" style={styles.bulletText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
  },
  placeholder: {
    width: '100%',
    minHeight: 80,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  section: {
    width: '100%',
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 8,
  },
  personCard: {
    backgroundColor: Colors.cardRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
  },
  bullet: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bulletMarker: {
    width: 16,
    fontSize: 15,
    lineHeight: 23,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  footnoteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: Colors.danger,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
