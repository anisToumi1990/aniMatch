import { Text, type TextProps, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'defaultSemiBold'
    | 'subtitle'
    | 'link'
    | 'secondary'
    | 'muted'
    | 'wordmark';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'secondary' ? styles.secondary : undefined,
        type === 'muted' ? styles.muted : undefined,
        type === 'wordmark' ? styles.wordmark : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  title: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  secondary: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  wordmark: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 4,
    color: Colors.textSecondary,
  },
});
