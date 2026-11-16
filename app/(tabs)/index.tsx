import { View, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useQuiz } from '../../context/QuizContext';

import { ThemedText } from '@/components/ThemedText';
import { ScreenBackground } from '@/components/ScreenBackground';
import { AccountModal } from '@/components/AccountModal';
import { NotificationBell } from '@/components/NotificationBell';
import { getDisplayName } from '@/lib/names';
import { AuraDetailsModal } from '@/components/AuraDetailsModal';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AURA_IMAGES, AuraImage } from '@/constants/AuraImages';
import { Colors } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { DailyAuraCard } from '@/components/DailyAuraCard';
import { AuraQuizHero } from '@/components/AuraQuizHero';
import { useDailyAura } from '@/hooks/useDailyAura';
import { ShareCardHost } from '@/components/share/ShareCardHost';
import { DailyAuraShareCard } from '@/components/share/DailyAuraShareCard';
import { shareCardImage } from '@/lib/share/shareCardImage';
import { waitForNextPaint } from '@/lib/share/shareCardTypes';
import { buildShareUrl } from '@/constants/AppLinks';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { resetQuiz } = useQuiz();

  // Get the user's full name from user metadata
  const fullName = getDisplayName(user?.user_metadata?.full_name, user?.email);
  const userInitial = fullName.charAt(0).toUpperCase();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedAura, setSelectedAura] = useState<AuraImage | null>(null);
  const { state: dailyAura, retry: retryDailyAura } = useDailyAura();
  const shareCardRef = useRef<View>(null);
  const [isSharingDaily, setIsSharingDaily] = useState(false);
  const [dailyShareFeedback, setDailyShareFeedback] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  async function handleShareDaily() {
    if (dailyAura.status !== 'ready' || isSharingDaily) return;
    setIsSharingDaily(true);
    setDailyShareFeedback(null);
    try {
      await waitForNextPaint();
      if (!shareCardRef.current) throw new Error('Share card is not ready.');
      const outcome = await shareCardImage(shareCardRef.current, {
        fileName: 'animatch-today.png',
        title: "Today's aura",
        message: `Today's ${dailyAura.aura.name} aura: "${dailyAura.message.message}" What's yours?`,
        url: buildShareUrl('share-daily'),
      });
      if (outcome === 'downloaded') setDailyShareFeedback({ kind: 'info', text: 'Saved as an image. Post it to your story!' });
    } catch (error) {
      console.error('Error sharing daily aura:', error);
      setDailyShareFeedback({ kind: 'error', text: "Couldn't create the image. Try again." });
    } finally {
      setIsSharingDaily(false);
    }
  }

  // Retake link only when we know the user has an aura (not while loading or on an unknown error).
  const hasAura =
    dailyAura.status === 'ready' ||
    dailyAura.status === 'empty' ||
    (dailyAura.status === 'error' && dailyAura.aura !== null);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'AniMatch',
            headerTitle: () => <ThemedText type="wordmark">ANIMATCH</ThemedText>,
            headerRight: () => (
              <View style={styles.headerActions}>
                <NotificationBell />
                <TouchableOpacity
                  style={styles.accountButton}
                  onPress={() => setShowAccountModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open account menu"
                >
                  <ThemedText style={styles.accountInitial}>{userInitial}</ThemedText>
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {dailyAura.status === 'locked' ? (
            <AuraQuizHero onTakeQuiz={() => router.push('/(tabs)/quiz')} />
          ) : (
            <View style={styles.dailyAura}>
              {/* A future "Today with {name}" pair tip goes inside as a child section. */}
              <DailyAuraCard
                state={dailyAura}
                onRetry={retryDailyAura}
                onShare={handleShareDaily}
                isSharing={isSharingDaily}
                shareFeedback={dailyShareFeedback}
              />
            </View>
          )}

          <View style={styles.carouselCard}>
            <View style={styles.carouselHeader}>
              <ThemedText type="subtitle" style={styles.carouselTitle}>Meet the auras</ThemedText>
              <ThemedText type="muted">Tap one to explore its personality</ThemedText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {AURA_IMAGES.map(aura => (
                <TouchableOpacity
                  key={aura.name}
                  onPress={() => setSelectedAura(aura)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`See the ${aura.name} aura's personality`}
                  style={styles.carouselItem}
                >
                  <AuraAvatar animalName={aura.name} size="medium" />
                  <ThemedText type="muted" style={styles.carouselName}>{aura.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {hasAura ? (
            <Pressable
              onPress={resetQuiz}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retakeLink, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="refresh-outline" size={15} color={Colors.textMuted} />
              <ThemedText type="muted" style={styles.retakeText}>Retake the quiz</ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
        {dailyAura.status === 'ready' ? (
          <ShareCardHost ref={shareCardRef}>
            <DailyAuraShareCard
              animalName={dailyAura.aura.name}
              message={dailyAura.message.message}
              doText={dailyAura.message.doText}
              dontText={dailyAura.message.dontText}
            />
          </ShareCardHost>
        ) : null}
        <AccountModal
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />
        <AuraDetailsModal
          aura={selectedAura}
          onClose={() => setSelectedAura(null)}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 48,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  dailyAura: {
    marginBottom: 32,
  },
  carouselCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
    marginBottom: 40,
  },
  carouselHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 4,
  },
  carouselTitle: {
    fontSize: 18,
  },
  carouselContent: {
    paddingHorizontal: 16,
  },
  carouselItem: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  carouselName: {
    marginTop: 6,
    fontSize: 13,
  },
  accountButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accountInitial: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  retakeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  retakeText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
