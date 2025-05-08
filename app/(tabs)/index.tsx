import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Modal, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import React, { useState, useReducer } from 'react';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase';
import { BackgroundPattern } from '../../components/BackgroundPattern';

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

interface State {
  email: string;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  isSuccess: boolean;
}

type Action =
  | { type: 'SET_EMAIL'; email: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; errorMessage: string }
  | { type: 'RESET' }
  | { type: 'RESET_EMAIL' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_EMAIL':
      return { ...state, email: action.email, hasError: false, errorMessage: '', isSuccess: false };
    case 'SUBMIT_START':
      return { ...state, isLoading: true, hasError: false, errorMessage: '', isSuccess: false };
    case 'SUBMIT_SUCCESS':
      return { ...state, isLoading: false, isSuccess: true, hasError: false, errorMessage: '' };
    case 'SUBMIT_ERROR':
      return { ...state, isLoading: false, hasError: true, errorMessage: action.errorMessage, isSuccess: false };
    case 'RESET':
      return { email: '', isLoading: false, hasError: false, errorMessage: '', isSuccess: false };
    case 'RESET_EMAIL':
      return { ...state, email: '' };
    default:
      return state;
  }
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Get the user's full name from user metadata
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const userInitial = fullName.charAt(0).toUpperCase();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [state, dispatch] = useReducer(reducer, {
    email: '',
    isLoading: false,
    hasError: false,
    errorMessage: '',
    isSuccess: false,
  });

  function handleEmailChange(text: string) {
    dispatch({ type: 'SET_EMAIL', email: text });
  }

  async function handleInvitePress() {
    dispatch({ type: 'RESET' });
    if (!isValidEmail(state.email)) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'Please enter a valid email address.' });
      return;
    }
    if (!user?.id) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You must be logged in to send an invite.' });
      return;
    }
    if (state.email.toLowerCase() === user.email?.toLowerCase()) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You cannot send an invitation to your own email address.' });
      return;
    }
    
    // Check if the email belongs to an existing user
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', state.email.toLowerCase())
      .single();

    if (userCheckError && userCheckError.code !== 'PGRST116') {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'Failed to check existing users.' });
      return;
    }

    if (existingUser?.id) {
      // Check for any invite in either direction with status 'pending' or 'accepted'
      const { data: bidirectionalInvites, error: bidirectionalError } = await supabase
        .from('invites')
        .select('id, inviter_user_id, recipient_user_id, status')
        .or(`and(inviter_user_id.eq.${user.id},recipient_user_id.eq.${existingUser.id}),and(inviter_user_id.eq.${existingUser.id},recipient_user_id.eq.${user.id})`)
        .in('status', ['pending', 'accepted']);

      if (bidirectionalError) {
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'Failed to check existing invitations.' });
        return;
      }

      if (bidirectionalInvites && bidirectionalInvites.length > 0) {
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'An invitation already exists between you and this user.' });
        return;
      }
    } else {
      // If recipient is not registered, only check for invites sent to this email
      const { data: existingInvite, error: checkError } = await supabase
        .from('invites')
        .select('id')
        .eq('inviter_user_id', user.id)
        .eq('recipient_email', state.email.toLowerCase())
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'Failed to check existing invitations.' });
        return;
      }

      if (existingInvite) {
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You have already sent an invitation to this email address.' });
        return;
      }
    }

    dispatch({ type: 'SUBMIT_START' });
    try {
      const { error } = await supabase.from('invites').insert({
        inviter_user_id: user.id,
        recipient_email: state.email.toLowerCase(),
        recipient_user_id: existingUser?.id || null,
        status: 'pending',
      });
      Keyboard.dismiss();
      if (error) {
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: error.message || 'Failed to send invite.' });
        return;
      }
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (err: any) {
      Keyboard.dismiss();
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: err.message || 'Failed to send invite.' });
    }
  }

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      router.replace("/(auth)/login");
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  return (
    <BackgroundPattern>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'AniMatch',
            headerShown: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTransparent: true,
            headerTintColor: '#2E7D32',
            headerRight: () => (
              <TouchableOpacity
                style={styles.userInitialButton}
                onPress={() => setShowAccountModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Open account menu"
              >
                <Image source={require('../../assets/images/avatar.png')} style={styles.avatarImage} resizeMode="cover" />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.auraCard}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={{ textAlign: 'center', color: '#2E7D32' }}>
                Welcome to{'\n'}
                🐾 AniMatch 🐾
              </ThemedText>
            </View>
            
            <View style={styles.descriptionContainer}>
              <ThemedText style={styles.descriptionText}>
                Discover your unique animal aura and unlock deeper connections.
              </ThemedText>
              <ThemedText style={styles.descriptionText}>
                Take our quick 10-question quiz to find out which animal reflects your personality – and explore how you vibe with others.
              </ThemedText>
            </View>

            <View style={styles.carouselContainer}>
              <ThemedText type="subtitle" style={styles.carouselTitle}>👇 Meet the Auras 👇</ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
              >
                <Image 
                  source={require('../../assets/auras/png/bear.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/cat.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/deer.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/dolphin.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/eagle.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/elephant.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/fox.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/lion.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/otter.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/owl.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/parrot.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/peacock.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/snake.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/unicorn.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/wolf.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                /> 
              </ScrollView>
            </View>
          </View>
        </ScrollView>
        <Modal
          visible={showAccountModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowAccountModal(false);
            dispatch({ type: 'RESET' });
          }}
        >
          <TouchableWithoutFeedback
            onPress={event => {
              Keyboard.dismiss();
              if (event.target === event.currentTarget) {
                setShowAccountModal(false);
                dispatch({ type: 'RESET' });
              }
            }}
            accessible={false}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Account</Text>
                <Text style={styles.modalSubtitle}>Invite a Friend</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#6b7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={state.email}
                  onChangeText={handleEmailChange}
                  accessible
                  accessibilityLabel="Email address input"
                  returnKeyType="done"
                />
                {state.hasError && (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {state.errorMessage}
                  </Text>
                )}
                {state.isSuccess && (
                  <Text style={styles.successText}>
                    Invitation sent successfully!
                  </Text>
                )}
                <TouchableOpacity
                  onPress={handleInvitePress}
                  style={styles.inviteButton}
                  disabled={state.isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Send Invite"
                >
                  {state.isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.inviteButtonText}>Send Invite</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSignOutButton}
                  onPress={handleSignOut}
                >
                  <Text style={styles.modalSignOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowAccountModal(false);
                    dispatch({ type: 'RESET' });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close account modal"
                >
                  <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </BackgroundPattern>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  auraCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    marginBottom: 20,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionText: {
    color: '#1B5E20',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  carouselContainer: {
    marginTop: 16,
  },
  carouselTitle: {
    textAlign: 'center',
    color: '#2E7D32',
    marginBottom: 16,
    fontSize: 18,
  },
  carouselContent: {
    paddingVertical: 8,
  },
  carouselImage: {
    width: 80,
    height: 80,
    marginHorizontal: 8,
  },
  userInitialButton: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    color: '#18181b',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 4,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 4,
  },
  successText: {
    color: '#22c55e',
    fontSize: 14,
    marginBottom: 4,
  },
  inviteButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalSignOutButton: {
    backgroundColor: '#ff6347',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  modalSignOutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
});
