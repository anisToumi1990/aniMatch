import { useEffect } from 'react';
import { Redirect, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (session) {
      // User is signed in, redirect to home
      router.replace("/(tabs)");
    } else {
      // User is not signed in, redirect to login
      router.replace("/(auth)/login");
    }
  }, [session, isLoading, router]);

  // Show a loading indicator while checking auth state
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
} 