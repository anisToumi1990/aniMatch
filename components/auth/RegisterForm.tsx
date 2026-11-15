import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { FormMessage, FormMessageState } from './FormMessage';

interface RegisterFormProps {
  onLoginPress?: () => void;
}

export function RegisterForm({ onLoginPress }: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<FormMessageState | null>(null);
  const { signUp, signIn } = useAuth();

  // Editing any field clears the previous message.
  function withMessageReset(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMessage(null);
    };
  }
  const navigation = useNavigation();
  const router = useRouter();

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setMessage(null);
    setIsLoading(true);
    try {
      const { error, needsEmailConfirmation } = await signUp(email, password, fullName);
      if (error) throw error;

      // Email confirmation is off: sign-up returns a session and the
      // AuthGuard takes the new user straight into the app.
      // If confirmation is ever turned back on, there is no session yet,
      // so say so instead of leaving the user on a silent form.
      if (needsEmailConfirmation) {
        setMessage({
          type: 'info',
          text: 'Account created. Check your email to confirm it, then sign in.',
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred during registration.' });
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    if (onLoginPress) {
      onLoginPress();
      return;
    }
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create account</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={withMessageReset(setFullName)}
              autoCapitalize="words"
              placeholderTextColor={Colors.textMuted}
              keyboardAppearance="dark"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={withMessageReset(setEmail)}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={Colors.textMuted}
              keyboardAppearance="dark"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Create a password"
                value={password}
                onChangeText={withMessageReset(setPassword)}
                secureTextEntry={!showPassword}
                placeholderTextColor={Colors.textMuted}
              keyboardAppearance="dark"
                textContentType="oneTimeCode"
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={22} 
                  color={Colors.textMuted} 
                />
              </TouchableOpacity>
            </View>
            {password.length > 0 && password.length < 6 && (
            <Text style={styles.helperText}>
              Password must be at least 6 characters
            </Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={withMessageReset(setConfirmPassword)}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor={Colors.textMuted}
              keyboardAppearance="dark"
                textContentType="oneTimeCode"
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={22} 
                  color={Colors.textMuted} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>

          <FormMessage message={message} />
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={navigateToLogin}
          >
            <Text style={styles.linkButtonText}>
              Already have an account? <Text style={styles.linkButtonEmphasis}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '500',
    marginBottom: 28,
    textAlign: 'center',
    color: Colors.text,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.cardRaised,
    padding: 16,
    borderRadius: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  eyeIcon: {
    padding: 10,
    marginRight: 10,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
  },
  button: {
    backgroundColor: Colors.primary,
    minHeight: 54,
    padding: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: Colors.onPrimary,
    fontWeight: '500',
    fontSize: 16,
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  linkButtonEmphasis: {
    color: Colors.text,
    fontWeight: '500',
  },
}); 