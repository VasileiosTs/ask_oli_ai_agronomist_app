import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders hero heading and chat input', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    const input = page.locator('input[type="text"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-label');
  });

  test('chat input has accessible label', async ({ page }) => {
    const input = page.locator('input[type="text"]');
    const label = await input.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label!.length).toBeGreaterThan(5);
  });

  test('heading order is correct: H1 before H2 before H3', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3').all();
    const tags = await Promise.all(headings.map((h) => h.evaluate((el) => el.tagName)));
    const firstH1 = tags.indexOf('H1');
    const firstH2 = tags.indexOf('H2');
    const firstH3 = tags.indexOf('H3');
    // H1 must exist and appear before H3
    expect(firstH1).toBeGreaterThanOrEqual(0);
    expect(firstH3).toBeGreaterThan(firstH1);
    // H2 must appear before H3
    if (firstH2 >= 0) {
      expect(firstH2).toBeLessThan(firstH3);
    }
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    const sendBtn = page.locator('button[aria-label="Send"], button[aria-label="Αποστολή"]');
    await expect(sendBtn).toBeDisabled();
  });

  test('send button enables when input has text', async ({ page }) => {
    await page.locator('input[type="text"]').fill('My tomatoes have brown spots');
    const sendBtn = page.locator('button[aria-label="Send"], button[aria-label="Αποστολή"]');
    await expect(sendBtn).toBeEnabled();
  });

  test('language toggle switches between EN and EL', async ({ page }) => {
    // Default is EN (app detects browser language, but test env defaults to EL or EN)
    const toggle = page.locator('button', { hasText: /^(EN|EL)$/ });
    await expect(toggle).toBeVisible();
    const initialText = await toggle.textContent();
    await toggle.click();
    const newText = await toggle.textContent();
    expect(newText).not.toEqual(initialText);
  });

  test('feature cards are visible', async ({ page }) => {
    await expect(page.locator('h3').first()).toBeVisible();
    const cards = page.locator('section').nth(1).locator('div[class*="rounded-2xl"]');
    await expect(cards).toHaveCount(3);
  });
});
