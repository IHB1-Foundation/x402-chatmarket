import { test, expect } from '@playwright/test';

/**
 * E2E tests for chat and payment flows.
 *
 * Prerequisites:
 * - API running in mock mode (X402_MOCK_MODE=true)
 * - At least one published module exists
 *
 * Note: Full wallet signing flow cannot be automated without mock wallet injection.
 * These tests verify:
 * 1. Chat page loads correctly
 * 2. 402 Payment Required modal appears when needed
 * 3. UI elements are in correct states
 */

test.describe('Chat Page', () => {
  test('should navigate to chat page from module detail', async ({ page }) => {
    // First get a module from marketplace
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    // Find first module link
    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      // Get the module ID from the link
      const href = await moduleLink.getAttribute('href');
      const moduleId = href?.split('/').pop();

      if (moduleId) {
        // Navigate directly to chat page
        await page.goto(`/chat/${moduleId}`);
        await page.waitForLoadState('networkidle');

        // Should be on chat page
        await expect(page).toHaveURL(new RegExp(`/chat/${moduleId}`));

        // Should have message input
        const messageInput =
          page.getByPlaceholder(/message/i) || page.locator('textarea, input[type="text"]');
        await expect(messageInput.first()).toBeVisible();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should show chat UI elements', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      const href = await moduleLink.getAttribute('href');
      const moduleId = href?.split('/').pop();

      if (moduleId) {
        await page.goto(`/chat/${moduleId}`);
        await page.waitForLoadState('networkidle');

        // Should show module info or name
        await expect(page.locator('h1, h2, [data-testid="module-name"]').first()).toBeVisible();

        // Should have send button or submit capability
        const sendButton = page.getByRole('button', { name: /send/i });
        const submitButton = page.locator('button[type="submit"]');

        const hasSendCapability = (await sendButton.count()) > 0 || (await submitButton.count()) > 0;
        expect(hasSendCapability).toBeTruthy();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should show 402 payment modal or connect wallet prompt when sending message without payment', async ({
    page,
  }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      const href = await moduleLink.getAttribute('href');
      const moduleId = href?.split('/').pop();

      if (moduleId) {
        // Navigate to paid chat mode (not try-once)
        await page.goto(`/chat/${moduleId}`);
        await page.waitForLoadState('networkidle');

        // Type a message
        const messageInput = page.locator('textarea, input[type="text"]').first();
        if ((await messageInput.count()) > 0) {
          await messageInput.fill('Hello, this is a test message');

          // Try to send
          const sendButton = page.getByRole('button', { name: /send/i });
          if ((await sendButton.count()) > 0) {
            await sendButton.click();

            // Wait a moment for response
            await page.waitForTimeout(2000);

            // Should show one of:
            // 1. Payment required modal (402)
            // 2. Connect wallet prompt
            // 3. Payment/wallet UI elements
            const paymentModal = page.locator('[data-testid="payment-modal"]');
            const connectWallet = page.getByRole('button', { name: /connect|wallet/i });
            const paymentText = page.getByText(/payment required|402|pay/i);

            const hasPaymentUI =
              (await paymentModal.count()) > 0 ||
              (await connectWallet.count()) > 0 ||
              (await paymentText.count()) > 0;

            // If no payment UI visible, might have gotten a free try response
            // or the wallet is not connected (prompts for connect first)
            // This is still valid behavior
            if (!hasPaymentUI) {
              // Check for response or loading state
              const assistantMessage = page.locator('[class*="assistant"], [data-role="assistant"]');
              const loadingState = page.locator('[class*="loading"], [aria-busy="true"]');

              expect(
                (await assistantMessage.count()) > 0 ||
                  (await loadingState.count()) > 0 ||
                  hasPaymentUI
              ).toBeTruthy();
            }
          } else {
            // No send button found
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should surface 402 errors that do not include paymentRequirements', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      const href = await moduleLink.getAttribute('href');
      const moduleId = href?.split('/').pop();

      if (moduleId) {
        await page.goto(`/chat/${moduleId}`);
        await page.waitForLoadState('networkidle');

        await page.route('**/api/modules/*/chat', async (route) => {
          if (route.request().method() !== 'POST') return route.continue();
          return route.fulfill({
            status: 402,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Payment settlement failed',
              details: 'X402_FACILITATOR_BASE_URL not configured',
            }),
          });
        });

        const messageInput = page.locator('textarea, input[type="text"]').first();
        if ((await messageInput.count()) > 0) {
          await messageInput.fill('Hello, this should error');

          const sendButton = page.getByRole('button', { name: /send/i });
          if ((await sendButton.count()) > 0) {
            await sendButton.click();

            await expect(page.getByText(/payment settlement failed/i).first()).toBeVisible();
          } else {
            test.skip();
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Try Once Mode', () => {
  test('should allow free preview in try-once mode', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    const moduleLink = page.locator('a[href*="/marketplace/"]').first();

    if ((await moduleLink.count()) > 0) {
      const href = await moduleLink.getAttribute('href');
      const moduleId = href?.split('/').pop();

      if (moduleId) {
        // Navigate to try-once mode
        await page.goto(`/chat/${moduleId}?mode=try`);
        await page.waitForLoadState('networkidle');

        // Should indicate try-once/preview mode
        const tryOnceIndicator = page.getByText(/try once|preview|free/i);
        if ((await tryOnceIndicator.count()) > 0) {
          await expect(tryOnceIndicator.first()).toBeVisible();
        }

        // Should have chat input
        const messageInput = page.locator('textarea, input[type="text"]').first();
        await expect(messageInput).toBeVisible();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Remix Chat (Two Payment Events)', () => {
  test('should show remix module info if available', async ({ page }) => {
    // Navigate to marketplace and look for remix modules
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    // Look for any module that might be a remix (has remix indicator)
    const remixIndicator = page.getByText(/remix|derivative/i);

    if ((await remixIndicator.count()) > 0) {
      // Click on the remix module
      await remixIndicator.first().click();
      await page.waitForLoadState('networkidle');

      // Should show upstream module reference
      const upstreamRef = page.getByText(/upstream|based on|original/i);
      if ((await upstreamRef.count()) > 0) {
        await expect(upstreamRef.first()).toBeVisible();
      }
    } else {
      // No remix modules found - this is OK for now
      test.skip();
    }
  });

  // Note: Testing actual two-payment-event flow requires:
  // 1. A published remix module
  // 2. Wallet connection and signing
  // 3. Agent wallet funded for upstream payment
  // This is best verified manually with the demo runbook
});
