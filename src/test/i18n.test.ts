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
