import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useQuiz } from '@/context/QuizContext';
import { fetchLatestQuizResult } from '@/lib/supabase/quiz';
import { ScreenBackground } from '@/components/ScreenBackground';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { getAuraEmoji } from '@/constants/AuraEmoji';
import { transparentHeaderOptions } from '@/constants/Theme';

/** "a" for Dolphin, "an" for Owl. */
function articleFor(animal: string): string {
  return /^[aeiou]/i.test(animal) ? 'an' : 'a';
}

/**
 * Opened by the Quiz tab (and Home's new-quiz banner) when the user already has a
 * result: confirm before retaking, since the aura, daily message and match scores will change.
 */
export default function RetakeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { animalAura: contextAura, resetQuiz, latestQuizVersion } = useQuiz();
  const [savedAuraName, setSavedAuraName] = useState<string | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // The quiz context can be empty (e.g. after a page reload): load the saved result.
  useEffect(() => {
    if (contextAura || !userId) return;
    let isCancelled = false;
    setIsLoadingSaved(true);
    fetchLatestQuizResult(userId)
      .then(result => {
        if (!isCancelled) setSavedAuraName(result?.animal_aura?.name ?? null);
      })
      .catch(error => console.error('Error loading aura for retake screen:', error))
      .finally(() => {
        if (!isCancelled) setIsLoadingSaved(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [contextAura, userId]);

  const animalName = contextAura?.name ?? savedAuraName;
  const auraColor = getAuraColor(animalName);

  function handleKeep() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate('/');
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ ...transparentHeaderOptions, title: 'Retake the quiz' }} />
        <View style={styles.content}>
          <View
            style={[
              styles.card,
              animalName && { borderColor: withAlpha(auraColor, 0.4), shadowColor: auraColor },
            ]}
          >
            {animalName ? (
              <>
                <AuraAvatar animalName={animalName} size="large" style={styles.avatar} />
                <ThemedText style={styles.title}>
                  You&apos;re {articleFor(animalName)}{' '}
                  <ThemedText style={[styles.title, { color: auraColor }]}>{animalName}</ThemedText>{' '}
                  {getAuraEmoji(animalName)}
                </ThemedText>
              </>
            ) : isLoadingSaved ? (
              <ActivityIndicator size="large" color={Colors.textSecondary} style={styles.loader} />
            ) : (
              <ThemedText style={styles.title}>Ready for a fresh start?</ThemedText>
            )}
            <ThemedText type="secondary" style={styles.text}>
              {latestQuizVersion === 1
                ? 'The new quiz reads you more accurately. Your aura, daily message and match scores may change.'
                : 'Want to retake the quiz? Your aura, daily message and match scores will update.'}
            </ThemedText>
            <View style={styles.buttons}>
              <AuraButton label="Retake the quiz" icon="refresh" onPress={resetQuiz} style={styles.button} />
              <AuraButton label="Keep my aura" variant="secondary" onPress={handleKeep} style={styles.button} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  card: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
  },
  avatar: {
    marginBottom: 18,
  },
  loader: {
    height: 168,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  text: {
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: 10,
  },
  button: {
    alignSelf: 'stretch',
  },
});
