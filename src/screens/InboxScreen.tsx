import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '../store';
import { InboxCard } from '../components/InboxCard';
import { Button } from '../components/Button';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

export function InboxScreen({ navigation }: any) {
  const colors = useColors();
  const inboxItems = useStore((s) => s.inboxItems);
  const addInboxItem = useStore((s) => s.addInboxItem);
  const deleteInboxItem = useStore((s) => s.deleteInboxItem);
  const importTasksFromInbox = useStore((s) => s.importTasksFromInbox);
  const user = useStore((s) => s.user);

  const [showTextModal, setShowTextModal] = useState(false);
  const [textNote, setTextNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload screenshots.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      await addInboxItem({
        type: 'screenshot',
        content: 'Screenshot uploaded. AI is analyzing the content for tasks, deadlines, and important information.',
        preview: 'Screenshot from your library',
        uri: result.assets[0].uri,
      });
      setIsUploading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        await addInboxItem({
          type: 'pdf',
          content: `PDF document: ${result.assets[0].name}. AI will extract assignments, deadlines, and tasks from this document.`,
          preview: result.assets[0].name,
          uri: result.assets[0].uri,
        });
        setIsUploading(false);
      }
    } catch {
      Alert.alert('Error', 'Could not open document picker');
    }
  };

  const handleAddTextNote = async () => {
    if (textNote.trim().length < 5) return;
    setShowTextModal(false);
    await addInboxItem({
      type: 'text',
      content: textNote.trim(),
      preview: textNote.trim().substring(0, 80),
    });
    setTextNote('');
  };

  const handleVoiceNote = async () => {
    Alert.alert(
      'Voice Note',
      'Voice recording coming soon! For now, type your note or upload a recording file.',
      [{ text: 'OK' }]
    );
  };

  const handleEmailForward = () => {
    Alert.alert(
      'Forward Emails',
      `Forward any email to:\ninbox@lifepilot.ai\n\nWe'll extract tasks and deadlines automatically.`,
      [{ text: 'Got it' }]
    );
  };

  const UPLOAD_OPTIONS = [
    { icon: 'image', label: 'Screenshot', color: '#3B82F6', onPress: handlePickImage },
    { icon: 'document', label: 'PDF', color: '#EF4444', onPress: handlePickDocument },
    { icon: 'mail', label: 'Email', color: '#F59E0B', onPress: handleEmailForward },
    { icon: 'mic', label: 'Voice', color: '#8B5CF6', onPress: handleVoiceNote },
    { icon: 'create', label: 'Text', color: '#10B981', onPress: () => setShowTextModal(true) },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>AI Inbox</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Drop anything — AI extracts your tasks
          </Text>
        </View>
        {!user?.isPremium && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Premium')}
            style={[styles.premiumBtn, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B40' }]}
          >
            <Ionicons name="diamond" size={14} color="#F59E0B" />
            <Text style={[styles.premiumBtnText, { color: '#F59E0B' }]}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.uploadGrid, { borderColor: colors.border }]}>
        {UPLOAD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            onPress={opt.onPress}
            style={[styles.uploadBtn, { backgroundColor: opt.color + '12', borderColor: opt.color + '30' }]}
            activeOpacity={0.7}
          >
            <View style={[styles.uploadIconWrap, { backgroundColor: opt.color + '20' }]}>
              <Ionicons name={opt.icon as any} size={22} color={opt.color} />
            </View>
            <Text style={[styles.uploadLabel, { color: opt.color }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!user?.isPremium && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Premium')}
          style={[styles.limitBanner, { backgroundColor: colors.warningLight, borderColor: '#F59E0B40' }]}
        >
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={[styles.limitText, { color: '#F59E0B' }]}>
            Free plan: 10 uploads/month. <Text style={{ fontWeight: '700' }}>Upgrade for unlimited.</Text>
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {inboxItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📥</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your inbox is empty</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Upload a screenshot, PDF, or type a note and AI will extract all your tasks and deadlines.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.listTitle, { color: colors.textSecondary }]}>
              {inboxItems.length} item{inboxItems.length !== 1 ? 's' : ''}
            </Text>
            {inboxItems.map((item) => (
              <InboxCard
                key={item.id}
                item={item}
                onImport={
                  item.status === 'processed' && (item.extractedTasks?.length ?? 0) > 0
                    ? () => {
                        importTasksFromInbox(item.id);
                        Alert.alert('Tasks Added', `${item.extractedTasks?.length} task(s) added to your task list!`);
                      }
                    : undefined
                }
                onDelete={() => deleteInboxItem(item.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Text Note Modal */}
      <Modal visible={showTextModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modal, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Note</Text>
            <TouchableOpacity onPress={() => setShowTextModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={textNote}
            onChangeText={setTextNote}
            placeholder="Paste an email, type a reminder, describe a deadline... AI will organize it for you."
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            style={[
              styles.textInput,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={[styles.modalHint, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="sparkles" size={14} color={colors.accent} />
            <Text style={[styles.hintText, { color: colors.accent }]}>
              AI will extract tasks, deadlines, and priorities automatically
            </Text>
          </View>
          <Button
            title="Analyze with AI"
            onPress={handleAddTextNote}
            disabled={textNote.trim().length < 5}
            size="lg"
          />
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
    alignItems: 'flex-start',
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
    fontWeight: fontWeight.medium,
  },
  premiumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  premiumBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  uploadGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  uploadBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  limitText: {
    flex: 1,
    fontSize: fontSize.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },
  listTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
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
    gap: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  textInput: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  modalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  hintText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
