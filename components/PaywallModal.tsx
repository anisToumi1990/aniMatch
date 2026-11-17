import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { weekdayName } from '@/lib/auraWeek';
import { PremiumPlan, PremiumSource, recordPremiumInterest } from '@/lib/supabase/premium';

interface PaywallModalProps {
  visible: boolean;
  /** The locked day that was tapped ("YYYY-MM-DD"), for the title. */
  lockedDate: string | null;
  animalName: string | null;
  source: PremiumSource;
  onClose: () => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const BENEFITS: { icon: IoniconName; title: string; text: string }[] = [
  { icon: 'calendar-outline', title: 'Tomorrow, today', text: 'See the week ahead before it happens.' },
  { icon: 'heart-outline', title: 'Love, Work and Friends readings', text: 'A daily reading for every part of your life.' },
  { icon: 'git-compare-outline', title: 'Deep compatibility report', text: 'Go far beyond the score with every match.' },
];

const PLANS: { id: PremiumPlan; title: string; price: string; note?: string; badge?: string }[] = [
  { id: 'yearly', title: 'Yearly', price: '€X.XX / year', note: '7 days free', badge: 'BEST VALUE' },
  { id: 'monthly', title: 'Monthly', price: '€X.XX / month' },
];

const TRIAL_STEPS: { day: string; text: string }[] = [
  { day: 'Today', text: 'Everything unlocked' },
  { day: 'Day 5', text: "We'll remind you before the trial ends" },
  { day: 'Day 7', text: 'Billing starts. Cancel anytime before' },
];

/**
 * Premium paywall, design only: no payment. The call to action records the
 * interest in premium_interest and shows an inline "coming soon" message.
 */
export function PaywallModal({ visible, lockedDate, animalName, source, onClose }: PaywallModalProps) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PremiumPlan>('yearly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Fresh state each time it opens (adjusted during render, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPlan('yearly');
      setIsSubmitting(false);
      setHasSubmitted(false);
    }
  }

  const auraColor = getAuraColor(animalName);
  const dayName = lockedDate ? weekdayName(lockedDate) : 'next';

  async function handleStart() {
    if (isSubmitting || hasSubmitted) return;
    setIsSubmitting(true);
    try {
      if (user?.id) await recordPremiumInterest(user.id, source, plan);
    } catch (error) {
      // The message is the same either way: there is nothing to buy yet.
      console.error('Error recording premium interest:', error);
    } finally {
      setIsSubmitting(false);
      setHasSubmitted(true);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.screen}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.content}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </Pressable>

            <View style={[styles.avatarGlow, { shadowColor: auraColor }]}>
              {animalName ? <AuraAvatar animalName={animalName} size="medium" /> : null}
            </View>
            <ThemedText style={[styles.eyebrow, { color: auraColor }]}>ANIMATCH PREMIUM</ThemedText>
            <ThemedText style={styles.title} accessibilityRole="header">
              Your {dayName} aura is already written.
            </ThemedText>

            <View style={styles.benefits}>
              {BENEFITS.map(benefit => (
                <View key={benefit.title} style={styles.benefit}>
                  <View style={[styles.benefitIcon, { backgroundColor: withAlpha(auraColor, 0.14) }]}>
                    <Ionicons name={benefit.icon} size={18} color={auraColor} />
                  </View>
                  <View style={styles.benefitText}>
                    <ThemedText style={styles.benefitTitle}>{benefit.title}</ThemedText>
                    <ThemedText type="secondary" style={styles.benefitBody}>{benefit.text}</ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.plans} accessibilityRole="radiogroup">
              {PLANS.map(option => {
                const isSelected = option.id === plan;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setPlan(option.id)}
                    accessibilityRole="radio"
                    aria-checked={isSelected}
                    accessibilityLabel={`${option.title}, ${option.price}${option.note ? `, ${option.note}` : ''}`}
                    style={({ pressed }) => [
                      styles.plan,
                      isSelected && { borderColor: auraColor, backgroundColor: withAlpha(auraColor, 0.1) },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {option.badge ? (
                      <View style={[styles.badge, { backgroundColor: auraColor }]}>
                        <ThemedText style={styles.badgeText}>{option.badge}</ThemedText>
                      </View>
                    ) : null}
                    <View style={[styles.radio, isSelected && { borderColor: auraColor }]}>
                      {isSelected ? <View style={[styles.radioDot, { backgroundColor: auraColor }]} /> : null}
                    </View>
                    <View style={styles.planText}>
                      <ThemedText style={styles.planTitle}>{option.title}</ThemedText>
                      {option.note ? <ThemedText style={[styles.planNote, { color: auraColor }]}>{option.note}</ThemedText> : null}
                    </View>
                    <ThemedText style={styles.planPrice}>{option.price}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {plan === 'yearly' ? (
              <View style={styles.timeline}>
                {TRIAL_STEPS.map((step, index) => (
                  <View key={step.day} style={styles.step}>
                    <View style={styles.stepRail}>
                      <View style={[styles.stepDot, index === 0 && { backgroundColor: auraColor, borderColor: auraColor }]} />
                      {index < TRIAL_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                    </View>
                    <View style={styles.stepText}>
                      <ThemedText style={styles.stepDay}>{step.day}</ThemedText>
                      <ThemedText type="secondary" style={styles.stepBody}>{step.text}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <AuraButton
              label={plan === 'yearly' ? 'Start 7-day free trial' : 'Continue with monthly'}
              onPress={handleStart}
              isLoading={isSubmitting}
              disabled={hasSubmitted}
              size="large"
              style={[styles.cta, { shadowColor: auraColor }]}
            />
            {hasSubmitted ? (
              <ThemedText style={styles.comingSoon} accessibilityLiveRegion="polite">
                Premium is coming soon. We&apos;ll let you know!
              </ThemedText>
            ) : null}
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.notNow, pressed && { opacity: 0.7 }]}>
              <ThemedText type="secondary" style={styles.notNowText}>Not now</ThemedText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  close: {
    alignSelf: 'flex-end',
    padding: 6,
    marginBottom: 4,
  },
  avatarGlow: {
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  benefits: {
    alignSelf: 'stretch',
    gap: 14,
    marginBottom: 24,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  benefitBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  plans: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 20,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 14,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.onPrimary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planText: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  planNote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  planPrice: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  timeline: {
    alignSelf: 'stretch',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
  },
  stepRail: {
    alignItems: 'center',
    width: 14,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    marginTop: 4,
  },
  stepLine: {
    flex: 1,
    width: 2,
    minHeight: 22,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  stepText: {
    flex: 1,
    paddingBottom: 12,
  },
  stepDay: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    alignSelf: 'stretch',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  comingSoon: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: Colors.success,
  },
  notNow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  notNowText: {
    fontSize: 15,
  },
});
