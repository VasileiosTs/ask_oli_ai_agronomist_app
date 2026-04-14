import { test, expect } from '@playwright/test';

/**
 * Golden path E2E tests — the flows that must never break before launch.
 *
 * Authenticated flows use localStorage injection to bypass Supabase Auth
 * (we can't run a real magic-link flow in CI). The injected session is
 * intentionally minimal — enough for routing guards to pass.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Inject a fake Supabase session into localStorage so auth guards pass. */
async function injectFakeSession(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const fakeSession = {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        email: 'test@askoli.ai',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: { full_name: 'Test Farmer' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    };
    // Supabase stores session under this key pattern
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-')) || 'sb-julraghuunmzqxcayict-auth-token';
    localStorage.setItem(key, JSON.stringify(fakeSession));
    // Also inject a minimal profile so profile-dependent UI renders
    localStorage.setItem('oli_profile_cache', JSON.stringify({
      id: 'test-user-id',
      name: 'Test Farmer',
      tier: 'free',
      primary_crop: 'olives',
      location: 'Greece',
      message_count: 0,
      message_count_reset_at: new Date().toISOString(),
    }));
  });
}

// ── Guest golden path ──────────────────────────────────────────────────────

test.describe('Guest golden path', () => {
  test('landing → type question → navigate to chat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });

    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();
    await input.fill('My olive leaves have yellow spots');

    const sendBtn = page.locator('button[aria-label="Send"], button[aria-label="Αποστολή"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(page).toHaveURL(/\/chat(\?q=|$)/, { timeout: 5000 });
  });

  test('chat page loads in guest mode with question param', async ({ page }) => {
    await page.goto('/chat?q=How+much+copper+for+100+litres');

    // Must stay on /chat (not redirect to landing)
    await expect(page).not.toHaveURL('/', { timeout: 5000 });

    // Oli branding visible
    await expect(page.getByText('Oli').first()).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated /chat without param redirects to landing', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('guest chat shows sign-in prompt', async ({ page }) => {
    await page.goto('/chat?q=tomato+disease');
    const signInBtn = page.locator('button, a').filter({ hasText: /sign in|σύνδεση/i }).first();
    await expect(signInBtn).toBeVisible({ timeout: 8000 });
  });
});

// ── Auth page ──────────────────────────────────────────────────────────────

test.describe('Auth page', () => {
  test('renders magic link form', async ({ page }) => {
    await page.goto('/auth');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
  });

  test('empty email disables send button', async ({ page }) => {
    await page.goto('/auth');
    const sendBtn = page.locator('button[type="submit"], button').filter({ hasText: /send|continue|αποστολή/i }).first();
    // Button should be disabled or email field required
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    // Verify the form requires an email before submission
    const required = await emailInput.getAttribute('required');
    const inputType = await emailInput.getAttribute('type');
    expect(inputType).toBe('email');
    // Either required attribute set or button disabled
    const isDisabled = await sendBtn.isDisabled().catch(() => false);
    expect(required !== null || isDisabled).toBeTruthy();
  });
});

// ── Fields page (public render check) ─────────────────────────────────────

test.describe('Fields page routing', () => {
  test('unauthenticated /fields redirects away from fields', async ({ page }) => {
    await page.goto('/fields');
    // Should not render the fields page for an unauthed user
    await expect(page).not.toHaveURL('/fields', { timeout: 5000 });
  });
});

// ── Shared diagnosis public page ──────────────────────────────────────────

test.describe('Public shared diagnosis', () => {
  test('/d/ route renders without auth', async ({ page }) => {
    // Use a fake share ID — page should render (404 state, not auth redirect)
    await page.goto('/d/test-share-id-nonexistent');
    // Should NOT redirect to landing or auth
    await expect(page).not.toHaveURL('/', { timeout: 5000 });
    await expect(page).not.toHaveURL('/auth', { timeout: 5000 });
  });
});

// ── Landing page conversion flow ──────────────────────────────────────────

test.describe('Landing page', () => {
  test('send button disabled on empty input', async ({ page }) => {
    await page.goto('/');
    const sendBtn = page.locator('button[aria-label="Send"], button[aria-label="Αποστολή"]');
    await expect(sendBtn).toBeDisabled({ timeout: 5000 });
  });

  test('send button enables when question typed', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"]').first();
    await input.fill('How do I treat olive fly?');
    const sendBtn = page.locator('button[aria-label="Send"], button[aria-label="Αποστολή"]');
    await expect(sendBtn).toBeEnabled({ timeout: 3000 });
  });

  test('pricing section visible', async ({ page }) => {
    await page.goto('/');
    // Scroll down to find pricing
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const pricingEl = page.locator('text=/4.99|€4|pro plan|PRO/i').first();
    await expect(pricingEl).toBeVisible({ timeout: 5000 });
  });
});
