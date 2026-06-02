import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigation.replace('Home');
    }
  }, [user, navigation]);

  const handleSubmit = async () => {
    setError('');

    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      const message = 'Please fill in all required fields.';
      setError(message);
      if (Platform.OS === 'web') window.alert(message);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
      navigation.replace('Home');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.errors?.[0]?.msg ||
        'Unable to authenticate. Check your connection and try again.';
      setError(message);
      if (Platform.OS === 'web') window.alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.shell}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>J</Text>
        </View>
        <Text style={styles.brand}>JoinApp</Text>
        <Text style={styles.subtitle}>Premium local plans, trusted hosts and group chat without the noise.</Text>
      </View>
      <View style={styles.form}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, mode === 'login' && styles.segmentActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, mode === 'register' && styles.segmentActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>
        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.textSubtle}
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSubtle}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {mode === 'login' && (
          <TouchableOpacity style={styles.forgotButton} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={styles.secondaryAction} onPress={() => {
          setError('');
          setMode(mode === 'login' ? 'register' : 'login');
        }}>
          <Text style={styles.switchText}>
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  shell: {
    width: '100%',
    alignItems: 'center',
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoText: {
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: '900',
  },
  brand: {
    fontSize: 36,
    color: colors.text,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 360,
  },
  form: {
    width: '100%',
    marginTop: spacing.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.lg,
    elevation: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.surfaceSoft,
  },
  segmentText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: colors.text,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: spacing.lg,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingBottom: spacing.md,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '900',
    fontSize: 16,
  },
  secondaryAction: {
    paddingTop: spacing.md,
  },
  switchText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '700',
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.danger,
    textAlign: 'center',
    fontSize: 14,
  },
});
