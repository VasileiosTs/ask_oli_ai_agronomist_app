import clsx from 'clsx';
import { useLanguage } from '../lib/LanguageContext';
import type { Lang } from '../lib/i18n';

interface Props {
  className?: string;
  compact?: boolean;
}

const OPTIONS: Lang[] = ['el', 'en'];

export default function LanguageToggle({ className, compact = false }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={clsx(
        'inline-flex items-center rounded-full border border-[#d8d4c7] bg-white/80 p-1',
        className,
      )}
      aria-label="Language selector"
      role="group"
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          className={clsx(
            'rounded-full font-semibold transition-colors',
            compact ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            lang === option
              ? 'bg-[#194121] text-white'
              : 'text-[#5a6053] hover:text-[#194121]',
          )}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
