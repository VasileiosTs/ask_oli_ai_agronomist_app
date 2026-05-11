import { useLanguage } from '../lib/LanguageContext';
import LegalBackButton from '../components/LegalBackButton';

const Terms = () => {
  const { t } = useLanguage();
  const h2 = "text-base font-semibold text-foreground mt-4";
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <LegalBackButton />
      <h1 className="mb-6 text-2xl font-bold">{t.termsOfService}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p className="text-xs text-muted">{t.legalUpdated}</p>
        <h2 className={h2}>1. {t.termsNature}</h2><p>{t.termsNatureBody}</p>
        <h2 className={h2}>2. {t.termsLiability}</h2><p>{t.termsLiabilityBody}</p>
        <h2 className={h2}>3. {t.termsUse}</h2><p>{t.termsUseBody}</p>
        <h2 className={h2}>4. {t.termsAccounts}</h2><p>{t.termsAccountsBody}</p>
        <h2 className={h2}>5. {t.termsIp}</h2><p>{t.termsIpBody}</p>
        <h2 className={h2}>6. {t.termsTermination}</h2><p>{t.termsTerminationBody}</p>
        <h2 className={h2}>7. {t.termsLaw}</h2><p>{t.termsLawBody}</p>
        <h2 className={h2}>8. {t.privacyContact}</h2>
        <p><a href="mailto:hello@ask-oli.com" className="text-primary hover:underline">hello@ask-oli.com</a></p>
      </div>
    </div>
  );
};

export default Terms;
