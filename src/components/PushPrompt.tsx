import { useState, useEffect } from 'react';
import { BellRing, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { usePushSubscription } from '../hooks/usePushSubscription';

const DISMISS_KEY = 'oli_push_prompt_dismissed';

interface Props {
  userId: string | null;
  messageCount: number;
}

export default function PushPrompt({ userId, messageCount }: Props) {
  const { t } = useLanguage();
  const push = usePushSubscription(userId);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Show after first AI response (messageCount >= 2 means at least 1 exchange)
    // Only if push is supported, not already subscribed, and not previously dismissed
    const wasDismissed = localStorage.getItem(DISMISS_KEY);
    if (!wasDismissed && push.isSupported && !push.isSubscribed && push.permission !== 'denied' && messageCount >= 2) {
      setDismissed(false);
    }
  }, [messageCount, push.isSupported, push.isSubscribed, push.permission]);

  if (dismissed) return null;

  const handleEnable = async () => {
    await push.subscribe();
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <BellRing className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t.pushPromptTitle}</p>
          <p className="mt-0.5 text-xs text-muted">{t.pushPromptBody}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              disabled={push.loading}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t.pushPromptEnable}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-full border border-border/50 bg-surface px-4 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              {t.pushPromptLater}
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 rounded-full p-1 text-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
