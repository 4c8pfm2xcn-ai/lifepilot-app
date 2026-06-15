import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InboxItem } from '../types';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

interface InboxCardProps {
  item: InboxItem;
  onPress?: () => void;
  onImport?: () => void;
  onDelete?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  screenshot: 'image',
  pdf: 'document',
  email: 'mail',
  voice: 'mic',
  text: 'create',
};

const TYPE_LABELS: Record<string, string> = {
  screenshot: 'Screenshot',
  pdf: 'PDF',
  email: 'Email',
  voice: 'Voice Note',
  text: 'Text Note',
};

const TYPE_COLORS: Record<string, string> = {
  screenshot: '#3B82F6',
  pdf: '#EF4444',
  email: '#F59E0B',
  voice: '#8B5CF6',
  text: '#10B981',
};

export function InboxCard({ item, onPress, onImport, onDelete }: InboxCardProps) {
  const colors = useColors();
  const typeColor = TYPE_COLORS[item.type];
  const isProcessing = item.status === 'processing';
  const isProcessed = item.status === 'processed';

  const timeAgo = () => {
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: typeColor + '15' }]}>
        <Ionicons name={TYPE_ICONS[item.type] as any} size={20} color={typeColor} />
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.typeLabel, { color: typeColor }]}>{TYPE_LABELS[item.type]}</Text>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeAgo()}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.preview, { color: colors.text }]}>
          {item.preview || item.content.substring(0, 100)}
        </Text>

        {isProcessing && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.accent }]}>AI is analyzing...</Text>
          </View>
        )}

        {isProcessed && item.extractedTasks && item.extractedTasks.length > 0 && (
          <View style={styles.extractedRow}>
            <Ionicons name="sparkles" size={12} color={colors.success} />
            <Text style={[styles.extractedText, { color: colors.success }]}>
              {item.extractedTasks.length} task{item.extractedTasks.length !== 1 ? 's' : ''} extracted
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {isProcessed && onImport && (
          <TouchableOpacity
            onPress={onImport}
            style={[styles.actionBtn, { backgroundColor: colors.accentLight }]}
          >
            <Ionicons name="add" size={14} color={colors.accent} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            style={[styles.actionBtn, { backgroundColor: colors.errorLight }]}
          >
            <Ionicons name="trash" size={14} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: {
    fontSize: fontSize.xs,
  },
  preview: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  extractedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  extractedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  actions: {
    gap: spacing.xs,
    flexShrink: 0,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
