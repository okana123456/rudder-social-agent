import { z } from 'zod';

export const jobStatuses = [
  'draft',
  'scheduled',
  'ready',
  'claimed',
  'awaiting_confirmation',
  'publishing',
  'published',
  'failed',
  'skipped',
  'cancelled',
  'requires_attention',
] as const;
export const JobStatusSchema = z.enum(jobStatuses);
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type DestinationKind = 'page' | 'group';
export type OperatingMode = 'confirmation' | 'autopilot';

export const CampaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  category: z.string().trim().max(80).default('General'),
  timezone: z.string().default('Africa/Nairobi'),
  startDate: z.string().date(),
  endDate: z.string().date().nullable(),
  dailyLimit: z.coerce.number().int().min(1).max(50).default(5),
  minimumIntervalMinutes: z.coerce.number().int().min(5).max(1440).default(60),
});

export const CaptionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(63206),
  callToAction: z.string().trim().max(240).default(''),
  link: z.string().url().or(z.literal('')).default(''),
  hashtags: z
    .array(z.string().regex(/^#[\p{L}\p{N}_]+$/u))
    .max(30)
    .default([]),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
});

export const SchedulePostSchema = z
  .object({
    campaignId: z.string().uuid(),
    captionId: z.string().uuid().nullable(),
    captionOverride: z.string().trim().min(1).max(63206).nullable(),
    mediaAssetIds: z.array(z.string().uuid()).max(10).default([]),
    destinationIds: z.array(z.string().uuid()).min(1),
    scheduledFor: z.string().datetime(),
    mode: z.enum(['confirmation', 'autopilot']).default('confirmation'),
  })
  .refine((v) => Boolean(v.captionId || v.captionOverride), 'A caption is required');

export const DeviceRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(['chrome_extension', 'desktop_agent']),
  operatingSystem: z.string().max(100),
  version: z.string().max(30),
  mode: z.enum(['confirmation', 'autopilot']).default('confirmation'),
});

export const ExtensionSettingsSchema = z.object({
  dashboardUrl: z.string().url(),
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(20),
  deviceId: z.string().uuid().optional(),
  deviceToken: z.string().min(20).optional(),
  mode: z.enum(['confirmation', 'autopilot']).default('confirmation'),
  autopilotAcknowledgedAt: z.string().datetime().optional(),
  notifications: z.boolean().default(true),
  diagnosticConsent: z.boolean().default(false),
  maxJobsPerSession: z.number().int().min(1).max(20).default(5),
  paused: z.boolean().default(false),
});

export type CampaignInput = z.infer<typeof CampaignSchema>;
export type CaptionInput = z.infer<typeof CaptionSchema>;
export type SchedulePostInput = z.infer<typeof SchedulePostSchema>;
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

export interface QueueJob {
  id: string;
  organisationId: string;
  destinationKind: DestinationKind;
  destinationId: string;
  destinationName: string;
  destinationUrl?: string;
  caption: string;
  mediaUrls: string[];
  scheduledFor: string;
  status: JobStatus;
  mode: OperatingMode;
  attemptCount: number;
  maxAttempts: number;
  leaseExpiresAt?: string;
  idempotencyKey: string;
}

export interface AgentEvent {
  type: 'status' | 'job_update' | 'emergency_stop' | 'diagnostic';
  jobId?: string;
  status?: JobStatus;
  code?: string;
  message: string;
  at: string;
}

const terminalStatuses: JobStatus[] = ['published', 'skipped', 'cancelled'];
export function canTransition(from: JobStatus, to: JobStatus) {
  const allowed: Record<JobStatus, JobStatus[]> = {
    draft: ['scheduled', 'cancelled'],
    scheduled: ['ready', 'cancelled'],
    ready: ['claimed', 'publishing', 'cancelled', 'skipped'],
    claimed: ['awaiting_confirmation', 'publishing', 'ready', 'requires_attention', 'skipped'],
    awaiting_confirmation: ['publishing', 'skipped', 'ready', 'requires_attention'],
    publishing: ['published', 'failed', 'requires_attention'],
    published: [],
    failed: ['ready', 'requires_attention', 'cancelled'],
    skipped: [],
    cancelled: [],
    requires_attention: ['ready', 'cancelled', 'skipped'],
  };
  return allowed[from].includes(to) && !terminalStatuses.includes(from);
}
export function retryDelayMs(attempt: number, base = 60_000, cap = 3_600_000) {
  return Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
}
export function isNonRetryableError(code: string) {
  return [
    'AUTH_REQUIRED',
    'CAPTCHA',
    'CHECKPOINT',
    'POSTING_RESTRICTED',
    'PERMISSION_DENIED',
    'GROUP_MISMATCH',
    'OUTCOME_UNVERIFIED',
  ].includes(code);
}
