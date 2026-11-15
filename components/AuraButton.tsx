import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

type AuraButtonVariant = 'primary' | 'secondary' | 'danger';

interface AuraButtonProps {
  label: string;
  onPress?: () => void;
  /** primary: light pill. secondary: outline. danger: outline with red text. */
  variant?: AuraButtonVariant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Optional element shown before the label instead of an Ionicons icon. */
  leading?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'regular' | 'large';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const VARIANT_COLORS: Record<AuraButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: Colors.primary, border: Colors.primary, text: Colors.onPrimary },
  secondary: { background: 'transparent', border: Colors.border, text: Colors.text },
  danger: { background: 'transparent', border: Colors.border, text: Colors.danger },
};

/** Fully rounded "Aura glow" button. */
export function AuraButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  leading,
  iconPosition = 'left',
  isLoading = false,
  disabled = false,
  size = 'regular',
  style,
  textStyle,
  accessibilityLabel,
}: AuraButtonProps) {
  const colors = VARIANT_COLORS[variant];
  const isInactive = disabled || isLoading;
  const iconElement = icon ? (
    <Ionicons name={icon} size={size === 'large' ? 20 : 18} color={colors.text} />
  ) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isInactive}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: isLoading }}
      style={[
        styles.button,
        size === 'large' ? styles.large : styles.regular,
        { backgroundColor: colors.background, borderColor: colors.border },
        disabled && !isLoading ? styles.disabled : undefined,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {leading}
          {iconPosition === 'left' ? iconElement : null}
          <Text
            style={[
              styles.label,
              size === 'large' ? styles.labelLarge : undefined,
              { color: colors.text },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {iconPosition === 'right' ? iconElement : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  large: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  disabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  labelLarge: {
    fontSize: 17,
  },
});
