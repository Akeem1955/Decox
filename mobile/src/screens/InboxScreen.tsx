import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { ChatDetailScreen, ChatPinContext } from './ChatDetailScreen';
import { FlowerLoader } from '../components/FlowerLoader';
import { firestore } from '../config/firebaseConfig';
import { getCurrentUser } from '../services/authService';
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

interface Conversation {
  id: string;
  counterpartUid: string;
  counterpartName: string;
  counterpartSpecialty: string;
  avatar: string;
  lastMessage: string;
  time: string;
  updatedAtMs: number;
  context?: ChatPinContext;
}

interface InboxScreenProps {
  onExplore?: () => void;
}

function formatFirestoreTime(ts: any): { display: string; ms: number } {
  if (!ts) return { display: '', ms: 0 };
  if (ts instanceof Timestamp) {
    const d = ts.toDate();
    const ms = d.getTime();
    const now = new Date();
    const diffMs = now.getTime() - ms;
    if (diffMs < 60000) return { display: 'Just now', ms };
    if (diffMs < 3600000) return { display: `${Math.floor(diffMs / 60000)}m ago`, ms };
    if (diffMs < 86400000) return { display: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ms };
    if (diffMs < 172800000) return { display: 'Yesterday', ms };
    return { display: d.toLocaleDateString(), ms };
  }
  return { display: String(ts), ms: 0 };
}

export function InboxScreen({ onExplore }: InboxScreenProps = {}) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  const pad = Math.max(width * 0.05, 16);

  useEffect(() => {
    const user = getCurrentUser();
    const userUid = user?.uid;

    if (!userUid) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convosRef = collection(firestore, 'conversations');
    // Compliant query: where participantUids array contains current user UID
    const q = query(convosRef, where('participantUids', 'array-contains', userUid));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Conversation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const participantUids: string[] = data.participantUids || [];
          const otherUid =
            participantUids.find((uid) => uid !== userUid) ||
            (data.userUid !== userUid ? data.userUid : 'JvLaoDLXBCMYqDO0SyKpeEC6HY42');

          const participants = data.participants || {};
          const otherInfo = participants[otherUid] || {};
          const isCurrentArtisan = userUid === 'JvLaoDLXBCMYqDO0SyKpeEC6HY42' || participants[userUid]?.role === 'artisan';

          const title =
            otherInfo.displayName ||
            (isCurrentArtisan ? 'Client Inquiry' : (data.artisanName || 'Adetunji Akeem'));

          const specialty =
            otherInfo.role === 'client'
              ? (data.context?.title ? `Inquiring: ${data.context.title}` : 'Direct Client Inquiry')
              : (otherInfo.specialty || data.artisanSpecialty || 'Master Artisan');

          const avatar = isCurrentArtisan ? '👤' : '👨‍🔧';
          const timeInfo = formatFirestoreTime(data.updatedAt || data.createdAt);

          loaded.push({
            id: docSnap.id,
            counterpartUid: otherUid,
            counterpartName: title,
            counterpartSpecialty: specialty,
            avatar,
            lastMessage: data.lastMessage || 'Inquiry initiated',
            time: timeInfo.display,
            updatedAtMs: timeInfo.ms,
            context: data.context,
          });
        });

        // In-memory sort by recent update avoids requiring compound Firestore index
        loaded.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setConversations(loaded);
        setLoading(false);
      },
      (err) => {
        console.warn('Inbox conversations fetch error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleDelete = (convoId: string, name: string) => {
    Alert.alert(
      'Delete Conversation',
      `Delete inquiry with ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(firestore, 'conversations', convoId));
            } catch (err) {
              console.error('Delete conversation failed:', err);
            }
          },
        },
      ]
    );
  };

  if (activeChat) {
    return (
      <ChatDetailScreen
        conversationId={activeChat.id}
        artisanUid={activeChat.counterpartUid}
        artisanName={activeChat.counterpartName}
        artisanSpecialty={activeChat.counterpartSpecialty}
        pinContext={activeChat.context}
        onBack={() => setActiveChat(null)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Text style={[styles.title, { color: colors.text, fontSize: Math.min(width * 0.065, 24) }]}>
          Inbox
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Real-time inquiries with verified master artisans & trade specialists
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <FlowerLoader size={60} />
        </View>
      ) : conversations.length > 0 ? (
        <ScrollView contentContainerStyle={[styles.list, { paddingHorizontal: pad }]}>
          {conversations.map((convo) => (
            <TouchableOpacity
              key={convo.id}
              style={[
                styles.convoCard,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setActiveChat(convo)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatarWrap, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                <Text style={{ fontSize: 24 }}>{convo.avatar}</Text>
              </View>

              <View style={styles.convoInfo}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.artisanName, { color: colors.text }]} numberOfLines={1}>
                    {convo.counterpartName}
                  </Text>
                  <Text style={[styles.timeText, { color: colors.textMuted }]}>{convo.time}</Text>
                </View>

                <View style={styles.specialtyRow}>
                  <View style={[styles.specialtyBadge, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                    <Text style={[styles.specialtyText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {convo.counterpartSpecialty}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.lastMsgText,
                    { color: colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {convo.lastMessage}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleDelete(convo.id, convo.counterpartName)}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1C1C1E' : '#F1F5F9' }]}>
            <Text style={{ fontSize: 36 }}>💬</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No inquiries yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Connect directly with verified master artisans to get custom site quotes, measurements, and material samples.
          </Text>
          {onExplore && (
            <TouchableOpacity
              style={[styles.exploreBtn, { backgroundColor: Colors.accent }]}
              onPress={onExplore}
              activeOpacity={0.85}
            >
              <Text style={styles.exploreBtnText}>Explore Artisan Crafts →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 4,
  },
  title: { fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  exploreBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  exploreBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  list: { gap: 10, paddingBottom: 80 },
  convoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoInfo: { flex: 1, gap: 3 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  artisanName: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  timeText: { fontSize: 11 },
  specialtyRow: {
    flexDirection: 'row',
  },
  specialtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: '90%',
  },
  specialtyText: { fontSize: 10, fontWeight: '600' },
  lastMsgText: { fontSize: 13, marginTop: 2 },
  deleteBtn: {
    padding: 6,
  },
});
