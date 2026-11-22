import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ScreenBackground } from '@/components/ScreenBackground';
import { AccountModal } from '@/components/AccountModal';
import { NotificationBell } from '@/components/NotificationBell';
import { AuraQuizHero } from '@/components/AuraQuizHero';
import { InviteModal } from '@/components/InviteModal';
import { InviteLinkRoute } from '@/components/InviteForm';
import { AuraHero } from '@/components/home/AuraHero';
import { DayMessage, DayMessageState } from '@/components/home/DayMessage';
import { MatchesRow } from '@/components/home/MatchesRow';
import { QuizV2Banner } from '@/components/home/QuizV2Banner';
import { ShareCardHost, ShareCardRef } from '@/components/share/ShareCardHost';
import { DailyAuraShareCard } from '@/components/share/DailyAuraShareCard';
import { Colors, getAuraColor } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { buildShareUrl } from '@/constants/AppLinks';
import { useDailyAura } from '@/hooks/useDailyAura';
import { PairTipItem, useDailyPairTips } from '@/hooks/useDailyPairTips';
import { getDisplayName } from '@/lib/names';
import { formatLongDate } from '@/lib/dateLabels';
import { dismissQuizV2Banner, isQuizV2BannerDismissed, shouldShowQuizV2Banner } from '@/lib/quizV2Banner';
import { shareCardImage } from '@/lib/share/shareCardImage';
import { waitForNextPaint } from '@/lib/share/shareCardTypes';

type ShareFeedback = { kind: 'info' | 'error'; text: string } | null;

/** Home's content column (scrollContent): max width and side padding. */
const CONTENT_MAX_WIDTH = 640;
const CONTENT_PADDING = 20;

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const userInitial = getDisplayName(user?.user_metadata?.full_name, user?.email).charAt(0).toUpperCase();
  // On wide screens, line the header up with the centered content column instead of the window edges.
  const { width: windowWidth } = useWindowDimensions();
  const columnInset = Math.max(0, (windowWidth - CONTENT_MAX_WIDTH) / 2) + CONTENT_PADDING;

  const { state: dailyAura, retry: retryDailyAura, localDate: today } = useDailyAura();
  // The aura once known: ready, empty (no content) or a message error with a known aura.
  const aura =
    dailyAura.status === 'ready' || dailyAura.status === 'empty' || dailyAura.status === 'error'
      ? dailyAura.aura
      : null;
  const { state: pairTips, retry: retryPairTips } = useDailyPairTips(aura !== null);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const shareCardRef = useRef<ShareCardRef>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null);

  // "New, more accurate quiz" banner for users whose latest result is from the old quiz.
  const { latestQuizVersion } = useQuiz();
  const userId = user?.id ?? null;
  const [isBannerDismissed, setIsBannerDismissed] = useState(true);
  useEffect(() => {
    if (!userId) return;
    let isCancelled = false;
    isQuizV2BannerDismissed(userId).then(isDismissed => {
      if (!isCancelled) setIsBannerDismissed(isDismissed);
    });
    return () => {
      isCancelled = true;
    };
  }, [userId]);
  const showQuizV2Banner = shouldShowQuizV2Banner(latestQuizVersion, isBannerDismissed);

  function handleDismissBanner() {
    setIsBannerDismissed(true);
    if (userId) dismissQuizV2Banner(userId);
  }

  // Today's card: the hero shows the aura, the card the message of the day.
  const dayState: DayMessageState =
    dailyAura.status === 'ready'
      ? { status: 'ready', message: dailyAura.message }
      : dailyAura.status === 'empty' || dailyAura.status === 'error'
        ? { status: dailyAura.status }
        : { status: 'loading' };
  const todayMessage = dailyAura.status === 'ready' ? dailyAura.message : null;

  async function handleShare() {
    if (!aura || !todayMessage || isSharing) return;
    const { message } = todayMessage;
    setIsSharing(true);
    setShareFeedback(null);
    try {
      await waitForNextPaint();
      if (!shareCardRef.current) throw new Error('Share card is not ready.');
      const outcome = await shareCardImage(shareCardRef.current, {
        fileName: 'animatch-aura.png',
        title: 'My aura',
        message: `My ${aura.name} aura today: "${message}" What's yours?`,
        url: buildShareUrl('share-daily'),
      });
      if (outcome === 'downloaded') setShareFeedback({ kind: 'info', text: 'Saved as an image. Post it to your story!' });
    } catch (error) {
      console.error('Error sharing aura:', error);
      setShareFeedback({ kind: 'error', text: "Couldn't create the image. Try again." });
    } finally {
      setIsSharing(false);
    }
  }

  function handleOpenMatch(item: PairTipItem) {
    router.navigate({ pathname: '/compatibility', params: { resultId: String(item.resultId) } });
  }

  function handleInviteLink(route: InviteLinkRoute) {
    router.navigate(route);
  }

  function renderBody() {
    if (dailyAura.status === 'locked') {
      return <AuraQuizHero onTakeQuiz={() => router.push('/(tabs)/quiz')} />;
    }
    if (dailyAura.status === 'loading') {
      return (
        <View style={styles.center} accessibilityLabel="Loading your aura">
          <ActivityIndicator size="large" color={Colors.textSecondary} />
        </View>
      );
    }
    if (!aura) {
      // Couldn't even load the user's aura.
      return (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ThemedText style={styles.errorText}>Your aura got lost on the way. Check your connection.</ThemedText>
          <Pressable onPress={retryDailyAura} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
            <Ionicons name="refresh" size={14} color={Colors.text} />
            <ThemedText style={styles.retryText}>Try again</ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        {showQuizV2Banner ? (
          <QuizV2Banner
            auraColor={getAuraColor(aura.name)}
            onOpen={() => router.navigate('/retake')}
            onDismiss={handleDismissBanner}
          />
        ) : null}
        <AuraHero animalName={aura.name} />
        <DayMessage
          state={dayState}
          localDate={today}
          auraColor={getAuraColor(aura.name)}
          onRetry={retryDailyAura}
          onShare={handleShare}
          isSharing={isSharing}
          shareFeedback={shareFeedback}
        />
        <MatchesRow
          state={pairTips}
          onRetry={retryPairTips}
          onInvite={() => setIsInviteOpen(true)}
          onSeeAll={() => router.navigate('/pair-tips')}
          onOpenMatch={handleOpenMatch}
        />
      </>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Tabs.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'AniMatch',
            headerTitle: () => <ThemedText type="wordmark">ANIMATCH</ThemedText>,
            headerTitleAlign: 'left',
            headerTitleContainerStyle: { marginLeft: columnInset, marginRight: 0 },
            headerRightContainerStyle: { paddingRight: columnInset },
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
        <ScrollView contentContainerStyle={styles.scrollContent}>{renderBody()}</ScrollView>

        {aura && todayMessage ? (
          <ShareCardHost ref={shareCardRef}>
            <DailyAuraShareCard
              animalName={aura.name}
              dateLabel={formatLongDate(todayMessage.localDate)}
              message={todayMessage.message}
              actionText={todayMessage.actionText}
              actionWhy={todayMessage.actionWhy}
            />
          </ShareCardHost>
        ) : null}
        <InviteModal visible={isInviteOpen} onClose={() => setIsInviteOpen(false)} onLinkPress={handleInviteLink} />
        <AccountModal visible={showAccountModal} onClose={() => setShowAccountModal(false)} />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  },
  accountInitial: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  center: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: Colors.danger,
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
