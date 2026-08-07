import type { Settings } from './types';
export async function deviceApi(
  config: Settings,
  action: string,
  extra: Record<string, unknown> = {},
) {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.deviceToken)
    throw new Error('Complete extension settings first.');
  const response = await fetch(`${config.supabaseUrl}/functions/v1/device-api`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      'x-device-token': config.deviceToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? 'Device request failed');
  return json;
}
