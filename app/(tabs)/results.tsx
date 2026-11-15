import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Share, Platform, Image, Modal, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { useAuth } from '@/context/AuthContext';
import { AnimalAura, fetchLatestQuizResult } from '@/lib/supabase/quiz';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { captureRef } from 'react-native-view-shot';
import { ScreenBackground } from '@/components/ScreenBackground';
import { SafeAreaView } from 'react-native-safe-area-context';

type SavedResultStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export default function ResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { animalAura: contextAura, resetQuiz, isPreviousResult } = useQuiz();
  const viewShotRef = useRef(null);

  // The quiz context only has an aura right after the quiz, or once its own
  // load finishes (and opening the quiz tab clears it). After a page reload,
  // or when the context is empty, load the saved result here instead of
  // redirecting: navigating from an effect on first render crashes on web
  // ("Attempted to navigate before mounting the Root Layout component").
  const [savedAura, setSavedAura] = useState<AnimalAura | null>(null);
  const [savedStatus, setSavedStatus] = useState<SavedResultStatus>('idle');
  const [reloadCount, setReloadCount] = useState(0);
  const userId = user?.id ?? null;
  const hasContextAura = contextAura !== null;

  useEffect(() => {
    if (!userId) {
      setSavedAura(null);
      setSavedStatus('idle');
      return;
    }
    if (hasContextAura) return;
    let isCancelled = false;

    // Clear any result from a previous load (e.g. a different user) first.
    setSavedAura(null);
    setSavedStatus('loading');
    fetchLatestQuizResult(userId)
      .then(result => {
        if (isCancelled) return;
        if (result?.animal_aura) {
          setSavedAura(result.animal_aura);
          setSavedStatus('loaded');
          return;
        }
        setSavedAura(null);
        setSavedStatus('empty');
      })
      .catch(() => {
        if (!isCancelled) setSavedStatus('error');
      });

    return () => {
      isCancelled = true;
    };
  }, [hasContextAura, userId, reloadCount]);

  const handleRetryLoad = useCallback(() => setReloadCount(count => count + 1), []);
  const handleStartQuiz = useCallback(() => router.push('/(tabs)/quiz'), [router]);

  const animalAura = contextAura ?? savedAura;
  // A result loaded from the database here is always a previous result.
  const showWelcomeBack = contextAura ? isPreviousResult : animalAura !== null;

  if (!animalAura) {
    const isEmpty = savedStatus === 'empty' || (!userId && savedStatus === 'idle');
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ 
            ...transparentHeaderOptions,
            title: 'Animal aura',
          }} />
          <View style={styles.statusContainer}>
            {isEmpty ? (
              <>
                <View style={styles.emptyRings}>
                  <View style={styles.emptyRingOuter} />
                  <View style={styles.emptyRingInner} />
                  <View style={styles.emptyCore} />
                </View>
                <ThemedText type="subtitle" style={styles.statusTitle}>
                  You haven&apos;t discovered your aura yet
                </ThemedText>
                <ThemedText type="secondary" style={styles.statusText}>
                  Take the 10-question quiz to find the animal that reflects your personality.
                </ThemedText>
                <AuraButton
                  label="Start the quiz"
                  onPress={handleStartQuiz}
                  size="large"
                  icon="arrow-forward"
                  iconPosition="right"
                  style={styles.statusButton}
                />
              </>
            ) : savedStatus === 'error' ? (
              <>
                <ThemedText type="subtitle" style={styles.statusTitle}>
                  We couldn&apos;t load your aura
                </ThemedText>
                <ThemedText type="secondary" style={styles.statusText}>
                  Please check your connection and try again.
                </ThemedText>
                <AuraButton
                  label="Try again"
                  variant="secondary"
                  onPress={handleRetryLoad}
                  style={styles.statusButton}
                />
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={Colors.textSecondary} />
                <ThemedText type="secondary" style={styles.loadingText}>Loading your result...</ThemedText>
              </>
            )}
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const handleShare = async () => {
    try {
      // Create a more attractive sharing message
      const shareMessage = `🌟 I discovered my Animal Aura is the ${animalAura.name}! 🌟\n\n${animalAura.description}\n\nMy key traits: ${animalAura.traits}\n\n#AniMatch #AnimalAura`;
      
      // Try to capture the result card as an image
      if (viewShotRef.current) {
        try {
          // Capture the view as an image using captureRef
          const uri = await captureRef(viewShotRef, {
            format: 'png',
            quality: 0.8,
          });
          
          // Share the image along with text
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            // Use the Share API which works on both platforms
            await Share.share({
              message: shareMessage,
              url: uri, // iOS will use this
              title: 'My Animal Aura', // Android will use this as title
            });
          } else {
            // Fallback for web and other platforms
            await Share.share({
              message: shareMessage,
            });
          }
          return;
        } catch (error) {
          console.error('Error capturing or sharing image:', error);
        }
      }
      
      // Fallback to simple text sharing
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.error('Error sharing result:', error);
    }
  };

  const handleRetakeQuiz = () => {
    // Just reset the quiz, which will trigger the directNavigateToQuiz flag
    // The tab layout will handle the navigation to avoid the home tab flash
    resetQuiz();
  };

  // Accent color for this aura, used for the badge, section markers and traits
  const auraColor = getAuraColor(animalAura.name);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'Animal aura',
          }}
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            
            {showWelcomeBack && (
              <View style={styles.welcomeBackBanner}>
                <ThemedText style={styles.welcomeBackText}>
                  Welcome back! Here's your previous result.
                </ThemedText>
              </View>
            )}
            
            <View 
              ref={viewShotRef}
              style={[styles.auraCard, { borderColor: withAlpha(auraColor, 0.35) }]}
            >
              <ThemedText type="wordmark" style={styles.cardEyebrow}>YOUR AURA</ThemedText>

              <AuraAvatar animalName={animalAura.name} size="large" style={styles.avatar} />
              
              <ThemedText style={styles.auraName}>
                {animalAura.name}
              </ThemedText>
              
              <View
                style={[
                  styles.categoryBadge,
                  { borderColor: withAlpha(auraColor, 0.5), backgroundColor: withAlpha(auraColor, 0.12) },
                ]}
              >
                <ThemedText style={[styles.categoryText, { color: auraColor }]}>
                  {animalAura.category.split('/')[0]}
                </ThemedText>
              </View>
              
              <ThemedText type="secondary" style={styles.auraDescription}>
                {animalAura.description}
              </ThemedText>
              
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                  <ThemedText style={styles.sectionTitle}>Strengths</ThemedText>
                </View>
                <ThemedText type="secondary" style={styles.sectionContent}>
                  {animalAura.strengths}
                </ThemedText>
              </View>
              
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                  <ThemedText style={styles.sectionTitle}>Challenges</ThemedText>
                </View>
                <ThemedText type="secondary" style={styles.sectionContent}>
                  {animalAura.challenges}
                </ThemedText>
              </View>
              
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                  <ThemedText style={styles.sectionTitle}>Key traits</ThemedText>
                </View>
                <View style={styles.traitsContainer}>
                  {animalAura.traits.split(',').map((trait, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.traitBadge, 
                        { borderColor: withAlpha(auraColor, 0.45), backgroundColor: withAlpha(auraColor, 0.1) }
                      ]}
                    >
                      <ThemedText style={[styles.traitText, { color: auraColor }]}>
                        {trait.trim()}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* Add AniMatch branding */}
              <View style={styles.brandingContainer}>
                <ThemedText type="wordmark">ANIMATCH</ThemedText>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <AuraButton
                label="Share result"
                icon="share-outline"
                onPress={handleShare}
                style={styles.button}
              />
              <AuraButton
                label="Retake quiz"
                icon="refresh-outline"
                variant="secondary"
                onPress={handleRetakeQuiz}
                style={styles.button}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    padding: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  statusTitle: {
    textAlign: 'center',
    marginBottom: 10,
  },
  statusText: {
    textAlign: 'center',
    marginBottom: 28,
  },
  statusButton: {
    minWidth: 240,
  },
  loadingText: {
    marginTop: 16,
  },
  emptyRings: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  emptyRingOuter: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: withAlpha(Colors.textMuted, 0.25),
  },
  emptyRingInner: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: withAlpha(Colors.textMuted, 0.4),
  },
  emptyCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  auraCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  cardEyebrow: {
    marginBottom: 20,
  },
  avatar: {
    marginBottom: 20,
  },
  auraName: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 20,
  },
  categoryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  auraDescription: {
    textAlign: 'center',
    marginBottom: 28,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 23,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  traitText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brandingContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    width: '100%',
    alignItems: 'center',
  },
  welcomeBackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    justifyContent: 'center',
  },
  welcomeBackText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
