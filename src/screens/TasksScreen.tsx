import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useStore } from '../store';
import { TaskItem } from '../components/TaskItem';
import { Button } from '../components/Button';
import { Task, Priority, TaskCategory } from '../types';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

type FilterTab = 'all' | 'today' | 'upcoming' | 'completed';

export function TasksScreen({ navigation }: any) {
  const colors = useColors();
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const completeTask = useStore((s) => s.completeTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const [filter, setFilter] = useState<FilterTab>('today');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newCategory, setNewCategory] = useState<TaskCategory>('personal');
  const [newDuration, setNewDuration] = useState('30');

  const today = format(new Date(), 'yyyy-MM-dd');

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    switch (filter) {
      case 'today':
        return filtered.filter((t) => t.dueDate === today && t.status !== 'completed');
      case 'upcoming':
        return filtered.filter((t) => (!t.dueDate || t.dueDate > today) && t.status !== 'completed');
      case 'completed':
        return filtered.filter((t) => t.status === 'completed');
      default:
        return filtered.filter((t) => t.status !== 'completed');
    }
  }, [tasks, filter, today, search]);

  const TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'today', label: 'Today', count: tasks.filter((t) => t.dueDate === today && t.status !== 'completed').length },
    { id: 'all', label: 'All', count: tasks.filter((t) => t.status !== 'completed').length },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Done', count: tasks.filter((t) => t.status === 'completed').length },
  ];

  const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
  const CATEGORIES: TaskCategory[] = ['work', 'school', 'fitness', 'personal', 'social', 'other'];

  const PRIORITY_COLORS = {
    urgent: '#EF4444',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#10B981',
  };

  const handleAddTask = () => {
    if (newTitle.trim().length < 2) return;
    addTask({
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      category: newCategory,
      estimatedDuration: parseInt(newDuration) || 30,
      dueDate: today,
      status: 'pending',
    });
    setShowModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setNewCategory('personal');
    setNewDuration('30');
  };

  const handleDeleteTask = (id: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask(id) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={[styles.addBtn, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setFilter(tab.id)}
            style={[
              styles.tab,
              { backgroundColor: filter === tab.id ? colors.accent : colors.surfaceSecondary },
            ]}
          >
            <Text style={[styles.tabText, { color: filter === tab.id ? '#FFF' : colors.textSecondary }]}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor: filter === tab.id ? 'rgba(255,255,255,0.3)' : colors.accent + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    { color: filter === tab.id ? '#FFF' : colors.accent },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>
              {filter === 'completed' ? '🎉' : '✅'}
            </Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === 'completed' ? 'No completed tasks yet' : 'All clear!'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {filter === 'completed'
                ? 'Complete tasks to see them here.'
                : 'Tap the + button to add a new task, or upload content to the AI inbox.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.resultCount, { color: colors.textTertiary }]}>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </Text>
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => completeTask(task.id)}
                onPress={() => navigation.navigate('Focus', { taskId: task.id })}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modal, { backgroundColor: colors.background }]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Task</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Task Title *</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={[styles.formInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Add details (optional)"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.formInput, styles.textarea, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Priority</Text>
              <View style={styles.chipRow}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setNewPriority(p)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: newPriority === p ? PRIORITY_COLORS[p] : PRIORITY_COLORS[p] + '15',
                        borderColor: PRIORITY_COLORS[p] + '40',
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: newPriority === p ? '#FFF' : PRIORITY_COLORS[p] }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewCategory(c)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: newCategory === c ? colors.accent : colors.surfaceSecondary,
                        borderColor: newCategory === c ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: newCategory === c ? '#FFF' : colors.text }]}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                Estimated Duration (minutes)
              </Text>
              <View style={styles.durationRow}>
                {['15', '30', '45', '60', '90', '120'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setNewDuration(d)}
                    style={[
                      styles.durationChip,
                      {
                        backgroundColor: newDuration === d ? colors.accent : colors.surfaceSecondary,
                        borderColor: newDuration === d ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: newDuration === d ? '#FFF' : colors.text }]}>
                      {d}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Add Task"
              onPress={handleAddTask}
              disabled={newTitle.trim().length < 2}
              size="lg"
              style={styles.submitBtn}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
  },
  tabsScroll: { marginBottom: spacing.md },
  tabs: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  tabBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },
  resultCount: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.huge,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  emptyDesc: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  modal: {
    flex: 1,
    padding: spacing.xxl,
    paddingTop: spacing.huge,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  formGroup: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  durationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  submitBtn: {
    width: '100%',
    marginTop: spacing.lg,
    marginBottom: spacing.huge,
  },
});
