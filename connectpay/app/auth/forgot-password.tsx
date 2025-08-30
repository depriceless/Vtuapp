import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState('');

  const handleReset = () => {
    if (!emailOrPhone.trim()) {
      Alert.alert('Error', 'Phone or Email is required.');
      return;
    }

    // Handle password reset logic here
    Alert.alert('Success', `Password reset link sent to ${emailOrPhone}`);
    router.push('/auth/login'); // Navigate back to login
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>Enter your phone number or email to reset your password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Phone or Email"
          placeholderTextColor="#ccc"
          value={emailOrPhone}
          onChangeText={setEmailOrPhone}
        />

        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>Reset Password</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ff2b2b', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 30 },
  input: { backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 12, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#ccc' },
  button: { backgroundColor: '#ff2b2b', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
});
