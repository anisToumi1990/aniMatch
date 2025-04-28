import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

interface AuthContextProps {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
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

  const refreshSession = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
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
    refreshSession,
    signInWithGoogle,
    signInWithApple,
    checkEmailExists: async (email: string) => {
      try {
        // Try to reset password for the email - this endpoint returns an error if email doesn't exist
        // but will return success for existing emails without actually sending an email
        const { error, data } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'io.supabase.animatch://no-reset', // Invalid URL, we don't actually want to reset
        });
        
        // If there's no error, email exists in the system
        if (!error) {
          // Check for more confirmation
          return true;
        }
        
        // If the error message includes "user not found", email doesn't exist
        if (error && error.message && 
           (error.message.toLowerCase().includes('user not found') || 
            error.message.toLowerCase().includes('no user found'))) {
          return false;
        }
        
        // If we get other errors, try the fallback method
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
        // First check if the email already exists to prevent duplicate registrations
        const emailExists = await value.checkEmailExists(email);
        if (emailExists) {
          return { 
            error: { 
              message: 'Email already registered. Please sign in or use a different email.'
            } 
          };
        }
        
        // Sign up with email and password
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        });
        
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