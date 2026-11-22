import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, LayoutChangeEvent } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuraAvatar } from '@/components/AuraAvatar';
import { ScreenBackground } from '@/components/ScreenBackground';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { formatRelationshipType, getMatchLevel } from '@/lib/compatibility';
import { getStoredAreaScores } from '@/lib/compatibilityV2';
import { AreaBreakdown } from '@/components/compatibility/AreaBreakdown';
import { PersonalInsights } from '@/components/compatibility/PersonalInsights';
import { getDisplayName, getFirstName } from '@/lib/names';
import { ShareCardHost, ShareCardRef } from '@/components/share/ShareCardHost';
import { MatchShareCard } from '@/components/share/MatchShareCard';
import { shareCardImage } from '@/lib/share/shareCardImage';
import { waitForNextPaint } from '@/lib/share/shareCardTypes';
import { buildShareUrl } from '@/constants/AppLinks';
import { transparentHeaderOptions } from '@/constants/Theme';
import { AuraButton } from '@/components/AuraButton';
import { InviteModal } from '@/components/InviteModal';
import { HeaderActions } from '@/components/HeaderActions';
import { HideMatchDialog } from '@/components/compatibility/HideMatchDialog';
import { fetchHiddenMatchIds, hideMatch, unhideMatch } from '@/lib/supabase/hiddenMatches';
import { MatchLinkParams } from '@/lib/notificationRoutes';
import { InviteLinkRoute } from '@/components/InviteForm';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const RELATIONSHIP_ICONS: Record<string, IoniconName> = {
  lover: 'heart',
  family: 'home',
  friend: 'people',
  business_partner: 'briefcase',
};

function getRelationshipIcon(relationshipType: string): IoniconName {
  return RELATIONSHIP_ICONS[relationshipType] ?? 'people';
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
  /** Compatibility v2 (null / missing on v1 rows). */
  compatibility_version?: number | null;
  communication_score?: number | null;
  energy_score?: number | null;
  conflict_score?: number | null;
  values_score?: number | null;
  user_a: {
    full_name: string | null;
    email: string | null;
  } | null;
  user_b: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface AnimalAura {
  id: number;
  name: string;
  icon_url: string;
}

interface LayoutPoint {
  x: number;
  y: number;
}

interface MatchCardProps {
  onPress: () => void;
  accessibilityLabel: string;
  /** Secondary button (share). Rendered next to the card, not inside it. */
  action: React.ReactNode;
  /** Renders the card content; put `actionSlot` where the action should appear and pass `onHeaderLayout` to its row. */
  children: (actionSlot: React.ReactNode, onHeaderLayout: (event: LayoutChangeEvent) => void) => React.ReactNode;
}

/**
 * A pressable match card with a share button on top of it. On web a button
 * can't contain another button, so the share button is a sibling of the card,
 * positioned over an empty slot measured inside the card's header row.
 */
function MatchCard({ onPress, accessibilityLabel, action, children }: MatchCardProps) {
  const [header, setHeader] = useState<LayoutPoint | null>(null);
  const [slot, setSlot] = useState<LayoutPoint | null>(null);
  const actionSlot = (
    <View
      style={styles.shareIconSlot}
      onLayout={event => setSlot({ x: event.nativeEvent.layout.x, y: event.nativeEvent.layout.y })}
    />
  );
  return (
    <View style={styles.resultCardWrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.85 }]}
      >
        {children(actionSlot, event => setHeader({ x: event.nativeEvent.layout.x, y: event.nativeEvent.layout.y }))}
      </Pressable>
      {header && slot ? (
        <View style={[styles.shareIconOverlay, { left: header.x + slot.x, top: header.y + slot.y }]}>{action}</View>
      ) : null}
    </View>
  );
}

export default function CompatibilityScreen() {
  const { user } = useAuth();
  const [compatibilityResults, setCompatibilityResults] = useState<CompatibilityResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<CompatibilityResult | null>(null);
  const [auraA, setAuraA] = useState<AnimalAura | null>(null);
  const [auraB, setAuraB] = useState<AnimalAura | null>(null);
  const [isAuraLoading, setIsAuraLoading] = useState(false);
  const [auraNamesById, setAuraNamesById] = useState<Record<number, string>>({});
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<CompatibilityResult | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  // Hidden only for the current user (hidden_matches).
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set());
  const [isShowingHidden, setIsShowingHidden] = useState(false);
  const [hideTarget, setHideTarget] = useState<CompatibilityResult | null>(null);
  const [isHiding, setIsHiding] = useState(false);
  const [unhidingId, setUnhidingId] = useState<string | null>(null);
  // Opened from a link (e.g. a notification) to a match the user has hidden.
  const [hiddenNotice, setHiddenNotice] = useState<CompatibilityResult | null>(null);
  const shareCardRef = useRef<ShareCardRef>(null);
  const shareToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter();
  // Set when another screen (Home's pair tips, a notification) opens a specific match:
  // resultId, else the match with withUser for relationshipType.
  const { resultId, withUser, relationshipType } = useLocalSearchParams<MatchLinkParams>();

  useEffect(() => () => clearTimeout(shareToastTimeoutRef.current), []);

  function showShareToast(message: string) {
    clearTimeout(shareToastTimeoutRef.current);
    setShareToast(message);
    shareToastTimeoutRef.current = setTimeout(() => setShareToast(null), 4000);
  }

  // "See your match in Compatibility" just closes the popup: we're already here.
  function handleInviteLinkPress(route: InviteLinkRoute) {
    if (route === '/(tabs)/compatibility') return;
    router.navigate(route);
  }

  // Aura names for the avatars on each card (read-only, loaded once).
  useEffect(() => {
    let isCancelled = false;

    async function loadAuraNames() {
      try {
        const { data, error } = await supabase.from('animal_auras').select('id, name');
        if (error) throw error;
        if (isCancelled) return;
        const names: Record<number, string> = {};
        (data ?? []).forEach((aura: { id: number; name: string }) => {
          names[aura.id] = aura.name;
        });
        setAuraNamesById(names);
      } catch (loadError) {
        console.error('Error loading aura names:', loadError);
      }
    }

    loadAuraNames();
    return () => {
      isCancelled = true;
    };
  }, []);

  const fetchCompatibilityResults = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [{ data, error }, hidden] = await Promise.all([
        supabase
          .from('compatibility_results')
          .select(`
            *,
            user_a:user_a_id(full_name, email),
            user_b:user_b_id(full_name, email)
          `)
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
        // Without hidden_matches (e.g. before its migration), show everything.
        fetchHiddenMatchIds(user.id).catch(hiddenError => {
          console.error('Error loading hidden matches:', hiddenError);
          return new Set<number>();
        }),
      ]);
      if (error) throw error;
      setCompatibilityResults(data || []);
      setHiddenIds(hidden);
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
    const other = result.user_a_id === user?.id ? result.user_b : result.user_a;
    return getDisplayName(other?.full_name, other?.email);
  };

  /** First names and auras for the share card, with the current user first. */
  function getShareCardProps(result: CompatibilityResult) {
    const isCurrentUserA = user?.id === result.user_a_id;
    const me = isCurrentUserA ? result.user_a : result.user_b;
    const other = isCurrentUserA ? result.user_b : result.user_a;
    return {
      nameA: getFirstName(me?.full_name, me?.email ?? user?.email),
      nameB: getFirstName(other?.full_name, other?.email),
      animalA: auraNamesById[isCurrentUserA ? result.user_a_aura_id : result.user_b_aura_id] ?? '',
      animalB: auraNamesById[isCurrentUserA ? result.user_b_aura_id : result.user_a_aura_id] ?? '',
      score: result.compatibility_score,
      relationshipType: result.relationship_type,
    };
  }

  async function handleShareMatch(result: CompatibilityResult) {
    if (sharingId) return;
    setSharingId(result.id);
    setShareTarget(result);
    try {
      // Let the off-screen card render this match before capturing it.
      await waitForNextPaint();
      if (!shareCardRef.current) throw new Error('Share card is not ready.');
      const { nameB } = getShareCardProps(result);
      const outcome = await shareCardImage(shareCardRef.current, {
        fileName: 'animatch-our-match.png',
        title: 'Our AniMatch',
        message: `${nameB} and I are a ${Math.round(result.compatibility_score)}% match on AniMatch. Are you compatible?`,
        url: buildShareUrl('share-match'),
      });
      if (outcome === 'downloaded') showShareToast('Match card saved as an image.');
    } catch (shareError) {
      console.error('Error sharing match card:', shareError);
      showShareToast("We couldn't create the match card. Please try again.");
    } finally {
      setSharingId(null);
    }
  }

  function renderShareButton(result: CompatibilityResult, style?: object) {
    const isSharingThis = sharingId === result.id;
    return (
      <Pressable
        onPress={() => handleShareMatch(result)}
        disabled={sharingId !== null}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Share your match with ${getOtherUserName(result)}`}
        accessibilityState={{ busy: isSharingThis, disabled: sharingId !== null }}
        style={({ pressed }) => [styles.shareIconButton, style, pressed && { opacity: 0.7 }]}
      >
        {isSharingThis ? (
          <ActivityIndicator size="small" color={Colors.text} />
        ) : (
          <Ionicons name="share-outline" size={20} color={Colors.text} />
        )}
      </Pressable>
    );
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
    fetchAuras(item);
  };

  function isHidden(result: CompatibilityResult): boolean {
    return hiddenIds.has(Number(result.id));
  }

  async function handleConfirmHide() {
    if (!user?.id || !hideTarget || isHiding) return;
    const target = hideTarget;
    setIsHiding(true);
    try {
      await hideMatch(user.id, Number(target.id));
      setHiddenIds(current => new Set(current).add(Number(target.id)));
      setHideTarget(null);
    } catch (hideError) {
      console.error('Error hiding match:', hideError);
      setHideTarget(null);
      showShareToast("We couldn't hide that match. Please try again.");
    } finally {
      setIsHiding(false);
    }
  }

  async function handleUnhide(result: CompatibilityResult, openAfter = false) {
    if (!user?.id || unhidingId) return;
    setUnhidingId(result.id);
    try {
      await unhideMatch(user.id, Number(result.id));
      setHiddenIds(current => {
        const next = new Set(current);
        next.delete(Number(result.id));
        // Back to the list once nothing is hidden any more.
        if (next.size === 0) setIsShowingHidden(false);
        return next;
      });
      if (openAfter) {
        setHiddenNotice(null);
        handleResultPress(result);
      }
    } catch (unhideError) {
      console.error('Error showing match again:', unhideError);
      showShareToast("We couldn't show that match again. Please try again.");
    } finally {
      setUnhidingId(null);
    }
  }

  // Open the requested match once results are loaded, then clear the params.
  useEffect(() => {
    if ((!resultId && !withUser) || isLoading) return;
    const requested = compatibilityResults.find(result =>
      resultId
        ? String(result.id) === String(resultId)
        : result.relationship_type === relationshipType &&
          (result.user_a_id === user?.id ? result.user_b_id : result.user_a_id) === withUser,
    );
    if (requested) {
      setIsShowingHidden(false);
      if (isHidden(requested)) {
        setSelectedResult(null);
        setHiddenNotice(requested);
      } else {
        setHiddenNotice(null);
        handleResultPress(requested);
      }
    } else {
      // No such match (yet, e.g. an accepted invite before both quizzes): show the list.
      setSelectedResult(null);
      setHiddenNotice(null);
      setIsShowingHidden(false);
    }
    router.setParams({ resultId: undefined, withUser: undefined, relationshipType: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleResultPress / isHidden are recreated every render.
  }, [resultId, withUser, relationshipType, isLoading, compatibilityResults, router]);

  function renderCardActions(result: CompatibilityResult) {
    return (
      <View style={styles.cardActions}>
        {renderShareButton(result)}
        <Pressable
          onPress={() => setHideTarget(result)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`More options for your match with ${getOtherUserName(result)}`}
          style={({ pressed }) => [styles.shareIconButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text} />
        </Pressable>
      </View>
    );
  }


  const renderCompatibilityItem = ({ item }: { item: CompatibilityResult }) => {
    const isCurrentUserA = user?.id === item.user_a_id;
    const myAuraName = auraNamesById[isCurrentUserA ? item.user_a_aura_id : item.user_b_aura_id] ?? '';
    const otherAuraName = auraNamesById[isCurrentUserA ? item.user_b_aura_id : item.user_a_aura_id] ?? '';
    const otherAuraColor = getAuraColor(otherAuraName);
    const score = Math.round(item.compatibility_score);
    const level = getMatchLevel(score);
    const otherName = getOtherUserName(item);
    const areaScores = getStoredAreaScores(item);

    return (
      <MatchCard
        onPress={() => handleResultPress(item)}
        accessibilityLabel={`View details for match with ${otherName}`}
        action={renderCardActions(item)}
      >
        {(actionSlot, onHeaderLayout) => (
        <>
        <View style={styles.resultCardHeader} onLayout={onHeaderLayout}>
          <View style={styles.avatarPair}>
            <AuraAvatar animalName={myAuraName} size="small" />
            <AuraAvatar animalName={otherAuraName} size="small" style={styles.avatarOverlap} />
          </View>
          <View style={styles.resultCardText}>
            <ThemedText style={[styles.userName, { color: otherAuraColor }]} numberOfLines={1}>
              {otherName}
            </ThemedText>
            <View style={styles.metaRow}>
              {otherAuraName ? (
                <ThemedText type="muted" style={styles.animalName}>{otherAuraName}</ThemedText>
              ) : null}
              <View
                style={[
                  styles.relationshipTag,
                  { borderColor: withAlpha(otherAuraColor, 0.45), backgroundColor: withAlpha(otherAuraColor, 0.12) },
                ]}
              >
                <Ionicons name={getRelationshipIcon(item.relationship_type)} size={11} color={otherAuraColor} />
                <ThemedText style={[styles.relationshipTagText, { color: otherAuraColor }]}>
                  {formatRelationshipType(item.relationship_type)}
                </ThemedText>
              </View>
            </View>
          </View>
          {actionSlot}
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </View>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreRow}>
            <ThemedText style={[styles.scoreValue, { color: level.color }]}>{score}%</ThemedText>
            <ThemedText style={[styles.scoreLevel, { color: level.color }]}>{level.label}</ThemedText>
          </View>
          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreFill,
                { width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: level.color },
              ]}
            />
          </View>
          {areaScores ? <AreaBreakdown areas={areaScores} /> : null}
        </View>
        </>
        )}
      </MatchCard>
    );
  };


  function renderShowAgainButton(result: CompatibilityResult, openAfter = false) {
    const isUnhidingThis = unhidingId === result.id;
    return (
      <Pressable
        onPress={() => handleUnhide(result, openAfter)}
        disabled={unhidingId !== null}
        accessibilityRole="button"
        accessibilityLabel={`Show your match with ${getOtherUserName(result)} again`}
        accessibilityState={{ busy: isUnhidingThis, disabled: unhidingId !== null }}
        style={({ pressed }) => [styles.showAgainButton, pressed && { opacity: 0.7 }]}
      >
        {isUnhidingThis ? (
          <ActivityIndicator size="small" color={Colors.text} />
        ) : (
          <ThemedText style={styles.showAgainText}>Show again</ThemedText>
        )}
      </Pressable>
    );
  }

  function renderHiddenItem({ item }: { item: CompatibilityResult }) {
    const isCurrentUserA = user?.id === item.user_a_id;
    const myAuraName = auraNamesById[isCurrentUserA ? item.user_a_aura_id : item.user_b_aura_id] ?? '';
    const otherAuraName = auraNamesById[isCurrentUserA ? item.user_b_aura_id : item.user_a_aura_id] ?? '';
    return (
      <View style={[styles.resultCard, styles.resultCardWrapper]}>
        <View style={styles.hiddenCardRow}>
          <View style={styles.avatarPair}>
            <AuraAvatar animalName={myAuraName} size="small" />
            <AuraAvatar animalName={otherAuraName} size="small" style={styles.avatarOverlap} />
          </View>
          <View style={styles.resultCardText}>
            <ThemedText style={styles.hiddenName} numberOfLines={1}>{getOtherUserName(item)}</ThemedText>
            <ThemedText type="muted" style={styles.animalName}>
              {formatRelationshipType(item.relationship_type)}
            </ThemedText>
          </View>
          {renderShowAgainButton(item)}
        </View>
      </View>
    );
  }

  function renderHiddenLink(count: number) {
    if (count === 0) return null;
    return (
      <Pressable
        onPress={() => setIsShowingHidden(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.hiddenLink, pressed && { opacity: 0.7 }]}
      >
        <ThemedText type="muted" style={styles.hiddenLinkText}>Show hidden matches ({count})</ThemedText>
      </Pressable>
    );
  }

  function renderHiddenNotice(result: CompatibilityResult) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.hiddenNoticeIcon}>
          <Ionicons name="eye-off-outline" size={26} color={Colors.textSecondary} />
        </View>
        <ThemedText type="subtitle" style={styles.noResultsTitle}>This match is hidden</ThemedText>
        <ThemedText type="secondary" style={[styles.noResultsText, styles.hiddenNoticeText]}>
          You hid your match with {getOtherUserName(result)}.
        </ThemedText>
        {renderShowAgainButton(result, true)}
      </View>
    );
  }

  function renderDetailView(result: CompatibilityResult) {
    const isCurrentUserA = user?.id === result.user_a_id;
    // auraA belongs to user_a, auraB to user_b.
    const leftAura = isCurrentUserA ? auraB : auraA; // connected user
    const rightAura = isCurrentUserA ? auraA : auraB; // current user

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
              <ThemedText style={[styles.detailScoreValue, { color: getMatchLevel(Math.round(result.compatibility_score)).color }]}>
                {Math.round(result.compatibility_score)}%
              </ThemedText>
              <ThemedText style={[styles.detailScoreLevel, { color: getMatchLevel(Math.round(result.compatibility_score)).color }]}>
                {getMatchLevel(Math.round(result.compatibility_score)).label}
              </ThemedText>
              <ThemedText type="secondary" style={styles.detailUserName}>
                Match with {getOtherUserName(result)}
              </ThemedText>
              <ThemedText type="muted" style={styles.detailRelationshipType}>
                {formatRelationshipType(result.relationship_type)}
              </ThemedText>
            </View>
            <PersonalInsights key={result.id} resultId={result.id} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const visibleResults = compatibilityResults.filter(result => !isHidden(result));
  const hiddenResults = compatibilityResults.filter(isHidden);

  function handleBack() {
    if (selectedResult) {
      setSelectedResult(null);
      return;
    }
    if (hiddenNotice) {
      setHiddenNotice(null);
      return;
    }
    setIsShowingHidden(false);
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: selectedResult
              ? 'Relationship details'
              : hiddenNotice
                ? 'Hidden match'
                : isShowingHidden
                  ? 'Hidden matches'
                  : 'Compatibility',
            headerLeft: () => selectedResult || hiddenNotice || isShowingHidden ? (
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
              </Pressable>
            ) : null,
            headerRight: () => (
              <HeaderActions style={styles.headerActions}>
                {selectedResult ? renderShareButton(selectedResult, styles.headerShareButton) : null}
              </HeaderActions>
            ),
          }}
        />
        {selectedResult ? (
          renderDetailView(selectedResult)
        ) : hiddenNotice ? (
          renderHiddenNotice(hiddenNotice)
        ) : isShowingHidden ? (
          <FlatList
            data={hiddenResults}
            renderItem={renderHiddenItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.container}>
            <View style={styles.inviteBar}>
              <AuraButton
                label="Invite someone"
                icon="person-add"
                onPress={() => setIsInviteOpen(true)}
                style={styles.inviteButton}
              />
            </View>
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.textSecondary} />
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : visibleResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ThemedText type="subtitle" style={styles.noResultsTitle}>
                  No matches yet
                </ThemedText>
                <ThemedText type="secondary" style={styles.noResultsText}>
                  Invite someone to see how your auras match. Once they accept and you&apos;ve both taken the quiz, your match shows up here.
                </ThemedText>
                {renderHiddenLink(hiddenResults.length)}
              </View>
            ) : (
              <FlatList
                data={visibleResults}
                renderItem={renderCompatibilityItem}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContainer}
                ListFooterComponent={renderHiddenLink(hiddenResults.length) ?? undefined}
              />
            )}
          </View>
        )}
        {shareToast ? (
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <ThemedText style={styles.toastText}>{shareToast}</ThemedText>
          </View>
        ) : null}
        {shareTarget ? (
          <ShareCardHost ref={shareCardRef}>
            <MatchShareCard {...getShareCardProps(shareTarget)} />
          </ShareCardHost>
        ) : null}
        <HideMatchDialog
          key={hideTarget ? String(hideTarget.id) : 'closed'}
          name={hideTarget ? getOtherUserName(hideTarget) : null}
          isHiding={isHiding}
          onConfirm={handleConfirmHide}
          onClose={() => setHideTarget(null)}
        />
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
    paddingTop: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  // Fixed above the list. The bottom padding keeps the button's glow out of the
  // list's scroll area, so cards scroll out of view below it instead of under it.
  inviteBar: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 16,
    backgroundColor: Colors.background,
    zIndex: 1,
  },
  // Primary pill with a soft light glow (shadow* props also render on web).
  inviteButton: {
    alignSelf: 'stretch',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  listContainer: {
    padding: 20,
    paddingTop: 8,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  resultCardWrapper: {
    marginBottom: 14,
  },
  resultCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPair: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarOverlap: {
    marginLeft: -18,
  },
  resultCardText: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  animalName: {
    fontSize: 14,
  },
  relationshipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  relationshipTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  scoreContainer: {
    backgroundColor: Colors.cardRaised,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  scoreLevel: {
    fontSize: 14,
    fontWeight: '500',
  },
  scoreTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 2,
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
  shareIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    marginRight: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Same footprint as cardActions (two 36 buttons + 8 margins), so the header layout doesn't change.
  shareIconSlot: {
    width: 88,
    height: 36,
  },
  headerShareButton: {
    marginRight: 0,
  },
  hiddenCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hiddenName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  showAgainButton: {
    minWidth: 104,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAgainText: {
    fontSize: 14,
    fontWeight: '500',
  },
  hiddenLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  hiddenLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  hiddenNoticeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginBottom: 16,
  },
  hiddenNoticeText: {
    marginBottom: 20,
  },
  shareIconOverlay: {
    position: 'absolute',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  toast: {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: 24,
    alignSelf: 'center',
    maxWidth: '90%',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
  },
  toastText: {
    fontSize: 14,
    lineHeight: 20,
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
  },
  detailScoreLevel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
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
