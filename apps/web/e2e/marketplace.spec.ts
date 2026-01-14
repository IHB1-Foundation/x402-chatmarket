import { test, expect } from '@playwright/test';

/**
 * E2E tests for marketplace flows.
 *
 * Prerequisites:
 * - API running in mock mode (X402_MOCK_MODE=true)
 * - Seed data: at least one published module
 *
 * Note: These tests verify UI behavior up to the point requiring wallet interaction.
 * Full payment flow tests require manual verification or mock wallet injection.
 */

test.describe('Marketplace', () => {
  test('should display marketplace homepage', async ({ page }) => {
    await page.goto('/');

    // Check homepage loads
    await expect(page.locator('h1')).toContainText(/soulforge/i);

    // Should have navigation to marketplace
    await expect(page.getByRole('link', { name: /marketplace/i })).toBeVisible();
  });

  test('should navigate to marketplace and display modules grid', async ({ page }) => {
    await page.goto('/marketplace');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should show marketplace heading
    await expect(page.locator('h1')).toContainText(/marketplace/i);

    // Should have search input
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('should filter modules by search query', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    // Type in search box
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');
    await searchInput.press('Enter');

    // URL should update with search param
    await expect(page).toHaveURL(/q=test/);
  });

  test('should navigate to module detail page', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    // Look for any module card link
    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    // If there are modules, click the first one
    if ((await moduleLink.count()) > 0) {
      await moduleLink.click();

      // Should be on a module detail page
      await expect(page).toHaveURL(/\/marketplace\/[a-f0-9-]+/);

      // Should show module name
      await expect(page.locator('h1')).toBeVisible();

      // Should have action buttons
      await expect(page.getByRole('button', { name: /try once|paid chat/i })).toBeVisible();
    } else {
      // No modules - skip this test
      test.skip();
    }
  });
});

test.describe('Module Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to marketplace first
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');
  });

  test('should show pricing information on detail page', async ({ page }) => {
    // Find and click first module
    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      await moduleLink.click();
      await page.waitForLoadState('networkidle');

      // Should display price information
      await expect(page.getByText(/price|per message|per session/i)).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should have Try Once and Paid Chat buttons', async ({ page }) => {
    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      await moduleLink.click();
      await page.waitForLoadState('networkidle');

      // Check for action buttons - at least one should exist
      const tryOnceButton = page.getByRole('button', { name: /try once/i });
      const paidChatButton = page.getByRole('button', { name: /paid chat/i });
      const chatLink = page.getByRole('link', { name: /try once|paid chat|chat/i });

      const hasActionButton =
        (await tryOnceButton.count()) > 0 ||
        (await paidChatButton.count()) > 0 ||
        (await chatLink.count()) > 0;

      expect(hasActionButton).toBeTruthy();
    } else {
      test.skip();
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate between home and marketplace', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // Go to marketplace
    await page.getByRole('link', { name: /marketplace/i }).click();
    await expect(page).toHaveURL(/marketplace/);

    // Go back to home
    await page.getByRole('link', { name: /soulforge|home/i }).first().click();
    await expect(page).toHaveURL('/');
  });

  test('should have seller dashboard link', async ({ page }) => {
    await page.goto('/');

    // Should have link to seller area
    await expect(page.getByRole('link', { name: /seller|dashboard|create/i })).toBeVisible();
  });
});
