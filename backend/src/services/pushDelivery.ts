import Notification, { NotificationType } from '../models/Notification';
import PushDevice from '../models/PushDevice';
import PushDelivery from '../models/PushDelivery';
import User from '../models/User';
import { randomUUID } from 'crypto';
import { notificationCopy } from './notifications';
import { ExpoHttpError, ExpoResult, ExpoTransport, expoTransport, isExpoPushToken } from './expoPush';

const minute = 60000;
const day = 24 * 60 * minute;
const maxAttempts = 4;
const staleAfter = 90 * day;
const deviceFilter = (job: any) => ({ _id: job.device, user: job.user, registrationId: job.registrationId });
const errorCode = (result: ExpoResult) => {
  const code = result.details?.error;
  return ['DeviceNotRegistered', 'InvalidPushToken', 'MessageRateExceeded', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'].includes(code || '') ? code! : 'ExpoRejected';
};

export const buildPushPayload = (notification: any, token: string) => {
  const [title, body] = notificationCopy[notification.type as NotificationType];
  return { to: token, title, body, channelId: 'activity-updates', sound: null, ttl: 3600,
    data: { notificationId: String(notification._id), type: notification.type, activityId: String(notification.activity) } };
};

// The marker is inserted with the notification itself, so a crash between
// persistence and scheduling cannot lose the push work. Old records default off.
export const scheduleNotificationPushes = async (now = new Date()) => {
  const records = await Notification.find({ pushPending: true }).sort({ createdAt: 1 }).limit(100);
  for (const notification of records) {
    if (!notification.readAt && notification.createdAt.getTime() > now.getTime() - day) {
      const devices = await PushDevice.find({ user: notification.recipient, revokedAt: null,
        lastSeenAt: { $gt: new Date(now.getTime() - staleAfter) } }).select('+registrationId');
      for (const device of devices) {
        try {
          await PushDelivery.updateOne({ notification: notification._id, device: device._id }, { $setOnInsert: {
            user: notification.recipient, registrationId: device.registrationId, state: 'pending', nextAttemptAt: now,
          } }, { upsert: true });
        } catch (error: any) { if (error?.code !== 11000) throw error; }
      }
    }
    await Notification.updateOne({ _id: notification._id }, { $set: { pushPending: false } });
  }
};

const finishError = async (job: any, result: ExpoResult, now: Date) => {
  const code = errorCode(result);
  if (code === 'DeviceNotRegistered' || code === 'InvalidPushToken') {
    // Revoke before completing the job, so a failed DB write is retried.
    await PushDevice.updateOne(deviceFilter(job), { $set: { revokedAt: now } });
  }
  const retry = code === 'MessageRateExceeded' && job.attempts < maxAttempts;
  await PushDelivery.updateOne({ _id: job._id, state: job.state, ...(job.ticketId ? { ticketId: job.ticketId } : {}), leaseId: job.leaseId }, { $set: {
    state: retry ? 'pending' : 'failed', errorCode: code,
    nextAttemptAt: new Date(now.getTime() + minute * 2 ** job.attempts),
  } });
};

export const processPushDeliveries = async (transport: ExpoTransport = expoTransport, now = new Date()) => {
  // A process that died before dispatch can retry. Once dispatch started, its
  // outcome is unknowable without a ticket; do not risk another visible alert.
  await PushDelivery.updateMany({ state: 'claimed', leaseUntil: { $lte: now } }, { $set: { state: 'pending' } });
  await PushDelivery.updateMany({ state: 'sending', leaseUntil: { $lte: now } }, { $set: { state: 'unknown', errorCode: 'InterruptedDispatch' } });
  const batch: { job: any; message: Record<string, unknown> }[] = [];
  for (let i = 0; i < 50; i++) {
    const job = await PushDelivery.findOneAndUpdate({ state: 'pending', nextAttemptAt: { $lte: now } },
      { $set: { state: 'claimed', leaseId: randomUUID(), leaseUntil: new Date(now.getTime() + 2 * minute) } }, { new: true, sort: { nextAttemptAt: 1 } });
    if (!job) break;
    const [notification, device, exists] = await Promise.all([
      Notification.findOne({ _id: job.notification, recipient: job.user }),
      PushDevice.findOne({ ...deviceFilter(job), revokedAt: null, lastSeenAt: { $gt: new Date(now.getTime() - staleAfter) } }).select('+expoPushToken'),
      User.exists({ _id: job.user, deletionStartedAt: { $exists: false }, deletedAt: { $exists: false } }),
    ]);
    // Future preference checks belong here; they must never change the inbox.
    if (!notification || notification.readAt || notification.createdAt.getTime() < now.getTime() - day || !device || !exists) {
      await PushDelivery.updateOne({ _id: job._id, state: 'claimed', leaseId: job.leaseId }, { $set: { state: 'skipped' } });
      continue;
    }
    if (!isExpoPushToken(device.expoPushToken)) {
      await finishError(job, { status: 'error', details: { error: 'InvalidPushToken' } }, now);
      continue;
    }
    // Record dispatch BEFORE the external call. A lease prevents parallel workers
    // claiming the same job; it does not pretend Expo supports exactly-once sends.
    const claimed = await PushDelivery.findOneAndUpdate({ _id: job._id, state: 'claimed', leaseId: job.leaseId, leaseUntil: { $gt: new Date() } },
      { $set: { state: 'sending', leaseUntil: new Date(Date.now() + 2 * minute) }, $inc: { attempts: 1 } }, { new: true });
    if (claimed) batch.push({ job: claimed, message: buildPushPayload(notification, device.expoPushToken) });
  }
  if (batch.length) {
    let tickets: ExpoResult[];
    try {
      // At most 50 per call (Expo permits 100). Sequential ticks bound traffic.
      tickets = await transport.send(batch.map((item) => item.message));
      if (!Array.isArray(tickets) || tickets.length !== batch.length) throw new Error('Ambiguous tickets');
    } catch (error) {
      for (const { job } of batch) {
        const rejected = error instanceof ExpoHttpError;
        const retry = rejected && (error.status === 429 || error.status >= 500) && job.attempts < maxAttempts;
        await PushDelivery.updateOne({ _id: job._id, state: 'sending' }, { $set: {
          state: retry ? 'pending' : rejected ? 'failed' : 'unknown',
          errorCode: rejected ? `Http${error.status}` : 'AmbiguousNetworkResult',
          nextAttemptAt: new Date(now.getTime() + minute * 2 ** job.attempts),
        } });
      }
      return;
    }
    for (let i = 0; i < batch.length; i++) {
      const { job } = batch[i];
      const ticket = tickets[i];
      if (ticket?.status === 'ok' && typeof ticket.id === 'string') {
        await PushDelivery.updateOne({ _id: job._id, state: 'sending' }, { $set: {
          state: 'ticket', ticketId: ticket.id, nextAttemptAt: new Date(now.getTime() + 15 * minute),
        } });
      } else if (ticket?.status === 'error') await finishError(job, ticket, now);
      else await PushDelivery.updateOne({ _id: job._id, state: 'sending' }, { $set: { state: 'unknown', errorCode: 'MalformedTicket' } });
    }
  }
};

export const checkPushReceipts = async (transport: ExpoTransport = expoTransport, now = new Date()) => {
  const jobs = await PushDelivery.find({ state: 'ticket', nextAttemptAt: { $lte: now } }).limit(100);
  if (!jobs.length) return;
  let receipts: Record<string, ExpoResult> = {};
  try { receipts = await transport.receipts(jobs.map((job) => job.ticketId!)); } catch { /* Receipt lookup can safely retry. */ }
  for (const job of jobs) {
    const receipt = receipts[job.ticketId!];
    if (receipt?.status === 'ok') {
      await PushDelivery.updateOne({ _id: job._id, state: 'ticket', ticketId: job.ticketId }, { $set: { state: 'delivered' } });
    } else if (receipt?.status === 'error') await finishError(job, receipt, now);
    else await PushDelivery.updateOne({ _id: job._id, state: 'ticket', ticketId: job.ticketId }, { $set: {
      state: job.receiptChecks >= 7 ? 'unknown' : 'ticket', errorCode: 'ReceiptUnavailable',
      nextAttemptAt: new Date(now.getTime() + 60 * minute),
    }, $inc: { receiptChecks: 1 } });
  }
};

export const startPushWorker = async () => {
  await Promise.all([PushDevice.init(), PushDelivery.init()]);
  let busy = false;
  const tick = async () => {
    if (busy || process.env.EXPO_PUSH_ENABLED !== 'true' || !process.env.EXPO_PROJECT_ID) return;
    busy = true;
    try {
      await PushDevice.updateMany({ revokedAt: null, lastSeenAt: { $lte: new Date(Date.now() - staleAfter) } }, { $set: { revokedAt: new Date() } });
      await scheduleNotificationPushes();
      await processPushDeliveries();
      await checkPushReceipts();
    } catch { console.error('[push] Worker failed; durable jobs retained'); }
    finally { busy = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 5000);
  timer.unref();
  return timer;
};
