import { defaults, settings } from './types';
import { deviceApi } from './api';
const form = document.querySelector<HTMLFormElement>('#form')!,
  message = document.querySelector<HTMLElement>('#message')!;
void settings().then((s) => {
  for (const [key, value] of Object.entries(s)) {
    const input = form.elements.namedItem(
      key === 'diagnosticConsent'
        ? 'diagnostics'
        : key === 'maxJobsPerSession'
          ? 'maxJobs'
          : key === 'autopilotAcknowledgedAt'
            ? 'ack'
            : key,
    ) as HTMLInputElement | null;
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = String(value ?? '');
  }
});
form.onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const mode = String(fd.get('mode')) as 'confirmation' | 'autopilot';
  const ack = Boolean(fd.get('ack'));
  if (mode === 'autopilot' && !ack) {
    message.className = 'error';
    message.textContent = 'Autopilot requires the explicit risk acknowledgement.';
    return;
  }
  const value = {
    ...defaults,
    dashboardUrl: String(fd.get('dashboardUrl')),
    supabaseUrl: String(fd.get('supabaseUrl')).replace(/\/$/, ''),
    supabaseAnonKey: String(fd.get('supabaseAnonKey')),
    deviceId: String(fd.get('deviceId')),
    deviceToken: String(fd.get('deviceToken')),
    mode,
    ...(mode === 'autopilot' ? { autopilotAcknowledgedAt: new Date().toISOString() } : {}),
    notifications: Boolean(fd.get('notifications')),
    diagnosticConsent: Boolean(fd.get('diagnostics')),
    maxJobsPerSession: Number(fd.get('maxJobs')),
    paused: false,
  };
  try {
    await deviceApi(value, 'heartbeat', { version: chrome.runtime.getManifest().version });
    await chrome.storage.local.set(value);
    message.className = '';
    message.textContent = 'Saved. Device connection succeeded.';
  } catch (error) {
    message.className = 'error';
    message.textContent = error instanceof Error ? error.message : 'Connection failed';
  }
};
