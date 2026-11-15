import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Colors, withAlpha } from '@/constants/Colors';

// The app is dark-only for now ("Aura glow"), so the light/dark toggle is hidden.
// Flip this back on once light mode exists.
const SHOW_THEME_TOGGLE = false;

interface State {
  email: string;
  fullName: string;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  isSuccess: boolean;
  isEditingName: boolean;
  successMessage: string;
  nameHasError: boolean;
  nameErrorMessage: string;
  nameIsSuccess: boolean;
  nameSuccessMessage: string;
}

type Action =
  | { type: 'SET_EMAIL'; email: string }
  | { type: 'SET_FULL_NAME'; fullName: string }
  | { type: 'SET_EDITING_NAME'; isEditing: boolean }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; message?: string }
  | { type: 'SUBMIT_ERROR'; errorMessage: string }
  | { type: 'NAME_SUBMIT_SUCCESS'; message: string }
  | { type: 'NAME_SUBMIT_ERROR'; errorMessage: string }
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
    case 'NAME_SUBMIT_SUCCESS':
      return {
        ...state,
        isLoading: false,
        nameIsSuccess: true,
        nameHasError: false,
        nameErrorMessage: '',
        nameSuccessMessage: action.message
      };
    case 'NAME_SUBMIT_ERROR':
      return {
        ...state,
        isLoading: false,
        nameHasError: true,
        nameErrorMessage: action.errorMessage,
        nameIsSuccess: false,
        nameSuccessMessage: ''
      };
    case 'RESET':
      return { 
        ...state, 
        email: '', 
        isLoading: false, 
        hasError: false, 
        errorMessage: '', 
        isSuccess: false,
        successMessage: '',
        nameHasError: false,
        nameErrorMessage: '',
        nameIsSuccess: false,
        nameSuccessMessage: ''
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
    nameHasError: false,
    nameErrorMessage: '',
    nameIsSuccess: false,
    nameSuccessMessage: ''
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  // Add timeout refs
  const messageTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const nameMessageTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Cleanup function for timeouts
  const clearMessageTimeouts = () => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    if (nameMessageTimeoutRef.current) {
      clearTimeout(nameMessageTimeoutRef.current);
    }
  };

  // Clear messages after 5 seconds
  const setMessageTimeout = (type: 'email' | 'name') => {
    clearMessageTimeouts();
    const timeoutRef = type === 'email' ? messageTimeoutRef : nameMessageTimeoutRef;
    timeoutRef.current = setTimeout(() => {
      if (type === 'email') {
        dispatch({ type: 'RESET' });
      } else {
        dispatch({ type: 'NAME_SUBMIT_SUCCESS', message: ' ' });
        dispatch({ type: 'NAME_SUBMIT_ERROR', errorMessage: ' ' });
      }
    }, 5000);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clearMessageTimeouts();
    };
  }, []);

  function handleEmailChange(text: string) {
    dispatch({ type: 'SET_EMAIL', email: text });
  }

  function handleFullNameChange(text: string) {
    dispatch({ type: 'SET_FULL_NAME', fullName: text });
  }

  async function handleNameSave() {
    if (!user?.id) return;
    
    // Validate name is not empty
    if (!state.fullName.trim()) {
      dispatch({ type: 'NAME_SUBMIT_ERROR', errorMessage: 'Name cannot be empty' });
      setMessageTimeout('name');
      return;
    }
    
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
      dispatch({ type: 'NAME_SUBMIT_SUCCESS', message: 'Name updated successfully' });
      setMessageTimeout('name');
    } catch (err: any) {
      dispatch({ type: 'NAME_SUBMIT_ERROR', errorMessage: err.message || 'Failed to update name' });
      setMessageTimeout('name');
    }
  }

  async function handleInvitePress() {
    dispatch({ type: 'RESET' });
    if (!isValidEmail(state.email)) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'Please enter a valid email address.' });
      setMessageTimeout('email');
      return;
    }
    if (!user?.id) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You must be logged in to send an invite.' });
      setMessageTimeout('email');
      return;
    }
    if (state.email.toLowerCase() === user.email?.toLowerCase()) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You cannot send an invitation to your own email address.' });
      setMessageTimeout('email');
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
      setMessageTimeout('email');
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
        setMessageTimeout('email');
        return;
      }

      if (bidirectionalInvites && bidirectionalInvites.length > 0) {
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'An invitation already exists between you and this user.' });
        setMessageTimeout('email');
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
        setMessageTimeout('email');
        return;
      }

      if (existingInvite) {
        dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You have already sent an invitation to this email address.' });
        setMessageTimeout('email');
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
        setMessageTimeout('email');
        return;
      }
      dispatch({ type: 'SUBMIT_SUCCESS', message: 'Invitation sent successfully!' });
      setMessageTimeout('email');
    } catch (err: any) {
      Keyboard.dismiss();
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: err.message || 'Failed to send invite.' });
      setMessageTimeout('email');
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
          // On web, Keyboard.dismiss() blurs the focused input, so pressing the
          // email field would immediately lose focus. Web has no soft keyboard
          // to dismiss anyway, so only do this on native.
          if (Platform.OS !== 'web') {
            Keyboard.dismiss();
          }
          if (event.target === event.currentTarget) {
            onClose();
            dispatch({ type: 'RESET' });
          }
        }}
        accessible={false}
      >
        <View style={[styles.modalOverlay, { backgroundColor: Colors.overlay }]}>
          <ThemedView style={[styles.modalContent, { backgroundColor: Colors.card }]}>
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
                    placeholderTextColor={Colors.textMuted}
                    keyboardAppearance="dark"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleNameSave}
                    disabled={state.isLoading}
                  >
                    <Ionicons name="checkmark" size={22} color={Colors.onPrimary} />
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
              <View style={styles.messageContainer}>
                {state.nameHasError && (
                  <ThemedText style={styles.errorText} accessibilityRole="alert">
                    {state.nameErrorMessage}
                  </ThemedText>
                )}
                {state.nameIsSuccess && (
                  <ThemedText style={styles.successText}>
                    {state.nameSuccessMessage}
                  </ThemedText>
                )}
              </View>
            </View>

            {SHOW_THEME_TOGGLE && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Theme</ThemedText>
                <View style={styles.themeOptions}>
                  <TouchableOpacity
                    style={[
                      styles.themeOption,
                      !isDarkMode && styles.selectedThemeOption,
                    ]}
                    onPress={() => setIsDarkMode(false)}
                  >
                    <Ionicons name="sunny" size={24} color={!isDarkMode ? Colors.text : Colors.textMuted} />
                    <ThemedText style={[
                      styles.themeOptionText,
                      !isDarkMode && styles.selectedThemeText,
                    ]}>
                      Light
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.themeOption,
                      isDarkMode && styles.selectedThemeOption,
                    ]}
                    onPress={() => setIsDarkMode(true)}
                  >
                    <Ionicons name="moon" size={24} color={isDarkMode ? Colors.text : Colors.textMuted} />
                    <ThemedText style={[
                      styles.themeOptionText,
                      isDarkMode && styles.selectedThemeText,
                    ]}>
                      Dark
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Invite friends</ThemedText>
              <View style={styles.inviteContainer}>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Enter email address"
                  placeholderTextColor={Colors.textMuted}
                  keyboardAppearance="dark"
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
                  <Ionicons name="send" size={20} color={Colors.onPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.messageContainer}>
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
            </View>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <ThemedText style={styles.signOutText}>Sign out</ThemedText>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 125,
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    marginHorizontal: 20,
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
    backgroundColor: Colors.cardRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '500',
    color: Colors.text,
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
    fontWeight: '500',
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
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: Colors.textSecondary,
    paddingVertical: 4,
    marginRight: 8,
    minWidth: 150,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 8,
  },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  themeOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedThemeOption: {
    borderColor: Colors.text,
    backgroundColor: withAlpha(Colors.text, 0.06),
  },
  themeOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedThemeText: {
    color: Colors.text,
    fontWeight: '500',
  },
  inviteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    borderRadius: 999,
    paddingHorizontal: 18,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  inviteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    padding: 12,
  },
  messageContainer: {
    height: 24,
    marginTop: 4,
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
  },
  successText: {
    color: Colors.success,
    fontSize: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  signOutText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
}); 