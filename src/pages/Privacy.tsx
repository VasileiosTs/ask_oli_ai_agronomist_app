import { useLanguage } from '../lib/LanguageContext';
import LegalBackButton from '../components/LegalBackButton';

const Privacy = () => {
  const { t } = useLanguage();
  const h2 = "text-base font-semibold text-foreground mt-4";
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <LegalBackButton />
      <h1 className="mb-6 text-2xl font-bold">{t.privacyPolicy}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p className="text-xs text-muted">{t.legalUpdated}</p>
        <h2 className={h2}>1. {t.privacyDataTitle}</h2>
        <p>{t.privacyDataAccount}</p><p>{t.privacyDataUsage}</p><p>{t.privacyDataTech}</p>
        <h2 className={h2}>2. {t.privacyHowTitle}</h2>
        <p>{t.privacyHowBody}</p>
        <h2 className={h2}>3. {t.privacyStorageTitle}</h2>
        <p>{t.privacyStorageBody}</p><p><strong className="text-foreground">Row Level Security:</strong> {t.privacyStorageRls}</p>
        <h2 className={h2}>4. {t.privacyThirdTitle}</h2>
        <p><strong className="text-foreground">Google Gemini:</strong> {t.privacyGemini}</p>
        <p><strong className="text-foreground">Sentry:</strong> {t.privacySentry}</p>
        <p><strong className="text-foreground">PostHog:</strong> {t.privacyPostHog}</p>
        <p><strong className="text-foreground">Vercel:</strong> {t.privacyVercel}</p>
        <h2 className={h2}>5. {t.privacyGdprTitle}</h2>
        <p>{t.privacyGdprAccess}</p><p>{t.privacyGdprDelete}</p><p>{t.privacyGdprCorrect}</p><p>{t.privacyGdprPortability}</p>
        <h2 className={h2}>6. Cookies</h2>
        <p>{t.privacyCookies}</p>
        <h2 className={h2}>7. {t.privacyAge}</h2>
        <h2 className={h2}>8. {t.privacyContact}</h2>
        <p><a href="mailto:hello@ask-oli.com" className="text-primary hover:underline">hello@ask-oli.com</a></p>
      </div>
    </div>
  );
};

export default Privacy;
