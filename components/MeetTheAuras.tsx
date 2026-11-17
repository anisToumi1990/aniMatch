import React, { useState } from 'react';
import { ScrollView, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraDetailsModal } from '@/components/AuraDetailsModal';
import { AURA_IMAGES, AuraImage } from '@/constants/AuraImages';
import { Colors } from '@/constants/Colors';

interface MeetTheAurasProps {
  style?: StyleProp<ViewStyle>;
}

/** Carousel of all auras; tapping one opens its personality popup. */
export function MeetTheAuras({ style }: MeetTheAurasProps) {
  const [selectedAura, setSelectedAura] = useState<AuraImage | null>(null);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>Meet the auras</ThemedText>
        <ThemedText type="muted">Tap one to explore its personality</ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {AURA_IMAGES.map(aura => (
          <TouchableOpacity
            key={aura.name}
            onPress={() => setSelectedAura(aura)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`See the ${aura.name} aura's personality`}
            style={styles.item}
          >
            <AuraAvatar animalName={aura.name} size="medium" />
            <ThemedText type="muted" style={styles.name}>{aura.name}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <AuraDetailsModal aura={selectedAura} onClose={() => setSelectedAura(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 4,
  },
  title: {
    fontSize: 18,
  },
  content: {
    paddingHorizontal: 16,
  },
  item: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  name: {
    marginTop: 6,
    fontSize: 13,
  },
});
