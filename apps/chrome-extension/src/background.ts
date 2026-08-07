import { deviceApi } from './api';
import { settings, type GroupJob } from './types';
let completedSession = 0;
chrome.runtime.onInstalled.addListener(() =>
  chrome.alarms.create('heartbeat', { periodInMinutes: 0.75 }),
);
chrome.runtime.onStartup.addListener(() =>
  chrome.alarms.create('heartbeat', { periodInMinutes: 0.75 }),
);
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat') await heartbeat();
});
async function heartbeat() {
  try {
    const s = await settings();
    if (s.deviceToken)
      await deviceApi(s, 'heartbeat', { version: chrome.runtime.getManifest().version });
  } catch (error) {
    await chrome.storage.session.set({
      lastError: error instanceof Error ? error.message : 'Heartbeat failed',
    });
  }
}
async function processNext() {
  const s = await settings();
  if (s.paused) throw new Error('Assistant is paused');
  if (completedSession >= s.maxJobsPerSession) throw new Error('Session job limit reached');
  const { job } = (await deviceApi(s, 'claim')) as { job: GroupJob | null };
  if (!job) return { message: 'No eligible Group jobs' };
  const expected = new URL(job.destinationUrl);
  const tab = await chrome.tabs.create({ url: job.destinationUrl, active: true });
  if (!tab.id) throw new Error('Could not open Facebook Group');
  await chrome.storage.session.set({ activeJob: job, expectedGroupPath: expected.pathname });
  return { message: `Opened ${job.destinationName}`, job };
}
chrome.runtime.onMessage.addListener((message, _sender, send) => {
  (async () => {
    if (message.type === 'GET_STATUS') {
      const s = await settings();
      let api = null;
      try {
        api = await deviceApi(s, 'heartbeat', { version: chrome.runtime.getManifest().version });
      } catch (error) {
        return { settings: s, error: error instanceof Error ? error.message : 'Disconnected' };
      }
      return {
        settings: s,
        api,
        lastError: (await chrome.storage.session.get('lastError')).lastError,
      };
    }
    if (message.type === 'PROCESS_NEXT') return processNext();
    if (message.type === 'SET_PAUSED') {
      const s = await settings();
      await chrome.storage.local.set({ paused: message.paused });
      if (s.deviceToken)
        await deviceApi({ ...s, paused: message.paused }, 'pause', { paused: message.paused });
      return { ok: true };
    }
    if (message.type === 'EMERGENCY_STOP') {
      await chrome.storage.local.set({ paused: true });
      const s = await settings();
      if (s.deviceToken) await deviceApi({ ...s, paused: true }, 'pause', { paused: true });
      const tabs = await chrome.tabs.query({ url: 'https://www.facebook.com/groups/*' });
      for (const tab of tabs)
        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'RUDDER_STOP' }).catch(() => {});
      return { ok: true };
    }
    if (message.type === 'JOB_STATUS') {
      const s = await settings();
      const result = await deviceApi(s, 'status', message.payload);
      if (message.payload.status === 'published') completedSession++;
      return result;
    }
    return { error: 'Unknown message' };
  })()
    .then(send)
    .catch((e) => send({ error: e.message }));
  return true;
});
void heartbeat();
