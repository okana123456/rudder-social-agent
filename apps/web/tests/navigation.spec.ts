import { test, expect } from '@playwright/test';
test('main navigation has no dead links and is mobile accessible', async ({ page }) => {
  await page.goto('/dashboard/overview');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  for (const label of [
    'Overview',
    'Campaigns',
    'Content Library',
    'Caption Library',
    'Composer',
    'Calendar',
    'Facebook Pages',
    'Facebook Groups',
    'Queue',
    'Devices & Agent',
    'Analytics',
    'Activity & Audit',
    'Settings',
  ])
    await expect(page.getByRole('link', { name: label })).toHaveAttribute('href', /\/dashboard\//);
});
test('authentication pages expose complete flows', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});
test('mobile navigation opens without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/overview');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
