import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { QuizProvider } from '../context/QuizContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import 'react-native-url-polyfill/auto';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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
            <AuthGuard />
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
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Email Verification Required</Text>
        <Text style={styles.message}>
          Please check your email and click the verification link to activate your account.
        </Text>
        <Text style={styles.subMessage}>
          If you don't see the email, check your spam folder.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
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
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 24,
  },
  subMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
