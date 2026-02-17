import { test, expect } from '@playwright/test';

const devContext = {
  tenantId: 'tenant-demo',
  userId: 'user-admin-demo',
  email: 'admin@demo.local',
  roles: 'admin,member',
  allowDeleteNotes: true,
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

test('create a note then delete it from note details', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/notes\//);

  await page.getByRole('button', { name: 'Delete Note' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Meeting note deleted')).toBeVisible();
  await expect(page).toHaveURL(/\/notes$/);

  await page.goto('/notes');
  await expect(page.getByText(title)).toHaveCount(0);
});
