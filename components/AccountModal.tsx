import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface State {
  email: string;
  fullName: string;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  isSuccess: boolean;
  isEditingName: boolean;
  successMessage: string;
}

type Action =
  | { type: 'SET_EMAIL'; email: string }
  | { type: 'SET_FULL_NAME'; fullName: string }
  | { type: 'SET_EDITING_NAME'; isEditing: boolean }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; message?: string }
  | { type: 'SUBMIT_ERROR'; errorMessage: string }
  | { type: 'RESET' }
  | { type: 'RESET_EMAIL' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_EMAIL':
      return { ...state, email: action.email, hasError: false, errorMessage: '', isSuccess: false, successMessage: '' };
    case 'SET_FULL_NAME':
      return { ...state, fullName: action.fullName };
    case 'SET_EDITING_NAME':
      return { ...state, isEditingName: action.isEditing };
    case 'SUBMIT_START':
      return { ...state, isLoading: true, hasError: false, errorMessage: '', isSuccess: false, successMessage: '' };
    case 'SUBMIT_SUCCESS':
      return { 
        ...state, 
        isLoading: false, 
        isSuccess: true, 
        hasError: false, 
        errorMessage: '',
        successMessage: action.message || 'Operation successful'
      };
    case 'SUBMIT_ERROR':
      return { 
        ...state, 
        isLoading: false, 
        hasError: true, 
        errorMessage: action.errorMessage, 
        isSuccess: false,
        successMessage: ''
      };
    case 'RESET':
      return { 
        ...state, 
        email: '', 
        isLoading: false, 
        hasError: false, 
        errorMessage: '', 
        isSuccess: false,
        successMessage: ''
      };
    case 'RESET_EMAIL':
      return { ...state, email: '' };
    default:
      return state;
  }
}

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AccountModal({ visible, onClose }: AccountModalProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [state, dispatch] = React.useReducer(reducer, {
    email: '',
    fullName: user?.user_metadata?.full_name || '',
    isLoading: false,
    hasError: false,
    errorMessage: '',
    isSuccess: false,
    isEditingName: false,
    successMessage: '',
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  function handleEmailChange(text: string) {
    dispatch({ type: 'SET_EMAIL', email: text });
  }

  function handleFullNameChange(text: string) {
    dispatch({ type: 'SET_FULL_NAME', fullName: text });
  }

  async function handleNameSave() {
    if (!user?.id) return;
    
    dispatch({ type: 'SUBMIT_START' });
    try {
      // Update the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: state.fullName })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update the user metadata
      const { error: userError } = await supabase.auth.update({
        data: { full_name: state.fullName }
      });

      if (userError) throw userError;
      
      dispatch({ type: 'SET_EDITING_NAME', isEditing: false });
      dispatch({ type: 'SUBMIT_SUCCESS', message: 'Name updated successfully' });
    } catch (err: any) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: err.message || 'Failed to update name' });
    }
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

      if (checkError && checkError.code !== 'PGRST116') {
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
      dispatch({ type: 'SUBMIT_SUCCESS', message: 'Invitation sent successfully!' });
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        onClose();
        dispatch({ type: 'RESET' });
      }}
    >
      <TouchableWithoutFeedback
        onPress={event => {
          Keyboard.dismiss();
          if (event.target === event.currentTarget) {
            onClose();
            dispatch({ type: 'RESET' });
          }
        }}
        accessible={false}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <ThemedView style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                onClose();
                dispatch({ type: 'RESET' });
              }}
              accessibilityRole="button"
              accessibilityLabel="Close account modal"
            >
              <Ionicons name="close" size={28} color={textColor} />
            </TouchableOpacity>

            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <ThemedText style={styles.avatarText}>
                  {state.fullName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              
              {state.isEditingName ? (
                <View style={styles.nameEditContainer}>
                  <TextInput
                    style={[styles.nameInput, { color: textColor }]}
                    value={state.fullName}
                    onChangeText={handleFullNameChange}
                    placeholder="Enter your name"
                    placeholderTextColor="#6b7280"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleNameSave}
                    disabled={state.isLoading}
                  >
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.nameContainer}
                  onPress={() => dispatch({ type: 'SET_EDITING_NAME', isEditing: true })}
                >
                  <ThemedText style={styles.nameText}>{state.fullName}</ThemedText>
                  <Ionicons name="pencil" size={16} color={textColor} style={styles.editIcon} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Theme</ThemedText>
              <View style={styles.themeToggle}>
                <Ionicons name="sunny" size={24} color={textColor} />
                <Switch
                  value={isDarkMode}
                  onValueChange={setIsDarkMode}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={isDarkMode ? '#4f46e5' : '#f4f3f4'}
                />
                <Ionicons name="moon" size={24} color={textColor} />
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Invite Friends</ThemedText>
              <View style={styles.inviteContainer}>
                <TextInput
                  style={[styles.input, { color: textColor }]}
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
                <TouchableOpacity
                  style={styles.inviteButton}
                  onPress={handleInvitePress}
                  disabled={state.isLoading}
                >
                  <Ionicons name="send" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {state.hasError && (
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  {state.errorMessage}
                </ThemedText>
              )}
              {state.isSuccess && (
                <ThemedText style={styles.successText}>
                  {state.successMessage}
                </ThemedText>
              )}
            </View>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 36,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  editIcon: {
    opacity: 0.6,
  },
  nameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#4f46e5',
    paddingVertical: 4,
    marginRight: 8,
    minWidth: 150,
  },
  saveButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    padding: 8,
  },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  inviteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  inviteButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
  },
  successText: {
    color: '#22c55e',
    fontSize: 14,
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 