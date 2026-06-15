import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScheduleBlock as ScheduleBlockType } from '../types';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

interface ScheduleBlockProps {
  block: ScheduleBlockType;
  onPress?: () => void;
  onComplete?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  task: 'checkbox-outline',
  focus: 'flash',
  break: 'cafe',
  event: 'calendar',
  buffer: 'time',
};

export function ScheduleBlockItem({ block, onPress, onComplete }: ScheduleBlockProps) {
  const colors = useColors();
  const blockColor = block.color || colors.accent;
  const isBreak = block.type === 'break';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          backgroundColor: blockColor + (isBreak ? '15' : '18'),
          borderColor: blockColor + '40',
          borderLeftColor: blockColor,
          opacity: block.completed ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.timeColumn}>
        <Text style={[styles.time, { color: colors.textSecondary }]}>{block.startTime}</Text>
        <View style={[styles.timeLine, { backgroundColor: blockColor + '40' }]} />
        <Text style={[styles.time, { color: colors.textTertiary }]}>{block.endTime}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={[styles.typeIcon, { backgroundColor: blockColor + '25' }]}>
            <Ionicons name={TYPE_ICONS[block.type] as any} size={14} color={blockColor} />
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              {
                color: colors.text,
                textDecorationLine: block.completed ? 'line-through' : 'none',
              },
            ]}
          >
            {block.title}
          </Text>
        </View>
        <Text style={[styles.type, { color: blockColor }]}>
          {block.type.charAt(0).toUpperCase() + block.type.slice(1)}
        </Text>
      </View>

      {onComplete && !block.completed && !isBreak && (
        <TouchableOpacity
          onPress={onComplete}
          style={[styles.completeBtn, { borderColor: blockColor }]}
        >
          <Ionicons name="checkmark" size={14} color={blockColor} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  timeColumn: {
    width: 44,
    alignItems: 'center',
    gap: 2,
  },
  time: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  timeLine: {
    width: 1,
    height: 8,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  type: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginLeft: 32,
  },
  completeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
