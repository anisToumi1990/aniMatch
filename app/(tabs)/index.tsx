import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ScreenBackground } from '@/components/ScreenBackground';
import { AccountModal } from '@/components/AccountModal';
import { NotificationBell } from '@/components/NotificationBell';
import { AuraQuizHero } from '@/components/AuraQuizHero';
import { InviteModal } from '@/components/InviteModal';
import { InviteLinkRoute } from '@/components/InviteForm';
import { PaywallModal } from '@/components/PaywallModal';
import { AuraHero } from '@/components/home/AuraHero';
import { WeekStrip } from '@/components/home/WeekStrip';
import { DayMessage } from '@/components/home/DayMessage';
import { MatchesRow } from '@/components/home/MatchesRow';
import { ShareCardHost, ShareCardRef } from '@/components/share/ShareCardHost';
import { DailyAuraShareCard } from '@/components/share/DailyAuraShareCard';
import { Colors, getAuraColor } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { buildShareUrl } from '@/constants/AppLinks';
import { useDailyAura } from '@/hooks/useDailyAura';
import { useAuraWeek } from '@/hooks/useAuraWeek';
import { PairTipItem, useDailyPairTips } from '@/hooks/useDailyPairTips';
import { getDisplayName } from '@/lib/names';
import { weekdayName } from '@/lib/auraWeek';
import { shareCardImage } from '@/lib/share/shareCardImage';
import { waitForNextPaint } from '@/lib/share/shareCardTypes';

type ShareFeedback = { kind: 'info' | 'error'; text: string } | null;

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const userInitial = getDisplayName(user?.user_metadata?.full_name, user?.email).charAt(0).toUpperCase();

  const { state: dailyAura, retry: retryDailyAura, localDate: today } = useDailyAura();
  // The aura once known: ready, empty (no content) or a message error with a known aura.
  const aura =
    dailyAura.status === 'ready' || dailyAura.status === 'empty' || dailyAura.status === 'error'
      ? dailyAura.aura
      : null;
  const week = useAuraWeek(aura?.id ?? null, today);
  const { state: pairTips, retry: retryPairTips } = useDailyPairTips(aura !== null);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [paywallDate, setPaywallDate] = useState<string | null>(null);
  const shareCardRef = useRef<ShareCardRef>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null);

  async function handleShare() {
    if (!aura || week.state.status !== 'ready' || isSharing) return;
    const { message } = week.state.message;
    setIsSharing(true);
    setShareFeedback(null);
    try {
      await waitForNextPaint();
      if (!shareCardRef.current) throw new Error('Share card is not ready.');
      const outcome = await shareCardImage(shareCardRef.current, {
        fileName: 'animatch-aura.png',
        title: 'My aura',
        message: `My ${aura.name} aura${week.isToday ? ' today' : ''}: "${message}" What's yours?`,
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

  function handleSelectDay(localDate: string) {
    setShareFeedback(null);
    week.selectDate(localDate);
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
        <AuraHero animalName={aura.name} localDate={week.selectedDate} isToday={week.isToday} />
        <WeekStrip
          days={week.days}
          selectedDate={week.selectedDate}
          auraColor={getAuraColor(aura.name)}
          onSelectDay={day => handleSelectDay(day.localDate)}
          onLockedDay={day => setPaywallDate(day.localDate)}
        />
        <DayMessage
          state={week.state}
          onRetry={week.retry}
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
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'AniMatch',
            headerTitle: () => <ThemedText type="wordmark">ANIMATCH</ThemedText>,
            headerTitleAlign: 'left',
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

        {aura && week.state.status === 'ready' ? (
          <ShareCardHost ref={shareCardRef}>
            <DailyAuraShareCard
              animalName={aura.name}
              dayLabel={week.isToday ? 'TODAY' : weekdayName(week.selectedDate).toUpperCase()}
              message={week.state.message.message}
              doText={week.state.message.doText}
              dontText={week.state.message.dontText}
            />
          </ShareCardHost>
        ) : null}
        <PaywallModal
          visible={paywallDate !== null}
          lockedDate={paywallDate}
          animalName={aura?.name ?? null}
          source="week_strip"
          onClose={() => setPaywallDate(null)}
        />
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
    marginRight: 16,
  },
  accountInitial: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 640,
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
