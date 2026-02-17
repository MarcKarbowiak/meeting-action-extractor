import { test, expect } from '@playwright/test';

const devContext = {
  tenantId: 'tenant-demo',
  userId: 'user-member-demo',
  email: 'member@demo.local',
  roles: 'member',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((ctx) => {
    localStorage.setItem('dev-context', JSON.stringify(ctx));
  }, devContext);
});

test('seeded note is visible and row click navigates to details', async ({ page }) => {
  await page.goto('/notes');

  await expect(page.getByRole('heading', { name: 'Meeting Notes' })).toBeVisible();

  await page.getByText('Q1 roadmap follow-up').click();
  await expect(page).toHaveURL(/\/notes\/note-demo-1$/);

  await expect(page.getByRole('heading', { name: 'Q1 roadmap follow-up' })).toBeVisible();
});

test('create a note then delete it from the list', async ({ page }) => {
  const title = `E2E smoke note ${Date.now()}`;

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.goto('/notes');
  await page.getByRole('button', { name: 'New Note' }).click();

  await expect(page.getByRole('heading', { name: 'New Meeting Note' })).toBeVisible();

  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Meeting Notes').fill('ACTION: Follow up with finance Owner: Priya due 2026-03-01');
  await page.getByRole('button', { name: 'Submit Note' }).click();

  await expect(page.getByText('Note created successfully')).toBeVisible();

  await page.goto('/notes');
  await expect(page.getByText(title)).toBeVisible();

  const row = page.locator('tr', { hasText: title });
  await expect(row).toBeVisible();
  await row.getByLabel('Delete meeting note').click();

  await expect(page.getByText('Meeting note deleted')).toBeVisible();
  await expect(row).toHaveCount(0);
});
