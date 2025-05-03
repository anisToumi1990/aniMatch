import { View, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { StatusBar } from 'expo-status-bar';

export default function RegisterScreen() {
  const router = useRouter();
  
  const handleLoginPress = () => {
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../assets/images/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <RegisterForm onLoginPress={handleLoginPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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