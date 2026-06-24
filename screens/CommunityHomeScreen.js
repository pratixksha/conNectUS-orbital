import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const CATEGORY_COLORS = {
  Study: '#3b82f6', Sports: '#10b981', Music: '#8b5cf6',
  Gaming: '#f59e0b', Food: '#ef4444', Arts: '#ec4899',
  Tech: '#06b6d4', Other: '#94a3b8',
};

export default function CommunityHomeScreen({ community, onBack }) {
  const [userId, setUserId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedPost, setExpandedPost] = useState(null);
  const color = CATEGORY_COLORS[community.category] || '#94a3b8';

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    await fetchPosts(user.id);
  }

  async function fetchPosts(uid) {
    setLoading(true);
    const { data } = await supabase
      .from('community_posts')
      .select(`
        *,
        profiles(full_name, avatar_url),
        community_replies(*, profiles(full_name)),
        community_post_likes(user_id)
      `)
      .eq('community_id', community.id)
      .order('created_at', { ascending: false });

    setPosts(data || []);
    setLoading(false);
  }

  async function submitPost() {
    if (!newPost.trim()) return;
    setPosting(true);
    const hashtags = [...newPost.matchAll(/#(\w+)/g)].map(m => m[1]);
    await supabase.from('community_posts').insert({
      community_id: community.id,
      author_id: userId,
      content: newPost.trim(),
      hashtags,
    });
    setNewPost('');
    await fetchPosts(userId);
    setPosting(false);
  }

  async function toggleLike(post) {
    const liked = post.community_post_likes.some(l => l.user_id === userId);
    if (liked) {
      await supabase.from('community_post_likes')
        .delete().eq('post_id', post.id).eq('user_id', userId);
    } else {
      await supabase.from('community_post_likes')
        .insert({ post_id: post.id, user_id: userId });
    }
    fetchPosts(userId);
  }

  async function submitReply(postId) {
    if (!replyText.trim()) return;
    await supabase.from('community_replies').insert({
      post_id: postId,
      author_id: userId,
      content: replyText.trim(),
    });
    setReplyText('');
    setReplyingTo(null);
    fetchPosts(userId);
  }

  async function deletePost(postId) {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('community_posts').delete().eq('id', postId);
          fetchPosts(userId);
        }
      }
    ]);
  }

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function PostCard({ post }) {
    const liked = post.community_post_likes.some(l => l.user_id === userId);
    const likeCount = post.community_post_likes.length;
    const replyCount = post.community_replies.length;
    const isExpanded = expandedPost === post.id;
    const isOwner = post.author_id === userId;

    return (
      <View style={styles.postCard}>
        {/* Post header */}
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}>
            <Text style={styles.postAvatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthor}>{post.profiles?.full_name || 'Unknown'}</Text>
            <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
          </View>
          {isOwner && (
            <TouchableOpacity onPress={() => deletePost(post.id)}>
              <Text style={{ color: '#94a3b8', fontSize: 16 }}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <View style={styles.hashtagRow}>
            {post.hashtags.map(tag => (
              <Text key={tag} style={[styles.hashtag, { color }]}>#{tag}</Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)}>
            <Text style={[styles.actionText, liked && { color: '#ef4444' }]}>
              {liked ? '❤️' : '🤍'} {likeCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => {
            setExpandedPost(isExpanded ? null : post.id);
            setReplyingTo(isExpanded ? null : post.id);
          }}>
            <Text style={styles.actionText}>💬 {replyCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Replies */}
        {isExpanded && (
          <View style={styles.repliesSection}>
            {post.community_replies.map(reply => (
              <View key={reply.id} style={styles.reply}>
                <Text style={styles.replyAuthor}>{reply.profiles?.full_name || 'Unknown'}</Text>
                <Text style={styles.replyContent}>{reply.content}</Text>
              </View>
            ))}
            <View style={styles.replyInput}>
              <TextInput
                style={styles.replyBox}
                placeholder="Write a reply..."
                value={replyText}
                onChangeText={setReplyText}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity style={[styles.replyBtn, { backgroundColor: color }]} onPress={() => submitReply(post.id)}>
                <Text style={styles.replyBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (loading || !userId) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: color + '44' }]}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{community.name}</Text>
          <Text style={styles.headerMeta}>{community.member_count || 0} members · {community.category}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Create post */}
          <View style={styles.createPost}>
            <TextInput
              style={styles.postInput}
              placeholder="Share something with the community... use #hashtags!"
              value={newPost}
              onChangeText={setNewPost}
              multiline
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              style={[styles.postBtn, { backgroundColor: color }, !newPost.trim() && { opacity: 0.5 }]}
              onPress={submitPost}
              disabled={posting || !newPost.trim()}
            >
              <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>

          {/* Posts */}
          {posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No posts yet. Be the first to post!</Text>
            </View>
          ) : (
            posts.map(p => <PostCard key={p.id} post={p} />)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  back: { fontSize: 15, color: '#1d4ed8' },
  headerCenter: { alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  headerMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  createPost: { margin: 16, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14 },
  postInput: { fontSize: 15, color: '#1e293b', minHeight: 70, textAlignVertical: 'top', marginBottom: 10 },
  postBtn: { borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  postCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  postAvatarText: { fontSize: 15, fontWeight: '700', color: '#1d4ed8' },
  postAuthor: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  postTime: { fontSize: 11, color: '#94a3b8' },
  postContent: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 8 },
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  hashtag: { fontSize: 13, fontWeight: '600' },
  postActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontSize: 14, color: '#64748b' },
  repliesSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 },
  reply: { marginBottom: 10 },
  replyAuthor: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  replyContent: { fontSize: 13, color: '#475569', marginTop: 2 },
  replyInput: { flexDirection: 'row', gap: 8, marginTop: 8 },
  replyBox: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  replyBtn: { borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  replyBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
});