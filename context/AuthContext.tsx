import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User, Subscription } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isEmailConfirmed: boolean;
  /**
   * `needsEmailConfirmation` is true when Supabase created the user but returned
   * no session (email confirmation is on), so the user can't be signed in yet.
   */
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: any | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<{ error: any | null }>;
  refreshSession: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  session: null,
  user: null,
  isLoading: true,
  isEmailConfirmed: false,
  signUp: async () => ({ error: null, needsEmailConfirmation: false }),
  signIn: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  refreshSession: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

WebBrowser.maybeCompleteAuthSession();

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEmailConfirmed, setIsEmailConfirmed] = useState<boolean>(false);

  const refreshSession = async () => {
    try {
      const session = supabase.auth.session();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) setIsEmailConfirmed(session.user.email_confirmed_at !== null)
      else setIsEmailConfirmed(false)
      setIsLoading(false);
    } catch (error) {
      console.error('Error refreshing session:', error);
      setIsLoading(false);
    }
  };

  // Social sign-in helper function
  const signInWithProvider = async (provider: 'google' | 'apple') => {
    try {
      const redirectUri = makeRedirectUri({
        scheme: "animatchaura",
        path: "auth/callback",
      });
      const { error, url } = await supabase.auth.signIn({ provider }, { redirectTo: redirectUri });
      if (error) {
        if (error.message.includes('provider is not enabled')) throw new Error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login is not configured. Please enable ${provider} provider in Supabase dashboard.`)
        throw error;
      }
      if (!url) throw new Error(`Failed to get authentication URL for ${provider}`)
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type === 'success') await refreshSession()
      else if (result.type === 'cancel') throw new Error('Authentication cancelled')
    } catch (error) {
      console.error(`Error signing in with ${provider}:`, error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    await signInWithProvider('google');
  };

  const signInWithApple = async () => {
    await signInWithProvider('apple');
  };

  useEffect(() => {
    refreshSession();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) setIsEmailConfirmed(session.user.email_confirmed_at !== null)
      else setIsEmailConfirmed(false)
      setIsLoading(false);
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    isLoading,
    isEmailConfirmed,
    refreshSession,
    signInWithGoogle,
    signInWithApple,
    signUp: async (email: string, password: string, fullName: string) => {
      try {
        const { session: newSession, error } = await supabase.auth.signUp({ 
          email, 
          password,
        }, {
          data: {
            full_name: fullName
          }
        });
        if (error && error.message && 
            (error.message.includes('already registered') || 
             error.message.includes('User already registered'))) {
          return { 
            error: { 
              message: 'Email already registered. Please sign in or use a different email.'
            },
            needsEmailConfirmation: false,
          };
        }
        if (!error) await refreshSession();
        return { error, needsEmailConfirmation: !error && !newSession };
      } catch (error) {
        return { error, needsEmailConfirmation: false };
      }
    },
    signIn: async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signIn({ email, password });
        if (!error) await refreshSession();
        return { error };
      } catch (error) {
        return { error };
      }
    },
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (!error) await refreshSession();
        return { error };
      } catch (error) {
        return { error };
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);