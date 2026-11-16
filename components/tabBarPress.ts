import { GestureResponderEvent, Platform } from 'react-native';

type PressHandler = ((event: GestureResponderEvent) => void) | undefined;

interface WebClickLike {
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number | null;
  preventDefault?: () => void;
}

/**
 * Tab bar buttons get an `href` on web, so react-native-web renders them as
 * links. A plain Pressable lets the browser follow that link, which reloads the
 * whole app. This wraps the tab's onPress so that on web a normal left click
 * stays client-side (preventDefault + React Navigation's onPress), while
 * Cmd/Ctrl/Shift/Alt-click and middle-click still open the link the browser way
 * (new tab / window), like React Navigation's own PlatformPressable.
 * On native it just calls onPress.
 */
export function withClientSideTabPress(onPress: PressHandler): PressHandler {
  if (Platform.OS !== 'web') return onPress;
  return event => {
    const click = event as unknown as WebClickLike;
    const nativeClick = (event?.nativeEvent ?? {}) as unknown as WebClickLike;
    const flag = (key: 'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey') => Boolean(click[key] ?? nativeClick[key]);
    const hasModifierKey = flag('metaKey') || flag('altKey') || flag('ctrlKey') || flag('shiftKey');
    const button = click.button ?? nativeClick.button;
    const isLeftClick = button == null || button === 0;
    if (hasModifierKey || !isLeftClick) return; // let the browser open it
    click.preventDefault?.();
    onPress?.(event);
  };
}
