import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button } from '../../components/Button';
import { apiService } from '../../services/api';
import { colors, radius, space } from '../../theme';
import { serifFamily } from '../../theme/typography';

export const SignInScreen = ({ route }: any) => {
  const onSignIn: (() => void) | undefined = route?.params?.onSignIn;
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem('deviceId').then((id) => {
      if (id) setDeviceId(id);
    });
  }, []);

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await apiService.requestOtp(phone);
      setStep('verify');
    } catch (err: any) {
      setError(`Failed to send code: ${err?.message ?? 'unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const { userToken, expiresAt } = await apiService.verifyOtp(phone, otpCode.trim(), deviceId);
      await AsyncStorage.setItem('userToken', userToken);
      await AsyncStorage.setItem('userTokenExpiresAt', String(expiresAt));
      onSignIn?.();
    } catch (err: any) {
      setError(`Verify failed: ${err?.message ?? 'unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await apiService.requestOtp(phone);
    } catch (err: any) {
      setError(`Failed to resend code: ${err?.message ?? 'unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>Alon</Text>
        <Text style={styles.tagline}>feel who's near</Text>

        {step === 'input' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.h1}>sign in</Text>
              <Text style={styles.p}>
                enter your phone number to sign in. we'll send you a 6-digit code.
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+63XXXXXXXXXX"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                keyboardType="phone-pad"
                autoFocus
              />
              <Text style={styles.hint}>
                enter your phone number in E.164 format (e.g., +63XXXXXXXXXX)
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
            <Button
              label="send code"
              tone="primary"
              onPress={sendOtp}
              disabled={!phone.trim() || loading}
            />
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.h1}>enter code</Text>
              <Text style={styles.p}>
                we sent a 6-digit code to {phone}
              </Text>
              <TextInput
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="------"
                placeholderTextColor={colors.textDim}
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={resendOtp} style={styles.resend}>
                <Text style={styles.resendText}>
                  {loading ? 'resending...' : 'resend code'}
                </Text>
              </Pressable>
            </View>
            <Button
              label="verify"
              tone="primary"
              onPress={verifyOtp}
              disabled={otpCode.trim().length !== 6 || loading}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgWarm },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.s4,
  },
  brand: {
    fontFamily: serifFamily,
    fontStyle: 'italic',
    fontSize: 22,
    letterSpacing: 2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: space.s5,
  },
  section: {
    gap: space.s3,
    marginBottom: space.s4,
    width: '100%',
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  p: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  hint: { fontSize: 11, color: colors.textMuted },
  error: {
    fontSize: 11,
    color: colors.red500,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    borderRadius: 12,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.bgWarmAlt,
  },
  otpInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    borderRadius: 12,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3,
    fontSize: 24,
    color: colors.textPrimary,
    backgroundColor: colors.bgWarmAlt,
    letterSpacing: 12,
    textAlign: 'center',
  },
  resend: {
    alignSelf: 'flex-start',
    marginTop: space.s2,
  },
  resendText: {
    fontSize: 11,
    color: colors.teal600,
    fontWeight: '600',
  },
});