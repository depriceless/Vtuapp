import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ImageBackground, 
  SafeAreaView, 
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GetStartedScreen() {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = React.useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = (error) => {
    console.warn('Failed to load background image:', error.nativeEvent?.error);
    // Still set as loaded to show content even if image fails
    setImageLoaded(true);
  };

  const handleGetStarted = () => {
    router.push('/auth');
  };

  return (
    <ImageBackground
      source={require('../assets/images/vtu.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
      onLoad={handleImageLoad}
      onError={handleImageError}
      imageStyle={styles.backgroundImageStyle}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Loading overlay */}
      {!imageLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* SafeAreaView only wraps content, not the image */}
      <SafeAreaView style={styles.contentContainer}>
        {/* Decorative circles */}
        <View style={styles.circleTop} />
        <View style={styles.circleBottom} />

        {/* Overlay to ensure text readability */}
        <View style={styles.overlay} />

        <View style={styles.contentWrapper}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Welcome to Connectpay</Text>
            <Text style={styles.subtitle}>
              Your one-stop solution to buy airtime, data, and pay bills effortlessly.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleGetStarted}
            activeOpacity={0.9}
            accessibilityLabel="Get started with Connectpay"
            accessibilityRole="button"
            accessibilityHint="Navigate to authentication screen"
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
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
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: SCREEN_WIDTH < 360 ? 20 : 30,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', // Subtle overlay for better text readability
  },
  circleTop: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.15,
    left: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: SCREEN_WIDTH * 0.375,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  circleBottom: {
    position: 'absolute',
    bottom: -SCREEN_HEIGHT * 0.15,
    right: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: SCREEN_WIDTH * 0.375,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.1 : SCREEN_HEIGHT * 0.08,
    paddingBottom: Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.05 : SCREEN_HEIGHT * 0.08,
    zIndex: 2, // Ensure content is above overlay
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: SCREEN_WIDTH < 360 ? 28 : 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: SCREEN_WIDTH < 360 ? 36 : 40,
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: SCREEN_WIDTH < 360 ? 24 : 26,
    opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  // Replace the button style with this:
button: {
  backgroundColor: '#fff',
  paddingVertical: SCREEN_WIDTH < 360 ? 16 : 18,
  paddingHorizontal: 40,
  borderRadius: 14,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
  width: '100%', // Changed from minWidth to full width
  // Add subtle animation-ready transform
  transform: [{ scale: 1 }],
},
  buttonText: {
    color: '#ff4b4b',
    fontWeight: '700',
    fontSize: SCREEN_WIDTH < 360 ? 16 : 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});