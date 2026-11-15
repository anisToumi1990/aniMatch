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
import { AntDesign } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { SHOW_SOCIAL_LOGIN } from '@/constants/Config';
import { FormMessage, FormMessageState } from './FormMessage';

interface LoginFormProps {
  onRegisterPress?: () => void;
}

export function LoginForm({ onRegisterPress }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<FormMessageState | null>(null);
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

  function handleEmailChange(text: string) {
    setEmail(text);
    setMessage(null);
  }

  function handlePasswordChange(text: string) {
    setPassword(text);
    setMessage(null);
  }
  const navigation = useNavigation();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    setMessage(null);
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      
      // Explicitly redirect to tabs after successful login
      router.replace("/(tabs)");
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred during login.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    try {
      setMessage(null);
      setSocialLoading(provider);
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || `Login with ${provider} failed. Please try again.`,
      });
    } finally {
      setSocialLoading(null);
    }
  };

  const navigateToRegister = () => {
    if (onRegisterPress) {
      onRegisterPress();
      return;
    }
    router.replace('/(auth)/register');
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
          <Text style={styles.title}>Sign in</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={handleEmailChange}
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
                placeholder="Enter your password"
                value={password}
                onChangeText={handlePasswordChange}
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
          </View>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
          
          <FormMessage message={message} />

          {SHOW_SOCIAL_LOGIN && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
          
              <View style={styles.socialButtonsContainer}>
                <TouchableOpacity
                  style={[styles.socialButton, styles.googleButton]}
                  onPress={() => handleSocialLogin('google')}
                  disabled={!!socialLoading}
                >
                  {socialLoading === 'google' ? (
                    <ActivityIndicator size="small" color={Colors.text} />
                  ) : (
                    <>
                      <AntDesign name="google" size={18} color={Colors.text} />
                      <Text style={styles.socialButtonText}>Google</Text>
                    </>
                  )}
                </TouchableOpacity>
            
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton]}
                  onPress={() => handleSocialLogin('apple')}
                  disabled={!!socialLoading}
                >
                  {socialLoading === 'apple' ? (
                    <ActivityIndicator size="small" color={Colors.text} />
                  ) : (
                    <>
                      <AntDesign name="apple1" size={18} color={Colors.text} />
                      <Text style={styles.socialButtonText}>Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={navigateToRegister}
          >
            <Text style={styles.linkButtonText}>
              Don&apos;t have an account? <Text style={styles.linkButtonEmphasis}>Sign up</Text>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: Colors.textMuted,
    fontSize: 13,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    padding: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 0.48,
  },
  googleButton: {
    backgroundColor: 'transparent',
  },
  appleButton: {
    backgroundColor: 'transparent',
  },
  socialButtonText: {
    color: Colors.text,
    fontWeight: '500',
    marginLeft: 8,
  },
  linkButton: {
    marginTop: 16,
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