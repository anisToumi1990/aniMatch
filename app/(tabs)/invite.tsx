import React, { useReducer } from 'react';
import { View, TextInput, Text, Pressable, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

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
  | { type: 'RESET' };

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
    default:
      return state;
  }
}

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

export function InviteScreen() {
  const [state, dispatch] = useReducer(reducer, {
    email: '',
    isLoading: false,
    hasError: false,
    errorMessage: '',
    isSuccess: false,
  });
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  function handleEmailChange(text: string) {
    dispatch({ type: 'SET_EMAIL', email: text });
  }

  async function handleInvitePress() {
    if (!isValidEmail(state.email)) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'Please enter a valid email address.' });
      return;
    }
    if (!user?.id) {
      dispatch({ type: 'SUBMIT_ERROR', errorMessage: 'You must be logged in to send an invite.' });
      return;
    }
    dispatch({ type: 'SUBMIT_START' });
    try {
      const { error } = await supabase.from('invites').insert({
        inviter_user_id: user.id,
        recipient_email: state.email,
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 16 }} edges={['top', 'left', 'right']}>
        <View style={{ width: width > 400 ? 400 : '100%', gap: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#18181b', marginBottom: 8 }}>Invite a Friend</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: state.hasError ? '#ef4444' : '#d1d5db',
              backgroundColor: '#f3f4f6',
              color: '#18181b',
              borderRadius: 8,
              padding: 14,
              fontSize: 16,
              marginBottom: 4,
            }}
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
            <Text style={{ color: '#ef4444', fontSize: 14, marginBottom: 4 }} accessibilityRole="alert">
              {state.errorMessage}
            </Text>
          )}
          {state.isSuccess && (
            <Text style={{ color: '#22c55e', fontSize: 14, marginBottom: 4 }}>
              Invitation sent successfully!
            </Text>
          )}
          <Pressable
            onPress={handleInvitePress}
            style={({ pressed }) => [{
              backgroundColor: pressed ? '#6366f1' : '#4f46e5',
              opacity: state.isLoading ? 0.7 : 1,
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 8,
            }]}
            disabled={state.isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send Invite"
          >
            {state.isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Send Invite</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

export default InviteScreen; 