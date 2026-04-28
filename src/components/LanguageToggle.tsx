import clsx from 'clsx';
import { useLanguage } from '../lib/LanguageContext';
import { LANG_OPTIONS } from '../lib/i18n';

interface Props {
  className?: string;
  compact?: boolean;
}

export default function LanguageToggle({ className, compact = false }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={clsx('flex flex-wrap gap-1', className)}
      aria-label="Language selector"
      role="group"
    >
      {LANG_OPTIONS.map(({ code, flag }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full font-semibold transition-colors border',
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
            lang === code
              ? 'bg-[#194121] text-white border-[#194121]'
              : 'bg-transparent text-[#5a6053] border-[#d8d4c7] hover:text-[#194121] hover:border-[#194121]',
          )}
        >
          <span>{flag}</span>
          <span>{code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
