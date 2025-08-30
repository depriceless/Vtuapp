import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { AuthContext } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons'; // Add this import for the eye icon

// Move to environment variables in production
const API_BASE_URL = 'http://localhost:5000';

export default function LoginScreen() {
  const router = useRouter();
  const { login, user } = useContext(AuthContext);

  // Refs for input focus management
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for password visibility
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    console.log('🔹 Current user in context:', user);
    // Auto-focus on email field when component mounts
    setTimeout(() => {
      emailRef.current?.focus();
    }, 100);
  }, [user]);

  // Email/Phone validation function
  const validateEmailOrPhone = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // More flexible phone regex that handles various formats
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,20}$/;

    if (!value.trim()) {
      return 'Email or phone is required';
    }

    // Clean the value for phone validation (remove spaces, dashes, parentheses)
    const cleanedValue = value.replace(/[\s\-\(\)]/g, '');

    // Check if it's a valid email
    if (emailRegex.test(value)) {
      return '';
    }

    // Check if it's a valid phone number (must contain only digits after cleaning, optionally starting with +)
    if (/^[\+]?\d{7,15}$/.test(cleanedValue)) {
      return '';
    }

    return 'Please enter a valid email or phone number';
  };

  // Password validation function
  const validatePassword = (value) => {
    if (!value.trim()) {
      return 'Password is required';
    }
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return '';
  };

  // Handle email/phone input change with validation
  const handleEmailChange = (value) => {
    setEmailOrPhone(value);
    setEmailError('');
    setErrorMessage('');
  };

  // Handle password input change with validation
  const handlePasswordChange = (value) => {
    setPassword(value);
    setPasswordError('');
    setErrorMessage('');
  };

  // Handle email field blur
  const handleEmailBlur = () => {
    setIsEmailFocused(false);
    const error = validateEmailOrPhone(emailOrPhone);
    setEmailError(error);
  };

  // Handle password field blur
  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
    const error = validatePassword(password);
    setPasswordError(error);
  };
  const handleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    // Validate inputs before submission
    const emailValidationError = validateEmailOrPhone(emailOrPhone);
    const passwordValidationError = validatePassword(password);

    setEmailError(emailValidationError);
    setPasswordError(passwordValidationError);

    if (emailValidationError || passwordValidationError) {
      return;
    }

    if (!emailOrPhone.trim() || !password.trim()) {
      setErrorMessage('Phone/Email and Password are required.');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { emailOrPhone: emailOrPhone.trim(), password: password.trim() },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      if (response.data.token) {
        await login(response.data.token);
        setSuccessMessage('Login successful! Redirecting...');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1000);
      } else {
        setErrorMessage('Email or password is incorrect.');
      }
    } catch (error) {
      console.error('Login error:', error);

      // Always show generic error for wrong credentials
      if (error.response && (error.response.status === 401 || error.response.status === 400)) {
        setErrorMessage('Email or password is incorrect.');
      } else if (error.response) {
        setErrorMessage(error.response.data.message || 'Server error occurred.');
      } else {
        setErrorMessage('Cannot reach the server. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Login to continue</Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        {/* Enhanced Email/Phone Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={emailRef}
            style={[
              styles.input, 
              (errorMessage || emailError) ? styles.inputError : null,
              isEmailFocused ? styles.inputFocused : null
            ]}
            placeholder="Phone or Email"
            placeholderTextColor="#999"
            value={emailOrPhone}
            onChangeText={handleEmailChange}
            onFocus={() => setIsEmailFocused(true)}
            onBlur={handleEmailBlur}
            onSubmitEditing={() => passwordRef.current?.focus()}
            autoCapitalize="none"
            keyboardType="default"
            returnKeyType="next"
            accessibilityLabel="Email or phone number input"
            accessibilityHint="Enter your email address or phone number"
          />
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
        </View>

        {/* Enhanced Password Input with Toggle */}
        <View style={styles.inputContainer}>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={passwordRef}
              style={[
                styles.passwordInput, 
                (errorMessage || passwordError) ? styles.inputError : null,
                isPasswordFocused ? styles.inputFocused : null
              ]}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={handlePasswordChange}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={handlePasswordBlur}
              onSubmitEditing={handleLogin}
              autoCapitalize="none"
              returnKeyType="done"
              accessibilityLabel="Password input"
              accessibilityHint="Enter your password"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={togglePasswordVisibility}
              activeOpacity={0.7}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityRole="button"
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
        </View>

        <TouchableOpacity
          onPress={() => router.push('/auth/forgot-password')}
          style={{ alignSelf: 'flex-end', marginBottom: 20 }}
          accessibilityLabel="Forgot password link"
          accessibilityRole="button"
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Login button"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>

        <View style={styles.signupWrapper}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity 
            onPress={() => router.push('/auth/signup')}
            accessibilityLabel="Sign up link"
            accessibilityRole="button"
          >
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f8f8', 
    paddingHorizontal: 30 
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#ff2b2b', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#555', 
    textAlign: 'center', 
    marginBottom: 30 
  },
  // New styles for enhanced features
  inputContainer: {
    marginBottom: 10,
  },
  inputFocused: {
    borderColor: '#ff2b2b',
    borderWidth: 2,
  },
  fieldError: {
    color: '#ff2b2b',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  input: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    fontWeight: 'bold',
  },
  inputError: {
    borderColor: '#ff2b2b',
  },
  // New styles for password container and input
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingRight: 50, // Make space for the eye icon
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    fontWeight: 'bold',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -10 }], // Center the icon vertically
    padding: 5, // Increase touch area
  },
  forgotText: { 
    color: '#ff2b2b', 
    fontWeight: 'bold', 
    textAlign: 'right' 
  },
  button: { 
    backgroundColor: '#ff2b2b', 
    paddingVertical: 18, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginTop: 10 
  },
  buttonDisabled: { 
    backgroundColor: '#ff2b2b80' 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 18 
  },
  signupWrapper: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 20 
  },
  signupText: { 
    color: '#555', 
    fontSize: 16 
  },
  signupLink: { 
    color: '#ff2b2b', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  errorText: {
    color: '#ff2b2b',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  successText: {
    color: '#28a745',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
});