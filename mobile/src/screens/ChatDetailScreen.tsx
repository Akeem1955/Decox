import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { firestore } from '../config/firebaseConfig';
import { getCurrentUser } from '../services/authService';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  isSelf: boolean;
  text: string;
  timestamp: string;
}

export interface ChatPinContext {
  id?: string;
  title?: string;
  imageUrl?: string;
}

interface ChatDetailScreenProps {
  conversationId?: string;
  artisanUid?: string;
  artisanName?: string;
  artisanSpecialty?: string;
  pinContext?: ChatPinContext;
  initialDraft?: string;
  onBack: () => void;
}

function formatTimestamp(ts: any): string {
  if (!ts) return 'Just now';
  if (ts instanceof Timestamp) {
    const d = ts.toDate();
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  }
  return String(ts);
}

export function ChatDetailScreen({
  conversationId,
  artisanUid = 'JvLaoDLXBCMYqDO0SyKpeEC6HY42',
  artisanName = 'Adetunji Akeem',
  artisanSpecialty = 'Master Artisan',
  pinContext,
  initialDraft = '',
  onBack,
}: ChatDetailScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(initialDraft);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const currentUser = getCurrentUser();
  const currentUid = currentUser?.uid || 'guest_user';
  const targetCounterpartUid = artisanUid || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42';

  // Deterministic 1-on-1 thread ID: [uid1, uid2].sort().join('_')
  const activeConversationId =
    conversationId ||
    (currentUid !== targetCounterpartUid
      ? [currentUid, targetCounterpartUid].sort().join('_')
      : `self_${currentUid}`);

  const pad = Math.max(width * 0.04, 14);

  // Subscribe to real-time Firestore messages
  useEffect(() => {
    const messagesRef = collection(firestore, 'conversations', activeConversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const isSelf = data.senderUid === currentUid;
          return {
            id: docSnap.id,
            senderUid: data.senderUid || '',
            senderName: data.senderName || (isSelf ? 'You' : artisanName),
            isSelf,
            text: data.text || '',
            timestamp: formatTimestamp(data.createdAt),
          };
        });
        setMessages(msgs);
      },
      (err) => {
        console.warn('Real-time messages error:', err);
      }
    );

    return () => unsubscribe();
  }, [activeConversationId, currentUid, artisanName]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    try {
      const myName =
        currentUser?.displayName ||
        currentUser?.email?.split('@')[0] ||
        (currentUid === 'JvLaoDLXBCMYqDO0SyKpeEC6HY42' ? 'Adetunji Akeem' : 'Client');
      const counterpartDisplayName =
        artisanName ||
        (targetCounterpartUid === 'JvLaoDLXBCMYqDO0SyKpeEC6HY42' ? 'Adetunji Akeem' : 'Client');

      const isMeArtisan = currentUid === 'JvLaoDLXBCMYqDO0SyKpeEC6HY42';
      const isCounterpartArtisan = targetCounterpartUid === 'JvLaoDLXBCMYqDO0SyKpeEC6HY42';

      const convoRef = doc(firestore, 'conversations', activeConversationId);

      // Persist or merge top-level conversation metadata
      await setDoc(
        convoRef,
        {
          id: activeConversationId,
          participantUids: [currentUid, targetCounterpartUid],
          participants: {
            [currentUid]: {
              displayName: myName,
              email: currentUser?.email || '',
              role: isMeArtisan ? 'artisan' : 'client',
            },
            [targetCounterpartUid]: {
              displayName: counterpartDisplayName,
              role: isCounterpartArtisan ? 'artisan' : 'client',
              specialty: artisanSpecialty,
            },
          },
          artisanName: isMeArtisan ? counterpartDisplayName : myName,
          lastMessage: text,
          lastSenderUid: currentUid,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          ...(pinContext ? { context: pinContext } : {}),
        },
        { merge: true }
      );

      // Persist message to subcollection
      const messagesRef = collection(firestore, 'conversations', activeConversationId, 'messages');
      await addDoc(messagesRef, {
        senderUid: currentUid,
        senderName: myName,
        text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(text); // restore draft on error
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: pad, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {artisanName}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {artisanSpecialty} • Online
          </Text>
        </View>

        <View style={styles.privateBadge}>
          <Text style={styles.privateBadgeText}>🛡️ Verified In-App</Text>
        </View>
      </View>

      {/* Pin Context Banner (if coming from a craft pin) */}
      {pinContext && (pinContext.title || pinContext.imageUrl) && (
        <View
          style={[
            styles.contextBanner,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC',
              borderColor: colors.border,
              marginHorizontal: pad,
            },
          ]}
        >
          {pinContext.imageUrl && (
            <Image source={{ uri: pinContext.imageUrl }} style={styles.contextThumb} />
          )}
          <View style={styles.contextInfo}>
            <Text style={[styles.contextLabel, { color: Colors.accent }]}>INQUIRY CONTEXT</Text>
            <Text style={[styles.contextTitle, { color: colors.text }]} numberOfLines={1}>
              {pinContext.title || 'Portfolio Work'}
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.messagesList, { paddingHorizontal: pad }]}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.startCard}>
              <View style={[styles.startAvatar, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                <Text style={{ fontSize: 32 }}>
                  {currentUid === 'JvLaoDLXBCMYqDO0SyKpeEC6HY42' ? '👤' : '👨‍🔧'}
                </Text>
              </View>
              <Text style={[styles.startTitle, { color: colors.text }]}>{artisanName}</Text>
              <Text style={[styles.startSub, { color: colors.textSecondary }]}>
                {artisanSpecialty}
              </Text>
              <View
                style={[
                  styles.startNotice,
                  { backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC', borderColor: colors.border },
                ]}
              >
                <Text style={[styles.startNoticeText, { color: colors.textSecondary }]}>
                  🛡️ Direct real-time inquiry with {artisanName}. Discuss custom site measurements,
                  material specifications, and fabrication timelines directly in app.
                </Text>
              </View>
            </View>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.isSelf;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgRow,
                    isSelf ? styles.msgRowUser : styles.msgRowArtisan,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isSelf
                        ? [styles.bubbleUser, { backgroundColor: Colors.accent }]
                        : [
                            styles.bubbleArtisan,
                            {
                              backgroundColor: isDark ? '#27272A' : '#F1F5F9',
                              borderColor: colors.border,
                            },
                          ],
                    ]}
                  >
                    {!isSelf && (
                      <Text style={[styles.senderLabel, { color: colors.textSecondary }]}>
                        {msg.senderName}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isSelf ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {msg.text}
                    </Text>
                    <Text
                      style={[
                        styles.timestampText,
                        { color: isSelf ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderTopColor: colors.border,
              paddingHorizontal: pad,
            },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: inputText.trim() ? 1 : 0.4 }]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, fontWeight: '300' },
  headerInfo: { flex: 1, gap: 1 },
  headerName: { fontSize: 15, fontWeight: '800' },
  headerSub: { fontSize: 11 },
  privateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
  },
  privateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 10,
  },
  contextThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  contextInfo: {
    flex: 1,
    gap: 2,
  },
  contextLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contextTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  messagesList: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  msgRow: {
    flexDirection: 'row',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowArtisan: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 18,
    gap: 4,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleArtisan: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  senderLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  timestampText: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 2,
  },
  startCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  startAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  startTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  startSub: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  startNotice: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  startNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
