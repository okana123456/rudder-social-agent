function el(id: string) {
  return document.getElementById(id)!;
}
function send(message: any): Promise<any> {
  return chrome.runtime.sendMessage(message);
}
async function refresh() {
  const result = await send({ type: 'GET_STATUS' });
  const s = result.settings;
  el('status').innerHTML = result.error
    ? `<div class="row"><span>Connection</span><span class="badge">Offline</span></div><p class="error">${escape(result.error)}</p>`
    : `<div class="row"><span>Connection</span><span class="badge">Connected</span></div><div class="row"><span>Facebook login</span><b id="login">Checking…</b></div><div class="row"><span>Pending jobs</span><b>${result.api.pending}</b></div><div class="row"><span>Completed today</span><b>${result.api.device?.completedToday ?? 0}</b></div><div class="row"><span>Mode</span><b>${s.mode}</b></div><div class="row"><span>Last heartbeat</span><b>Now</b></div>`;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const logged = Boolean(
    tabs[0]?.url?.startsWith('https://www.facebook.com/') && !tabs[0]?.url?.includes('/login'),
  );
  const login = el('login');
  if (login) login.textContent = logged ? 'Likely signed in' : 'Open Facebook';
  el('pause').textContent = s.paused ? 'Resume' : 'Pause';
}
el('next').onclick = async () => {
  const r = await send({ type: 'PROCESS_NEXT' });
  el('error').textContent = r.error ?? r.message ?? '';
};
el('pause').onclick = async () => {
  const current = await chrome.storage.local.get('paused');
  await send({ type: 'SET_PAUSED', paused: !current.paused });
  refresh();
};
el('stop').onclick = async () => {
  await send({ type: 'EMERGENCY_STOP' });
  el('error').textContent = 'Emergency stop active.';
  refresh();
};
el('options').onclick = () => chrome.runtime.openOptionsPage();
el('dashboard').onclick = async () => {
  const s = await chrome.storage.local.get('dashboardUrl');
  chrome.tabs.create({ url: `${s.dashboardUrl ?? 'http://localhost:3000'}/dashboard/overview` });
};
void refresh();
function escape(v: string) {
  const d = document.createElement('div');
  d.textContent = v;
  return d.innerHTML;
}
