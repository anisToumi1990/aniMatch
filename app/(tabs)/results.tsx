import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { useAuth } from '@/context/AuthContext';
import { AnimalAura, fetchLatestQuizResult } from '@/lib/supabase/quiz';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { ScreenBackground } from '@/components/ScreenBackground';
import { LockedAuraAvatar } from '@/components/LockedAuraAvatar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { getFirstName } from '@/lib/names';
import { splitTraits } from '@/lib/traits';
import { InviteModal } from '@/components/InviteModal';
import { InviteLinkRoute } from '@/components/InviteForm';
import { ShareCardHost } from '@/components/share/ShareCardHost';
import { AuraShareCard } from '@/components/share/AuraShareCard';
import { shareCardImage } from '@/lib/share/shareCardImage';
import { waitForNextPaint } from '@/lib/share/shareCardTypes';
import { buildShareUrl } from '@/constants/AppLinks';

type SavedResultStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

/** Feedback shown under the buttons after sharing. */
type ShareFeedback = 'downloaded' | 'error' | null;

export default function ResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { animalAura: contextAura, resetQuiz, isPreviousResult } = useQuiz();
  const shareCardRef = useRef<View>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // The quiz context only has an aura right after the quiz, or once its own
  // load finishes (and opening the quiz tab clears it). After a page reload,
  // or when the context is empty, load the saved result here instead of
  // redirecting: navigating from an effect on first render crashes on web
  // ("Attempted to navigate before mounting the Root Layout component").
  const [savedAura, setSavedAura] = useState<AnimalAura | null>(null);
  const [savedStatus, setSavedStatus] = useState<SavedResultStatus>('idle');
  const [reloadCount, setReloadCount] = useState(0);
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;
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

  // First name for the share card: profiles.full_name, else the email name.
  useEffect(() => {
    if (!userId) {
      setFirstName(null);
      return;
    }
    let isCancelled = false;
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) console.error('Error loading profile name:', error);
        setFirstName(getFirstName(data?.full_name, data?.email ?? userEmail));
      });
    return () => {
      isCancelled = true;
    };
  }, [userId, userEmail]);

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
                <LockedAuraAvatar style={styles.lockedAvatar} />
                <ThemedText type="subtitle" style={styles.statusTitle}>
                  Your aura is locked 🔒
                </ThemedText>
                <ThemedText type="secondary" style={styles.statusText}>
                  Take the 10-question quiz to unlock the animal that reflects your personality.
                </ThemedText>
                <AuraButton
                  label="Take the quiz"
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

  async function handleShare() {
    if (!animalAura || isSharing) return;
    setIsSharing(true);
    setShareFeedback(null);
    try {
      await waitForNextPaint();
      if (!shareCardRef.current) throw new Error('Share card is not ready.');
      const outcome = await shareCardImage(shareCardRef.current, {
        fileName: 'animatch-my-aura.png',
        title: 'My Animal Aura',
        message: `My aura is the ${animalAura.name}. What's yours?`,
        url: buildShareUrl('share-aura'),
      });
      if (outcome === 'downloaded') setShareFeedback('downloaded');
    } catch (error) {
      console.error('Error sharing aura card:', error);
      setShareFeedback('error');
    } finally {
      setIsSharing(false);
    }
  }

  function handleInviteLinkPress(route: InviteLinkRoute) {
    router.navigate(route);
  }

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
                  Welcome back! Here&apos;s your previous result.
                </ThemedText>
              </View>
            )}
            
            <View
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
                  {splitTraits(animalAura.traits).map((trait, index) => (
                    <View
                      key={index}
                      style={[
                        styles.traitBadge, 
                        { borderColor: withAlpha(auraColor, 0.45), backgroundColor: withAlpha(auraColor, 0.1) }
                      ]}
                    >
                      <ThemedText style={[styles.traitText, { color: auraColor }]}>
                        {trait}
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
                label="Share my aura"
                icon="share-outline"
                onPress={handleShare}
                isLoading={isSharing}
                accessibilityLabel="Share my aura card"
                style={[styles.button, styles.shareButton, { shadowColor: auraColor }]}
              />
              <AuraButton
                label="Invite someone"
                icon="person-add-outline"
                variant="secondary"
                onPress={() => setIsInviteOpen(true)}
                style={styles.button}
              />
            </View>
            {shareFeedback ? (
              <ThemedText
                style={[styles.shareFeedback, shareFeedback === 'error' && styles.shareFeedbackError]}
                accessibilityLiveRegion="polite"
              >
                {shareFeedback === 'downloaded'
                  ? 'Your aura card was saved as an image. Post it to your story!'
                  : "We couldn't create your aura card. Please try again."}
              </ThemedText>
            ) : null}
            <Pressable
              onPress={handleRetakeQuiz}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retakeButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} />
              <ThemedText type="secondary" style={styles.retakeText}>Retake quiz</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
        <ShareCardHost ref={shareCardRef}>
          <AuraShareCard firstName={firstName} animalName={animalAura.name} traits={animalAura.traits} />
        </ShareCardHost>
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
  lockedAvatar: {
    marginBottom: 28,
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
    marginBottom: 8,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingHorizontal: 12,
  },
  // Soft glow in the aura color (shadow* props also render on web).
  shareButton: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
  shareFeedback: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.success,
    marginTop: 4,
  },
  shareFeedbackError: {
    color: Colors.danger,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  retakeText: {
    fontSize: 15,
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
