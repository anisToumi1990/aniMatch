import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export interface FormMessageState {
  /** error: red, for problems. info: neutral, for information. */
  type: 'error' | 'info';
  text: string;
}

interface FormMessageProps {
  message: FormMessageState | null;
}

/**
 * Inline message under an auth form. Replaces Alert.alert, which does
 * nothing on react-native-web.
 */
export function FormMessage({ message }: FormMessageProps) {
  if (!message) return null;
  const isError = message.type === 'error';
  const color = isError ? Colors.danger : Colors.textSecondary;

  return (
    <View
      style={styles.container}
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={isError ? 'alert-circle-outline' : 'information-circle-outline'}
        size={18}
        color={color}
        style={styles.icon}
      />
      <Text style={[styles.text, { color }]}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  icon: {
    marginTop: 1,
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
