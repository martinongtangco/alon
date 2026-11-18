import React, { useMemo, useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { useAppStore } from '../../state/store';
import { ALL_MODES, ALL_VIBES, Mode, Vibe } from '../../types';
import { colors, radius, space } from '../../theme';
import { serifFamily } from '../../theme/typography';
import { requestBlePermissions } from '../../utils/permissions';
import { apiService } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ADR 0035: birthdate step inserted between name and vibes
const STEPS = ['intro', 'name', 'birthdate', 'vibes', 'mode', 'permissions', 'phone'] as const;
type Step = (typeof STEPS)[number];

export const OnboardingScreen = () => {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem('deviceId').then((id) => {
      if (id) setDeviceId(id);
    });
  }, []);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  // ADR 0035: Age Verification — birthdate + 18+ confirmation
  const [birthdate, setBirthdate] = useState('');
  const [confirm18, setConfirm18] = useState(false);
  const [ageError, setAgeError] = useState('');
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [mode, setMode] = useState<Mode>('networking');
  const [permissionsGranted, setPermissionsGranted] = useState(true);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    if (step === 'permissions') {
      requestBlePermissions().then(setPermissionsGranted);
    }
  }, [stepIndex]);

  const step: Step = STEPS[stepIndex];
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'YO';
    const first = parts[0][0];
    const second = parts[1]?.[0] ?? parts[0][1] ?? '';
    return (first + second).toUpperCase();
  }, [name]);

  const canAdvance = (() => {
    if (step === 'name') return name.trim().length > 0;
    // ADR 0035: birthdate step validation
    if (step === 'birthdate') return birthdate.length >= 10 && confirm18;
    if (step === 'vibes') return vibes.length >= 1;
    if (step === 'phone') {
      if (phoneStep === 'input') return /^\+[1-9]\d{6,14}$/.test(phone.trim());
      return otpCode.trim().length === 6;
    }
    return true;
  })();

  const advance = async () => {
    // ADR 0035: verify age when advancing past birthdate step
    if (step === 'birthdate') {
      setAgeError('');
      try {
        // Client-side age check before calling server
        const dob = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 18) {
          setAgeError('Alon is for users 18 and older.');
          return;
        }
        await apiService.verifyAge(birthdate);
      } catch (err: any) {
        setAgeError(err?.message ?? 'Age verification failed');
        return;
      }
      if (stepIndex < STEPS.length - 1) {
        setStepIndex(stepIndex + 1);
      }
      return;
    }

    if (step === 'phone') {
      // In phone verify sub-step, verify the OTP
      if (phoneStep === 'verify') {
        setPhoneLoading(true);
        setPhoneError('');
        try {
          const { userToken, expiresAt } = await apiService.verifyOtp(phone, otpCode.trim(), deviceId);
          await AsyncStorage.setItem('userToken', userToken);
          await AsyncStorage.setItem('userTokenExpiresAt', String(expiresAt));
          completeOnboarding({
            name: name.trim() || 'You',
            initials,
            bio: bio.trim() || undefined,
            vibes,
            mode,
            ghostMode: false,
            // ADR 0035: age verified during birthdate step
            ageVerified: true,
          });
        } catch (err: any) {
          setPhoneError(`Verify failed: ${err?.message ?? 'unknown'}`);
        } finally {
          setPhoneLoading(false);
        }
        return;
      }
      // Otherwise request OTP
      setPhoneStep('verify');
      setOtpCode('');
      setPhoneLoading(true);
      setPhoneError('');
      try {
        await apiService.requestOtp(phone);
      } catch (err: any) {
        setPhoneError(`Failed to send code: ${err?.message ?? 'unknown error'}`);
      } finally {
        setPhoneLoading(false);
      }
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      completeOnboarding({
        name: name.trim() || 'You',
        initials,
        bio: bio.trim() || undefined,
        vibes,
        mode,
        ghostMode: false,
        // ADR 0035: age verified during birthdate step
        ageVerified: true,
      });
    }
  };

  const back = () => {
    if (step === 'phone' && phoneStep === 'verify') {
      setPhoneStep('input');
      setOtpCode('');
      setPhoneError('');
      return;
    }
    stepIndex > 0 && setStepIndex(stepIndex - 1);
  };

  const resendOtp = async () => {
    setPhoneLoading(true);
    setPhoneError('');
    try {
      await apiService.requestOtp(phone);
    } catch (err: any) {
      setPhoneError(`Failed to resend code: ${err?.message ?? 'unknown error'}`);
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>Alon</Text>
        <Text style={styles.tagline}>feel who's near</Text>

        <StepDots count={STEPS.length} current={stepIndex} />

        <View style={styles.body}>
          {step === 'intro' && (
            <View style={styles.section}>
              <Text style={styles.h1}>set it. forget it. feel it.</Text>
              <Text style={styles.p}>
                Alon runs in your pocket. when someone compatible comes near,
                your phone buzzes. no chat, no scrolling — just go say hi.
              </Text>
            </View>
          )}

           {step === 'name' && (
             <View style={styles.section}>
               <Text style={styles.h1}>what should we call you?</Text>
               <TextInput
                 value={name}
                 onChangeText={setName}
                 placeholder="your name"
                 placeholderTextColor={colors.textDim}
                 style={styles.input}
                 autoFocus
               />
               <TextInput
                 value={bio}
                 onChangeText={setBio}
                 placeholder="a short bio (optional)"
                 placeholderTextColor={colors.textDim}
                 style={styles.input}
               />
               <Text style={styles.hint}>
                 only your initials show up to others — full name only after a
                 mutual reveal.
               </Text>
             </View>
           )}

           {step === 'birthdate' && (
             <View style={styles.section}>
               <Text style={styles.h1}>verify your age</Text>
               <Text style={styles.p}>
                 Alon is for users 18 and older. enter your date of birth.
               </Text>
               <TextInput
                 value={birthdate}
                 onChangeText={(text) => { setBirthdate(text); setAgeError(''); }}
                 placeholder="YYYY-MM-DD"
                 placeholderTextColor={colors.textDim}
                 style={styles.input}
                 autoFocus
               />
               <Text style={styles.hint}>
                 example: 1995-06-15
               </Text>
               <Pressable
                 onPress={() => { setConfirm18(!confirm18); setAgeError(''); }}
                 style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
               >
                 <View style={{
                   width: 20, height: 20, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth,
                   borderColor: colors.borderWarm, backgroundColor: confirm18 ? colors.amber600 : 'transparent',
                 }} />
                 <Text style={styles.p}>I confirm I am 18 years of age or older</Text>
               </Pressable>
               {ageError ? <Text style={styles.error}>{ageError}</Text> : null}
             </View>
           )}

           {step === 'vibes' && (
            <View style={styles.section}>
              <Text style={styles.h1}>what are your vibes?</Text>
              <Text style={styles.p}>pick at least one. shared vibes = stronger buzz.</Text>
              <View style={styles.chipWrap}>
                {ALL_VIBES.map((v) => {
                  const active = vibes.includes(v);
                  return (
                    <Pressable
                      key={v}
                      onPress={() =>
                        setVibes((prev) =>
                          active ? prev.filter((x) => x !== v) : [...prev, v],
                        )
                      }
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: colors.amber600,
                          borderColor: colors.amber900,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          active && { color: colors.bgWarm },
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'mode' && (
            <View style={styles.section}>
              <Text style={styles.h1}>what's your mode?</Text>
              <Text style={styles.p}>you can change this anytime.</Text>
              <View style={styles.chipWrap}>
                {ALL_MODES.map((m) => {
                  const active = mode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMode(m)}
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: colors.teal600,
                          borderColor: colors.teal900,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          active && { color: colors.bgWarm },
                        ]}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'permissions' && (
            <View style={styles.section}>
              <Text style={styles.h1}>one more thing</Text>
              <Text style={styles.p}>
                Alon needs bluetooth to detect nearby vibes. on android 12+, you'll
                see a system permission dialog — tap "allow" for each.
              </Text>
              <Text style={styles.p}>
                why location? android requires it for bluetooth scanning. Alon never
                uses your location for anything else.
              </Text>
              <Text style={styles.p}>
                battery target: 3–6% per hour, comparable to spotify.
              </Text>
              {!permissionsGranted && (
                <Text style={styles.hint}>
                  Bluetooth permission was denied. you can continue — ghost mode
                  will be on until you grant it in settings.
                </Text>
              )}
            </View>
          )}

          {step === 'phone' && (
            <View style={styles.section}>
              <Text style={styles.h1}>verify your phone</Text>
              {phoneStep === 'input' ? (
                <>
                  <Text style={styles.p}>
                    we'll send a code to verify your number. this helps us create your
                    persistent account.
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
                  {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
                </>
              ) : (
                <>
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
                  {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
                  <Pressable onPress={resendOtp} style={styles.resend}>
                    <Text style={styles.resendText}>
                      {phoneLoading ? 'resending...' : 'resend code'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {stepIndex > 0 ? (
            <Button label="back" tone="ghost" onPress={back} />
          ) : (
            <View style={{ width: 80 }} />
          )}
          <Button
            label={step === 'permissions' ? "let's go" : step === 'phone' && phoneStep === 'verify' ? 'verify' : 'next'}
            tone="primary"
            onPress={advance}
            disabled={!canAdvance || phoneLoading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const StepDots = ({
  count,
  current,
}: {
  count: number;
  current: number;
}) => (
  <View style={styles.dots}>
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i === current && { backgroundColor: colors.teal600, width: 18 },
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgWarm },
  scroll: { padding: space.s4, gap: space.s5, flexGrow: 1 },
  brand: {
    fontFamily: serifFamily,
    fontStyle: 'italic',
    fontSize: 22,
    letterSpacing: 2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: space.s4,
  },
  tagline: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.s2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgBlock,
  },
  body: { flex: 1, gap: space.s4 },
  section: { gap: space.s3 },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  p: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  hint: { fontSize: 11, color: colors.textMuted },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  chip: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    backgroundColor: colors.bgWarmAlt,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.s4,
  },
  error: {
    fontSize: 11,
    color: colors.rust600,
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
