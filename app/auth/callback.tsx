import { useEffect } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
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
          // Set session based on URL parameters
          await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          });
          // Refresh auth state
          await refreshSession();
          // Redirect to home
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
      <ActivityIndicator size="large" color="#007bff" />
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
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
}); 