import { facebookAdapter, waitFor } from './selectors';
import type { GroupJob } from './types';
let stopped = false;
let panel: HTMLElement | null = null;
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RUDDER_STOP') {
    stopped = true;
    panel?.remove();
    showBanner('Rudder stopped. No post was published.', 'error');
  }
});
async function report(
  jobId: string,
  status: string,
  code?: string,
  message?: string,
  externalPostUrl?: string,
) {
  return chrome.runtime.sendMessage({
    type: 'JOB_STATUS',
    payload: { jobId, status, code, message, externalPostUrl },
  });
}
async function start() {
  const stored = await chrome.storage.session.get(['activeJob', 'expectedGroupPath']);
  const job = stored.activeJob as GroupJob | undefined;
  if (!job) return;
  const expectedGroupPath = String(stored.expectedGroupPath ?? '');
  if (!expectedGroupPath || !location.pathname.startsWith(expectedGroupPath)) {
    await report(
      job.id,
      'requires_attention',
      'GROUP_MISMATCH',
      'The open Facebook Group does not match the approved destination.',
    );
    return;
  }
  const detection = facebookAdapter.detectPage();
  if (detection !== 'ready') {
    const code = detection.toUpperCase();
    await report(
      job.id,
      'requires_attention',
      code,
      `Facebook displayed a ${detection} state. Automation stopped.`,
    );
    showBanner(`Stopped: Facebook ${detection} state detected.`, 'error');
    return;
  }
  try {
    showBanner(`Preparing approved post for ${job.destinationName}…`);
    const trigger = await waitFor(() => facebookAdapter.composerTrigger());
    if (stopped) return;
    trigger.click();
    const editor = await waitFor(() => facebookAdapter.composer());
    if (!facebookAdapter.insertCaption(editor, job.caption))
      throw new Error('Caption insertion could not be verified');
    if (job.mediaUrls.length) {
      const input = await waitFor(() => facebookAdapter.fileInput(), 8000);
      const transfer = new DataTransfer();
      for (const [index, url] of job.mediaUrls.entries()) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Approved media could not be downloaded');
        const blob = await response.blob();
        transfer.items.add(
          new File([blob], `rudder-media-${index}.${blob.type.split('/')[1] ?? 'bin'}`, {
            type: blob.type,
          }),
        );
      }
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await report(job.id, 'awaiting_confirmation');
    const mode = job.confirmationOnly ? 'confirmation' : job.mode;
    showConfirmation(job, mode, async () => {
      if (stopped) return;
      const state = facebookAdapter.detectPage();
      if (state !== 'ready') {
        await report(
          job.id,
          'requires_attention',
          state.toUpperCase(),
          'Facebook state changed before publishing.',
        );
        showBanner('Publishing stopped because Facebook displayed an unexpected state.', 'error');
        return;
      }
      const post = await waitFor(() => facebookAdapter.postButton());
      await report(job.id, 'publishing');
      post.click();
      try {
        await waitFor(() => facebookAdapter.success(), 20000);
        await report(job.id, 'published', undefined, undefined, location.href);
        showBanner('Post outcome verified and recorded.', 'success');
        panel?.remove();
        await chrome.storage.session.remove(['activeJob', 'expectedGroupPath']);
      } catch {
        await report(
          job.id,
          'requires_attention',
          'OUTCOME_UNVERIFIED',
          'The Post button was clicked, but the published outcome could not be verified. Check the group before retrying.',
        );
        showBanner(
          'Outcome could not be verified. Check the group; do not retry until reviewed.',
          'error',
        );
      }
    });
  } catch (error) {
    await report(
      job.id,
      'requires_attention',
      'SELECTOR_FAILURE',
      error instanceof Error ? error.message : 'Facebook interface changed',
    );
    showBanner('Rudder could not safely prepare this post. The job needs review.', 'error');
  }
}
function showConfirmation(
  job: GroupJob,
  mode: 'confirmation' | 'autopilot',
  publish: () => Promise<void>,
) {
  panel?.remove();
  panel = document.createElement('aside');
  panel.id = 'rudder-confirmation';
  panel.setAttribute(
    'style',
    'position:fixed;right:20px;top:80px;z-index:2147483647;width:360px;background:#fff;color:#17202a;border:2px solid #1976d2;border-radius:14px;box-shadow:0 18px 60px #0005;padding:18px;font-family:system-ui',
  );
  panel.innerHTML = `<strong style="font-size:17px">Rudder review</strong><p style="font-size:13px;color:#526678">Destination: ${safe(job.destinationName)}<br>Mode: ${mode}</p><div style="max-height:140px;overflow:auto;background:#f5f8fb;padding:10px;border-radius:8px;font-size:13px;white-space:pre-wrap">${safe(job.caption)}</div><p style="font-size:12px;color:#6b7b8d">Review the Facebook preview itself before approving. Pressing Cancel will skip this attempt.</p><div style="display:flex;gap:8px"><button id="rudder-approve" style="flex:1;border:0;border-radius:8px;padding:10px;background:#1976d2;color:#fff;font-weight:700">Approve & Publish</button><button id="rudder-cancel" style="border:1px solid #ccd8e2;border-radius:8px;padding:10px;background:#fff">Cancel</button></div>`;
  document.body.append(panel);
  panel.querySelector<HTMLButtonElement>('#rudder-approve')!.onclick = () => publish();
  panel.querySelector<HTMLButtonElement>('#rudder-cancel')!.onclick = async () => {
    stopped = true;
    await report(job.id, 'skipped', 'USER_CANCELLED', 'User cancelled at confirmation.');
    panel?.remove();
    showBanner('Post cancelled. Nothing was published.');
  };
  if (mode === 'autopilot') {
    let seconds = 5;
    const approve = panel.querySelector<HTMLButtonElement>('#rudder-approve')!;
    approve.textContent = `Publishing in ${seconds}s · Cancel`;
    const timer = setInterval(() => {
      if (stopped) {
        clearInterval(timer);
        return;
      }
      seconds--;
      approve.textContent = `Publishing in ${seconds}s · Cancel`;
      if (seconds <= 0) {
        clearInterval(timer);
        void publish();
      }
    }, 1000);
    approve.onclick = () => {
      clearInterval(timer);
      stopped = true;
      void report(job.id, 'skipped', 'USER_CANCELLED', 'Autopilot countdown cancelled.');
      panel?.remove();
    };
  }
}
function showBanner(message: string, kind = 'info') {
  const old = document.querySelector('#rudder-banner');
  old?.remove();
  const node = document.createElement('div');
  node.id = 'rudder-banner';
  node.textContent = message;
  node.setAttribute(
    'style',
    `position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;padding:12px 18px;border-radius:10px;color:white;background:${kind === 'error' ? '#b83232' : kind === 'success' ? '#188250' : '#102a43'};font:600 14px system-ui;box-shadow:0 8px 30px #0004`,
  );
  document.body.append(node);
  setTimeout(() => node.remove(), 8000);
}
function safe(value: string) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
void start();
