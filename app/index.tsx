import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications } from '../lib/notifications';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        registerForPushNotifications(session.user.id);
        router.replace('/home');
      } else {
        router.replace('/auth');
      }

      setLoading(false);
    });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ActivityIndicator style={{ flex: 1 }} />
    </View>
  );
}