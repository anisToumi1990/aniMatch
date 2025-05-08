import { View, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LoginForm } from '../../components/auth/LoginForm';
import { StatusBar } from 'expo-status-bar';
import { BackgroundPattern } from '../../components/BackgroundPattern';

export default function LoginScreen() {
  const router = useRouter();

  const handleRegisterPress = () => {
    router.replace('/(auth)/register');
  };

  return (
    <BackgroundPattern>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <LoginForm onRegisterPress={handleRegisterPress} />
      </SafeAreaView>
    </BackgroundPattern>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 150,
  },
}); 