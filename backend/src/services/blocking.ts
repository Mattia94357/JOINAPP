import User from '../models/User';

export const activeUserFilter = { deletionStartedAt: { $exists: false }, deletedAt: { $exists: false } };
const id = (value: any) => value?._id?.toString?.() || value?.id || value?.toString?.();
export const isBlockedBetween = (first: any, second: any) => Boolean(
  (first?.blockedUsers || []).some((value: any) => id(value) === id(second))
  || (second?.blockedUsers || []).some((value: any) => id(value) === id(first)),
);
export const socialAccessDenied = async (viewerId?: string, otherId?: string) => {
  if (!otherId) return true;
  const other = await User.findOne({ _id: otherId, ...activeUserFilter }).select('_id blockedUsers');
  if (!other) return true;
  if (!viewerId || viewerId === otherId) return false;
  const viewer = await User.findOne({ _id: viewerId, ...activeUserFilter }).select('_id blockedUsers');
  return !viewer || isBlockedBetween(viewer, other);
};
export const hiddenSocialUserIds = async (viewerId?: string) => {
  const hidden = await User.find({ $or: [
    { deletionStartedAt: { $exists: true } }, { deletedAt: { $exists: true } },
    ...(viewerId ? [{ blockedUsers: viewerId }] : []),
  ] }).select('_id');
  const viewer = viewerId ? await User.findById(viewerId).select('blockedUsers') : null;
  return [...hidden.map((user) => user._id), ...(viewer?.blockedUsers || [])];
};
