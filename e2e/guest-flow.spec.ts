import { test, expect } from '@playwright/test';

test.describe('Guest chat flow', () => {
  test('submitting a question from landing navigates to /chat', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('My tomatoes have yellow leaves');
    await page.locator('button[aria-label="Send"], button[aria-label="Αποστολή"]').click();
    await expect(page).toHaveURL(/\/chat\?q=/);
  });

  test('chat page renders in guest mode with ?q= param', async ({ page }) => {
    await page.goto('/chat?q=My%20tomatoes%20have%20yellow%20leaves');
    // The chat container should be visible (not redirected to landing)
    await expect(page).not.toHaveURL('/');
    // Oli header should appear
    await expect(page.getByText('Oli').first()).toBeVisible();
  });

  test('direct /chat without ?q= redirects unauthenticated user to landing', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL('/');
  });

  test('guest mode shows sign in button', async ({ page }) => {
    await page.goto('/chat?q=test+question');
    const signInBtn = page.locator('button', { hasText: /Sign in|Σύνδεση/ });
    await expect(signInBtn).toBeVisible({ timeout: 5000 });
  });

  test('guest mode ?q= param is cleared from URL after auto-send', async ({ page }) => {
    await page.goto('/chat?q=My%20tomatoes%20have%20yellow%20leaves');
    // After Chat mounts and clears the param, URL should be /chat (not /chat?q=...)
    // We stay on /chat (not redirected) because guestEntry was set on mount
    await page.waitForURL('/chat', { timeout: 5000 });
    await expect(page).toHaveURL('/chat');
  });
});
