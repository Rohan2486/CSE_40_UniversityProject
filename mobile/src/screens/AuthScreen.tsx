import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Input, Screen, Subheading } from '../components/ui';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

export const AuthScreen = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter both email and password to continue.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        Alert.alert(
          'Account created',
          'Check your email for a confirmation link if confirmations are enabled in Supabase.',
        );
      }
    } catch (error) {
      Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>BreedVision Mobile</Text>
        <Heading>Use the same AI backend on Expo Go</Heading>
        <Subheading>
          This mobile app reuses your existing Supabase auth, edge functions, storage bucket, and breed-classification pipeline.
        </Subheading>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
        <Input value={email} onChangeText={setEmail} placeholder="Email" />
        <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <Button label={mode === 'login' ? 'Sign In' : 'Sign Up'} onPress={handleAuth} loading={loading} />
        <Button
          label={mode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
          onPress={() => setMode((current) => (current === 'login' ? 'signup' : 'login'))}
          variant="ghost"
        />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingTop: 48,
    gap: 10,
  },
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
});
