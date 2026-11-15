import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { StatusBar } from 'expo-status-bar';
import { ScreenBackground } from '@/components/ScreenBackground';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';

export default function RegisterScreen() {
  const router = useRouter();
  
  const handleLoginPress = () => {
    router.replace('/(auth)/login');
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.logoContainer}>
          <ThemedText type="wordmark" style={styles.wordmark}>ANIMATCH</ThemedText>
          <AuraAvatar animalName="Fox" size="medium" />
          <ThemedText type="secondary" style={styles.tagline}>What&apos;s your aura?</ThemedText>
        </View>
        <RegisterForm onLoginPress={handleLoginPress} />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 8,
  },
  wordmark: {
    marginBottom: 24,
  },
  tagline: {
    marginTop: 12,
  },
}); 