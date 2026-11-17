import { DarkTheme, type Theme } from 'expo-router/react-navigation';
import { Colors } from './Colors';

/** Header options shared by the tab screens: transparent, light text, medium-weight title. */
export const transparentHeaderOptions = {
  headerShown: true,
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: Colors.text,
  headerTitleStyle: { fontWeight: '500' as const, fontSize: 17, color: Colors.text },
};

/** React Navigation theme so navigator backgrounds, cards and borders are dark. */
export const NavigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.text,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.danger,
  },
};
