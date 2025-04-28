import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

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
  const selectedBackgroundColor = '#7E4EFF';
  const selectedTextColor = '#FFFFFF';
  
  const unselectedBackgroundColor = '#F2F2F7';
  const unselectedTextColor = '#000000';

  const borderColor = '#E5E5EA';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? selectedBackgroundColor : unselectedBackgroundColor,
          borderColor: isSelected ? selectedBackgroundColor : borderColor,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={[
        styles.keyContainer, 
        { 
          backgroundColor: isSelected ? '#FFFFFF' : selectedBackgroundColor,
        }
      ]}>
        <ThemedText 
          style={[
            styles.keyText, 
            { color: isSelected ? selectedBackgroundColor : '#FFFFFF' }
          ]}
        >
          {optionKey}
        </ThemedText>
      </View>
      
      <ThemedText 
        style={[
          styles.optionText, 
          { color: isSelected ? selectedTextColor : unselectedTextColor }
        ]}
      >
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
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  keyContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  keyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
}); 