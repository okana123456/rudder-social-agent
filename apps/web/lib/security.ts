import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function safeRedirect(value: string | null, fallback = '/dashboard/facebook-pages') {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
export function encrypt(value: string) {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is missing');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return `${iv.toString('base64')}.${encrypted.toString('base64')}`;
}
export function decrypt(value: string) {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is missing');
  const [ivText, payloadText] = value.split('.');
  if (!ivText || !payloadText) throw new Error('Invalid encrypted value');
  const payload = Buffer.from(payloadText, 'base64');
  const tag = payload.subarray(payload.length - 16);
  const data = payload.subarray(0, payload.length - 16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(raw, 'base64'),
    Buffer.from(ivText, 'base64'),
  );
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}
const limits = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max = 10, windowMs = 60000) {
  const now = Date.now();
  const item = limits.get(key);
  if (!item || item.reset < now) {
    limits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (item.count >= max) return false;
  item.count++;
  return true;
}
