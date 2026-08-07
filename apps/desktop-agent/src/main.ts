import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  nativeImage,
  safeStorage,
  shell,
} from 'electron';
import Store from 'electron-store';

interface Config {
  dashboardUrl: string;
  supabaseUrl: string;
  anonKey: string;
  encryptedDeviceToken: string;
  launchChrome: boolean;
  paused: boolean;
  pending: number;
  lastError: string;
}
const store = new Store<Config>({
  defaults: {
    dashboardUrl: process.env.RUDDER_DASHBOARD_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.RUDDER_SUPABASE_URL ?? '',
    anonKey: process.env.RUDDER_SUPABASE_ANON_KEY ?? '',
    encryptedDeviceToken: '',
    launchChrome: false,
    paused: false,
    pending: 0,
    lastError: '',
  },
});
let tray: Tray | null = null,
  timer: NodeJS.Timeout | null = null,
  shuttingDown = false;
function token() {
  const encrypted = store.get('encryptedDeviceToken');
  if (!encrypted) return '';
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch {
    return '';
  }
}
function icon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#1976d2"/><text x="16" y="23" text-anchor="middle" font-family="Arial" font-size="21" font-weight="700" fill="white">R</text></svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  );
}
async function request(action: string, extra: Record<string, unknown> = {}) {
  const url = store.get('supabaseUrl'),
    key = store.get('anonKey'),
    deviceToken = token();
  if (!url || !key || !deviceToken) throw new Error('Device connection is not configured');
  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/device-api`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'x-device-token': deviceToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, version: app.getVersion(), ...extra }),
  });
  const result = (await response.json()) as any;
  if (!response.ok) throw new Error(result.error ?? 'Supabase connection failed');
  return result;
}
async function heartbeat() {
  if (shuttingDown) return;
  try {
    const previous = store.get('pending');
    const result = await request('heartbeat');
    store.set({ pending: result.pending ?? 0, lastError: '' });
    if (result.pending > previous && Notification.isSupported())
      new Notification({
        title: 'Rudder posts pending',
        body: `${result.pending} Group jobs are ready for the browser extension.`,
      }).show();
  } catch (error) {
    store.set('lastError', error instanceof Error ? error.message : 'Connection failed');
  }
  buildMenu();
}
function buildMenu() {
  if (!tray) return;
  const paused = store.get('paused'),
    pending = store.get('pending'),
    error = store.get('lastError');
  tray.setToolTip(error ? `Rudder · ${error}` : `Rudder · ${pending} pending`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Rudder Social Agent · ${pending} pending`, enabled: false },
      { label: error ? `Offline: ${error}` : 'Dashboard and Supabase connected', enabled: false },
      { type: 'separator' },
      { label: 'Start', enabled: paused, click: () => setPaused(false) },
      { label: 'Pause', enabled: !paused, click: () => setPaused(true) },
      { label: 'Resume', enabled: paused, click: () => setPaused(false) },
      { label: 'Open Dashboard', click: () => shell.openExternal(store.get('dashboardUrl')) },
      { label: 'Launch Chrome', click: () => shell.openExternal('https://www.facebook.com/') },
      { type: 'separator' },
      {
        label: app.getLoginItemSettings().openAtLogin
          ? 'Disable Windows startup'
          : 'Enable Windows startup',
        click: () => {
          const enabled = !app.getLoginItemSettings().openAtLogin;
          app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
          buildMenu();
        },
      },
      { label: 'Connection settings…', click: showSettings },
      {
        label: 'Quit',
        click: () => {
          shuttingDown = true;
          app.quit();
        },
      },
    ]),
  );
}
async function setPaused(paused: boolean) {
  store.set('paused', paused);
  try {
    await request('pause', { paused });
  } catch (error) {
    store.set('lastError', error instanceof Error ? error.message : 'Pause failed');
  }
  buildMenu();
}
function showSettings() {
  const win = new BrowserWindow({
    width: 620,
    height: 640,
    resizable: false,
    title: 'Rudder connection settings',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const data = store.store;
  const html = `<!doctype html><html><style>body{font:14px system-ui;background:#f5f8fb;color:#17202a;padding:24px}h1{font-size:22px}label{display:grid;gap:5px;margin:14px 0;font-weight:700}input{padding:10px;border:1px solid #cdd9e3;border-radius:8px}button{padding:11px 16px;border:0;border-radius:8px;background:#1976d2;color:white;font-weight:700}.note{padding:12px;border-left:3px solid #19a7a0;background:#e8f6f5}</style><h1>Rudder connection</h1><p class="note">The desktop agent never stores Facebook passwords or browser sessions. The device token is encrypted with Windows protected storage.</p><form method="get" action="rudder://save"><label>Dashboard URL<input name="dashboard" type="url" value="${escapeHtml(data.dashboardUrl)}" required></label><label>Supabase URL<input name="supabase" type="url" value="${escapeHtml(data.supabaseUrl)}" required></label><label>Supabase public anon key<input name="key" value="${escapeHtml(data.anonKey)}" required></label><label>Device token<input name="token" type="password" placeholder="Paste a new token to replace the current one"></label><button>Save connection</button></form></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
app.setAsDefaultProtocolClient('rudder');
app.on('open-url', (event, url) => {
  event.preventDefault();
  saveFromUrl(url);
});
app.on('second-instance', (_event, argv) => {
  const url = argv.find((v) => v.startsWith('rudder://'));
  if (url) saveFromUrl(url);
});
function saveFromUrl(value: string) {
  const url = new URL(value);
  if (url.hostname !== 'save') return;
  store.set('dashboardUrl', url.searchParams.get('dashboard') ?? store.get('dashboardUrl'));
  store.set('supabaseUrl', url.searchParams.get('supabase') ?? store.get('supabaseUrl'));
  store.set('anonKey', url.searchParams.get('key') ?? store.get('anonKey'));
  const raw = url.searchParams.get('token');
  if (raw && safeStorage.isEncryptionAvailable())
    store.set('encryptedDeviceToken', safeStorage.encryptString(raw).toString('base64'));
  void heartbeat();
}
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else
  app.whenReady().then(() => {
    tray = new Tray(icon());
    tray.on('double-click', () => shell.openExternal(store.get('dashboardUrl')));
    buildMenu();
    void heartbeat();
    timer = setInterval(heartbeat, 45000);
    if (store.get('launchChrome')) void shell.openExternal('https://www.facebook.com/');
  });
app.on('window-all-closed', () => {
  // Keep the tray process alive when the settings window closes.
});
app.on('before-quit', () => {
  shuttingDown = true;
  if (timer) clearInterval(timer);
});
