import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';

// ✅ Fixed API URL configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function SignupScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!username.trim()) newErrors.username = 'Username is required';
    if (!phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^\d+$/.test(phone)) newErrors.phone = 'Phone number must be numeric';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!confirmPassword) newErrors.confirmPassword = 'Confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    setMessage(null); // reset previous messages
    if (!validate()) return;

    const data = {
      phone: phone.trim(),
      name: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      password: password.trim(),
    };

    try {
      // ✅ Fixed API call - use base URL + endpoint
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/register`,
        data
      );

      // Extract token from response
      const { token, user } = response.data;

      setMessage({ text: 'Registration successful! Setting up your account...', type: 'success' });

      // Navigate to PIN setup with the token
      setTimeout(() => {
        router.push({
          pathname: './pin-setup',
          params: { 
            userToken: token,
            userName: user.name 
          }
        });
      }, 1500);

    } catch (error: any) {
      setMessage({
        text: error.response?.data?.message || 'Something went wrong. Please try again.',
        type: 'error',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingVertical: 40 }}>
          <View style={styles.contentWrapper}>
            <Text style={styles.title}>Create Account</Text>

            {/* Inline message */}
            {message && (
              <Text style={[styles.message, message.type === 'success' ? styles.success : styles.errorMessage]}>
                {message.text}
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
            />
            {errors.fullName && <Text style={styles.error}>{errors.fullName}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
            />
            {errors.username && <Text style={styles.error}>{errors.username}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="numeric"
              value={phone}
              onChangeText={setPhone}
            />
            {errors.phone && <Text style={styles.error}>{errors.phone}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {errors.email && <Text style={styles.error}>{errors.email}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {errors.password && <Text style={styles.error}>{errors.password}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {errors.confirmPassword && (
              <Text style={styles.error}>{errors.confirmPassword}</Text>
            )}

            <TouchableOpacity style={styles.button} onPress={handleSignup}>
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>

            <View style={styles.loginWrapper}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('./login')}>
                <Text style={{ color: '#ff2b2b', fontWeight: 'bold' }}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 30,
  },
  contentWrapper: {
    marginTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff2b2b',
    textAlign: 'center',
    marginBottom: 20,
  },
  message: {
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 16,
    paddingHorizontal: 5,
  },
  success: { color: '#2e7d32' },
  errorMessage: { color: '#d32f2f' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  error: { color: '#ff2b2b', marginBottom: 10 },
  button: {
    backgroundColor: '#ff2b2b',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  loginWrapper: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  loginText: { fontSize: 16, color: '#000' },
});