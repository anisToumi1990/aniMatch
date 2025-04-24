Phase 1: Basic Authentication MVP
1. Project Setup

Install essential dependencies:
   cd your-app-name
   npx expo install @react-navigation/native
   npx expo install @react-navigation/native-stack
   npx expo install react-native-screens
   npx expo install react-native-safe-area-context
   npx expo install @supabase/supabase-js
   npx expo install react-native-url-polyfill
   npx expo install @react-native-async-storage/async-storage

2. Configure Supabase

1. Create src/lib/supabase.ts:

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
3. Create Basic File Structure

src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   └── app/
│       └── HomeScreen.tsx
├── navigation/
│   └── index.tsx
├── contexts/
│   └── AuthContext.tsx
└── types/
    └── index.ts
4. Set Up Navigation Types

// src/types/index.ts

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Home: undefined;
};
5. Create Navigation Structure

// src/navigation/index.tsx

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export function Navigation() {
  const [session, setSession] = useState<Session | null>(null);

  return (
    <NavigationContainer>
      {session ? (
        <AppStack.Navigator>
          <AppStack.Screen name="Home" component={HomeScreen} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
6. Create Auth Context

// src/contexts/AuthContext.tsx

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null,
  signUp: async (email: string, password: string) => {},
  signIn: async (email: string, password: string) => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      signUp: async (email, password) => {
        return await supabase.auth.signUp({ email, password });
      },
      signIn: async (email, password) => {
        return await supabase.auth.signInWithPassword({ email, password });
      },
      signOut: async () => {
        return await supabase.auth.signOut();
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
7. Create Login Screen

// src/screens/auth/LoginScreen.tsx

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? "Loading..." : "Login"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}
8. Create Register Screen

// src/screens/auth/RegisterScreen.tsx
// Similar to LoginScreen but using signUp instead of signIn
9. Create Home Screen

// src/screens/app/HomeScreen.tsx

export function HomeScreen() {
  const { signOut, session } = useAuth();

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Welcome {session?.user?.email}</Text>
      <Button title="Sign Out" onPress={signOut} />
    </View>
  );
}
10. Update App.tsx

// App.tsx

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}