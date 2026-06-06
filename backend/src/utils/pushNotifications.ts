type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export const buildExpoPushMessage = ({ to, title, body, data = {} }: PushPayload) => ({
  to,
  sound: 'default',
  title,
  body,
  data,
});

export const buildActivityNotification = {
  participantJoined: (to: string, activityTitle: string, participantName: string) =>
    buildExpoPushMessage({
      to,
      title: 'Someone joined your activity',
      body: `${participantName} joined ${activityTitle}.`,
      data: { type: 'participant_joined' },
    }),
  startsSoon: (to: string, activityTitle: string) =>
    buildExpoPushMessage({
      to,
      title: 'Activity starts soon',
      body: `${activityTitle} is coming up soon.`,
      data: { type: 'activity_starts_soon' },
    }),
  newChatMessage: (to: string, activityTitle: string, senderName: string) =>
    buildExpoPushMessage({
      to,
      title: `New message in ${activityTitle}`,
      body: `${senderName} sent a message.`,
      data: { type: 'new_chat_message' },
    }),
  nearbyActivity: (to: string, activityTitle: string) =>
    buildExpoPushMessage({
      to,
      title: 'New activity nearby',
      body: `${activityTitle} is open near you.`,
      data: { type: 'nearby_activity' },
    }),
};
