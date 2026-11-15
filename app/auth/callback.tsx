import { useEffect } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function AuthCallback() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Handle auth callback
      try {
        if (params.access_token && params.refresh_token) {
          // In supabase-js v1, setSession does not exist. Session is handled by the OAuth redirect.
          // Just refresh the session and redirect.
          await refreshSession();
          router.replace('/(tabs)');
        } else {
          // If no tokens found, go back to login
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
        router.replace('/(auth)/login');
      }
    };

    handleAuthCallback();
  }, [params, router, refreshSession]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.textSecondary} />
      <Text style={styles.text}>Completing authentication...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
}); 