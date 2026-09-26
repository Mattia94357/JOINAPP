export const isExpoPushToken = (value: unknown): value is string => typeof value === 'string'
  && value.length <= 512 && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value);

export type ExpoResult = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };
export class ExpoHttpError extends Error {
  constructor(public status: number) { super('Expo request rejected'); }
}
export type ExpoTransport = {
  send: (messages: Record<string, unknown>[]) => Promise<ExpoResult[]>;
  receipts: (ids: string[]) => Promise<Record<string, ExpoResult>>;
};

// Supported Expo HTTP API. No automatic transport retries: the durable worker
// decides when it is safe to retry. Never log request bodies or Expo error text.
const request = async (endpoint: string, body: unknown) => {
  const response = await fetch(`https://exp.host/--/api/v2/push/${endpoint}`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ExpoHttpError(response.status);
  const payload = await response.json() as any;
  if (!payload.data || payload.errors?.length) throw new Error('Ambiguous Expo response');
  return payload.data;
};
export const expoTransport: ExpoTransport = {
  send: (messages) => request('send', messages),
  receipts: (ids) => request('getReceipts', { ids }),
};
