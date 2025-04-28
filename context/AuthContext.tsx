import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isEmailConfirmed: boolean;
  checkEmailExists: (email: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any | null }>;
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
  checkEmailExists: async () => false,
  signUp: async () => ({ error: null }),
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
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      
      // Check if email is confirmed
      if (data.session?.user) {
        setIsEmailConfirmed(data.session.user.email_confirmed_at !== null);
      } else {
        setIsEmailConfirmed(false);
      }
      
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
      
      const { error, data } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        if (error.message.includes('provider is not enabled')) {
          throw new Error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login is not configured. Please enable ${provider} provider in Supabase dashboard.`);
        }
        throw error;
      }
      
      if (!data.url) {
        throw new Error(`Failed to get authentication URL for ${provider}`);
      }
      
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri
      );
      
      if (result.type === 'success') {
        await refreshSession();
      } else if (result.type === 'cancel') {
        throw new Error('Authentication cancelled');
      }
    } catch (error) {
      console.error(`Error signing in with ${provider}:`, error);
      throw error;
    }
  };

  // Google sign-in
  const signInWithGoogle = async () => {
    await signInWithProvider('google');
  };

  // Apple sign-in
  const signInWithApple = async () => {
    await signInWithProvider('apple');
  };

  useEffect(() => {
    refreshSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Update email confirmation status when auth state changes
      if (session?.user) {
        setIsEmailConfirmed(session.user.email_confirmed_at !== null);
      } else {
        setIsEmailConfirmed(false);
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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
    checkEmailExists: async (email: string) => {
      try {
        // Direct approach: Try to sign in with a dummy password
        // This is more reliable than the reset password approach
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: 'dummy-password-for-check',
        });
        
        // If we get a specific error about invalid credentials, the email exists
        // If we get a "user not found" error, the email doesn't exist
        if (error) {
          if (error.message && 
              (error.message.toLowerCase().includes('invalid login credentials') ||
               error.message.toLowerCase().includes('invalid email or password'))) {
            return true; // Email exists but password is wrong
          }
          
          if (error.message && 
              (error.message.toLowerCase().includes('user not found') || 
               error.message.toLowerCase().includes('no user found'))) {
            return false; // Email doesn't exist
          }
        }
        
        // If we get here, we couldn't determine with certainty
        // Try the fallback method
        console.log("Trying fallback email check method");
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: `Temp${Math.random().toString(36).slice(2, 10)}!`, // Random temp password
        });
        
        // If error contains 'already registered', the email exists
        if (signUpError && signUpError.message.includes('already registered')) {
          return true;
        }
        
        // If no clear indication, assume email doesn't exist
        return false;
      } catch (error) {
        console.error('Error checking email:', error);
        return false;
      }
    },
    signUp: async (email: string, password: string, fullName: string) => {
      try {
        // Directly attempt to sign up without checking if email exists first
        // Supabase will handle the validation and return appropriate errors
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        });
        
        // If the error is about email already registered, return a user-friendly message
        if (error && error.message && 
            (error.message.includes('already registered') || 
             error.message.includes('User already registered'))) {
          return { 
            error: { 
              message: 'Email already registered. Please sign in or use a different email.'
            } 
          };
        }
        
        if (!error) {
          await refreshSession();
        }
        return { error };
      } catch (error) {
        return { error };
      }
    },
    signIn: async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          await refreshSession();
        }
        return { error };
      } catch (error) {
        return { error };
      }
    },
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (!error) {
          await refreshSession();
        }
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