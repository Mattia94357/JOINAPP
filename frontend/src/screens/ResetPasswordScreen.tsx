import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { resetPasswordRequest } from '../api';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const passwordStrengthMessage = 'Password must be at least 8 characters and include a letter and a number.';
const isStrongPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const routeToken = route.params?.token;
  const initialToken = useMemo(() => {
    if (routeToken) return routeToken;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('token') || '';
    }
    return '';
  }, [routeToken]);
  const isDevelopment = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false;
  const [manualToken, setManualToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const showMessage = (title: string, body: string) => {
    if (Platform.OS === 'web') {
      window.alert(body);
    } else {
      Alert.alert(title, body);
    }
  };

  const handleReset = async () => {
    setMessage('');
    const token = manualToken.trim();

    if (!token) {
      setMessage('Reset token is missing. Request a new password reset link.');
      return;
    }

    if (!isStrongPassword(password)) {
      setMessage(passwordStrengthMessage);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await resetPasswordRequest(token, password);
      showMessage('Password updated', response.data.message || 'Password updated. You can now log in.');
      navigation.replace('Login');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.card}>
        <View style={styles.iconBubble}>
          <Text style={styles.iconText}>J</Text>
        </View>
        <Text style={styles.title}>Create a new password</Text>
        <Text style={styles.subtitle}>Choose a fresh password for your JOIN account.</Text>

        {isDevelopment && (
          <TextInput
            style={styles.input}
            placeholder="Development reset token"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            value={manualToken}
            onChangeText={setManualToken}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Reset password'}</Text>
        </TouchableOpacity>
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.lg,
    elevation: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    color: colors.primaryText,
    fontSize: 22,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  helperText: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    padding: spacing.md,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 14,
  },
});
