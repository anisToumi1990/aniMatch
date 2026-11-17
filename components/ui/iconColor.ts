import { ColorValue, OpaqueColorValue } from 'react-native';

/**
 * React Native 0.88's ColorValue also allows null and numbers (e.g. the tab bar
 * icon color), which icon components don't accept. Narrow it to a string or a
 * platform color, or undefined.
 */
export function toIconColor(color: ColorValue | undefined): string | OpaqueColorValue | undefined {
  if (color == null || typeof color === 'number') return undefined;
  return color;
}
