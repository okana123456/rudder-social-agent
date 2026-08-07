export async function decryptToken(value: string) {
  const encodedKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!encodedKey) throw new Error('TOKEN_ENCRYPTION_KEY is missing');
  const bytes = Uint8Array.from(atob(encodedKey), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
  const [ivPart, cipherPart] = value.split('.');
  if (!ivPart || !cipherPart) throw new Error('Invalid encrypted token');
  const iv = Uint8Array.from(atob(ivPart), (c) => c.charCodeAt(0));
  const cipher = Uint8Array.from(atob(cipherPart), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher),
  );
}
