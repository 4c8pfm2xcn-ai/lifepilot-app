import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { spacing, fontSize, fontWeight, radius } from '../../theme';

const { width, height } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const FEATURES = [
  { icon: 'sparkles', text: 'AI extracts tasks from anything you share' },
  { icon: 'calendar', text: 'Builds your perfect daily schedule' },
  { icon: 'flash', text: 'Keeps you focused and on track' },
  { icon: 'trending-up', text: 'Learns your habits over time' },
];

export function WelcomeScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const feature1 = useRef(new Animated.Value(0)).current;
  const feature2 = useRef(new Animated.Value(0)).current;
  const feature3 = useRef(new Animated.Value(0)).current;
  const feature4 = useRef(new Animated.Value(0)).current;
  const featureAnims = [feature1, feature2, feature3, feature4];

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.stagger(
        150,
        featureAnims.map((anim) =>
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true })
        )
      ),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={['#4C1D95', '#7C3AED', '#A78BFA']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Animated.View
        style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.logoWrap}>
          <Ionicons name="compass" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.appName}>LifePilot AI</Text>
        <Text style={styles.tagline}>Your AI executive assistant</Text>
      </Animated.View>

      <View style={styles.featuresContainer}>
        {FEATURES.map((feature, index) => (
          <Animated.View
            key={feature.text}
            style={[styles.featureRow, { opacity: featureAnims[index] }]}
          >
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon as any} size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.featureText}>{feature.text}</Text>
          </Animated.View>
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          title="Get Started — It's Free"
          onPress={() => navigation.navigate('Setup')}
          variant="primary"
          size="lg"
          style={styles.ctaButton}
          textStyle={{ color: '#7C3AED', fontWeight: '700' }}
        />
        <TouchableOpacity
          onPress={() => navigation.navigate('Setup')}
          style={styles.signinLink}
        >
          <Text style={styles.signinText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
        <Text style={styles.legal}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: height * 0.12,
    paddingBottom: spacing.huge,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: fontSize.display + 4,
    fontWeight: fontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: fontSize.lg,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: fontWeight.medium,
  },
  featuresContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontSize: fontSize.lg,
    color: '#FFFFFF',
    fontWeight: fontWeight.medium,
    lineHeight: 24,
  },
  footer: {
    gap: spacing.md,
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  signinLink: {
    paddingVertical: spacing.sm,
  },
  signinText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  legal: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
