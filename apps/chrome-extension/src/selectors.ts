export type Detection = 'ready' | 'login' | 'checkpoint' | 'captcha' | 'restriction' | 'unexpected';
const visible = (node: Element | null): node is HTMLElement =>
  node instanceof HTMLElement && node.offsetParent !== null;
const text = (node: Element) => node.textContent?.trim().toLowerCase() ?? '';
export const facebookAdapter = {
  detectPage(): Detection {
    const url = location.href;
    const body = document.body.innerText.toLowerCase();
    if (url.includes('/login') || document.querySelector('input[name="email"]')) return 'login';
    if (
      url.includes('/checkpoint') ||
      body.includes('security check') ||
      body.includes('confirm your identity')
    )
      return 'checkpoint';
    if (body.includes('captcha')) return 'captcha';
    if (
      body.includes('temporarily blocked') ||
      body.includes('restricted from posting') ||
      body.includes('we limit how often')
    )
      return 'restriction';
    if (/^https:\/\/(www\.)?facebook\.com\/groups\//.test(url)) return 'ready';
    return 'unexpected';
  },
  composerTrigger() {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[role="button"],button'));
    return (
      candidates.find(
        (e) =>
          visible(e) &&
          ['write something…', 'write something...', 'create a public post', 'create post'].some(
            (v) => text(e).includes(v),
          ),
      ) ?? null
    );
  },
  composer() {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
    for (const dialog of dialogs.reverse()) {
      const editor = dialog.querySelector<HTMLElement>(
        '[contenteditable="true"][role="textbox"],div[contenteditable="true"]',
      );
      if (visible(editor)) return editor;
    }
    return (
      Array.from(
        document.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]'),
      ).find(visible) ?? null
    );
  },
  insertCaption(editor: HTMLElement, caption: string) {
    editor.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, caption);
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: caption }),
    );
    return (editor.textContent ?? '').trim().length > 0;
  },
  fileInput() {
    return (
      Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]')).find(
        (input) => input.accept.includes('image') || input.accept.includes('video'),
      ) ?? null
    );
  },
  postButton() {
    const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);
    if (!dialog) return null;
    return (
      Array.from(dialog.querySelectorAll<HTMLElement>('[role="button"],button')).find(
        (e) => visible(e) && text(e) === 'post' && e.getAttribute('aria-disabled') !== 'true',
      ) ?? null
    );
  },
  success() {
    const body = document.body.innerText.toLowerCase();
    return (
      body.includes('your post is now published') ||
      body.includes('your post was submitted') ||
      (Boolean(document.querySelector('[role="alert"]')) && body.includes('posted'))
    );
  },
};
export async function waitFor<T>(probe: () => T | null, timeout = 12000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Facebook interface element was not found before the timeout');
}
