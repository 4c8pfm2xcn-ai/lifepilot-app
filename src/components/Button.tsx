import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const colors = useColors();

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles[size],
    ...(variant === 'primary' && { backgroundColor: colors.accent }),
    ...(variant === 'secondary' && { backgroundColor: colors.accentLight, borderWidth: 0 }),
    ...(variant === 'ghost' && { backgroundColor: 'transparent' }),
    ...(variant === 'danger' && { backgroundColor: colors.error }),
    ...(disabled && { opacity: 0.5 }),
  };

  const labelStyle: TextStyle = {
    ...styles.label,
    ...labelSizes[size],
    ...(variant === 'primary' && { color: '#FFFFFF' }),
    ...(variant === 'secondary' && { color: colors.accent }),
    ...(variant === 'ghost' && { color: colors.accent }),
    ...(variant === 'danger' && { color: '#FFFFFF' }),
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#FFF' : colors.accent} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[labelStyle, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  label: {
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});

const sizeStyles: Record<string, ViewStyle> = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  md: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xxl },
  lg: { paddingVertical: spacing.lg + 2, paddingHorizontal: spacing.xxxl },
};

const labelSizes: Record<string, TextStyle> = {
  sm: { fontSize: fontSize.sm },
  md: { fontSize: fontSize.md },
  lg: { fontSize: fontSize.lg },
};
