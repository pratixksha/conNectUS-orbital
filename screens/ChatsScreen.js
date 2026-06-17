import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
  Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import {
  ProfileAvatar,
  formatMessageTime,
  fetchConversations,
  fetchMessages,
  sendMessage,
  fetchAcceptedFriends,
  getOrCreateConversation,
  getCurrentUserId,
} from '../lib/social';
import UserProfileScreen from './UserProfileScreen';

function ChatThreadScreen({ conversationId, otherUser, currentUserId, onBack, onOpenProfile  }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  
  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchMessages(conversationId);
      setMessages(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText('');
    try {
      await sendMessage(conversationId, currentUserId, trimmed);
    } catch (err) {
      setText(trimmed);
      Alert.alert('Error', err.message);
    }
    setSending(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.threadHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.threadHeaderCenter}
            onPress={() => onOpenProfile?.(otherUser)}
          >
            <ProfileAvatar profile={otherUser} size={36} />
            <Text style={styles.threadName}>{otherUser.full_name}</Text>
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#1d4ed8" />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => {
              const isMine = item.sender_id === currentUserId;
              return (
                <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                      {item.content}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyThread}>Say hi to start the conversation!</Text>
            }
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function NewChatModal({ visible, onClose, friends, onSelectFriend, loading }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBg} onPress={onClose} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>New Chat</Text>
          <Text style={styles.modalSub}>Choose a friend to message</Text>
          {loading ? (
            <ActivityIndicator color="#1d4ed8" style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {friends.length === 0 && (
                <Text style={styles.emptyText}>Add friends first to start chatting.</Text>
              )}
              {friends.map(({ profile }) => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.modalRow}
                  onPress={() => onSelectFriend(profile)}
                >
                  <ProfileAvatar profile={profile} size={40} />
                  <Text style={styles.modalRowName}>{profile.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ChatsScreen({ onBack, initialChat = null }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [activeChat, setActiveChat] = useState(initialChat);
  const [showNewChat, setShowNewChat] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);


  const loadConversations = useCallback(async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    setCurrentUserId(userId);
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchConversations(userId);
      setConversations(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!activeChat) loadConversations();
    }, [loadConversations, activeChat])
  );

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (initialChat) setActiveChat(initialChat);
  }, [initialChat]);

  useEffect(() => {
    if (!currentUserId || activeChat) return;

    const channel = supabase
      .channel(`conversations:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadConversations()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, activeChat, loadConversations]);

  async function openNewChatModal() {
    setShowNewChat(true);
    setFriendsLoading(true);
    const userId = await getCurrentUserId();
    try {
      const data = await fetchAcceptedFriends(userId);
      setFriends(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setFriendsLoading(false);
  }

  async function startChatWithFriend(profile) {
    setShowNewChat(false);
    try {
      const userId = await getCurrentUserId();
      const conversationId = await getOrCreateConversation(userId, profile.id);
      setActiveChat({ conversationId, otherUser: profile });
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  if (viewingProfile) {
    return (
      <UserProfileScreen
        userId={viewingProfile.id}
        onBack={() => setViewingProfile(null)}
        onOpenChat={() => setViewingProfile(null)} // already chatting with them
      />
    );
  }

  if (activeChat) {
    return (
      <ChatThreadScreen
        conversationId={activeChat.conversationId}
        otherUser={activeChat.otherUser}
        currentUserId={currentUserId}
        onBack={() => {
          setActiveChat(null);
          loadConversations();
        }}
        onOpenProfile={(profile) => setViewingProfile(profile)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.menuBtn}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.appName}>
            con<Text style={{ color: '#ea580c' }}>N</Text>ect<Text style={{ color: '#ea580c' }}>US</Text>
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.chatIcon}>💬</Text>
          <Text style={styles.pageTitle}>My chats</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#1d4ed8" />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {conversations.length === 0 && (
              <Text style={styles.emptyText}>No chats yet. Start a new conversation!</Text>
            )}
            {conversations.map(conv => (
              <TouchableOpacity
                key={conv.id}
                style={styles.convRow}
                onPress={() => setActiveChat({ conversationId: conv.id, otherUser: conv.otherUser })}
              >
                <ProfileAvatar profile={conv.otherUser} size={48} />
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName}>{conv.otherUser.full_name}</Text>
                    <View style={styles.timeRow}>
                      <View style={[
                        styles.statusDot,
                        formatMessageTime(conv.lastMessageAt) === 'Now' && styles.statusDotLive,
                      ]} />
                      <Text style={styles.convTime}>
                        {formatMessageTime(conv.lastMessageAt || conv.lastMessage?.created_at)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {conv.lastMessage?.content || 'No messages yet'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.newChatBtn} onPress={openNewChatModal}>
          <Text style={styles.newChatBtnText}>+ New chat</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <NewChatModal
        visible={showNewChat}
        onClose={() => setShowNewChat(false)}
        friends={friends}
        loading={friendsLoading}
        onSelectFriend={startChatWithFriend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuBtn: { width: 32 },
  menuIcon: { fontSize: 22 },
  appName: { fontSize: 20, fontWeight: 'bold', color: '#1d4ed8' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  chatIcon: { fontSize: 22 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 16, fontWeight: '700', color: '#111' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' },
  statusDotLive: { backgroundColor: '#22c55e' },
  convTime: { fontSize: 12, color: '#64748b' },
  convPreview: { fontSize: 14, color: '#64748b' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  newChatBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#1d4ed8',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  newChatBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, color: '#1d4ed8' },
  threadHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  threadName: { fontSize: 17, fontWeight: '700', color: '#111' },
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
  },
  bubbleMine: { backgroundColor: '#1d4ed8' },
  bubbleTheirs: { backgroundColor: '#f1f5f9' },
  bubbleText: { fontSize: 15, color: '#111', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  emptyThread: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#94a3b8' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalRowName: { fontSize: 16, fontWeight: '600' },
});
