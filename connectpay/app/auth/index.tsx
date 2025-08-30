import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  // Animation references
  const titleAnim = React.useRef(new Animated.Value(0)).current;
  const subtitleAnim = React.useRef(new Animated.Value(0)).current;
  const buttonAnim = React.useRef(new Animated.Value(0)).current;
  const logoAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  // Loading state
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [animationsStarted, setAnimationsStarted] = React.useState(false);

  // Start staggered animations when image loads
  React.useEffect(() => {
    if (imageLoaded && !animationsStarted) {
      setAnimationsStarted(true);

      // Staggered animation sequence
      Animated.sequence([
        // Logo animation
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Scale animation
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Parallel animations for text
      Animated.stagger(200, [
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(buttonAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [imageLoaded, animationsStarted]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = (error) => {
    console.warn('Failed to load welcome background image:', error.nativeEvent?.error);
    // Fallback: start animations even if image fails to load
    setImageLoaded(true);
  };

  // Enhanced button press with haptic feedback simulation
  const handleSignUpPress = () => {
    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/auth/signup');
    });
  };

  const handleLoginPress = () => {
    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/auth/login');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={require('../../assets/images/welcomebg.jpg')}
        style={styles.background}
        resizeMode="cover"
        onLoad={handleImageLoad}
        onError={handleImageError}
        // Add fallback color in case image fails
        imageStyle={styles.backgroundImage}
      >
        {/* Loading overlay */}
        {!imageLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ff2b2b" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        <View style={styles.overlay}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentWrapper}>
              {/* App Logo/Icon */}
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    opacity: logoAnim,
                    transform: [
                      {
                        translateY: logoAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-50, 0],
                        }),
                      },
                      {
                        scale: scaleAnim,
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.logoWrapper}>
                  <Ionicons 
                    name="card-outline" 
                    size={SCREEN_WIDTH < 360 ? 40 : 50} 
                    color="#ff2b2b" 
                  />
                </View>
              </Animated.View>

              {/* Animated Title */}
              <Animated.View
                style={{
                  opacity: titleAnim,
                  transform: [
                    {
                      translateY: titleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={styles.title}>
                  Welcome to{SCREEN_WIDTH < 360 ? ' ' : '\n'}
                  <Text style={styles.highlight}>Connectpay</Text>
                </Text>
              </Animated.View>

              {/* Animated Subtitle */}
              <Animated.View
                style={{
                  opacity: subtitleAnim,
                  transform: [
                    {
                      translateY: subtitleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={styles.subtitle}>
                  Experience effortless mobile services: buy airtime and data, pay bills, and manage all your transactions quickly and securely, anytime, anywhere.
                </Text>
              </Animated.View>

              {/* Feature highlights */}
              <Animated.View
                style={[
                  styles.featuresContainer,
                  {
                    opacity: subtitleAnim,
                    transform: [
                      {
                        translateY: subtitleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.featureItem}>
                  <Ionicons name="phone-portrait-outline" size={SCREEN_WIDTH < 360 ? 16 : 20} color="#fff" />
                  <Text style={styles.featureText}>Buy Airtime</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="wifi-outline" size={SCREEN_WIDTH < 360 ? 16 : 20} color="#fff" />
                  <Text style={styles.featureText}>Data Plans</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="receipt-outline" size={SCREEN_WIDTH < 360 ? 16 : 20} color="#fff" />
                  <Text style={styles.featureText}>Pay Bills</Text>
                </View>
              </Animated.View>

              {/* Animated Buttons */}
              <Animated.View
                style={[
                  styles.buttonsContainer,
                  {
                    opacity: buttonAnim,
                    transform: [
                      {
                        translateY: buttonAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [40, 0],
                        }),
                      },
                      {
                        scale: scaleAnim,
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSignUpPress}
                  activeOpacity={0.9}
                  accessibilityLabel="Sign up for new account"
                  accessibilityRole="button"
                  accessibilityHint="Creates a new Connectpay account"
                >
                  <Text style={styles.buttonText}>Sign up</Text>
                  <Ionicons 
                    name="arrow-forward" 
                    size={SCREEN_WIDTH < 360 ? 16 : 20} 
                    color="#fff" 
                    style={styles.buttonIcon} 
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleLoginPress}
                  activeOpacity={0.8}
                  accessibilityLabel="Login to existing account"
                  accessibilityRole="button"
                  accessibilityHint="Sign in to your existing Connectpay account"
                >
                  <Text style={styles.secondaryText}>I have an account</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Security badge */}
              <Animated.View
                style={[
                  styles.securityBadge,
                  {
                    opacity: buttonAnim,
                  },
                ]}
              >
                <Ionicons name="shield-checkmark" size={SCREEN_WIDTH < 360 ? 14 : 16} color="#4CAF50" />
                <Text style={styles.securityText}>256-bit SSL Encrypted</Text>
              </Animated.View>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    // Fallback background color if image fails to load
    backgroundColor: '#1a1a1a',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT,
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH < 360 ? 20 : 30,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  logoWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: SCREEN_WIDTH < 360 ? 30 : 35,
    padding: SCREEN_WIDTH < 360 ? 15 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: SCREEN_WIDTH < 360 ? 28 : 32,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: SCREEN_WIDTH < 360 ? 36 : 40,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  highlight: {
    color: '#ff2b2b',
    textShadowColor: 'rgba(255,43,43,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
    color: '#fff',
    textAlign: 'center',
    marginVertical: SCREEN_HEIGHT * 0.02,
    lineHeight: SCREEN_WIDTH < 360 ? 22 : 24,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH < 360 ? 10 : 20,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH < 360 ? 10 : 12,
    marginTop: 5,
    textAlign: 'center',
    opacity: 0.9,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonsContainer: {
    width: '100%',
    marginTop: SCREEN_HEIGHT * 0.03,
  },
  primaryButton: {
    backgroundColor: '#ff2b2b',
    paddingVertical: SCREEN_WIDTH < 360 ? 16 : 18,
    paddingHorizontal: SCREEN_WIDTH < 360 ? 20 : 30,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#ff2b2b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    fontWeight: '700',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonIcon: {
    marginLeft: 4,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: SCREEN_WIDTH < 360 ? 14 : 16,
    paddingHorizontal: SCREEN_WIDTH < 360 ? 20 : 30,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    // Note: backdropFilter is iOS only and experimental
    ...(Platform.OS === 'ios' && { backdropFilter: 'blur(10px)' }),
  },
  secondaryText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: SCREEN_WIDTH < 360 ? 14 : 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.03,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    // Note: backdropFilter is iOS only and experimental
    ...(Platform.OS === 'ios' && { backdropFilter: 'blur(10px)' }),
  },
  securityText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH < 360 ? 10 : 12,
    marginLeft: 6,
    opacity: 0.9,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});