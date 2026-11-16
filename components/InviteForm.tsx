import React from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';

/** Tabs the invite notices can link to. */
export type InviteLinkRoute = '/(tabs)/compatibility' | '/(tabs)/notifications';

type InviteNoticeKind = 'connected' | 'invitedByMe' | 'invitedMe';

/** Information (not an error) shown when an invite already exists with this person. */
interface InviteNotice {
  kind: InviteNoticeKind;
  /** The other person's full name, or their email if they have no name. */
  name: string;
}

interface ExistingInvite {
  inviter_user_id: string;
  recipient_user_id: string | null;
  status: string;
}

/** Accepted wins over pending; then a pending invite I sent, then one they sent. */
function getInviteNoticeKind(invites: ExistingInvite[], currentUserId: string): InviteNoticeKind | null {
  if (invites.some(invite => invite.status === 'accepted')) return 'connected';
  const pending = invites.filter(invite => invite.status === 'pending');
  if (pending.some(invite => invite.inviter_user_id === currentUserId)) return 'invitedByMe';
  if (pending.length > 0) return 'invitedMe';
  return null;
}

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

interface State {
  email: string;
  inviteNotice: InviteNotice | null;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  isSuccess: boolean;
  successMessage: string;
}

type Action =
  | { type: 'SET_EMAIL'; email: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; message: string }
  | { type: 'SUBMIT_ERROR'; errorMessage: string }
  | { type: 'SUBMIT_NOTICE'; notice: InviteNotice }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'RESET' };

const initialState: State = {
  email: '',
  inviteNotice: null,
  isLoading: false,
  hasError: false,
  errorMessage: '',
  isSuccess: false,
  successMessage: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_EMAIL':
      return { ...state, email: action.email, hasError: false, errorMessage: '', isSuccess: false, successMessage: '', inviteNotice: null };
    case 'SUBMIT_START':
      return { ...state, isLoading: true, hasError: false, errorMessage: '', isSuccess: false, successMessage: '', inviteNotice: null };
    case 'SUBMIT_SUCCESS':
      // Clear the field so the next invite starts from an empty form.
      return { ...state, email: '', isLoading: false, isSuccess: true, hasError: false, errorMessage: '', successMessage: action.message };
    case 'SUBMIT_NOTICE':
      return { ...state, isLoading: false, hasError: false, errorMessage: '', isSuccess: false, successMessage: '', inviteNotice: action.notice };
    case 'SUBMIT_ERROR':
      return { ...state, isLoading: false, hasError: true, errorMessage: action.errorMessage, isSuccess: false, successMessage: '' };
    case 'CLEAR_MESSAGES':
      return { ...state, hasError: false, errorMessage: '', isSuccess: false, successMessage: '', inviteNotice: null };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface InviteFormProps {
  /**
   * Called when a notice link ("Compatibility", "notifications") is pressed.
   * The form resets itself first. Defaults to navigating to that tab.
   */
  onLinkPress?: (route: InviteLinkRoute) => void;
  autoFocus?: boolean;
}

/** Email field + send button that creates an invite, with inline feedback. */
export function InviteForm({ onLinkPress, autoFocus = false }: InviteFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const messageTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function clearMessageTimeout() {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
  }

  // Messages disappear after 5 seconds. A failed or blocked invite also clears
  // the field, as before; a sent invite has already cleared it.
  function setMessageTimeout() {
    clearMessageTimeout();
    messageTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'RESET' });
    }, 5000);
  }

  React.useEffect(() => clearMessageTimeout, []);

  function fail(errorMessage: string) {
    dispatch({ type: 'SUBMIT_ERROR', errorMessage });
    setMessageTimeout();
  }

  async function handleInvitePress() {
    const email = state.email.toLowerCase();
    dispatch({ type: 'CLEAR_MESSAGES' });
    if (!isValidEmail(email)) {
      fail('Please enter a valid email address.');
      return;
    }
    if (!user?.id) {
      fail('You must be logged in to send an invite.');
      return;
    }
    if (email === user.email?.toLowerCase()) {
      fail('You cannot send an invitation to your own email address.');
      return;
    }

    // Check if the email belongs to an existing user
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    if (userCheckError && userCheckError.code !== 'PGRST116') {
      fail('Failed to check existing users.');
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
        fail('Failed to check existing invitations.');
        return;
      }

      if (bidirectionalInvites && bidirectionalInvites.length > 0) {
        const noticeKind = getInviteNoticeKind(bidirectionalInvites, user.id);
        if (noticeKind) {
          const otherName = existingUser.full_name?.trim() || existingUser.email || email;
          dispatch({ type: 'SUBMIT_NOTICE', notice: { kind: noticeKind, name: otherName } });
          setMessageTimeout();
          return;
        }
        // The query only returns pending/accepted invites, so this is a fallback.
        fail('An invitation already exists between you and this user.');
        return;
      }
    } else {
      // If recipient is not registered, only check for invites sent to this email
      const { data: existingInvite, error: checkError } = await supabase
        .from('invites')
        .select('id')
        .eq('inviter_user_id', user.id)
        .eq('recipient_email', email)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        fail('Failed to check existing invitations.');
        return;
      }

      if (existingInvite) {
        fail('You have already sent an invitation to this email address.');
        return;
      }
    }

    dispatch({ type: 'SUBMIT_START' });
    try {
      const { error } = await supabase.from('invites').insert({
        inviter_user_id: user.id,
        recipient_email: email,
        recipient_user_id: existingUser?.id || null,
        status: 'pending',
      });
      Keyboard.dismiss();
      if (error) {
        fail(error.message || 'Failed to send invite.');
        return;
      }
      dispatch({ type: 'SUBMIT_SUCCESS', message: 'Invitation sent successfully!' });
      setMessageTimeout();
    } catch (err: any) {
      Keyboard.dismiss();
      fail(err.message || 'Failed to send invite.');
    }
  }

  function handleLinkPress(route: InviteLinkRoute) {
    clearMessageTimeout();
    dispatch({ type: 'RESET' });
    if (onLinkPress) {
      onLinkPress(route);
      return;
    }
    router.navigate(route);
  }

  function renderInviteNotice(notice: InviteNotice) {
    if (notice.kind === 'connected') {
      return (
        <ThemedText style={styles.noticeText} accessibilityLiveRegion="polite">
          You&apos;re already connected with {notice.name}. See your match in{' '}
          <ThemedText
            style={styles.noticeLink}
            onPress={() => handleLinkPress('/(tabs)/compatibility')}
            accessibilityRole="link"
          >
            Compatibility
          </ThemedText>
          .
        </ThemedText>
      );
    }
    if (notice.kind === 'invitedByMe') {
      return (
        <ThemedText style={styles.noticeText} accessibilityLiveRegion="polite">
          You already invited {notice.name}. Waiting for them to accept.
        </ThemedText>
      );
    }
    return (
      <ThemedText style={styles.noticeText} accessibilityLiveRegion="polite">
        {notice.name} already invited you. Check your{' '}
        <ThemedText
          style={styles.noticeLink}
          onPress={() => handleLinkPress('/(tabs)/notifications')}
          accessibilityRole="link"
        >
          notifications
        </ThemedText>
        .
      </ThemedText>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inviteContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter email address"
          placeholderTextColor={Colors.textMuted}
          keyboardAppearance="dark"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={state.email}
          onChangeText={text => dispatch({ type: 'SET_EMAIL', email: text })}
          accessible
          accessibilityLabel="Email address input"
          returnKeyType="done"
          autoFocus={autoFocus}
        />
        <TouchableOpacity
          style={[styles.inviteButton, state.isLoading && styles.inviteButtonBusy]}
          onPress={handleInvitePress}
          disabled={state.isLoading}
          accessibilityRole="button"
          accessibilityLabel="Send invite"
          accessibilityState={{ disabled: state.isLoading, busy: state.isLoading }}
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
        {state.inviteNotice && renderInviteNotice(state.inviteNotice)}
        {state.isSuccess && (
          <ThemedText style={styles.successText} accessibilityLiveRegion="polite">
            {state.successMessage}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
    color: Colors.text,
  },
  inviteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    padding: 12,
  },
  inviteButtonBusy: {
    opacity: 0.6,
  },
  messageContainer: {
    minHeight: 24,
    marginTop: 4,
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
  },
  noticeText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeLink: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  successText: {
    color: Colors.success,
    fontSize: 14,
  },
});
