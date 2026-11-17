import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors, withAlpha } from '@/constants/Colors';
import { formatLongDate, WeekDay } from '@/lib/auraWeek';

interface WeekStripProps {
  days: WeekDay[];
  selectedDate: string;
  auraColor: string;
  /** Past day or today: show its message. */
  onSelectDay: (day: WeekDay) => void;
  /** Future day: open the paywall. */
  onLockedDay: (day: WeekDay) => void;
}

function accessibilityLabelFor(day: WeekDay, isSelected: boolean): string {
  const date = formatLongDate(day.localDate);
  if (day.kind === 'locked') return `${date}, locked. Premium`;
  if (day.kind === 'unavailable') return `${date}, not available yet`;
  return `${date}${day.kind === 'today' ? ', today' : ''}${isSelected ? ', selected' : ''}`;
}

/** 7 day pills: 4 past days, today (aura color), 2 locked days. */
export function WeekStrip({ days, selectedDate, auraColor, onSelectDay, onLockedDay }: WeekStripProps) {
  return (
    <View style={styles.row}>
      {days.map(day => {
        const isSelected = day.localDate === selectedDate;
        const isToday = day.kind === 'today';
        const isLocked = day.kind === 'locked';
        const isUnavailable = day.kind === 'unavailable';
        return (
          <Pressable
            key={day.localDate}
            onPress={() => (isLocked ? onLockedDay(day) : onSelectDay(day))}
            disabled={isUnavailable}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabelFor(day, isSelected)}
            aria-selected={isSelected}
            aria-disabled={isUnavailable}
            style={({ pressed }) => [
              styles.pill,
              isToday && { backgroundColor: withAlpha(auraColor, 0.22), borderColor: withAlpha(auraColor, 0.8) },
              isSelected && !isToday && styles.pillSelected,
              isSelected && isToday && { borderColor: auraColor },
              isUnavailable && styles.pillUnavailable,
              pressed && { opacity: 0.75 },
            ]}
          >
            <ThemedText style={[styles.weekday, isToday && { color: auraColor }]}>
              {isToday ? 'Today' : day.weekdayShort}
            </ThemedText>
            <ThemedText style={[styles.dayNumber, isLocked && styles.lockedText]}>{day.dayOfMonth}</ThemedText>
            {isLocked ? (
              <Ionicons name="lock-closed" size={11} color={Colors.textMuted} style={styles.lock} />
            ) : (
              <View style={[styles.dot, isSelected && { backgroundColor: isToday ? auraColor : Colors.text }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  pillSelected: {
    borderColor: Colors.text,
    backgroundColor: Colors.cardRaised,
  },
  pillUnavailable: {
    opacity: 0.35,
  },
  weekday: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  dayNumber: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: Colors.text,
  },
  lockedText: {
    color: Colors.textMuted,
  },
  lock: {
    height: 11,
    marginTop: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
});
