import { ClipboardList, X, Check } from 'lucide-react';

export interface ActionDetected {
  action_type: string;
  product?: string;
  quantity?: string;
  date_mentioned?: string;
  confidence: number;
}

interface Props {
  action: ActionDetected;
  lang: string;
  onConfirm: (action: ActionDetected) => void;
  onDismiss: () => void;
}

const ACTION_LABELS: Record<string, { el: string; en: string }> = {
  spray:         { el: 'Ψεκασμός', en: 'Spray' },
  fertilization: { el: 'Λίπανση', en: 'Fertilization' },
  irrigation:    { el: 'Πότισμα', en: 'Irrigation' },
  observation:   { el: 'Παρατήρηση', en: 'Observation' },
  harvest:       { el: 'Συγκομιδή', en: 'Harvest' },
};

export default function AutoLogBanner({ action, lang, onConfirm, onDismiss }: Props) {
  if (action.confidence < 0.7) return null;

  const label = ACTION_LABELS[action.action_type]?.[lang === 'el' ? 'el' : 'en'] ?? action.action_type;

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 animate-fade-in">
      <ClipboardList className="h-5 w-5 flex-shrink-0 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {lang === 'el' ? `Εντοπίστηκε: ${label}` : `Detected: ${label}`}
          {action.product && <span className="text-muted"> · {action.product}</span>}
        </p>
        <p className="text-xs text-muted">
          {lang === 'el' ? 'Θέλεις να το καταγράψω;' : 'Want me to log this?'}
        </p>
      </div>
      <button onClick={() => onConfirm(action)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={onDismiss}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
