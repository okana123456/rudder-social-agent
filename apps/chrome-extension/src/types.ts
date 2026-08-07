export interface Settings {
  dashboardUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  deviceId: string;
  deviceToken: string;
  mode: 'confirmation' | 'autopilot';
  autopilotAcknowledgedAt?: string;
  notifications: boolean;
  diagnosticConsent: boolean;
  maxJobsPerSession: number;
  paused: boolean;
}
export interface GroupJob {
  id: string;
  caption: string;
  destinationName: string;
  destinationUrl: string;
  mode: 'confirmation' | 'autopilot';
  confirmationOnly: boolean;
  mediaUrls: string[];
  attemptCount: number;
  maxAttempts: number;
}
export const defaults: Settings = {
  dashboardUrl: 'http://localhost:3000',
  supabaseUrl: '',
  supabaseAnonKey: '',
  deviceId: '',
  deviceToken: '',
  mode: 'confirmation',
  notifications: true,
  diagnosticConsent: false,
  maxJobsPerSession: 5,
  paused: false,
};
export async function settings(): Promise<Settings> {
  return { ...defaults, ...(await chrome.storage.local.get(defaults)) } as Settings;
}
