import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors, fontSize, fontWeight } from '../theme';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  showPercentage?: boolean;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  color,
  label,
  sublabel,
  showPercentage = true,
}: ProgressRingProps) {
  const colors = useColors();
  const ringColor = color || colors.accent;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor + '20'}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        {showPercentage && (
          <Text style={[styles.percentage, { color: colors.text, fontSize: size > 80 ? fontSize.xl : fontSize.lg }]}>
            {Math.round(progress)}%
          </Text>
        )}
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        {sublabel && <Text style={[styles.sublabel, { color: colors.textTertiary }]}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  sublabel: {
    fontSize: 10,
  },
});
