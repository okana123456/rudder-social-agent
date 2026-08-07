import { describe, expect, it } from 'vitest';
import {
  CampaignSchema,
  CaptionSchema,
  canTransition,
  isNonRetryableError,
  retryDelayMs,
} from './index';
describe('publishing state machine', () => {
  it('prevents duplicate terminal publishing', () => {
    expect(canTransition('published', 'ready')).toBe(false);
    expect(canTransition('publishing', 'published')).toBe(true);
  });
  it('uses bounded exponential retry delays', () => {
    expect(retryDelayMs(1)).toBe(60000);
    expect(retryDelayMs(4)).toBe(480000);
    expect(retryDelayMs(20)).toBe(3600000);
  });
  it('stops on platform and authentication checks', () => {
    expect(isNonRetryableError('CAPTCHA')).toBe(true);
    expect(isNonRetryableError('NETWORK_TIMEOUT')).toBe(false);
  });
});
describe('validation', () => {
  it('rejects blank captions', () => {
    expect(
      CaptionSchema.safeParse({
        title: 'Offer',
        body: '',
        callToAction: '',
        link: '',
        hashtags: [],
        tags: [],
      }).success,
    ).toBe(false);
  });
  it('enforces safe campaign limits', () => {
    expect(
      CampaignSchema.safeParse({
        name: 'A',
        description: '',
        category: 'General',
        timezone: 'Africa/Nairobi',
        startDate: '2026-08-07',
        endDate: null,
        dailyLimit: 500,
        minimumIntervalMinutes: 1,
      }).success,
    ).toBe(false);
  });
});
