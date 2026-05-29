import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <View style={{ flex: 1 }}><ActivityIndicator style={{ flex: 1 }} /></View>;

  return session ? <HomeScreen onLogout={() => setSession(null)} /> : <AuthScreen />;
}