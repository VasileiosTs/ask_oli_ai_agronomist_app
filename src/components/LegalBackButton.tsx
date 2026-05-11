import { Link } from 'react-router-dom';
import { useLanguage } from '../lib/LanguageContext';

const LegalBackButton = () => {
  const { t } = useLanguage();
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 mb-6 text-sm text-muted hover:text-foreground transition-colors">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {t.notFoundHome}
    </Link>
  );
};

export default LegalBackButton;
