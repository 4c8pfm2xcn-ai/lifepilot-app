import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../../store';
import { Button } from '../../components/Button';
import { useColors, spacing, radius, fontSize, fontWeight } from '../../theme';

const { width } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<any> };

const PERKS = [
  { icon: 'infinite', text: 'Unlimited AI processing', highlight: true },
  { icon: 'flash', text: 'Advanced schedule optimization', highlight: false },
  { icon: 'cloud-upload', text: 'Unlimited uploads (screenshots, PDFs)', highlight: false },
  { icon: 'calendar', text: 'Google & Apple Calendar sync', highlight: false },
  { icon: 'bar-chart', text: 'AI weekly productivity reports', highlight: false },
  { icon: 'school', text: 'AI productivity coaching', highlight: false },
  { icon: 'people', text: 'Friend accountability groups', highlight: false },
  { icon: 'trophy', text: 'Premium leaderboards & badges', highlight: false },
];

export function PremiumScreen({ navigation }: Props) {
  const colors = useColors();
  const activatePremium = useStore((s) => s.activatePremium);
  const user = useStore((s) => s.user);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubscribe = () => {
    activatePremium();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleSkip = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <LinearGradient
            colors={['#4C1D95', '#7C3AED', '#A78BFA']}
            style={styles.heroCard}
          >
            <View style={styles.crownWrap}>
              <Ionicons name="diamond" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.heroTitle}>LifePilot Premium</Text>
            <Text style={styles.heroSubtitle}>
              {user?.name ? `Level up, ${user.name.split(' ')[0]}` : 'Level up your productivity'}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>$9.99</Text>
              <Text style={styles.pricePer}>/month</Text>
            </View>
            <Text style={styles.priceNote}>7-day free trial • Cancel anytime</Text>
          </LinearGradient>

          <View style={styles.perksContainer}>
            <Text style={[styles.perksTitle, { color: colors.text }]}>Everything included:</Text>
            {PERKS.map((perk) => (
              <View key={perk.text} style={[styles.perkRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.perkIcon, { backgroundColor: colors.accentLight }]}>
                  <Ionicons name={perk.icon as any} size={16} color={colors.accent} />
                </View>
                <Text style={[styles.perkText, { color: colors.text }]}>{perk.text}</Text>
                {perk.highlight && (
                  <View style={[styles.newBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={[styles.testimonial, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.testimonialText, { color: colors.text }]}>
              "LifePilot helped me raise my GPA by 0.4 points in one semester. I actually feel in control of my schedule."
            </Text>
            <Text style={[styles.testimonialAuthor, { color: colors.textSecondary }]}>
              — Emily K., College Student ⭐⭐⭐⭐⭐
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Button
          title="Start Free Trial"
          onPress={handleSubscribe}
          size="lg"
          style={styles.subscribeBtn}
        />
        <Button
          title="Maybe later"
          onPress={handleSkip}
          variant="ghost"
          size="md"
          style={{ paddingVertical: spacing.md }}
        />
        <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
          No charge during trial. Cancel anytime before day 7.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.xxl,
    paddingBottom: 0,
    gap: spacing.xxl,
  },
  heroCard: {
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  crownWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: fontWeight.medium,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: spacing.md,
  },
  price: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  pricePer: {
    fontSize: fontSize.lg,
    color: 'rgba(255,255,255,0.7)',
    paddingBottom: 4,
  },
  priceNote: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  perksContainer: {
    gap: 0,
  },
  perksTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  testimonial: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
  },
  testimonialText: {
    fontSize: fontSize.md,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  footer: {
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  subscribeBtn: {
    width: '100%',
  },
  footerNote: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
