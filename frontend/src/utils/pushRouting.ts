import { AppNotification } from '../api';
const types = new Set(['join_request', 'join_approved', 'join_declined', 'waitlist_promoted', 'participant_removed', 'activity_cancelled', 'activity_edited']);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
export const parsePushData = (value: any): { notificationId: string; type: AppNotification['type']; activityId: string } | null =>
  value && types.has(value.type) && id(value.notificationId) && id(value.activityId)
    ? { notificationId: value.notificationId, type: value.type, activityId: value.activityId } : null;
