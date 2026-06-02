import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { forgotPasswordRequest } from '../api';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showNativeMessage = (title: string, body: string) => {
    if (Platform.OS === 'web') {
      window.alert(body);
    } else {
      Alert.alert(title, body);
    }
  };

  const handleRequestReset = async () => {
    setMessage('');
    setErrorMessage('');
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Enter the email you use for JOIN.');
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPasswordRequest(trimmedEmail);
      const responseMessage = response.data.message || 'If an account exists, reset instructions are on the way.';
      setMessage(responseMessage);

      if (response.data.resetToken) {
        navigation.navigate('ResetPassword', { token: response.data.resetToken });
        return;
      }

      if (response.data.resetUrl) {
        const token = response.data.resetUrl.split('token=').pop();
        if (token) {
          navigation.navigate('ResetPassword', { token });
          return;
        }
      }

      showNativeMessage('Check your email', responseMessage);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'Unable to request a reset link right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.card}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>J</Text>
        </View>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Enter your JOIN email and we will send a secure reset link.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSubtle}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={styles.button} onPress={handleRequestReset} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send reset link'}</Text>
        </TouchableOpacity>

        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.replace('Login')}>
          <Text style={styles.secondaryText}>Back to login</Text>
        </TouchableOpacity>
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
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
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
  successText: {
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 14,
  },
  secondaryAction: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  secondaryText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
});
