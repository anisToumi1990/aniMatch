import { ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { QuizProvider } from '../context/QuizContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import 'react-native-url-polyfill/auto';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { NavigationTheme } from '@/constants/Theme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// This is the main layout of the app
// It wraps all the screens in our app
export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QuizProvider>
          <NotificationsProvider>
            <ThemeProvider value={NavigationTheme}>
              <StatusBar style="light" />
              <AuthGuard />
            </ThemeProvider>
          </NotificationsProvider>
        </QuizProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// This component will handle the authentication state and redirect users accordingly
function AuthGuard() {
  const { session, isLoading, isEmailConfirmed } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inVerificationGroup = segments[0] === '(verification)';

    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/(auth)/login');
    } else if (session && !isEmailConfirmed && !inVerificationGroup) {
      // Redirect to verification if authenticated but email not confirmed
      router.replace('/(verification)');
    } else if (session && isEmailConfirmed && (inAuthGroup || inVerificationGroup)) {
      // Redirect to home if authenticated, email confirmed, and in auth/verification group
      router.replace('/(tabs)');
    }
  }, [session, isLoading, isEmailConfirmed, segments]);

  return <Slot />;
}

// Email verification screen component
function EmailVerificationScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.title}>Email verification required</Text>
        <Text style={styles.message}>
          Please check your email and click the verification link to activate your account.
        </Text>
        <Text style={styles.subMessage}>
          If you don't see the email, check your spam folder.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Create a verification screen route
export function VerificationScreen() {
  return <EmailVerificationScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
    color: Colors.text,
  },
  message: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 24,
    color: Colors.text,
  },
  subMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.onPrimary,
    fontWeight: '500',
    fontSize: 16,
  },
});
