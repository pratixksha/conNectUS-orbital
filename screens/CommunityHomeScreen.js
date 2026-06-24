import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
    Platform, Modal, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

const CATEGORY_COLORS = {
    Study: '#3b82f6', Sports: '#10b981', Music: '#8b5cf6',
    Gaming: '#f59e0b', Food: '#ef4444', Arts: '#ec4899',
    Tech: '#06b6d4', Other: '#94a3b8',
};

export default function CommunityHomeScreen({ community, onBack }) {
    const [userId, setUserId] = useState(null);
    const [communityData, setCommunityData] = useState(community);
    const [posts, setPosts] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [expandedPost, setExpandedPost] = useState(null);
    const [showPostModal, setShowPostModal] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [newPost, setNewPost] = useState('');
    const [posting, setPosting] = useState(false);
    const [postImageUri, setPostImageUri] = useState(null);

    const color = CATEGORY_COLORS[communityData.category] || '#94a3b8';

    useEffect(() => { init(); }, []);

    async function init() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const { data: fresh } = await supabase
            .from('communities').select('*').eq('id', community.id).single();
        if (fresh) setCommunityData(fresh);
        await Promise.all([fetchPosts(user.id), fetchMembers()]);
    }

    async function fetchPosts(uid) {
        setLoading(true);
        const { data } = await supabase
            .from('community_posts')
            .select('*, profiles(full_name, avatar_url), community_replies(*, profiles(full_name)), community_post_likes(user_id)')
            .eq('community_id', community.id)
            .order('created_at', { ascending: false });
        console.log('Posts:', JSON.stringify(data, null, 2));
        setPosts(data || []);
        setLoading(false);
    }

    async function fetchMembers() {
        const { data } = await supabase
            .from('community_members')
            .select('profiles(full_name, avatar_url)')
            .eq('community_id', community.id);
        setMembers((data || []).map(m => m.profiles));
    }

    async function pickPostImage() {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setPostImageUri(result.assets[0].uri);
        }
    }

    async function submitPost() {
        if (!newPost.trim()) return;

        setPosting(true);

        const hashtags = [...newPost.matchAll(/#(\w+)/g)].map(m => m[1]);

        let imageUrl = null;

        if (postImageUri) {
            const { data: { user } } = await supabase.auth.getUser();

            const ext = postImageUri.split('.').pop().toLowerCase() || 'jpg';
            const path = `${userId}/${Date.now()}.${ext}`;

            const formData = new FormData();
            formData.append('file', { uri: postImageUri, type: `image/${ext}`, name: `post.${ext}` });

            const response = await fetch(postImageUri);
            const blob = await response.blob();
            console.log('URI:', postImageUri);
            console.log('Blob size:', blob.size);
            console.log('Blob type:', blob.type);

            const { error } = await supabase.storage
                .from('post-images')
                .upload(path, formData, { contentType: `image/${ext}` });




            if (error) {
                console.log(error);
                Alert.alert('Upload failed');
                setPosting(false);
                return;
            }

            const { data } = supabase.storage
                .from('post-images')
                .getPublicUrl(path);

            imageUrl = data.publicUrl;
        }

        await supabase.from('community_posts').insert({
            community_id: community.id,
            author_id: userId,
            content: newPost.trim(),
            hashtags,
            image_url: imageUrl,
        });

        setNewPost('');
        setPostImageUri(null);
        setShowPostModal(false);

        await fetchPosts(userId);

        setPosting(false);
    }

    async function toggleLike(post) {
        const liked = post.community_post_likes.some(l => l.user_id === userId);
        if (liked) {
            await supabase.from('community_post_likes').delete().eq('post_id', post.id).eq('user_id', userId);
        } else {
            await supabase.from('community_post_likes').insert({ post_id: post.id, user_id: userId });
        }
        fetchPosts(userId);
    }

    async function submitReply(postId) {
        if (!replyText.trim()) return;
        await supabase.from('community_replies').insert({ post_id: postId, author_id: userId, content: replyText.trim() });
        setReplyText('');
        fetchPosts(userId);
    }

    async function deletePost(postId) {
        Alert.alert('Delete Post', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('community_posts').delete().eq('id', postId); fetchPosts(userId); } }
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
            <TouchableOpacity activeOpacity={0.9} style={styles.postCard} onPress={() => setExpandedPost(isExpanded ? null : post.id)}>
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

                <Text style={styles.postContent}>{post.content}</Text>
                {post.image_url && (
                    <Image
                        source={{ uri: post.image_url }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                )}

                {post.hashtags?.length > 0 && (
                    <View style={styles.hashtagRow}>
                        {post.hashtags.map(tag => (
                            <Text key={tag} style={[styles.hashtag, { color }]}>#{tag}</Text>
                        ))}
                    </View>
                )}

                <View style={styles.postActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)}>
                        <Text style={[styles.actionText, liked && { color: '#ef4444' }]}>{liked ? '❤️' : '🤍'} {likeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setExpandedPost(isExpanded ? null : post.id)}>
                        <Text style={styles.actionText}>💬 {replyCount}</Text>
                    </TouchableOpacity>
                </View>

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
            </TouchableOpacity>
        );
    }

    if (loading || !userId) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Banner */}
                <View style={styles.banner}>
                    {communityData.banner_url
                        ? (
                            <Image
                                source={{ uri: communityData.banner_url }}
                                style={styles.bannerImage}
                            />
                        )
                        : (
                            <View
                                style={[
                                    styles.bannerImage,
                                    { backgroundColor: color }
                                ]}
                            />
                        )
                    }

                    <SafeAreaView
                        edges={['top']}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 999,
                        }}
                    >
                        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                            <Text style={styles.backText}>← Back</Text>
                        </TouchableOpacity>
                    </SafeAreaView>

                    <View style={styles.bannerContent}>
                        <View style={[styles.bannerAvatar, { borderColor: color }]}>
                            <Text style={styles.bannerAvatarText}>
                                {communityData.name[0].toUpperCase()}
                            </Text>
                        </View>

                        <Text style={styles.bannerName}>
                            {communityData.name}
                        </Text>

                        <View style={[styles.catTag, { backgroundColor: color + '22' }]}>
                            <Text style={[styles.catTagText, { color }]}>
                                {communityData.category || 'Other'}
                            </Text>
                        </View>

                        <TouchableOpacity onPress={() => setShowMembersModal(true)}>
                            <Text style={[styles.memberCount, { color }]}>
                                {communityData.member_count || 0} members · tap to view
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {/* Posts */}
                <View style={{ paddingTop: 16 }}>
                    {posts.length === 0
                        ? <View style={styles.empty}><Text style={styles.emptyText}>No posts yet. Be the first to post!</Text></View>
                        : posts.map(p => <PostCard key={p.id} post={p} />)
                    }
                </View>
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={[styles.fab, { backgroundColor: color }]} onPress={() => setShowPostModal(true)}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Create Post Modal */}
            <Modal visible={showPostModal} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>New Post</Text>
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#f1f5f9',
                                padding: 12,
                                borderRadius: 10,
                                marginBottom: 12,
                            }}
                            onPress={pickPostImage}
                        >
                            <Text>
                                {postImageUri ? '📷 Image Selected' : '📷 Add Image'}
                            </Text>
                        </TouchableOpacity>
                        <TextInput
                            style={styles.postInput}
                            placeholder="Share something... use #hashtags!"
                            value={newPost}
                            onChangeText={setNewPost}
                            multiline
                            autoFocus
                            placeholderTextColor="#94a3b8"
                        />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPostModal(false); setNewPost(''); }}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.postBtn, { backgroundColor: color }, !newPost.trim() && { opacity: 0.5 }]}
                                onPress={submitPost}
                                disabled={posting || !newPost.trim()}
                            >
                                <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Members Modal */}
            <Modal visible={showMembersModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Members ({members.length})</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {members.map((m, i) => (
                                <View key={i} style={styles.memberRow}>
                                    <View style={styles.memberAvatar}>
                                        <Text style={styles.memberAvatarText}>{m?.full_name?.[0] || '?'}</Text>
                                    </View>
                                    <Text style={styles.memberName}>{m?.full_name || 'Unknown'}</Text>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={[styles.postBtn, { backgroundColor: color, marginTop: 16 }]} onPress={() => setShowMembersModal(false)}>
                            <Text style={styles.postBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    banner: { backgroundColor: '#fff' },
    bannerImage: { width: '100%', height: 140 },
    backBtn: {
        marginTop: 8,
        marginLeft: 16,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 999,
        elevation: 999,
    },
    backText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    bannerContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    bannerAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 10, marginTop: -36, borderWidth: 3, borderColor: '#fff' },
    bannerAvatarText: { fontSize: 30, fontWeight: '800', color: '#1e293b' },
    bannerName: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 6, textAlign: 'center' },
    catTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
    catTagText: { fontSize: 13, fontWeight: '600' },
    memberCount: { fontSize: 13, textDecorationLine: 'underline' },
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
    fab: { position: 'absolute', bottom: 28, right: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
    fabText: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    postInput: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, fontSize: 15, color: '#1e293b', minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
    modalBtns: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    cancelText: { color: '#64748b', fontWeight: '600' },
    postBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    postBtnText: { color: '#fff', fontWeight: '700' },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
    memberAvatarText: { fontSize: 16, fontWeight: '700', color: '#1d4ed8' },
    memberName: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
    postImage: {
        width: '100%',
        height: 220,
        borderRadius: 12,
        marginTop: 10,
        marginBottom: 8,
    },
});