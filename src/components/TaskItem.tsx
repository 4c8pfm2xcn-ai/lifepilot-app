import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task, Priority } from '../types';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

interface TaskItemProps {
  task: Task;
  onComplete: () => void;
  onPress?: () => void;
  compact?: boolean;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'URGENT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

const CATEGORY_ICONS: Record<string, string> = {
  work: 'briefcase',
  school: 'book',
  fitness: 'fitness',
  personal: 'person',
  social: 'people',
  other: 'ellipsis-horizontal',
};

export function TaskItem({ task, onComplete, onPress, compact = false }: TaskItemProps) {
  const colors = useColors();
  const priorityColor = PRIORITY_COLORS[task.priority];
  const isCompleted = task.status === 'completed';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: priorityColor,
          opacity: isCompleted ? 0.6 : 1,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onComplete}
        disabled={isCompleted}
        style={[
          styles.checkbox,
          {
            borderColor: isCompleted ? colors.success : colors.border,
            backgroundColor: isCompleted ? colors.success : 'transparent',
          },
        ]}
      >
        {isCompleted && <Ionicons name="checkmark" size={14} color="#FFF" />}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              {
                color: colors.text,
                textDecorationLine: isCompleted ? 'line-through' : 'none',
              },
            ]}
          >
            {task.title}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {PRIORITY_LABELS[task.priority]}
            </Text>
          </View>
        </View>

        {!compact && task.description && (
          <Text numberOfLines={2} style={[styles.description, { color: colors.textSecondary }]}>
            {task.description}
          </Text>
        )}

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name={CATEGORY_ICONS[task.category] as any} size={12} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{task.category}</Text>
          </View>
          {task.estimatedDuration > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {task.estimatedDuration}m
              </Text>
            </View>
          )}
          {task.dueTime && (
            <View style={styles.metaItem}>
              <Ionicons name="alarm-outline" size={12} color={priorityColor} />
              <Text style={[styles.metaText, { color: priorityColor }]}>{task.dueTime}</Text>
            </View>
          )}
          {task.tags?.slice(0, 2).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
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
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  description: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: fontSize.xs,
    textTransform: 'capitalize',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
});
