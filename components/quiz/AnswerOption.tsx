import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors, withAlpha } from '@/constants/Colors';

interface AnswerOptionProps {
  optionKey: string;
  optionText: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function AnswerOption({ 
  optionKey, 
  optionText, 
  isSelected, 
  onSelect 
}: AnswerOptionProps) {
  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.containerSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.keyContainer, isSelected && styles.keyContainerSelected]}>
        <ThemedText style={[styles.keyText, isSelected && styles.keyTextSelected]}>
          {optionKey}
        </ThemedText>
      </View>
      
      <ThemedText style={[styles.optionText, !isSelected && styles.optionTextIdle]}>
        {optionText}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
  },
  containerSelected: {
    borderColor: Colors.text,
    backgroundColor: withAlpha(Colors.text, 0.06),
  },
  keyContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  keyContainerSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  keyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  keyTextSelected: {
    color: Colors.onPrimary,
  },
  optionText: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  optionTextIdle: {
    color: Colors.textSecondary,
  },
});
