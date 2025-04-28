import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      
      // Explicitly navigate to the login screen after sign out
      router.replace("/(auth)/login");
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  return (
    <ParallaxScrollView
      headerBackgroundColor="#A1CEDC"
      headerImage={
        <View style={styles.headerImageContainer}>
          <Text style={styles.headerText}>AniMatch</Text>
        </View>
      }>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Welcome to AniMatch!</ThemedText>
          <HelloWave />
        </ThemedView>
        
        <ThemedView style={styles.userInfoContainer}>
          <ThemedText type="subtitle">
            Hello, {user?.email || 'User'}
          </ThemedText>
          <ThemedText>
            You're signed in and ready to start matching!
          </ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">What's Next?</ThemedText>
          <ThemedText>
            Explore the app, take the personality quiz, and find your animal aura.
          </ThemedText>
        </ThemedView>

      </SafeAreaView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  userInfoContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 24,
  },
  signOutButton: {
    backgroundColor: '#ff6347',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
