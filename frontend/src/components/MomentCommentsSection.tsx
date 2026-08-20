import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createMomentCommentRequest,
  deleteMomentCommentRequest,
  fetchMomentCommentsRequest,
  MomentCommentResponse,
  MomentResponse,
} from '../api';
import { colors, spacing } from '../theme';
import AvatarBadge from './AvatarBadge';

const COMMENT_LIMIT = 400;

type MomentCommentUpdate = Pick<MomentResponse, 'commentCount' | 'latestComments'>;

type Props = {
  moment: MomentResponse;
  token?: string | null;
  onMomentUpdate: (momentId: string, update: MomentCommentUpdate) => void;
  onAuthorPress?: (userId: string) => void;
};

const compactTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h`;
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)}d`;
  return new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const commentAvatar = (comment: MomentCommentResponse) => (
  comment.author.profileThumbnailUrl || comment.author.profilePictureUrl || comment.author.avatar
);

export default function MomentCommentsSection({ moment, token, onMomentUpdate, onAuthorPress }: Props) {
  const [comments, setComments] = useState<MomentCommentResponse[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const submittingRef = useRef(false);
  const loadRequestRef = useRef(0);

  const loadComments = async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetchMomentCommentsRequest(moment.id, token || undefined);
      if (requestId !== loadRequestRef.current) return;
      setComments(response.data.comments || []);
    } catch (error: any) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(error?.response?.data?.message || 'Comments are temporarily unavailable.');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setComments([]);
    setText('');
    loadComments();
    return () => { loadRequestRef.current += 1; };
  }, [moment.id, token]);

  const submitComment = async () => {
    const trimmed = text.trim();
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to add a comment.');
      return;
    }
    if (!trimmed) {
      Alert.alert('Comment required', 'Write a comment before sending.');
      return;
    }
    if (trimmed.length > COMMENT_LIMIT || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const response = await createMomentCommentRequest(moment.id, trimmed, clientRequestId, token);
      const nextComment = response.data.comment;
      setComments((current) => current.some((comment) => comment.id === nextComment.id)
        ? current
        : [...current, nextComment]);
      setText('');
      onMomentUpdate(moment.id, {
        commentCount: response.data.commentCount,
        latestComments: [nextComment, ...(moment.latestComments || []).filter((comment) => comment.id !== nextComment.id)].slice(0, 2),
      });
    } catch (error: any) {
      Alert.alert('Comment not sent', error?.response?.data?.message || 'Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const deleteComment = (comment: MomentCommentResponse) => {
    if (!token || deletingId) return;
    Alert.alert('Delete comment?', 'This comment will be removed permanently.', [
      { text: 'Keep comment', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(comment.id);
          try {
            const response = await deleteMomentCommentRequest(moment.id, comment.id, token);
            const remaining = comments.filter((item) => item.id !== comment.id);
            setComments(remaining);
            onMomentUpdate(moment.id, {
              commentCount: response.data.commentCount,
              latestComments: [...remaining].reverse().slice(0, 2),
            });
          } catch (error: any) {
            Alert.alert('Comment not deleted', error?.response?.data?.message || 'Please try again.');
          } finally {
            setDeletingId(undefined);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Comments</Text>
        <Text style={styles.count}>{moment.commentCount}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {!loading && loadError ? (
        <TouchableOpacity style={styles.error} onPress={loadComments}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Text style={styles.retry}>Tap to retry</Text>
        </TouchableOpacity>
      ) : null}
      {!loading && !loadError && !comments.length ? (
        <Text style={styles.empty}>No comments yet. Keep the conversation about this experience.</Text>
      ) : null}

      {!loading && !loadError ? comments.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          <TouchableOpacity
            style={styles.authorButton}
            disabled={!comment.author.id || !onAuthorPress}
            onPress={() => comment.author.id && onAuthorPress?.(comment.author.id)}
          >
            <AvatarBadge name={comment.author.name} avatarUrl={commentAvatar(comment)} size={30} />
          </TouchableOpacity>
          <View style={styles.commentBody}>
            <TouchableOpacity
              disabled={!comment.author.id || !onAuthorPress}
              onPress={() => comment.author.id && onAuthorPress?.(comment.author.id)}
            >
              <Text style={styles.author}>{comment.author.name}</Text>
            </TouchableOpacity>
            <Text style={styles.commentText}>{comment.text}</Text>
            <View style={styles.commentMeta}>
              <Text style={styles.time}>{compactTime(comment.createdAt)}</Text>
              {comment.canDelete ? (
                <TouchableOpacity disabled={Boolean(deletingId)} onPress={() => deleteComment(comment)}>
                  <Text style={styles.deleteText}>{deletingId === comment.id ? 'Deleting…' : 'Delete'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )) : null}

      {token ? (
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            maxLength={COMMENT_LIMIT}
            multiline
            editable={!submitting}
            accessibilityLabel="Add a comment"
          />
          <TouchableOpacity
            style={[styles.send, (!text.trim() || submitting) && styles.sendDisabled]}
            disabled={!text.trim() || submitting}
            onPress={submitComment}
            accessibilityLabel="Send comment"
          >
            {submitting
              ? <ActivityIndicator size="small" color={colors.primaryText} />
              : <Ionicons name="arrow-up" size={18} color={colors.primaryText} />}
          </TouchableOpacity>
        </View>
      ) : <Text style={styles.signIn}>Sign in to add a comment.</Text>}
      {text.length > COMMENT_LIMIT - 40 ? <Text style={styles.characterCount}>{text.length}/{COMMENT_LIMIT}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm, marginBottom: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 16, backgroundColor: colors.surface },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  heading: { color: colors.text, fontSize: 16, fontWeight: '900' },
  count: { color: colors.primary, fontSize: 12, fontWeight: '900', marginLeft: spacing.sm },
  loader: { marginVertical: spacing.lg },
  empty: { color: colors.textSubtle, fontSize: 12, lineHeight: 18, paddingVertical: spacing.sm },
  error: { paddingVertical: spacing.md },
  errorText: { color: colors.textMuted, fontSize: 12 },
  retry: { color: colors.primary, fontSize: 12, fontWeight: '900', marginTop: 4 },
  comment: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  authorButton: { alignSelf: 'flex-start' },
  commentBody: { flex: 1, marginLeft: spacing.sm },
  author: { color: colors.text, fontSize: 12, fontWeight: '900' },
  commentText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  time: { color: colors.textSubtle, fontSize: 10 },
  deleteText: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', marginLeft: spacing.md },
  composer: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.md, paddingLeft: spacing.md, paddingRight: 4, paddingVertical: 4, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 22, backgroundColor: colors.background },
  input: { flex: 1, minHeight: 34, maxHeight: 90, paddingTop: 8, paddingBottom: 7, color: colors.text, fontSize: 13 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  sendDisabled: { opacity: .45 },
  signIn: { color: colors.textSubtle, fontSize: 12, marginTop: spacing.md },
  characterCount: { color: colors.textSubtle, fontSize: 10, textAlign: 'right', marginTop: 4 },
});
