import { useLanguage } from '../lib/LanguageContext';

export type VioFollowUp = {
  id: string;
  fieldId: string | null;
  fieldName: string | null;
  cropLabel: string;
  problemLabel: string | null;
  productApplied: string | null;
  daysAgo: number | null;
  vioStepType: 'apply_check' | 'outcome_check';
};

type Props = {
  item: VioFollowUp;
  onApply: (id: string, applied: boolean) => void;
  onOutcome: (id: string, outcome: 'better' | 'same' | 'worse' | 'not_applied') => void;
  onOpen: (fieldId: string) => void;
  onDismiss: (id: string) => void;
  className?: string;
};

function loggedAgoText(daysAgo: number | null, lang: string): string {
  if (daysAgo === null) return lang === 'el' ? 'καταγράφηκε πρόσφατα' : 'logged recently';
  if (daysAgo <= 0) return lang === 'el' ? 'καταγράφηκε σήμερα' : 'logged today';
  if (daysAgo === 1) return lang === 'el' ? 'καταγράφηκε χθες' : 'logged yesterday';
  return lang === 'el' ? `καταγράφηκε πριν ${daysAgo} μέρες` : `logged ${daysAgo} days ago`;
}

export default function VioFollowUpCard({ item, onApply, onOutcome, onOpen, onDismiss, className = '' }: Props) {
  const { lang } = useLanguage();

  const showCrop = item.cropLabel && item.cropLabel !== item.fieldName;
  const metaParts = [item.problemLabel, loggedAgoText(item.daysAgo, lang)].filter(Boolean);
  const question = item.vioStepType === 'apply_check'
    ? (lang === 'el' ? 'Εφάρμοσες τη θεραπεία;' : 'Did you apply the treatment?')
    : (lang === 'el'
        ? `Βλέπεις βελτίωση${item.productApplied ? ` μετά το ${item.productApplied}` : ''};`
        : `Any improvement${item.productApplied ? ` after ${item.productApplied}` : ''}?`);

  const headline = (
    <>
      <span className="block text-sm leading-snug text-foreground">
        <strong>{item.fieldName || item.cropLabel}</strong>
        {item.fieldName && showCrop && <span className="text-muted"> · {item.cropLabel}</span>}
      </span>
      {metaParts.length > 0 && (
        <span className="mt-0.5 block text-xs text-muted">{metaParts.join(' · ')}</span>
      )}
      <span className="mt-1 block text-xs text-foreground">{question}</span>
    </>
  );

  return (
    <div className={`rounded-2xl border border-primary/30 bg-primary/6 p-4 flex-shrink-0 ${className}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {lang === 'el' ? '🌿 Ενημέρωση θεραπείας' : '🌿 Treatment update'}
        </p>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-muted hover:text-foreground transition-colors text-lg leading-none"
          aria-label={lang === 'el' ? 'Απόρριψη' : 'Dismiss'}
        >×</button>
      </div>

      {item.fieldId ? (
        <button
          onClick={() => onOpen(item.fieldId as string)}
          className="group mb-3 -mx-1 block w-full rounded-lg px-1 py-1 text-left transition-colors hover:bg-primary/5"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">{headline}</span>
            <span className="mt-0.5 text-base leading-none text-primary opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true">›</span>
          </span>
        </button>
      ) : (
        <div className="mb-3">{headline}</div>
      )}

      {item.vioStepType === 'apply_check' ? (
        <div className="flex gap-2">
          <button
            onClick={() => onApply(item.id, true)}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
          >{lang === 'el' ? 'Ναι, εφάρμοσα' : 'Yes, I applied'}</button>
          <button
            onClick={() => onApply(item.id, false)}
            className="rounded-full border border-border/50 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted/10 transition-colors"
          >{lang === 'el' ? 'Όχι ακόμα' : 'Not yet'}</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(['better', 'same', 'worse', 'not_applied'] as const).map(v => (
            <button key={v}
              onClick={() => onOutcome(item.id, v)}
              className="rounded-full border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {lang === 'el'
                ? { better: 'Βελτίωση', same: 'Ίδια', worse: 'Χειρότερα', not_applied: 'Δεν εφάρμοσα' }[v]
                : { better: 'Better', same: 'No change', worse: 'Worse', not_applied: "Didn't apply" }[v]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
