import type { ViewerJoinStatus } from '../api';

export const activityViewerFlags = (viewerJoinStatus?: ViewerJoinStatus) => ({
  isHost: viewerJoinStatus === 'host',
  isConfirmed: viewerJoinStatus === 'participant',
  isPending: viewerJoinStatus === 'pending',
  isDeclined: viewerJoinStatus === 'declined',
  isWaitlisted: viewerJoinStatus === 'waitlisted',
  isInvited: viewerJoinStatus === 'invited',
  hasNoMembership: viewerJoinStatus === 'none' || viewerJoinStatus === undefined,
});

export const viewerCanStartJoin = (viewerJoinStatus?: ViewerJoinStatus) => (
  viewerJoinStatus === 'none' || viewerJoinStatus === 'invited' || viewerJoinStatus === undefined
);
