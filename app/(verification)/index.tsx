import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/Colors';

export default function VerificationScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
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
    color: Colors.textSecondary,
  },
  subMessage: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.text,
    fontWeight: '500',
    fontSize: 16,
  },
}); 