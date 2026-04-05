import { describe, it, expect } from 'vitest';
import { dict } from '../lib/i18n';
import type { T } from '../lib/i18n';

describe('i18n translations', () => {
  const elKeys = Object.keys(dict.el) as (keyof T)[];
  const enKeys = Object.keys(dict.en) as (keyof T)[];

  it('el and en have the same keys', () => {
    expect(elKeys.sort()).toEqual(enKeys.sort());
  });

  it('no empty string values in en', () => {
    for (const key of enKeys) {
      const val = dict.en[key];
      if (typeof val === 'string') {
        expect(val.length, `en.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('no empty string values in el', () => {
    for (const key of elKeys) {
      const val = dict.el[key];
      if (typeof val === 'string') {
        expect(val.length, `el.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('has all required legal page keys', () => {
    const legalKeys: (keyof T)[] = [
      'privacyDataTitle', 'privacyHowTitle', 'privacyStorageTitle',
      'privacyThirdTitle', 'privacyGdprTitle', 'privacyCookies',
      'termsNature', 'termsLiability', 'termsUse', 'termsAccounts',
      'termsIp', 'termsTermination', 'termsLaw',
    ];
    for (const key of legalKeys) {
      expect(dict.en[key], `en missing ${key}`).toBeDefined();
      expect(dict.el[key], `el missing ${key}`).toBeDefined();
    }
  });

  it('has all nav keys', () => {
    expect(dict.en.navChat).toBe('Chat');
    expect(dict.en.navHistory).toBe('History');
    expect(dict.en.navFields).toBe('Fields');
    expect(dict.en.navProfile).toBe('Profile');
  });

  it('has push notification keys', () => {
    expect(dict.en.pushPromptTitle).toBeDefined();
    expect(dict.en.pushPromptBody).toBeDefined();
    expect(dict.en.pushPromptEnable).toBeDefined();
  });
});

describe('i18next integration', () => {
  it('i18next resources match dict for en', async () => {
    // Dynamically import to avoid top-level side effects in test environment
    const { default: i18n } = await import('../lib/i18next');
    expect(i18n.getResourceBundle('en', 'translation')).toMatchObject({
      tagline: dict.en.tagline,
      navChat: dict.en.navChat,
      navProfile: dict.en.navProfile,
    });
  });

  it('i18next resources match dict for el', async () => {
    const { default: i18n } = await import('../lib/i18next');
    expect(i18n.getResourceBundle('el', 'translation')).toMatchObject({
      tagline: dict.el.tagline,
      navChat: dict.el.navChat,
    });
  });

  it('i18next t function returns correct string for en', async () => {
    const { default: i18n } = await import('../lib/i18next');
    await i18n.changeLanguage('en');
    expect(i18n.t('navChat')).toBe('Chat');
    expect(i18n.t('navProfile')).toBe('Profile');
  });

  it('i18next t function returns correct string for el', async () => {
    const { default: i18n } = await import('../lib/i18next');
    await i18n.changeLanguage('el');
    expect(i18n.t('navChat')).toBe('Συνομιλία');
  });
});
